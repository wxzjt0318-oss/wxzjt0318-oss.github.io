/**
 * 中文维基百科（zh.wikipedia.org）条目抓取
 * ─────────────────────────────────────────────────────────────────────────────
 * 与萌娘百科共用 scripts/wiki/mediawiki.mjs 的抓取 / 解析 / 缓存逻辑，
 * 通过 `variant=zh-cn` 直接请求大陆简体变体。
 *
 * CLI：node scripts/wiki/wikipedia.mjs "零之使魔" [--json] [--no-cache]
 *
 * 维基百科内容遵循 CC BY-SA 4.0，引用时必须保留出处链接。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMediaWikiClient } from "./mediawiki.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php";
export const WIKIPEDIA_PAGE_BASE = "https://zh.wikipedia.org/wiki/";
export const WIKIPEDIA_LICENSE = "CC BY-SA 4.0";

const client = createMediaWikiClient({
	name: "维基百科",
	api: WIKIPEDIA_API,
	pageBase: WIKIPEDIA_PAGE_BASE,
	userAgent:
		"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)",
	cacheDir: path.join(ROOT_DIR, ".cache", "wikipedia"),
	cacheVersion: 1,
	minIntervalMs: 500,
	extraQueryParams: { variant: "zh-cn" },
});

export function fetchWikipediaArticle(title) {
	return client.fetchArticle(title);
}

export function searchWikipediaTitles(query, limit = 5) {
	return client.search(query, limit);
}

/** titles 可以是单个标题或候选标题数组（如 [中文名, 日文原名]） */
export function fetchWikipediaArticleForWork(titles, options = {}) {
	return client.fetchArticleForWork(titles, options);
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2);
	const query = args.find((a) => !a.startsWith("--"));
	if (!query) {
		console.error(
			'用法: node scripts/wiki/wikipedia.mjs "<条目名>" [--json] [--no-cache]',
		);
		process.exit(1);
	}
	try {
		const article = await fetchWikipediaArticleForWork(query, {
			useCache: !args.includes("--no-cache"),
		});
		if (!article) {
			console.error(`✗ 未找到条目: ${query}`);
			process.exit(2);
		}
		if (args.includes("--json")) {
			console.log(JSON.stringify(article, null, 2));
		} else {
			console.log(`条目: ${article.title}\n链接: ${article.pageUrl}`);
			console.log(
				`导言 (${article.intro.length} 字):\n${article.intro.slice(0, 500)}`,
			);
			console.log(
				`章节: ${article.sections.map((s) => `${s.heading}(${s.text.length})`).join(" / ")}`,
			);
		}
	} catch (error) {
		console.error(`✗ 抓取失败: ${error.message}`);
		process.exit(1);
	}
}
