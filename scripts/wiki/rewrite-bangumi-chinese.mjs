/**
 * 存量 bangumi-* 自动发文的中文化重写（批处理）
 * ─────────────────────────────────────────────────────────────────────────────
 * 对 src/content/posts/bangumi-<subjectId>.md 逐篇：
 *   1. 重新抓取 Bangumi 条目详情与角色（中文名 / 基础信息）；
 *   2. 萌娘百科优先、中文维基百科兜底，补作品介绍、剧情与角色中文简介；
 *   3. 用与每日发文相同的流程（composeArticle）重建整篇文章，全文简体中文；
 *   4. 保留 URL（alias）、发布日期、封面、草稿 / 置顶状态不变。
 *
 * Bangumi 详情抓取失败的文章原样跳过，绝不降级覆盖。
 * frontmatter 含 `chineseRewrite: false` 或 `moegirlRewrite: false` 的文章永久跳过。
 *
 * 同时输出 reports/bangumi-chinese-rewrite.json：记录每篇采用的百科来源、剩余日文占比，
 * 以及只有日文资料、需要人工翻译的剧情与角色简介。
 *
 * 用法：
 *   node scripts/wiki/rewrite-bangumi-chinese.mjs               # 全部
 *   node scripts/wiki/rewrite-bangumi-chinese.mjs --only 25823,510256
 *   node scripts/wiki/rewrite-bangumi-chinese.mjs --dry-run     # 只生成报告，不写文章
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnimeArticleMarkdown } from "../bangumi-daily-posts.mjs";
import {
	composeArticle,
	loadSnapshotCollections,
	measureJapaneseRatio,
} from "../generate-bangumi-daily-post.mjs";
import { applyGlossary } from "./zh-glossary.mjs";
import { cleanChineseProse, hasKana } from "./zh-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const REPORT_FILE = path.join(
	ROOT_DIR,
	"reports",
	"bangumi-chinese-rewrite.json",
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const onlyIndex = args.indexOf("--only");
const ONLY =
	onlyIndex >= 0
		? new Set(
				String(args[onlyIndex + 1] || "")
					.split(",")
					.filter(Boolean),
			)
		: null;

const PROTECT_RE = /^(chineseRewrite|moegirlRewrite):\s*(false|0|no)\s*$/im;
const STATUS_TO_TYPE = { 想看: 1, 看过: 2, 在看: 3, 搁置: 4, 抛弃: 5 };
const NARRATOR_RE = /^(ナレーション|ナレーター|旁白|解说|Narrator)$/i;

function readFrontmatter(raw) {
	const match = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const fm = match[1];
	const field = (name) => {
		const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
		if (!m) return "";
		const value = m[1].trim();
		try {
			return value.startsWith('"') ? JSON.parse(value) : value;
		} catch {
			return value.replace(/^['"]|['"]$/g, "");
		}
	};
	return {
		raw: fm,
		published: field("published") || field("pubDate"),
		alias: field("alias"),
		image: field("image"),
		draft: field("draft") === "true",
		pinned: field("pinned") === "true",
		sourceLink: field("sourceLink"),
	};
}

/** 快照里找不到时（已移出追番列表），用原文的追番状态 / 进度兜底 */
function fallbackCandidate(subjectId, body) {
	const status = body.match(/\*\*追番状态\*\*：(\S+)/)?.[1] || "";
	const watched = Number(
		body.match(/\*\*观看进度\*\*：已看到\s*(\d+)/)?.[1] || 0,
	);
	return {
		subject_id: subjectId,
		type: STATUS_TO_TYPE[status] || 0,
		ep_status: watched,
		subject: { id: subjectId },
	};
}

function pendingTranslations({ detail, rawCharacters, encyclopedia, payload }) {
	const plotCn =
		encyclopedia?.story || cleanChineseProse(detail?.summary || "");
	const pending = {};
	if (plotCn.length < 40 && hasKana(detail?.summary || "")) {
		pending.plot = detail.summary;
	}
	const shown = new Set(payload.characters.map((c) => c.name));
	pending.characters = (Array.isArray(rawCharacters) ? rawCharacters : [])
		.filter((c) => c?.name && !NARRATOR_RE.test(String(c.name).trim()))
		.slice(0, 8)
		.map((c) => ({
			id: c.id,
			name: c.name,
			relation: c.relation,
			cv: c.actors?.[0]?.name || "",
			summary: c.summary || "",
		}))
		.filter((c) => hasKana(c.summary) || hasKana(c.name));
	pending.shownCharacters = [...shown];
	pending.emptyBios = payload.characters
		.filter((c) => !c.description)
		.map((c) => c.name);
	return pending;
}

async function main() {
	const files = (await fs.readdir(POSTS_DIR))
		.filter((f) => /^bangumi-\d+\.md$/.test(f))
		.filter((f) => !ONLY || ONLY.has(f.match(/\d+/)[0]))
		.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

	const { collections } = await loadSnapshotCollections();
	const bySubject = new Map(collections.map((c) => [c.subject_id, c]));
	console.log(
		`▶ 待处理 ${files.length} 篇${DRY_RUN ? "（dry-run）" : ""}，快照条目 ${bySubject.size} 个`,
	);

	const report = { generatedAt: new Date().toISOString(), posts: [] };
	const counts = { rewritten: 0, skipped: 0, failed: 0 };

	for (const file of files) {
		const subjectId = Number(file.match(/\d+/)[0]);
		const filePath = path.join(POSTS_DIR, file);
		const raw = (await fs.readFile(filePath, "utf8")).replace(/\r\n/g, "\n");
		const fm = readFrontmatter(raw);
		if (!fm) {
			console.warn(`⚠ ${file}：frontmatter 解析失败，跳过`);
			counts.skipped++;
			continue;
		}
		if (PROTECT_RE.test(fm.raw)) {
			console.log(`🛡 ${file}：已声明保护，跳过`);
			counts.skipped++;
			continue;
		}

		const body = raw.slice(raw.indexOf("\n---", 4) + 4);
		const candidate =
			bySubject.get(subjectId) || fallbackCandidate(subjectId, body);
		console.log(`\n📝 ${file}`);
		try {
			const result = await composeArticle(candidate, {
				now: fm.published ? new Date(`${fm.published}T00:00:00`) : new Date(),
				reviewMode: fm.draft,
			});
			if (!result.detail) {
				console.warn(`⚠ ${file}：Bangumi 详情抓取失败，保留原文`);
				counts.failed++;
				report.posts.push({ file, subjectId, status: "failed" });
				continue;
			}
			const { payload } = result;
			payload.alias = fm.alias || payload.alias;
			if (fm.image) payload.image = fm.image;
			if (fm.published) payload.published = fm.published;
			payload.draft = fm.draft;
			payload.pinned = fm.pinned;

			const markdown = applyGlossary(
				buildAnimeArticleMarkdown(payload),
			).replace(/^pinned: (true|false)$/m, `pinned: ${fm.pinned}`);
			const ratio = measureJapaneseRatio(markdown);
			if (!DRY_RUN)
				await fs.writeFile(filePath, `${markdown.trimEnd()}\n`, "utf8");
			counts.rewritten++;
			report.posts.push({
				file,
				subjectId,
				status: "rewritten",
				title: payload.title,
				originalTitle: payload.originalTitle,
				sources: (result.encyclopedia?.sources || []).map(
					(s) => `${s.label}:${s.title}`,
				),
				kanaRatio: Number(ratio.toFixed(4)),
				pending: pendingTranslations({ ...result, payload }),
			});
			console.log(
				`✅ ${payload.title}  来源：${report.posts.at(-1).sources.join(" / ") || "仅 Bangumi"}  假名 ${(ratio * 100).toFixed(1)}%`,
			);
		} catch (error) {
			console.warn(`⚠ ${file}：重写失败（${error.message}），保留原文`);
			counts.failed++;
			report.posts.push({
				file,
				subjectId,
				status: "failed",
				error: error.message,
			});
		}
	}

	await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
	await fs.writeFile(
		REPORT_FILE,
		`${JSON.stringify(report, null, 2)}\n`,
		"utf8",
	);
	console.log(
		`\n完成：重写 ${counts.rewritten}，跳过 ${counts.skipped}，失败 ${counts.failed}。报告：${path.relative(ROOT_DIR, REPORT_FILE)}`,
	);
}

main().catch((error) => {
	console.error("✗ rewrite failed:", error);
	process.exit(1);
});
