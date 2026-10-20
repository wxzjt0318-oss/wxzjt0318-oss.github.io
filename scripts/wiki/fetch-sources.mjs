/**
 * 撰写深度文章用的资料抓取：把指定条目的萌娘百科 / 中文维基百科全文存成 JSON。
 * ─────────────────────────────────────────────────────────────────────────────
 * 读取 scripts/wiki/source-requests.json：
 *   { "精灵幻想记": ["精灵幻想记", "北山结莉", "松冈祯丞", ...], ... }
 * 每组输出 reports/wiki-sources/<组名>.json：
 *   { "<查询>": { moegirl: {title, url, text} | null, wikipedia: {...} | null } }
 *
 * 需要外网，在 GitHub Actions「Fetch Wiki Sources」中运行。全文已转为简体中文。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMoegirlArticleForWork } from "../moegirl/scraper.mjs";
import { fetchWikipediaArticleForWork } from "./wikipedia.mjs";
import { toSimplified } from "./zh-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const REQUESTS = path.join(__dirname, "source-requests.json");
const OUT_DIR = path.join(ROOT_DIR, "reports", "wiki-sources");

const MAX_TEXT = 20000;
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

// 改写完成后请求清单会被删除；删除同样会触发工作流，此时什么都不做
const rawRequests = await fs.readFile(REQUESTS, "utf8").catch(() => null);
if (!rawRequests) {
	console.log("scripts/wiki/source-requests.json 不存在，跳过");
	process.exit(0);
}
const requests = JSON.parse(rawRequests);
await fs.mkdir(OUT_DIR, { recursive: true });
const groups = Object.entries(requests).filter((_, i) => i % SHARDS === SHARD);
for (const [group, queries] of groups) {
	if (await fs.stat(path.join(OUT_DIR, `${group}.json`)).catch(() => null)) continue;
	const out = {};
	for (const query of queries) {
		const [moegirl, wikipedia] = await Promise.all([
			fetchMoegirlArticleForWork(query, { minIntroLength: 10 }).catch(() => null),
			fetchWikipediaArticleForWork(query, { minIntroLength: 10 }).catch(() => null),
		]);
		out[query] = { moegirl: pack(moegirl), wikipedia: pack(wikipedia) };
		console.log(`${group} / ${query}: 萌娘百科 ${moegirl ? `✓ ${moegirl.title}` : "✗"}，维基百科 ${wikipedia ? `✓ ${wikipedia.title}` : "✗"}`);
	}
	await fs.writeFile(path.join(OUT_DIR, `${group}.json`), `${JSON.stringify(out, null, 2)}\n`, "utf8");
}
