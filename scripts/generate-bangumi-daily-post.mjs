import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	DEFAULT_FALLBACK_IMAGE,
	buildAnimeArticleMarkdown,
	buildEnhancedArticleMarkdown,
	buildReviewReport,
	chooseBestCoverImage,
	createStateRecord,
	formatDate,
	readJsonIfExists,
	selectNextAnimeCandidate,
	sanitizeFileName,
	slugifyTitle,
	truncateText,
	pickInfoboxValue,
	writeJson,
} from "./bangumi-daily-posts.mjs";

import {
	analyzeMoegirlArticle,
	polishArticleContent,
	qualityCheck,
	getMoegirlCharacters,
} from "./moegirl-article-analyzer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const STATE_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-posts-state.json");
const REPORT_FILE = path.join(ROOT_DIR, "reports", "bangumi-daily-posts-latest.json");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const LOG_FILE = path.join(LOG_DIR, `bangumi-daily-post-${formatDate(new Date(), "file")}.log`);

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";
const WIKIPEDIA_API_URL = "https://zh.wikipedia.org/w/api.php";
const MOEGIRL_API_URL = "https://zh.moegirl.org.cn/api.php";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

function getEnvBoolean(name, defaultValue = false) {
	const raw = process.env[name];
	if (raw == null || raw === "") {
		return defaultValue;
	}
	return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function getEnvNumber(name, defaultValue) {
	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? raw : defaultValue;
}

async function fetchJson(url, init, retries = MAX_RETRY_ATTEMPTS) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, {
				headers: {
					"accept": "application/json",
					"user-agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
					...(init?.headers || {}),
				},
				...init,
			});
			if (!response.ok) {
				throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
			}
			return await response.json();
		} catch (error) {
			if (attempt === retries) {
				throw error;
			}
			await sleep(RETRY_DELAY_MS * attempt);
		}
	}
}

async function fetchText(url, init, retries = MAX_RETRY_ATTEMPTS) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, {
				headers: {
					"accept": "text/html,application/xhtml+xml,*/*",
					"user-agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
					...(init?.headers || {}),
				},
				...init,
			});
			if (!response.ok) {
				throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
			}
			return await response.text();
		} catch (error) {
			if (attempt === retries) {
				throw error;
			}
			await sleep(RETRY_DELAY_MS * attempt);
		}
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dirPath) {
	try {
		await fs.mkdir(dirPath, { recursive: true });
	} catch (error) {
		if (error.code !== "EEXIST") {
			throw error;
		}
	}
}

class Logger {
	constructor(logFile) {
		this.logFile = logFile;
		this.entries = [];
	}

	async init() {
		await ensureDir(path.dirname(this.logFile));
	}

	async log(level, message, data = null) {
		const entry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...(data && { data }),
		};
		this.entries.push(entry);
		const logLine = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}${data ? " " + JSON.stringify(data) : ""}`;
		console.log(logLine);
		try {
			await fs.appendFile(this.logFile, logLine + "\n", "utf8");
		} catch (error) {
			console.warn(`Failed to write to log file: ${error.message}`);
		}
	}

	info(message, data) { return this.log("INFO", message, data); }
	warn(message, data) { return this.log("WARN", message, data); }
	error(message, data) { return this.log("ERROR", message, data); }
	success(message, data) { return this.log("SUCCESS", message, data); }
}

async function readExistingPosts() {
	const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
	const posts = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) {
			continue;
		}
		const fullPath = path.join(POSTS_DIR, entry.name);
		const raw = await fs.readFile(fullPath, "utf8");
		const match = raw.match(/^---\n([\s\S]*?)\n---/);
		if (!match) {
			continue;
		}
		const frontmatter = match[1];
		const getField = (name) => {
			const fieldMatch = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
			if (!fieldMatch) return "";
			return fieldMatch[1].trim().replace(/^['\"]|['\"]$/g, "");
		};
		posts.push({
			filePath: fullPath,
			title: getField("title"),
			alias: getField("alias"),
			sourceLink: getField("sourceLink"),
		});
	}
	return posts;
}

function deriveStatusLabel(type) {
	const mapping = {
		1: "想看",
		2: "看过",
		3: "在看",
		4: "搁置",
		5: "抛弃",
	};
	return mapping[type] || "已收藏";
}

function buildTags(candidate, detail) {
	const tags = [];
	const subjectTags = Array.isArray(candidate?.subject?.tags) ? candidate.subject.tags : [];
	for (const tag of subjectTags) {
		const name = typeof tag === "string" ? tag : tag?.name;
		if (name && !tags.includes(name)) {
			tags.push(name);
		}
		if (tags.length >= 5) break;
	}
	const platform = pickInfoboxValue(detail, ["放送星期", "播放电视台", "平台"]);
	if (platform && !tags.includes(platform) && tags.length < 6) {
		tags.push(platform);
	}
	if (!tags.includes("Bangumi") && tags.length < 6) {
		tags.push("Bangumi");
	}
	return tags;
}

function summarizeStudio(value) {
	if (!value) return "";
	return String(value).split(/[（(]/)[0].trim();
}

function extractStaff(detail) {
	const infobox = Array.isArray(detail?.infobox) ? detail.infobox : [];
	const interestingKeys = ["导演", "监督", "系列构成", "人物设定", "动画制作", "製作", "制作"];
	const staff = [];
	for (const key of interestingKeys) {
		const value = pickInfoboxValue({ infobox }, [key]);
		if (value) {
			staff.push({ relation: key, name: value });
		}
	}
	return staff;
}

function buildMeta(candidate, detail, statusLabel) {
	const studio = summarizeStudio(
		pickInfoboxValue(detail, ["动画制作", "製作", "制作", "制作公司", "Studio"]),
	);
	const airDate = candidate?.subject?.date || detail?.date || "";
	const episodes = candidate?.subject?.eps || detail?.eps || candidate?.ep_status || "";
	return {
		studio,
		airDate,
		episodes: episodes ? `${episodes} 话` : "",
		progress: candidate?.ep_status ? `已看到 ${candidate.ep_status} 话` : "",
		statusLabel,
	};
}

async function fetchBangumiSubjectDetail(subjectId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/subjects/${subjectId}`);
	} catch (error) {
		throw new Error(`Failed to fetch Bangumi subject detail for ${subjectId}: ${error.message}`);
	}
}

async function fetchBangumiCharacters(subjectId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/subjects/${subjectId}/characters`);
	} catch (error) {
		throw new Error(`Failed to fetch Bangumi characters for ${subjectId}: ${error.message}`);
	}
}

async function searchWikipedia(title, limit = 5) {
	const params = new URLSearchParams({
		action: "query",
		list: "search",
		srsearch: title,
		srlimit: limit,
		format: "json",
		origin: "*",
	});

	try {
		const data = await fetchJson(`${WIKIPEDIA_API_URL}?${params}`);
		if (!data?.query?.search) {
			return [];
		}
		return data.query.search.map((item) => ({
			title: item.title,
			snippet: item.snippet.replace(/<[^>]*>/g, ""),
			pageId: item.pageid,
		}));
	} catch (error) {
		throw new Error(`Wikipedia search failed: ${error.message}`);
	}
}

async function getWikipediaPage(title) {
	const params = new URLSearchParams({
		action: "query",
		titles: title,
		prop: "extracts",
		explaintext: true,
		exintro: true,
		format: "json",
		origin: "*",
	});

	try {
		const data = await fetchJson(`${WIKIPEDIA_API_URL}?${params}`);
		const pages = data?.query?.pages || {};
		const pageId = Object.keys(pages)[0];
		if (!pageId || pageId === "-1") {
			return null;
		}
		return {
			title: pages[pageId].title,
			extract: pages[pageId].extract || "",
		};
	} catch (error) {
		throw new Error(`Failed to get Wikipedia page: ${error.message}`);
	}
}

async function searchMoegirlDirect(title, limit = 5) {
	const params = new URLSearchParams({
		action: "query",
		list: "search",
		srsearch: title,
		srlimit: limit,
		format: "json",
	});

	try {
		const response = await fetch(`${MOEGIRL_API_URL}?${params}`, {
			headers: {
				"User-Agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = await response.json();
		if (!data?.query?.search) {
			return [];
		}
		return data.query.search.map((item) => ({
			title: item.title,
			snippet: item.snippet.replace(/<[^>]*>/g, ""),
			pageId: item.pageid,
		}));
	} catch (error) {
		throw new Error(`Moegirl search failed: ${error.message}`);
	}
}

async function getMoegirlPageDirect(title) {
	const params = new URLSearchParams({
		action: "query",
		titles: title,
		prop: "extracts",
		explaintext: true,
		format: "json",
	});

	try {
		const response = await fetch(`${MOEGIRL_API_URL}?${params}`, {
			headers: {
				"User-Agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
			},
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = await response.json();
		const pages = data?.query?.pages || {};
		const pageId = Object.keys(pages)[0];
		if (!pageId || pageId === "-1") {
			return null;
		}
		return {
			title: pages[pageId].title,
			extract: pages[pageId].extract || "",
		};
	} catch (error) {
		throw new Error(`Failed to get Moegirl page: ${error.message}`);
	}
}

async function fetchDoubaoResponse(prompt, retries = MAX_RETRY_ATTEMPTS) {
	const apiKey = process.env.DOUBAN_API_KEY;
	if (!apiKey) {
		throw new Error("Doubao API key not configured (DOUBAN_API_KEY)");
	}

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "doubao-pro-32k",
					messages: [
						{
							role: "system",
							content: "你是一个专业的ACG内容分析助手，请根据用户提供的动漫作品信息，生成简洁、有价值的补充内容。",
						},
						{
							role: "user",
							content: prompt,
						},
					],
					max_tokens: 1000,
					temperature: 0.7,
				}),
			});

			if (!response.ok) {
				throw new Error(`Doubao API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.choices?.[0]?.message?.content || "";
		} catch (error) {
			if (attempt === retries) {
				throw error;
			}
			await sleep(RETRY_DELAY_MS * attempt);
		}
	}
}

function generateDoubaoPrompt(animeTitle, summary, characters) {
	return `请为以下动漫作品生成补充内容：

作品名称：${animeTitle}

作品简介：
${summary}

主要角色：
${characters.map((c) => `- ${c.name}${c.cv ? ` (CV: ${c.cv})` : ""}`).join("\n")}

请提供：
1. 作品的特色分析（50字左右）
2. 角色亮点描述（每个角色30字左右）
3. 观看建议（30字左右）`;
}

function fuseContent(original, wikipediaContent, moegirlContent, doubaoContent) {
	const fused = {
		original,
		sources: [],
		additions: [],
	};

	if (wikipediaContent) {
		fused.sources.push({
			source: "wikipedia",
			title: wikipediaContent.title,
			relevance: 0.7,
		});
		fused.additions.push({
			source: "wikipedia",
			content: wikipediaContent.extract,
			priority: 0.7,
		});
	}

	if (moegirlContent) {
		fused.sources.push({
			source: "moegirl",
			title: moegirlContent.title,
			relevance: 0.9,
		});
		fused.additions.push({
			source: "moegirl",
			content: moegirlContent.extract,
			priority: 0.9,
		});
	}

	if (doubaoContent) {
		fused.sources.push({
			source: "doubao",
			title: "豆包AI补充",
			relevance: 0.6,
		});
		fused.additions.push({
			source: "doubao",
			content: doubaoContent,
			priority: 0.6,
		});
	}

	return fused;
}

function integrateFusedContent(articleContent, fusedData) {
	if (!fusedData.additions || fusedData.additions.length === 0) {
		return articleContent;
	}

	const sortedAdditions = fusedData.additions.sort((a, b) => b.priority - a.priority);

	let enhancedContent = articleContent;

	const wikiAddition = sortedAdditions.find((a) => a.source === "wikipedia");
	const moegirlAddition = sortedAdditions.find((a) => a.source === "moegirl");

	if (wikiAddition && wikiAddition.content.length > 100) {
		const wikiSnippet = wikiAddition.content.substring(0, 300) + "...";
	}

	if (moegirlAddition && moegirlAddition.content.length > 100) {
		const moegirlSnippet = moegirlAddition.content.substring(0, 300) + "...";
	}

	return enhancedContent;
}

function collectBangumiImageCandidates(candidate, detail) {
	const images = [];
	const subject = candidate?.subject || {};
	const detailImages = detail?.images || {};
	const add = (url, source, width, height, title) => {
		if (!url) return;
		images.push({ url, source, width, height, title });
	};
	add(detailImages.large, "bangumi-large", 1200, 1700, subject?.name_cn || subject?.name || detail?.name);
	add(detailImages.common, "bangumi-common", 900, 1280, subject?.name_cn || subject?.name || detail?.name);
	add(subject?.images?.large, "bangumi-large", 1200, 1700, subject?.name_cn || subject?.name);
	add(subject?.images?.common, "bangumi-common", 900, 1280, subject?.name_cn || subject?.name);
	add(subject?.images?.medium, "bangumi-medium", 600, 800, subject?.name_cn || subject?.name);
	return images;
}

function resolveCoverImage(candidate, detail) {
	const names = [candidate?.subject?.name_cn, candidate?.subject?.name, detail?.name_cn, detail?.name].filter(Boolean);
	const bangumiCandidates = collectBangumiImageCandidates(candidate, detail);
	const result = chooseBestCoverImage(bangumiCandidates, { names });
	if (result.selected) {
		return result;
	}
	return {
		selected: { url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback" },
		candidates: [{ url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback", score: 0 }],
	};
}

function buildArticlePayload(candidate, detail, imageSelection, options) {
	const titleText = candidate?.subject?.name_cn || candidate?.subject?.name || detail?.name_cn || detail?.name || `Bangumi 条目 ${candidate.subject_id}`;
	const articleTitle = `《${titleText}》`;
	const alias = slugifyTitle(candidate?.subject?.name || candidate?.subject?.name_cn || titleText, `bangumi-${candidate.subject_id}`);
	const description = truncateText(
		detail?.summary || candidate?.subject?.short_summary || candidate?.subject?.name_cn || candidate?.subject?.name,
		120,
	);
	const statusLabel = deriveStatusLabel(candidate?.type);
	const tags = buildTags(candidate, detail);
	const meta = buildMeta(candidate, detail, statusLabel);
	return {
		subjectId: candidate.subject_id,
		title: articleTitle,
		originalTitle: candidate?.subject?.name || detail?.name || "",
		description,
		summary: (detail?.summary || candidate?.subject?.short_summary || "").trim(),
		tags,
		category: tags[0] ? `${tags[0]}作品介绍` : "Bangumi 每日追番",
		sourceLink: `https://bgm.tv/subject/${candidate.subject_id}`,
		published: formatDate(options.now),
		alias,
		image: imageSelection.selected?.url || DEFAULT_FALLBACK_IMAGE,
		draft: options.reviewMode,
		meta,
		staff: extractStaff(detail),
		statusLabel,
		reviewMode: options.reviewMode,
		moegirlContent: options.moegirlContent || null,
		characters: options.characters || [],
		fusedContent: options.fusedContent || null,
	};
}

async function main() {
	const logger = new Logger(LOG_FILE);
	await logger.init();

	const startTime = Date.now();
	const reviewMode = getEnvBoolean("BANGUMI_POST_REVIEW_MODE", false);
	const maxPerRun = getEnvNumber("BANGUMI_POSTS_PER_RUN", 1);
	const cacheFile = path.join(ROOT_DIR, ".cache", "bangumi", "anime.json");
	const now = new Date();

	await logger.info("Starting Bangumi daily post generation", {
		reviewMode,
		maxPerRun,
		startTime: now.toISOString(),
	});

	try {
		const rawCollections = await readJsonIfExists(cacheFile, null);
		const normalizedCollections = Array.isArray(rawCollections)
			? rawCollections.map((item) => ({
				subject_id: Number(String(item.link || "").match(/\/subject\/(\d+)/)?.[1] || 0),
				type: item.status === "watching" ? 3 : item.status === "completed" ? 2 : item.status === "planned" ? 1 : item.status === "on_hold" ? 4 : item.status === "dropped" ? 5 : 0,
				ep_status: Number(item.progress || 0),
				updated_at: item.endDate || item.startDate || `${item.year || "1970"}-01-01`,
				subject: {
					id: Number(String(item.link || "").match(/\/subject\/(\d+)/)?.[1] || 0),
					name: item.title || "",
					name_cn: item.title || "",
					date: item.startDate || "",
					eps: Number(item.totalEpisodes || 0),
					short_summary: item.description || "",
					tags: Array.isArray(item.genre) ? item.genre.map((name) => ({ name })) : [],
					images: {
						large: item.cover || "",
						common: item.cover || "",
						medium: item.cover || "",
					},
				},
			}))
			: Array.isArray(rawCollections?.data)
				? rawCollections.data
				: [];

		if (normalizedCollections.length === 0) {
			await logger.warn("No Bangumi anime cache data found, skipping daily article generation");
			return;
		}

		await logger.info(`Loaded ${normalizedCollections.length} items from cache`);

		const generatedState = await readJsonIfExists(STATE_FILE, { generated: [] });
		const existingPosts = await readExistingPosts();
		const selected = selectNextAnimeCandidate({
			collections: normalizedCollections,
			generatedState,
			existingPosts,
			maxPerRun,
		});

		if (selected.length === 0) {
			await logger.warn("No new Bangumi anime candidates available for article generation");
			await writeJson(REPORT_FILE, buildReviewReport({
				selected: null,
				candidates: [],
				outputPath: "",
				statePath: STATE_FILE,
				reviewMode,
			}));
			return;
		}

		const candidate = selected[0];
		await logger.info(`Selected subject ${candidate.subject_id}: ${candidate?.subject?.name_cn || candidate?.subject?.name}`);

		const titleText = candidate?.subject?.name_cn || candidate?.subject?.name || "";

		await logger.info(`Fetching Bangumi subject detail for ${candidate.subject_id}...`);
		const detail = await fetchBangumiSubjectDetail(candidate.subject_id);

		await logger.info(`Fetching Bangumi characters for ${candidate.subject_id}...`);
		const characters = await fetchBangumiCharacters(candidate.subject_id);

		await logger.info("Resolving cover image...");
		const imageSelection = resolveCoverImage(candidate, detail);
		await logger.info(`Selected cover: ${imageSelection.selected?.url || "default"}`);

		let wikipediaContent = null;
		let moegirlContent = null;
		let doubaoContent = null;
		const useWikipedia = getEnvBoolean("BANGUMI_POST_USE_WIKIPEDIA", true);
		const useMoegirl = getEnvBoolean("BANGUMI_POST_USE_MOEIRL", true);
		const useDoubao = getEnvBoolean("BANGUMI_POST_USE_DOUBAN", false);

		if (useWikipedia) {
			await logger.info(`Searching Wikipedia for: ${titleText}`);
			try {
				const wikiResults = await searchWikipedia(titleText, 3);
				if (wikiResults && wikiResults.length > 0) {
					wikipediaContent = await getWikipediaPage(wikiResults[0].title);
					if (wikipediaContent) {
						await logger.success(`Wikipedia content retrieved: ${wikipediaContent.title}`);
					}
				}
			} catch (error) {
				await logger.warn(`Wikipedia integration failed: ${error.message}`);
			}
		}

		if (useMoegirl) {
			await logger.info(`Searching Moegirl for: ${titleText}`);
			try {
				const moegirlResults = await searchMoegirlDirect(titleText, 3);
				if (moegirlResults && moegirlResults.length > 0) {
					moegirlContent = await getMoegirlPageDirect(moegirlResults[0].title);
					if (moegirlContent) {
						await logger.success(`Moegirl content retrieved: ${moegirlContent.title}`);

						const moegirlChars = await getMoegirlCharacters(moegirlResults[0].title);
						if (moegirlChars && moegirlChars.length > 0) {
							await logger.success(`Moegirl characters retrieved: ${moegirlChars.length}`);
							characters.unshift(...moegirlChars.map((c) => ({
								...c,
								source: "moegirl",
							})));
						}
					}
				}
			} catch (error) {
				await logger.warn(`Moegirl integration failed: ${error.message}`);
			}
		}

		if (useDoubao) {
			await logger.info(`Generating Doubao content for: ${titleText}`);
			try {
				const prompt = generateDoubaoPrompt(
					titleText,
					detail?.summary || "",
					characters.slice(0, 5),
				);
				doubaoContent = await fetchDoubaoResponse(prompt);
				if (doubaoContent) {
					await logger.success(`Doubao content generated (${doubaoContent.length} chars)`);
				}
			} catch (error) {
				await logger.warn(`Doubao integration failed: ${error.message}`);
			}
		}

		const fusedContent = fuseContent(
			detail?.summary || "",
			wikipediaContent,
			moegirlContent,
			doubaoContent,
		);
		await logger.info(`Content fusion complete: ${fusedContent.sources.length} sources integrated`);

		const payload = buildArticlePayload(candidate, detail, imageSelection, {
			now,
			reviewMode,
			moegirlContent,
			characters,
			fusedContent,
		});

		const useEnhancedFormat = getEnvBoolean("BANGUMI_POST_USE_ENHANCED_FORMAT", true);
		await logger.info(`Building article markdown (${useEnhancedFormat ? "enhanced" : "standard"})...`);
		let articleContent = useEnhancedFormat
			? buildEnhancedArticleMarkdown(payload)
			: buildAnimeArticleMarkdown(payload);

		if (fusedContent.additions.length > 0) {
			await logger.info("Integrating fused content into article...");
			articleContent = integrateFusedContent(articleContent, fusedContent);
		}

		const enablePolishing = getEnvBoolean("BANGUMI_POST_ENABLE_POLISHING", true);
		if (enablePolishing) {
			await logger.info("Executing Moegirl style analysis and content polishing...");
			const analysis = await analyzeMoegirlArticle(articleContent, payload.title);
			await logger.info(`Article analysis score: ${analysis.score}/100`);

			if (analysis.suggestions.length > 0) {
				await logger.info(`Optimization suggestions (${analysis.suggestions.length} items)`);
			}

			articleContent = polishArticleContent(articleContent, analysis);
			await logger.info("Content polishing complete");

			await logger.info("Executing quality check...");
			const qcResult = qualityCheck(articleContent, payload.title);
			if (qcResult.passed) {
				await logger.success("Quality check passed");
			} else {
				await logger.warn("Quality check not fully passed, continuing with publication");
				const failedChecks = Object.entries(qcResult.checks).filter(([k, v]) => !v.passed).map(([k]) => k);
				await logger.warn(`Failed checks: ${failedChecks.join(", ")}`);
			}
		}

		const safeAlias = sanitizeFileName(payload.alias, `bangumi-${candidate.subject_id}`);
		const outputFileName = `${safeAlias}.md`;
		const outputPath = path.join(POSTS_DIR, outputFileName);

		await logger.info(`Writing article to ${outputPath}...`);
		await fs.writeFile(outputPath, articleContent, "utf8");
		await logger.success(`Article written to ${outputPath}`);

		const newRecord = createStateRecord({
			subjectId: candidate.subject_id,
			title: payload.title,
			filePath: outputPath,
			alias: payload.alias,
			sourceLink: payload.sourceLink,
			published: payload.published,
			image: payload.image,
			reviewMode,
		});

		generatedState.generated = [
			...(generatedState.generated || []),
			newRecord,
		];
		await writeJson(STATE_FILE, generatedState);
		await logger.success(`Updated state file ${STATE_FILE}`);

		await writeJson(REPORT_FILE, buildReviewReport({
			selected: candidate,
			candidates: imageSelection.candidates,
			outputPath,
			statePath: STATE_FILE,
			reviewMode,
		}));

		const duration = Date.now() - startTime;
		await logger.success(`Bangumi daily post generation completed in ${duration}ms`);

	} catch (error) {
		await logger.error(`Generation failed: ${error.message}`, {
			stack: error.stack,
		});
		throw error;
	}
}

main().catch((error) => {
	console.error("Bangumi daily post generation failed:", error);
	process.exit(1);
});