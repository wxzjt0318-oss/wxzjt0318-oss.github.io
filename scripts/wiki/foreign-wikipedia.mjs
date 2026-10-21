/**
 * 日文 / 英文维基百科条目抓取（长文改写的参考资料，原文不转换，由写稿时翻译成中文）
 * ─────────────────────────────────────────────────────────────────────────────
 * 与中文维基、萌娘百科共用 scripts/wiki/mediawiki.mjs 的抓取 / 解析 / 缓存逻辑。
 * 日文维基对日本动画、轻小说、漫画的制作信息与播出资料通常最完整，优先参考。
 *
 * 两者内容均遵循 CC BY-SA 4.0，引用时必须保留出处链接。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMediaWikiClient } from "./mediawiki.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";

const jaClient = createMediaWikiClient({
	name: "日文维基百科",
	api: "https://ja.wikipedia.org/w/api.php",
	pageBase: "https://ja.wikipedia.org/wiki/",
	userAgent: USER_AGENT,
	cacheDir: path.join(ROOT_DIR, ".cache", "jawiki"),
	minIntervalMs: 500,
});

const enClient = createMediaWikiClient({
	name: "英文维基百科",
	api: "https://en.wikipedia.org/w/api.php",
	pageBase: "https://en.wikipedia.org/wiki/",
	userAgent: USER_AGENT,
	cacheDir: path.join(ROOT_DIR, ".cache", "enwiki"),
	minIntervalMs: 500,
});

/** titles：日文原名等候选标题；精确命中失败时用全文搜索兜底 */
export function fetchJaWikipediaArticleForWork(titles, options = {}) {
	return jaClient.fetchArticleForWork(titles, options);
}

/** titles：日文原名或英文 / 罗马字标题；英文维基的搜索能按日文原名找到条目 */
export function fetchEnWikipediaArticleForWork(titles, options = {}) {
	return enClient.fetchArticleForWork(titles, options);
}
