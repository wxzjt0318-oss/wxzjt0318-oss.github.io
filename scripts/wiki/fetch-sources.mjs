/**
 * 撰写深度文章用的资料抓取：把指定条目的多个百科 / 动画数据库资料存成 JSON。
 * ─────────────────────────────────────────────────────────────────────────────
 * 读取 scripts/wiki/source-requests.json，每组可以是：
 *   { "zh": ["中文标题", "角色名", ...], "ja": ["日文原名"], "en": ["英文 / 罗马字标题"], "bangumi": "条目编号" }
 *   或旧格式 ["中文标题", "日文原名", ...]（含假名的查询自动归入 ja）
 * 每组输出 reports/wiki-sources/<组名>.json：
 *   { "<中文查询>": { moegirl, wikipedia },        // 萌娘百科、中文维基（已转简体）
 *     "<日文查询>": { jawiki, enwiki },           // 日文维基（优先）、英文维基（原文）
 *     "_databases": { ann: [...], kitsu: [...] }, // Anime News Network、Kitsu（结构化资料）
 *     "_linked": { wikidata, syoboi, animehack, mal, livechart, bahamut, bangumi, mediaarts, fandom } }
 *       // 经 Wikidata 编号精确关联的各站资料，见 scripts/wiki/linked-sources.mjs
 * 每个来源都是 {title, url, text} 或 null（数据库为数组）。
 *
 * 需要外网，在 GitHub Actions「Fetch Wiki Sources」中运行。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMoegirlArticleForWork } from "../moegirl/scraper.mjs";
import { fetchAnnEntries, fetchAnnEntryById, fetchKitsuEntries } from "./anime-databases.mjs";
import {
	fetchEnWikipediaArticleForWork,
	fetchJaWikipediaArticleForWork,
} from "./foreign-wikipedia.mjs";
import { fetchLinkedSources } from "./linked-sources.mjs";
import { fetchWikipediaArticleForWork } from "./wikipedia.mjs";
import { toSimplified } from "./zh-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const REQUESTS = path.join(__dirname, "source-requests.json");
const OUT_DIR = path.join(ROOT_DIR, "reports", "wiki-sources");

const MAX_TEXT = 20000;
// 日文维基的制作、播出资料通常最完整，条目也更长
const MAX_TEXT_JA = 40000;
const KANA = /[\u3040-\u30ff]/;
// 分片：SHARD=0..SHARDS-1，各自处理一部分组，便于在 Actions 里并行
const SHARD = Number(process.env.SHARD || 0);
const SHARDS = Number(process.env.SHARDS || 1);

function pack(article) {
	if (!article) return null;
	return {
		title: toSimplified(article.title),
		url: article.pageUrl,
		text: toSimplified(article.fullText || "").slice(0, MAX_TEXT),
	};
}

/** 外文资料保留原文，写稿时再翻译 */
function packRaw(article, max = MAX_TEXT) {
	if (!article) return null;
	return { title: article.title, url: article.pageUrl, text: String(article.fullText || "").slice(0, max) };
}

function normalizeGroup(entry) {
	if (Array.isArray(entry)) {
		return { zh: entry.filter((q) => !KANA.test(q)), ja: entry.filter((q) => KANA.test(q)), en: [] };
	}
	return { zh: entry?.zh || [], ja: entry?.ja || [], en: entry?.en || [], bangumi: String(entry?.bangumi || "") };
}

const settle = (promise) => promise.catch((error) => {
	console.warn(`  ⚠ ${error.message}`);
	return null;
});

// 改写完成后请求清单会被删除；删除同样会触发工作流，此时什么都不做
const rawRequests = await fs.readFile(REQUESTS, "utf8").catch(() => null);
if (!rawRequests) {
	console.log("scripts/wiki/source-requests.json 不存在，跳过");
	process.exit(0);
}
const requests = JSON.parse(rawRequests);
await fs.mkdir(OUT_DIR, { recursive: true });
const groups = Object.entries(requests).filter((_, i) => i % SHARDS === SHARD);
for (const [group, entry] of groups) {
	if (await fs.stat(path.join(OUT_DIR, `${group}.json`)).catch(() => null)) continue;
	const { zh, ja, en, bangumi } = normalizeGroup(entry);
	const out = {};
	for (const query of zh) {
		const [moegirl, wikipedia] = await Promise.all([
			settle(fetchMoegirlArticleForWork(query, { minIntroLength: 10 })),
			settle(fetchWikipediaArticleForWork(query, { minIntroLength: 10 })),
		]);
		out[query] = { moegirl: pack(moegirl), wikipedia: pack(wikipedia) };
		console.log(`${group} / ${query}: 萌娘百科 ${moegirl ? `✓ ${moegirl.title}` : "✗"}，维基百科 ${wikipedia ? `✓ ${wikipedia.title}` : "✗"}`);
	}
	const englishTitles = new Set(en);
	for (const query of ja) {
		const [jawiki, enwiki] = await Promise.all([
			settle(fetchJaWikipediaArticleForWork(query, { minIntroLength: 10 })),
			settle(fetchEnWikipediaArticleForWork(query, { minIntroLength: 10 })),
		]);
		out[query] = { jawiki: packRaw(jawiki, MAX_TEXT_JA), enwiki: packRaw(enwiki) };
		if (enwiki?.title) englishTitles.add(enwiki.title.replace(/\s*\([^)]*\)\s*$/, ""));
		console.log(`${group} / ${query}: 日文维基 ${jawiki ? `✓ ${jawiki.title}` : "✗"}，英文维基 ${enwiki ? `✓ ${enwiki.title}` : "✗"}`);
	}
	// 动画数据库按英文 / 罗马字标题搜索（英文维基条目名、文章 alias）
	const ann = [];
	const kitsu = [];
	for (const title of englishTitles) {
		for (const item of (await settle(fetchAnnEntries(title))) || []) {
			if (!ann.some((a) => a.url === item.url)) ann.push(item);
		}
		for (const item of (await settle(fetchKitsuEntries(title))) || []) {
			if (!kitsu.some((k) => k.url === item.url)) kitsu.push(item);
		}
	}
	const linked = await fetchLinkedSources({ ja, en: [...englishTitles], bangumiId: bangumi });
	if (linked.annId && !ann.some((a) => a.url.endsWith(`id=${linked.annId}`))) {
		const exact = await settle(fetchAnnEntryById(linked.annId));
		if (exact) ann.unshift(exact);
	}
	const { annId: _annId, ...linkedSources } = linked;
	out._linked = linkedSources;
	console.log(
		`${group} / 关联来源：${Object.entries(linkedSources).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join("，")}`,
	);
	out._databases = { ann: ann.slice(0, 4), kitsu: kitsu.slice(0, 3) };
	console.log(`${group} / 数据库（${[...englishTitles].join("、") || "无英文标题"}）：ANN ${ann.length} 条，Kitsu ${kitsu.length} 条`);
	await fs.writeFile(path.join(OUT_DIR, `${group}.json`), `${JSON.stringify(out, null, 2)}\n`, "utf8");
}
