/**
 * 基于萌娘百科内容重写 bangumi-* 自动发文（一次性批处理 + 可复用维护工具）
 * ─────────────────────────────────────────────────────────────────────────────
 * 对 src/content/posts/bangumi-*.md 逐篇执行：
 *   1. 通过 scripts/moegirl/scraper.mjs 抓取对应萌娘百科条目的完整介绍；
 *   2. 用萌娘百科导言重写 frontmatter description 与正文「一、作品概述」；
 *   3. 用萌娘百科「剧情简介」章节重写正文「三、剧情简介」（抓不到则保留原文）；
 *   4. 重建具有独特性的标签（作品名置顶 + 题材 + 形式 + 制作公司 + Bangumi）；
 *   5. 重建每篇独立的短语式分类（《作品名》+ 主题材），对齐自主编辑文章标准；
 *   6. 保留其余全部内容：基础信息、主要角色、制作阵容、看点、评价、图片、
 *      sourceLink、alias、发布日期等一律不动。
 *
 * 用法：
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs             # 全量重写（带缓存）
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --dry-run   # 只打印变更摘要不写文件
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --only 104196,4255
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --meta-only # 只更新标签/分类/description
 *
 * 注意：本脚本不修改 generate-bangumi-daily-post.mjs 的核心发文逻辑；
 * 萌娘百科内容遵循 CC BY-NC-SA 3.0 CN，正文已保留出处链接。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	fetchMoegirlArticleForWork,
	findStorySection,
} from "./scraper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");

const DRY_RUN = process.argv.includes("--dry-run");
const META_ONLY = process.argv.includes("--meta-only");
const onlyArg = process.argv.find((a) => a.startsWith("--only=")) ||
	process.argv[process.argv.indexOf("--only") + 1]?.match(/^[\d,]+$/)?.[0];
const ONLY_IDS = onlyArg
	? new Set(String(onlyArg).replace("--only=", "").split(",").map((s) => s.trim()))
	: null;

const FORM_TAGS = new Set(["TV", "OVA", "OAD", "剧场版", "电影", "Web", "SP", "特别篇"]);
const SKIP_TAG = [/^\d{4}/, /^星期/, /^周[一二三四五六日]/];

/** 题材词表：只有命中词表的 CJK 标签才算"题材"，避免把导演/公司/人名当题材 */
const GENRE_VOCAB = new Set([
	"恋爱", "恋爱喜剧", "青春恋爱", "校园恋爱", "纯爱", "后宫", "百合", "耽美",
	"搞笑", "喜剧", "轻喜剧", "浪漫喜剧", "日常", "校园", "职场", "青春", "成长",
	"异世界", "转生", "穿越", "轮回", "奇幻", "魔幻", "科幻", "机战", "战斗", "热血",
	"冒险", "悬疑", "推理", "恐怖", "惊悚", "治愈", "催泪", "音乐", "偶像", "运动",
	"美食", "种田", "经营", "历史", "战争", "妖魔", "吸血鬼", "龙", "伪娘", "萝莉",
	"妹系", "姐系", "傲娇", "病娇", "龙傲天", "爽文", "智斗", "装逼", "群像剧",
	"家庭", "亲情", "友情", "轻小说改", "小说改", "漫画改", "漫改", "游戏改", "GAL改",
	"原创", "轻小说", "漫画", "轻改", "泡面番", "里番", "肉番", "R18", "萌系", "宅系",
	"家庭喜剧", "新婚生活", "经济", "领地经营", "动画化", "奇幻冒险", "奇幻恋爱",
]);

/** 判断一个标签是否"题材"（命中词表或包含词表词） */
function isGenreTag(tag) {
	if (GENRE_VOCAB.has(tag)) return true;
	for (const word of GENRE_VOCAB) {
		if (word.length >= 2 && tag.includes(word) && tag.length <= word.length + 3) return true;
	}
	return false;
}

const CJK_RE = /[一-鿿]/;

function splitTags(raw) {
	const m = raw.match(/^tags:\s*\[([\s\S]*?)\]/m);
	if (!m) return [];
	return m[1]
		.split(",")
		.map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
		.filter(Boolean);
}

function getField(fm, name) {
	const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
	return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

/** 标签重建：作品名置顶，题材 ≤3，形式 ≤1，制作公司 ≤1，Bangumi 收尾 */
export function rebuildTags(shortTitle, oldTags) {
	const genres = [];
	const forms = [];
	const others = [];
	for (const tag of oldTags) {
		if (!tag || /^Bangumi$/i.test(tag) || SKIP_TAG.some((re) => re.test(tag)) || tag === shortTitle) continue;
		if (FORM_TAGS.has(tag)) {
			forms.push(tag);
		} else if (isGenreTag(tag)) {
			genres.push(tag);
		} else {
			others.push(tag);
		}
	}
	const tags = [shortTitle, ...genres.slice(0, 3), ...forms.slice(0, 1), ...others.slice(0, 1), "Bangumi"];
	return [...new Set(tags)].slice(0, 7);
}

/** 分类重建：每篇独立的短语式分类 */
export function rebuildCategory(shortTitle, newTags) {
	const genre = newTags.find((t) => t !== shortTitle && t !== "Bangumi" && !FORM_TAGS.has(t));
	return genre ? `《${shortTitle}》${genre}` : `《${shortTitle}》作品介绍`;
}

function truncate(text, max = 120) {
	const clean = String(text || "").replace(/\s+/g, " ").trim();
	if (clean.length <= max) return clean;
	return `${clean.slice(0, max)}…`;
}

/** 在正文中替换两个 ## 小节之间的内容（保留小节标题） */
function replaceSection(body, startHeading, endHeadings, replacement) {
	const startIdx = body.indexOf(startHeading);
	if (startIdx < 0) return { body, replaced: false };
	let endIdx = -1;
	for (const end of endHeadings) {
		const idx = body.indexOf(end, startIdx + startHeading.length);
		if (idx > 0 && (endIdx < 0 || idx < endIdx)) endIdx = idx;
	}
	if (endIdx < 0) return { body, replaced: false };
	const head = body.slice(0, startIdx + startHeading.length);
	const tail = body.slice(endIdx);
	return { body: `${head}\n\n${replacement}\n\n${tail}`, replaced: true };
}

async function processPost(file) {
	const fullPath = path.join(POSTS_DIR, file);
	const raw = await fs.readFile(fullPath, "utf8");
	const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return { file, status: "skip", reason: "no frontmatter" };
	const fm = fmMatch[1];
	let body = raw.slice(fmMatch[0].length).replace(/^\r?\n/, "");

	const rawTitle = getField(fm, "title");
	const shortTitle = rawTitle.replace(/^《|》$/g, "").trim();
	if (!shortTitle) return { file, status: "skip", reason: "no title" };

	const oldTags = splitTags(fm);
	const newTags = rebuildTags(shortTitle, oldTags);
	const newCategory = rebuildCategory(shortTitle, newTags);

	let article = await fetchMoegirlArticleForWork(shortTitle).catch((e) => {
		console.warn(`  ⚠ ${file}: 萌娘百科抓取失败 ${e.message}`);
		return null;
	});
	// 兜底：中文名未命中时用正文里的「原作标题」（日文原名）再试一次
	if (!article) {
		const originalTitle = body.match(/^- \*\*原作标题\*\*：(.+)$/m)?.[1]?.trim();
		if (originalTitle && originalTitle !== shortTitle) {
			article = await fetchMoegirlArticleForWork(originalTitle).catch(() => null);
		}
	}

	// description：优先萌娘百科导言首段
	const introFirstPara = (article?.intro || "").split("\n\n")[0] || "";
	const newDescription = introFirstPara
		? truncate(introFirstPara)
		: getField(fm, "description");

	// ── frontmatter 重写（逐行替换，保留字段顺序）──
	let newFm = fm;
	newFm = newFm.replace(/^description:\s*.*$/m, `description: "${newDescription.replace(/"/g, "'")}"`);
	newFm = newFm.replace(/^tags:\s*\[[\s\S]*?\]/m, `tags: [${newTags.map((t) => `"${t}"`).join(", ")}]`);
	newFm = newFm.replace(/^category:\s*.*$/m, `category: "${newCategory.replace(/"/g, "'")}"`);

	// ── 正文重写 ──
	const changes = [];
	let overviewReplaced = false;
	let storyReplaced = false;
	if (!META_ONLY && article) {
		// 一、作品概述：萌娘百科导言（保留原有引导句与封面行之外的主体段落）
		const overviewText = [article.intro, article.sections.find((s) => /^(原作介绍|作品介绍|剧情简介)$/.test(s.heading))?.text]
			.filter(Boolean)
			.join("\n\n")
			.trim();
		if (overviewText.length >= 40) {
			const r = replaceSection(
				body,
				"## 一、作品概述",
				["## 二、基础信息"],
				`${overviewText}\n\n> 以上内容整理自[萌娘百科「${article.title}」条目](${article.pageUrl})（CC BY-NC-SA 3.0）。`,
			);
			// 保留原小节的封面图行
			if (r.replaced) {
				const oldSection = body.slice(body.indexOf("## 一、作品概述"), body.indexOf("## 二、基础信息"));
				const imageLine = oldSection.match(/^!\[.*$/m)?.[0];
				if (imageLine) {
					r.body = r.body.replace("## 二、基础信息", `${imageLine}\n\n## 二、基础信息`);
				}
				body = r.body;
				overviewReplaced = true;
			}
		}

		// 三、剧情简介：萌娘百科剧情章节
		const story = findStorySection(article);
		if (story && story.length >= 40) {
			const oldSectionStart = body.indexOf("## 三、剧情简介");
			const oldSectionEnd = body.indexOf("## 主要角色", oldSectionStart) > 0
				? body.indexOf("## 主要角色", oldSectionStart)
				: body.indexOf("## 四、", oldSectionStart);
			let closingPara = "";
			if (oldSectionStart >= 0 && oldSectionEnd > oldSectionStart) {
				const oldSection = body.slice(oldSectionStart, oldSectionEnd);
				const paras = oldSection.split("\n\n").filter((p) => p.trim());
				const last = paras[paras.length - 1] || "";
				if (last.includes("剧情设计颇具匠心") || last.includes("一大亮点")) {
					closingPara = `\n\n${last.trim()}`;
				}
			}
			const r = replaceSection(
				body,
				"## 三、剧情简介",
				["## 主要角色", "## 四、"],
				`${story}${closingPara}`,
			);
			if (r.replaced) {
				body = r.body;
				storyReplaced = true;
			}
		}

		// 基础信息里的题材标签行同步更新
		const oldTagsLine = oldTags.join(" / ");
		if (oldTagsLine && body.includes(oldTagsLine)) {
			body = body.replace(oldTagsLine, newTags.join(" / "));
		}
	}

	if (!overviewReplaced && !META_ONLY && !article) changes.push("moegirl-miss");
	const newRaw = `---\n${newFm}\n---\n\n${body.replace(/^\n+/, "")}`;

	const changed = newRaw !== raw;
	if (changed && !DRY_RUN) {
		await fs.writeFile(fullPath, newRaw, "utf8");
	}
	return {
		file,
		status: changed ? (DRY_RUN ? "would-change" : "rewritten") : "unchanged",
		moegirl: article ? article.title : null,
		category: newCategory,
		tags: newTags,
		overviewReplaced,
		storyReplaced,
		changes,
	};
}

async function main() {
	const files = (await fs.readdir(POSTS_DIR))
		.filter((f) => f.startsWith("bangumi-") && f.endsWith(".md"))
		.filter((f) => !ONLY_IDS || ONLY_IDS.has(f.replace(/\D/g, "")))
		.sort();
	console.log(`▶ 待处理 ${files.length} 篇 bangumi 自动发文${DRY_RUN ? "（dry-run）" : ""}${META_ONLY ? "（仅元数据）" : ""}`);

	const results = [];
	for (const file of files) {
		const r = await processPost(file);
		results.push(r);
		const flag = r.status === "rewritten" || r.status === "would-change" ? "✓" : "·";
		console.log(`${flag} ${file}  moegirl=${r.moegirl || "✗"}  cat=${r.category}  ${r.overviewReplaced ? "概述✓" : ""}${r.storyReplaced ? "剧情✓" : ""} ${r.changes.join(",")}`);
	}

	const miss = results.filter((r) => !r.moegirl);
	const summary = {
		total: results.length,
		changed: results.filter((r) => r.status !== "unchanged" && r.status !== "skip").length,
		moegirlHit: results.length - miss.length,
		moegirlMiss: miss.map((r) => r.file),
		storyReplaced: results.filter((r) => r.storyReplaced).length,
		overviewReplaced: results.filter((r) => r.overviewReplaced).length,
	};
	console.log("\n══ 汇总 ══");
	console.log(JSON.stringify(summary, null, 2));
	await fs.mkdir(path.join(ROOT_DIR, "reports"), { recursive: true });
	await fs.writeFile(
		path.join(ROOT_DIR, "reports", "moegirl-rewrite-latest.json"),
		JSON.stringify({ ranAt: new Date().toISOString(), dryRun: DRY_RUN, summary, results }, null, 2),
		"utf8",
	);
}

main().catch((e) => {
	console.error("✗ rewrite failed:", e);
	process.exit(1);
});
