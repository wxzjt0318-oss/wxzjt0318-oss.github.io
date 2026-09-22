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
 *   - 本工具只读不改现有自动发文核心逻辑。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const MOEGIRL_API = "https://zh.moegirl.org.cn/api.php";
export const MOEGIRL_PAGE_BASE = "https://zh.moegirl.org.cn/";
const USER_AGENT =
	"wxzjt0318-oss-blog-moegirl-scraper/1.0 (content curation; contact: github.com/wxzjt0318-oss)";
const CACHE_DIR = path.join(ROOT_DIR, ".cache", "moegirl");
const CACHE_TTL_MS = 7 * 24 * 3_600_000;
const CACHE_VERSION = 2; // 解析逻辑变更时 +1，自动失效旧缓存
const MIN_REQUEST_INTERVAL_MS = 300;

let lastRequestAt = 0;

async function throttle() {
	const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
	if (wait > 0) {
		await new Promise((r) => setTimeout(r, wait));
	}
	lastRequestAt = Date.now();
}

async function apiGet(params, { retries = 3 } = {}) {
	const url = `${MOEGIRL_API}?${new URLSearchParams({ format: "json", ...params })}`;
	for (let attempt = 0; attempt < retries; attempt++) {
		await throttle();
		try {
			const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
			if (res.status === 429 || res.status >= 500) {
				const waitMs = 1500 * (attempt + 1);
				console.warn(`⚠ moegirl ${res.status}, ${waitMs}ms 后重试…`);
				await new Promise((r) => setTimeout(r, waitMs));
				continue;
			}
			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}
			return await res.json();
		} catch (error) {
			if (attempt === retries - 1) throw error;
			await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
		}
	}
	throw new Error("moegirl apiGet: unreachable");
}

/** 作品名变体：动画季度/OVA 条目在萌娘百科通常收在系列主条目下 */
export function titleVariants(rawTitle) {
	const base = String(rawTitle || "").trim();
	const variants = [base];
	const stripPatterns = [
		/\s*(OAD|OVA|TV|剧场版|电影|SP|特别篇|总集篇)\s*\d*\s*$/i,
		/\s*第[一二三四五六七八九十\d]+季\s*$/,
		/\s*第[一二三四五六七八九十\d]+期\s*$/,
		/\s*[（(].*?[）)]\s*$/,
		/\s*[:：].*$/,
		/\s+Season\s*\d+\s*$/i,
		/\s+\d+(nd|rd|th)\s+Season\s*$/i,
	];
	let current = base;
	for (const pattern of stripPatterns) {
		const next = current.replace(pattern, "").trim();
		if (next && next !== current && next.length >= 2) {
			variants.push(next);
			current = next;
		}
	}
	return [...new Set(variants)];
}

/** 全文搜索，返回候选标题列表 */
export async function searchMoegirlTitles(query, limit = 5) {
	const data = await apiGet({
		action: "query",
		list: "search",
		srsearch: query,
		srlimit: String(limit),
		srnamespace: "0",
	});
	return (data?.query?.search || []).map((item) => item.title);
}

/** 把完整 plain-text extract 解析为 intro + 章节数组 */
export function parseExtract(extract) {
	const text = String(extract || "")
		.replace(/\r\n/g, "\n")
		.trim();
	if (!text) {
		return { intro: "", sections: [] };
	}
	const lines = text.split("\n");
	const introLines = [];
	const sections = [];
	let current = null;
	const isHeading = (line, prevBlank) =>
		line.length > 0 &&
		line.length <= 30 &&
		!/[。，、！？；：…—」』）),.)]$/.test(line) &&
		!line.includes("：") &&
		prevBlank;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const prevBlank = i === 0 || lines[i - 1].trim() === "";
		if (isHeading(line, prevBlank)) {
			current = { heading: line, paragraphs: [] };
			sections.push(current);
			continue;
		}
		if (!line) continue;
		if (current) {
			current.paragraphs.push(line);
		} else {
			introLines.push(line);
		}
	}
	return {
		intro: introLines.join("\n\n"),
		sections: sections.map((s) => ({
			heading: s.heading,
			text: s.paragraphs.join("\n\n"),
		})),
	};
}

/** 按标题抓取完整条目（带重定向解析与消歧检测） */
export async function fetchMoegirlArticle(title) {
	const data = await apiGet({
		action: "query",
		prop: "extracts|info",
		explaintext: "1",
		exsectionformat: "plain",
		redirects: "1",
		inprop: "url",
		titles: title,
	});
	const pages = data?.query?.pages || {};
	const page = Object.values(pages)[0];
	if (!page || page.missing != null || !page.extract) {
		return null;
	}
	const { intro, sections } = parseExtract(page.extract);
	return {
		title: page.title,
		pageUrl:
			page.fullurl || `${MOEGIRL_PAGE_BASE}${encodeURIComponent(page.title)}`,
		intro,
		sections,
		fullText: page.extract,
		fetchedAt: new Date().toISOString(),
	};
}

function cacheKeyFor(query) {
	return `${Buffer.from(query, "utf8").toString("base64url")}.json`;
}

async function readCache(query, ttlMs) {
	try {
		const file = path.join(CACHE_DIR, cacheKeyFor(query));
		const raw = await fs.readFile(file, "utf8");
		const cached = JSON.parse(raw);
		if (cached.v !== CACHE_VERSION) return null;
		if (Date.now() - Date.parse(cached.cachedAt || 0) > ttlMs) return null;
		return cached.result;
	} catch {
		return null;
	}
}

async function writeCache(query, result) {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true });
		await fs.writeFile(
			path.join(CACHE_DIR, cacheKeyFor(query)),
			JSON.stringify(
				{ v: CACHE_VERSION, cachedAt: new Date().toISOString(), result },
				null,
				2,
			),
			"utf8",
		);
	} catch {}
}

/**
 * 面向作品条目的智能抓取：
 * 依次尝试 标题变体精确命中 → 全文搜索，返回第一个有实质内容的条目。
 */
export async function fetchMoegirlArticleForWork(workTitle, options = {}) {
	const { useCache = true, ttlMs = CACHE_TTL_MS } = options;
	const query = String(workTitle || "").trim();
	if (!query) return null;

	if (useCache) {
		const cached = await readCache(query, ttlMs);
		if (cached !== null) return cached;
	}

	let article = null;
	const tried = new Set();
	for (const variant of titleVariants(query)) {
		if (tried.has(variant)) continue;
		tried.add(variant);
		article = await fetchMoegirlArticle(variant);
		if (article && article.intro.length >= 40) break;
		article = null;
	}
	if (!article) {
		const candidates = await searchMoegirlTitles(query, 5).catch(() => []);
		for (const candidate of candidates) {
			if (tried.has(candidate)) continue;
			tried.add(candidate);
			article = await fetchMoegirlArticle(candidate);
			if (article && article.intro.length >= 40) break;
			article = null;
		}
	}

	if (useCache) await writeCache(query, article);
	return article;
}

/** 从章节列表中提取剧情类章节文本 */
export function findStorySection(article) {
	if (!article?.sections) return "";
	const storyPatterns =
		/^(剧情简介|故事简介|剧情|故事梗概|内容简介|简介|故事|世界观|背景设定)$/;
	let collecting = "";
	for (const section of article.sections) {
		if (storyPatterns.test(section.heading)) {
			collecting = section.text;
			break;
		}
	}
	return collecting;
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
