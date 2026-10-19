/**
 * 萌娘百科（zh.moegirl.org.cn）精准爬取工具
 * ─────────────────────────────────────────────────────────────────────────────
 * 通过 MediaWiki API 抓取条目完整文章内容：
 *   - 标题解析：精确命中 → 后缀变体（去 OVA/第二季 等）→ 全文搜索兜底
 *   - 内容解析：导言（intro）+ 按章节切分的完整正文
 *   - 磁盘缓存：.cache/moegirl/<key>.json，默认 7 天 TTL，避免重复请求
 *
 * 作为库使用：
 *   import { fetchMoegirlArticleForWork } from "./scripts/moegirl/scraper.mjs";
 *   const article = await fetchMoegirlArticleForWork("伪恋 OAD");
 *   // → { title, pageUrl, intro, sections: [{ heading, text }], fullText, fetchedAt }
 *
 * 作为 CLI 使用：
 *   node scripts/moegirl/scraper.mjs "伪恋 OAD"            # 打印解析结果摘要
 *   node scripts/moegirl/scraper.mjs "伪恋" --json        # 输出完整 JSON
 *   node scripts/moegirl/scraper.mjs "伪恋" --no-cache    # 跳过缓存强制抓取
 *
 * 注意：
 *   - 请遵守萌娘百科的内容授权（CC BY-NC-SA 3.0 CN），引用时保留出处链接；
 *   - 默认请求间隔 300ms，UA 标识用途，勿用于批量镜像；
 *   - 通用抓取逻辑位于 scripts/wiki/mediawiki.mjs，与维基百科抓取共用。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	createMediaWikiClient,
	findStorySection,
	parseExtract,
	titleVariants,
} from "../wiki/mediawiki.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const MOEGIRL_API = "https://zh.moegirl.org.cn/api.php";
export const MOEGIRL_PAGE_BASE = "https://zh.moegirl.org.cn/";
export const MOEGIRL_LICENSE = "CC BY-NC-SA 3.0";

const client = createMediaWikiClient({
	name: "萌娘百科",
	api: MOEGIRL_API,
	pageBase: MOEGIRL_PAGE_BASE,
	userAgent:
		"wxzjt0318-oss-blog-moegirl-scraper/1.1 (content curation; contact: github.com/wxzjt0318-oss)",
	cacheDir: path.join(ROOT_DIR, ".cache", "moegirl"),
	cacheVersion: 3, // 解析逻辑变更时 +1，自动失效旧缓存
	// 萌娘百科条目以繁简混排为主，请求简体变体；抓取后仍会本地繁转简兜底
	extraQueryParams: { variant: "zh-cn" },
});

export { findStorySection, parseExtract, titleVariants };

/** 全文搜索，返回候选标题列表 */
export function searchMoegirlTitles(query, limit = 5) {
	return client.search(query, limit);
}

/** 按标题抓取完整条目（带重定向解析与消歧检测） */
export function fetchMoegirlArticle(title) {
	return client.fetchArticle(title);
}

/**
 * 面向作品条目的智能抓取：
 * 依次尝试 标题变体精确命中 → 全文搜索，返回第一个有实质内容的条目。
 * workTitle 可以是单个标题或候选标题数组（如 [中文名, 日文原名]）。
 */
export function fetchMoegirlArticleForWork(workTitle, options = {}) {
	return client.fetchArticleForWork(workTitle, options);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2);
	const query = args.find((a) => !a.startsWith("--"));
	const asJson = args.includes("--json");
	const useCache = !args.includes("--no-cache");
	if (!query) {
		console.error(
			'用法: node scripts/moegirl/scraper.mjs "<条目名>" [--json] [--no-cache]',
		);
		process.exit(1);
	}
	try {
		const article = await fetchMoegirlArticleForWork(query, { useCache });
		if (!article) {
			console.error(`✗ 未找到条目: ${query}`);
			process.exit(2);
		}
		if (asJson) {
			console.log(JSON.stringify(article, null, 2));
		} else {
			console.log(`条目: ${article.title}`);
			console.log(`链接: ${article.pageUrl}`);
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
