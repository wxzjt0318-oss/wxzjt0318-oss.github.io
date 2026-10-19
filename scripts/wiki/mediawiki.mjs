/**
 * 通用 MediaWiki 条目抓取客户端（萌娘百科 / 中文维基百科共用）
 * ─────────────────────────────────────────────────────────────────────────────
 * createMediaWikiClient({ name, api, pageBase, cacheDir, ... }) 返回：
 *   - search(query, limit)          全文搜索 → 标题列表
 *   - fetchArticle(title)           按标题抓取（跟随重定向，过滤消歧页）
 *   - fetchArticleForWork(titles)   依次尝试多个候选标题 + 变体 + 搜索兜底
 *
 * 条目结构：{ site, title, pageUrl, intro, sections: [{ heading, text }], fullText, fetchedAt }
 * 磁盘缓存：<cacheDir>/<key>.json，默认 7 天 TTL。
 */

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TTL_MS = 7 * 24 * 3_600_000;

/** 作品名变体：动画季度 / OVA 条目在百科中通常收在系列主条目下 */
export function titleVariants(rawTitle) {
	const base = String(rawTitle || "").trim();
	const variants = [base];
	const stripPatterns = [
		/\s*(OAD|OVA|TV|剧场版|電影|电影|SP|特别篇|总集篇)\s*\d*\s*$/i,
		/\s*第[一二三四五六七八九十\d]+季\s*$/,
		/\s*第[一二三四五六七八九十\d]+期\s*$/,
		/\s*[（(].*?[）)]\s*$/,
		/\s*[:：].*$/,
		/\s+Season\s*\d+\s*$/i,
		/\s+\d+(nd|rd|th)\s+Season\s*$/i,
		/\s*[FＦ]$/,
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

const STORY_HEADING_RE =
	/^(剧情简介|故事简介|剧情|劇情|劇情簡介|故事梗概|内容简介|內容簡介|简介|簡介|故事|概要|世界观|背景设定)$/;

/** 从章节列表中提取剧情类章节文本 */
export function findStorySection(article) {
	if (!article?.sections) return "";
	for (const section of article.sections) {
		if (STORY_HEADING_RE.test(section.heading) && section.text) {
			return section.text;
		}
	}
	return "";
}

export function createMediaWikiClient({
	name,
	api,
	pageBase,
	userAgent,
	cacheDir,
	cacheVersion = 1,
	cacheTtlMs = DEFAULT_TTL_MS,
	minIntervalMs = 300,
	extraQueryParams = {},
	fetchImpl = (...args) => fetch(...args),
}) {
	let lastRequestAt = 0;

	async function throttle() {
		const wait = minIntervalMs - (Date.now() - lastRequestAt);
		if (wait > 0) {
			await new Promise((r) => setTimeout(r, wait));
		}
		lastRequestAt = Date.now();
	}

	async function apiGet(params, { retries = 3 } = {}) {
		const url = `${api}?${new URLSearchParams({ format: "json", ...extraQueryParams, ...params })}`;
		for (let attempt = 0; attempt < retries; attempt++) {
			await throttle();
			try {
				const res = await fetchImpl(url, {
					headers: { "user-agent": userAgent },
				});
				if (res.status === 429 || res.status >= 500) {
					const waitMs = 1500 * (attempt + 1);
					console.warn(`⚠ ${name} ${res.status}, ${waitMs}ms 后重试…`);
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
		throw new Error(`${name} apiGet: 重试次数用尽`);
	}

	async function search(query, limit = 5) {
		const data = await apiGet({
			action: "query",
			list: "search",
			srsearch: query,
			srlimit: String(limit),
			srnamespace: "0",
		});
		return (data?.query?.search || []).map((item) => item.title);
	}

	async function fetchArticle(title) {
		const data = await apiGet({
			action: "query",
			prop: "extracts|info|pageprops",
			ppprop: "disambiguation",
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
		if (page.pageprops && "disambiguation" in page.pageprops) {
			return null;
		}
		const { intro, sections } = parseExtract(page.extract);
		return {
			site: name,
			title: page.title,
			pageUrl: page.fullurl || `${pageBase}${encodeURIComponent(page.title)}`,
			intro,
			sections,
			fullText: page.extract,
			fetchedAt: new Date().toISOString(),
		};
	}

	function cacheFile(key) {
		return path.join(
			cacheDir,
			`${Buffer.from(key, "utf8").toString("base64url")}.json`,
		);
	}

	async function readCache(key) {
		if (!cacheDir) return undefined;
		try {
			const cached = JSON.parse(await fs.readFile(cacheFile(key), "utf8"));
			if (cached.v !== cacheVersion) return undefined;
			if (Date.now() - Date.parse(cached.cachedAt || 0) > cacheTtlMs) {
				return undefined;
			}
			return cached.result;
		} catch {
			return undefined;
		}
	}

	async function writeCache(key, result) {
		if (!cacheDir) return;
		try {
			await fs.mkdir(cacheDir, { recursive: true });
			await fs.writeFile(
				cacheFile(key),
				JSON.stringify(
					{ v: cacheVersion, cachedAt: new Date().toISOString(), result },
					null,
					2,
				),
				"utf8",
			);
		} catch {}
	}

	/**
	 * 面向作品的智能抓取：依次尝试 每个候选标题的变体精确命中 → 全文搜索，
	 * 返回第一个导言足够长且通过 accept() 校验的条目。
	 */
	async function fetchArticleForWork(titles, options = {}) {
		const {
			useCache = true,
			minIntroLength = 40,
			accept = () => true,
			searchLimit = 5,
		} = options;
		const queries = [
			...new Set(
				(Array.isArray(titles) ? titles : [titles])
					.map((t) => String(t || "").trim())
					.filter(Boolean),
			),
		];
		if (queries.length === 0) return null;

		const cacheKey = queries.join("|");
		if (useCache) {
			const cached = await readCache(cacheKey);
			if (cached !== undefined) return cached;
		}

		const tried = new Set();
		const tryTitle = async (title) => {
			if (tried.has(title)) return null;
			tried.add(title);
			const article = await fetchArticle(title);
			return article &&
				article.intro.length >= minIntroLength &&
				accept(article)
				? article
				: null;
		};

		let article = null;
		outer: for (const query of queries) {
			for (const variant of titleVariants(query)) {
				article = await tryTitle(variant);
				if (article) break outer;
			}
		}
		if (!article) {
			outer: for (const query of queries) {
				const candidates = await search(query, searchLimit).catch(() => []);
				for (const candidate of candidates) {
					article = await tryTitle(candidate);
					if (article) break outer;
				}
			}
		}

		if (useCache) await writeCache(cacheKey, article);
		return article;
	}

	return { name, apiGet, search, fetchArticle, fetchArticleForWork };
}
