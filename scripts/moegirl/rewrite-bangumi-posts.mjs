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
 * ── 自动生成内容 vs 人工编辑内容（防误覆盖保护机制）──────────────────────────
 * 本工具只拥有两个小节：「一、作品概述」与「三、剧情简介」。写入前会对每篇的每个
 * 受管小节做一次「来源判定」，只有判定为「机器生成且此后未被改动」才允许覆写：
 *
 *   protected      frontmatter 声明 `moegirlRewrite: false`        → 跳过（永久保护）
 *   clean          台账有机器写入摘要，且与当前内容一致             → 允许覆写
 *   modified       台账有机器基线，但当前内容已与基线不符           → 跳过（人工改过）
 *   legacy-verified 无台账基线，但重新生成的内容与现状逐字一致      → 允许覆写
 *   legacy-suspect 无台账基线，且与重新生成的内容不一致             → 跳过（疑似人工改过）
 *
 * 只要任一受管小节落在 blocking 状态（protected / modified / legacy-suspect），
 * 整篇文件都会被跳过，frontmatter 也不动 —— 保证人工编辑过的文章零改动。
 *
 * 台账 `scripts/moegirl/rewrite-ledger.json` 只记录「机器写入过什么」，随仓库提交，
 * 因此任何与台账不符的改动都会被识别为人工编辑。需要无视保护强制覆写时用 --force
 * （危险：请先提交工作区，以便随时回滚）。
 *
 * 用法：
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs             # 全量重写（带缓存）
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --dry-run   # 只打印变更摘要不写文件
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --only 104196,4255
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --meta-only # 只更新标签/分类/description
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --status    # 只做来源判定，不抓取不写入
 *   node scripts/moegirl/rewrite-bangumi-posts.mjs --force     # 无视保护强制覆写（危险）
 *
 * 注意：本脚本不修改 generate-bangumi-daily-post.mjs 的核心发文逻辑；
 * 萌娘百科内容遵循 CC BY-NC-SA 3.0 CN，正文已保留出处链接。
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMoegirlArticleForWork, findStorySection } from "./scraper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const LEDGER_PATH = path.join(__dirname, "rewrite-ledger.json");
const LEDGER_VERSION = 1;

const DRY_RUN = process.argv.includes("--dry-run");
const META_ONLY = process.argv.includes("--meta-only");
const STATUS_ONLY = process.argv.includes("--status");
const FORCE = process.argv.includes("--force");
const onlyArg =
	process.argv.find((a) => a.startsWith("--only=")) ||
	process.argv[process.argv.indexOf("--only") + 1]?.match(/^[\d,]+$/)?.[0];
const ONLY_IDS = onlyArg
	? new Set(
			String(onlyArg)
				.replace("--only=", "")
				.split(",")
				.map((s) => s.trim()),
		)
	: null;

/** 受管小节定义：标题 + 结束标题候选（用于切出小节正文） */
const MANAGED_SECTIONS = {
	overview: {
		label: "作品概述",
		heading: "## 一、作品概述",
		ends: ["## 二、基础信息"],
	},
	story: {
		label: "剧情简介",
		heading: "## 三、剧情简介",
		ends: ["## 主要角色", "## 四、"],
	},
};

/** 小节来源判定结果 */
export const STATE = {
	PROTECTED: "protected",
	CLEAN: "clean",
	MODIFIED: "modified",
	LEGACY_OK: "legacy-verified",
	LEGACY_SUSPECT: "legacy-suspect",
};

/** 落在这些状态的小节不允许被自动覆写 */
export const BLOCKING_STATES = new Set([
	STATE.PROTECTED,
	STATE.MODIFIED,
	STATE.LEGACY_SUSPECT,
]);

/** frontmatter 显式退出声明：moegirlRewrite: false */
const PROTECT_FIELD_RE = /^moegirlRewrite:\s*(false|0|no)\s*$/im;

const FORM_TAGS = new Set([
	"TV",
	"OVA",
	"OAD",
	"剧场版",
	"电影",
	"Web",
	"SP",
	"特别篇",
]);
const SKIP_TAG = [/^\d{4}/, /^星期/, /^周[一二三四五六日]/];

/** 题材词表：只有命中词表的 CJK 标签才算"题材"，避免把导演/公司/人名当题材 */
const GENRE_VOCAB = new Set([
	"恋爱",
	"恋爱喜剧",
	"青春恋爱",
	"校园恋爱",
	"纯爱",
	"后宫",
	"百合",
	"耽美",
	"搞笑",
	"喜剧",
	"轻喜剧",
	"浪漫喜剧",
	"日常",
	"校园",
	"职场",
	"青春",
	"成长",
	"异世界",
	"转生",
	"穿越",
	"轮回",
	"奇幻",
	"魔幻",
	"科幻",
	"机战",
	"战斗",
	"热血",
	"冒险",
	"悬疑",
	"推理",
	"恐怖",
	"惊悚",
	"治愈",
	"催泪",
	"音乐",
	"偶像",
	"运动",
	"美食",
	"种田",
	"经营",
	"历史",
	"战争",
	"妖魔",
	"吸血鬼",
	"龙",
	"伪娘",
	"萝莉",
	"妹系",
	"姐系",
	"傲娇",
	"病娇",
	"龙傲天",
	"爽文",
	"智斗",
	"装逼",
	"群像剧",
	"家庭",
	"亲情",
	"友情",
	"轻小说改",
	"小说改",
	"漫画改",
	"漫改",
	"游戏改",
	"GAL改",
	"原创",
	"轻小说",
	"漫画",
	"轻改",
	"泡面番",
	"里番",
	"肉番",
	"R18",
	"萌系",
	"宅系",
	"家庭喜剧",
	"新婚生活",
	"经济",
	"领地经营",
	"动画化",
	"奇幻冒险",
	"奇幻恋爱",
]);

/** 判断一个标签是否"题材"（命中词表或包含词表词） */
function isGenreTag(tag) {
	if (GENRE_VOCAB.has(tag)) return true;
	for (const word of GENRE_VOCAB) {
		if (word.length >= 2 && tag.includes(word) && tag.length <= word.length + 3)
			return true;
	}
	return false;
}

// ── 内容指纹：用于区分「机器写入的内容」与「人工改写的内容」──────────────────

/** 统一换行与首尾空白，消除 CRLF/尾随空格带来的假差异 */
export function normalizeManagedText(text) {
	return String(text || "")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+$/gm, "")
		.trim();
}

/**
 * 仅把 CRLF/CR 统一为 LF，不裁剪内容。
 * 用于写盘前归一化，保证仓库内文件换行符一致（见 .gitattributes）。
 */
export function toLfText(text) {
	return String(text ?? "").replace(/\r\n?/g, "\n");
}

/** 对受管内容取稳定摘要（sha256 前 16 位十六进制） */
export function digestOf(text) {
	return createHash("sha256")
		.update(normalizeManagedText(text), "utf8")
		.digest("hex")
		.slice(0, 16);
}

/** 从正文中切出某个小节的正文（不含小节标题） */
export function extractSectionBody(body, heading, endHeadings) {
	const startIdx = body.indexOf(heading);
	if (startIdx < 0) return null;
	let endIdx = -1;
	for (const end of endHeadings) {
		const idx = body.indexOf(end, startIdx + heading.length);
		if (idx > 0 && (endIdx < 0 || idx < endIdx)) endIdx = idx;
	}
	if (endIdx < 0) return null;
	return body.slice(startIdx + heading.length, endIdx);
}

/** 去掉封面图行后的受管正文（封面图由工具保留而非生成，不参与指纹） */
function stripCoverImage(sectionText) {
	return String(sectionText || "")
		.split("\n")
		.filter((line) => !/^!\[.*\]\(.*\)\s*$/.test(line.trim()))
		.join("\n");
}

/** 计算某篇某小节当前的受管内容指纹 */
export function currentSectionDigest(body, key) {
	const spec = MANAGED_SECTIONS[key];
	const sectionText = extractSectionBody(body, spec.heading, spec.ends);
	if (sectionText === null) return null;
	return digestOf(stripCoverImage(sectionText));
}

/**
 * 判定单个小节的来源。
 * @returns {{ state: string, reason: string }}
 */
export function classifySection({
	protectedByFrontmatter,
	ledgerEntry,
	currentDigest,
	regeneratedDigest,
}) {
	if (protectedByFrontmatter) {
		return {
			state: STATE.PROTECTED,
			reason: "frontmatter 声明 moegirlRewrite: false",
		};
	}
	if (currentDigest === null) {
		// 小节不存在：无内容可保护，允许工具新建
		return { state: STATE.CLEAN, reason: "小节缺失，可新建" };
	}
	if (ledgerEntry?.origin === "generated") {
		if (ledgerEntry.digest === currentDigest) {
			return { state: STATE.CLEAN, reason: "与台账中的机器写入摘要一致" };
		}
		return {
			state: STATE.MODIFIED,
			reason: "内容与台账基线不符，判定为人工编辑",
		};
	}
	// 无机器基线：用「重新生成的内容」做一次逐字比对
	if (regeneratedDigest === null) {
		return {
			state: STATE.LEGACY_SUSPECT,
			reason: "无台账基线且无法重新生成比对",
		};
	}
	if (regeneratedDigest === currentDigest) {
		return { state: STATE.LEGACY_OK, reason: "与重新生成结果逐字一致" };
	}
	return {
		state: STATE.LEGACY_SUSPECT,
		reason: "与重新生成结果不一致，疑似人工编辑",
	};
}

// ── 台账读写 ────────────────────────────────────────────────────────────────

async function readLedger() {
	try {
		const raw = await fs.readFile(LEDGER_PATH, "utf8");
		const parsed = JSON.parse(raw);
		if (
			parsed?.version !== LEDGER_VERSION ||
			typeof parsed.files !== "object"
		) {
			return { version: LEDGER_VERSION, updatedAt: null, files: {} };
		}
		return {
			version: LEDGER_VERSION,
			updatedAt: parsed.updatedAt ?? null,
			files: parsed.files,
		};
	} catch {
		return { version: LEDGER_VERSION, updatedAt: null, files: {} };
	}
}

async function writeLedger(ledger) {
	ledger.updatedAt = new Date().toISOString();
	await fs.writeFile(
		LEDGER_PATH,
		`${JSON.stringify(ledger, null, 2)}\n`,
		"utf8",
	);
}

/** 记录/更新某篇某小节的机器写入摘要 */
function recordLedgerEntry(ledger, file, key, { digest, source }) {
	if (!ledger.files[file]) ledger.files[file] = { sections: {} };
	const entry = ledger.files[file];
	entry.sections[key] = {
		digest,
		source,
		writtenAt: new Date().toISOString(),
		origin: "generated",
	};
}

/** 清理台账中已不存在文章的条目 */
function pruneLedger(ledger, existingFiles) {
	let removed = 0;
	for (const file of Object.keys(ledger.files)) {
		if (!existingFiles.has(file)) {
			delete ledger.files[file];
			removed++;
		}
	}
	return removed;
}

// ── 标签 / 分类 / frontmatter ───────────────────────────────────────────────

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
		if (
			!tag ||
			/^Bangumi$/i.test(tag) ||
			SKIP_TAG.some((re) => re.test(tag)) ||
			tag === shortTitle
		)
			continue;
		if (FORM_TAGS.has(tag)) {
			forms.push(tag);
		} else if (isGenreTag(tag)) {
			genres.push(tag);
		} else {
			others.push(tag);
		}
	}
	const tags = [
		shortTitle,
		...genres.slice(0, 3),
		...forms.slice(0, 1),
		...others.slice(0, 1),
		"Bangumi",
	];
	return [...new Set(tags)].slice(0, 7);
}

/** 分类重建：每篇独立的短语式分类 */
export function rebuildCategory(shortTitle, newTags) {
	const genre = newTags.find(
		(t) => t !== shortTitle && t !== "Bangumi" && !FORM_TAGS.has(t),
	);
	return genre ? `《${shortTitle}》${genre}` : `《${shortTitle}》作品介绍`;
}

function truncate(text, max = 120) {
	const clean = String(text || "")
		.replace(/\s+/g, " ")
		.trim();
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

// ── 受管内容的生成（写入与比对共用同一份构造逻辑，保证可比性）────────────────

/** 「作品概述」的受管内容：萌娘百科导言 + 原作介绍 + 出处链接 */
function buildOverviewManaged(article) {
	const extra = article.sections.find((s) =>
		/^(原作介绍|作品介绍|剧情简介)$/.test(s.heading),
	)?.text;
	const overviewText = [article.intro, extra]
		.filter(Boolean)
		.join("\n\n")
		.trim();
	if (overviewText.length < 40) return null;
	const attribution = `> 以上内容整理自[萌娘百科「${article.title}」条目](${article.pageUrl})（CC BY-NC-SA 3.0）。`;
	return {
		managed: `${overviewText}\n\n${attribution}`,
		source: article.pageUrl,
	};
}

/** 「剧情简介」的受管内容：萌娘百科剧情章节（保留原文收尾点评段） */
function buildStoryManaged(article, currentSectionText) {
	const story = findStorySection(article);
	if (!story || story.length < 40) return null;
	const paras = String(currentSectionText || "")
		.split("\n\n")
		.filter((p) => p.trim());
	const last = paras[paras.length - 1] || "";
	const keepClosing =
		last.includes("剧情设计颇具匠心") || last.includes("一大亮点")
			? `\n\n${last.trim()}`
			: "";
	return { managed: `${story}${keepClosing}`, source: article.pageUrl };
}

// ── 单篇处理 ────────────────────────────────────────────────────────────────

async function processPost(file, ledger) {
	const fullPath = path.join(POSTS_DIR, file);
	const raw = await fs.readFile(fullPath, "utf8");
	const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return { file, status: "skip", reason: "no frontmatter" };
	const fm = fmMatch[1];
	const body = raw.slice(fmMatch[0].length).replace(/^\r?\n/, "");

	const rawTitle = getField(fm, "title");
	const shortTitle = rawTitle.replace(/^《|》$/g, "").trim();
	if (!shortTitle) return { file, status: "skip", reason: "no title" };

	const oldTags = splitTags(fm);
	const newTags = rebuildTags(shortTitle, oldTags);
	const newCategory = rebuildCategory(shortTitle, newTags);

	// ── 第 1 步：来源判定 ──
	const protectedByFrontmatter = PROTECT_FIELD_RE.test(fm);
	const ledgerSections = ledger.files[file]?.sections ?? {};

	// 需要重新生成内容时（legacy 比对或实际写入）才抓取；--status 只跳过写入而非抓取
	const needArticle = !META_ONLY;
	let article = null;
	if (needArticle) {
		article = await fetchMoegirlArticleForWork(shortTitle).catch((e) => {
			console.warn(`  ⚠ ${file}: 萌娘百科抓取失败 ${e.message}`);
			return null;
		});
		// 兜底：中文名未命中时用正文里的「原作标题」（日文原名）再试一次
		if (!article) {
			const originalTitle = body
				.match(/^- \*\*原作标题\*\*：(.+)$/m)?.[1]
				?.trim();
			if (originalTitle && originalTitle !== shortTitle) {
				article = await fetchMoegirlArticleForWork(originalTitle).catch(
					() => null,
				);
			}
		}
	}

	const judgments = {};
	for (const key of Object.keys(MANAGED_SECTIONS)) {
		const currentDigest = currentSectionDigest(body, key);
		let regeneratedDigest = null;
		if (article) {
			const spec = MANAGED_SECTIONS[key];
			const sectionText =
				extractSectionBody(body, spec.heading, spec.ends) ?? "";
			const built =
				key === "overview"
					? buildOverviewManaged(article)
					: buildStoryManaged(article, sectionText);
			if (built) regeneratedDigest = digestOf(built.managed);
		}
		judgments[key] = {
			...classifySection({
				protectedByFrontmatter,
				ledgerEntry: ledgerSections[key],
				currentDigest,
				regeneratedDigest,
			}),
			currentDigest,
			regeneratedDigest,
		};
	}

	// 任一受管小节被保护 / 被改过 → 整篇跳过，frontmatter 也不动
	const blocking = Object.entries(judgments).filter(([, j]) =>
		BLOCKING_STATES.has(j.state),
	);
	if (blocking.length > 0 && !FORCE) {
		return {
			file,
			status: "protected",
			reason: blocking
				.map(([k, j]) => `${MANAGED_SECTIONS[k].label}:${j.state}(${j.reason})`)
				.join("; "),
			judgments,
		};
	}

	if (STATUS_ONLY) {
		return {
			file,
			status: "status",
			judgments,
			moegirl: article ? article.title : null,
			reason: FORCE ? "forced" : "ok",
		};
	}

	// ── 第 2 步：frontmatter 重写 ──
	const introFirstPara = (article?.intro || "").split("\n\n")[0] || "";
	const newDescription = introFirstPara
		? truncate(introFirstPara)
		: getField(fm, "description");

	let newFm = fm;
	newFm = newFm.replace(
		/^description:\s*.*$/m,
		`description: "${newDescription.replace(/"/g, "'")}"`,
	);
	newFm = newFm.replace(
		/^tags:\s*\[[\s\S]*?\]/m,
		`tags: [${newTags.map((t) => `"${t}"`).join(", ")}]`,
	);
	newFm = newFm.replace(
		/^category:\s*.*$/m,
		`category: "${newCategory.replace(/"/g, "'")}"`,
	);

	// ── 第 3 步：正文重写（仅覆盖通过判定的受管小节）──
	const changes = [];
	let newBody = body;
	let overviewReplaced = false;
	let storyReplaced = false;

	if (!META_ONLY && article) {
		// --force 时无视来源判定，否则只覆写未被保护的受管小节
		const mayWrite = (key) =>
			FORCE || !BLOCKING_STATES.has(judgments[key].state);

		// 「一、作品概述」
		const overview = buildOverviewManaged(article);
		if (overview && mayWrite("overview")) {
			const spec = MANAGED_SECTIONS.overview;
			const r = replaceSection(
				newBody,
				spec.heading,
				spec.ends,
				overview.managed,
			);
			if (r.replaced) {
				// 保留原小节的封面图行
				const oldSection =
					extractSectionBody(newBody, spec.heading, spec.ends) ?? "";
				const imageLine = oldSection.match(/^!\[.*$/m)?.[0];
				if (imageLine) {
					r.body = r.body.replace(
						spec.ends[0],
						`${imageLine}\n\n${spec.ends[0]}`,
					);
				}
				newBody = r.body;
				overviewReplaced = true;
				recordLedgerEntry(ledger, file, "overview", {
					digest: digestOf(overview.managed),
					source: overview.source,
				});
			}
		}

		// 「三、剧情简介」
		const storySection = extractSectionBody(
			newBody,
			"## 三、剧情简介",
			MANAGED_SECTIONS.story.ends,
		);
		const story = buildStoryManaged(article, storySection ?? "");
		if (story && mayWrite("story")) {
			const r = replaceSection(
				newBody,
				"## 三、剧情简介",
				MANAGED_SECTIONS.story.ends,
				story.managed,
			);
			if (r.replaced) {
				newBody = r.body;
				storyReplaced = true;
				recordLedgerEntry(ledger, file, "story", {
					digest: digestOf(story.managed),
					source: story.source,
				});
			}
		}

		// 基础信息里的题材标签行同步更新
		const oldTagsLine = oldTags.join(" / ");
		if (oldTagsLine && newBody.includes(oldTagsLine)) {
			newBody = newBody.replace(oldTagsLine, newTags.join(" / "));
		}
	}

	if (!overviewReplaced && !META_ONLY && !article) changes.push("moegirl-miss");
	// 统一为 LF：正文来自磁盘（可能是 CRLF），而模板里的分隔符是 \n，
	// 若直接拼接会产出「frontmatter=LF、正文=CRLF」的混合换行文件，
	// 既污染 diff 又制造跨平台合并冲突。见仓库根 .gitattributes。
	const newRaw = toLfText(
		`---\n${newFm}\n---\n\n${newBody.replace(/^\n+/, "")}`,
	);

	const changed = newRaw !== toLfText(raw);
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
		judgments,
		changes,
	};
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

async function main() {
	const allFiles = (await fs.readdir(POSTS_DIR))
		.filter((f) => f.startsWith("bangumi-") && f.endsWith(".md"))
		.sort();
	const files = allFiles.filter(
		(f) => !ONLY_IDS || ONLY_IDS.has(f.replace(/\D/g, "")),
	);

	console.log(
		`▶ 待处理 ${files.length} 篇 bangumi 自动发文` +
			`${DRY_RUN ? "（dry-run）" : ""}${META_ONLY ? "（仅元数据）" : ""}` +
			`${STATUS_ONLY ? "（仅来源判定）" : ""}${FORCE ? "（⚠ --force 无视保护）" : ""}`,
	);

	const ledger = await readLedger();
	const removed = pruneLedger(ledger, new Set(allFiles));
	if (removed > 0) console.log(`  · 台账清理 ${removed} 条已失效条目`);

	const results = [];
	for (const file of files) {
		const r = await processPost(file, ledger);
		results.push(r);
		if (r.status === "protected") {
			console.log(`🛡 ${file}  已跳过 —— ${r.reason}`);
		} else if (r.status === "status") {
			const marks = Object.entries(r.judgments)
				.map(([k, j]) => `${MANAGED_SECTIONS[k].label}=${j.state}`)
				.join(" ");
			console.log(`· ${file}  ${marks}`);
		} else {
			const flag =
				r.status === "rewritten" || r.status === "would-change" ? "✓" : "·";
			console.log(
				`${flag} ${file}  moegirl=${r.moegirl || "✗"}  cat=${r.category}  ` +
					`${r.overviewReplaced ? "概述✓" : ""}${r.storyReplaced ? "剧情✓" : ""} ${r.changes.join(",")}`,
			);
		}
	}

	if (!DRY_RUN && !STATUS_ONLY) {
		await writeLedger(ledger);
	}

	const skipped = results.filter((r) => r.status === "protected");
	const touched = results.filter(
		(r) => r.status === "rewritten" || r.status === "would-change",
	);
	// 统一口径：按判定结果统计「可覆写 / 被保护」，与运行模式无关
	const judged = results.filter((r) => r.judgments);
	const isBlocked = (r) =>
		Object.values(r.judgments).some((j) => BLOCKING_STATES.has(j.state));
	const writable = judged.filter((r) => !isBlocked(r));
	const summary = {
		total: results.length,
		changed: touched.length,
		skippedProtected: skipped.length,
		skippedFiles: skipped.map((r) => ({ file: r.file, reason: r.reason })),
		moegirlHit: results.filter((r) => r.moegirl).length,
		moegirlMiss: results
			.filter((r) => !r.moegirl && r.status !== "protected")
			.map((r) => r.file),
		storyReplaced: results.filter((r) => r.storyReplaced).length,
		overviewReplaced: results.filter((r) => r.overviewReplaced).length,
		judged: {
			writable: writable.length,
			protected: judged.length - writable.length,
		},
	};
	if (STATUS_ONLY) {
		// --status 只做判定不写入，变更类统计一律归零以免与写入口径混淆
		summary.changed = 0;
		summary.storyReplaced = 0;
		summary.overviewReplaced = 0;
		summary.mode = "--status（仅判定，未写入）";
	}
	console.log("\n══ 汇总 ══");
	console.log(JSON.stringify(summary, null, 2));
	if (skipped.length > 0) {
		console.log(
			`\n🛡 ${skipped.length} 篇因人工编辑/显式保护被跳过。` +
				"如需强制覆写请先提交工作区，再用 --force（会同时覆盖这些文章）。",
		);
	}

	await fs.mkdir(path.join(ROOT_DIR, "reports"), { recursive: true });
	await fs.writeFile(
		path.join(ROOT_DIR, "reports", "moegirl-rewrite-latest.json"),
		JSON.stringify(
			{ ranAt: new Date().toISOString(), dryRun: DRY_RUN, summary, results },
			null,
			2,
		),
		"utf8",
	);
}

const isDirectRun =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
	main().catch((e) => {
		console.error("✗ rewrite failed:", e);
		process.exit(1);
	});
}
