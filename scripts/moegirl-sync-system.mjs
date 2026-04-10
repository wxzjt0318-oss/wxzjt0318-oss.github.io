import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MOEGIRL_API_BASE = "https://zh.moegirl.org.cn/api.php";
const MOEGIRL_PAGE_BASE = "https://zh.moegirl.org.cn/";

const REQUEST_DELAY_MS = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 5000;
const LOG_FILE = "logs/moegirl-sync.log";

const LOG_LEVELS = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

let lastRequestTime = 0;

async function writeLog(level, message, data = {}) {
	const timestamp = new Date().toISOString();
	const logEntry = { timestamp, level, message, ...data };
	const logLine = JSON.stringify(logEntry) + "\n";
	try {
		await fs.mkdir("logs", { recursive: true });
		await fs.appendFile(LOG_FILE, logLine, "utf8");
	} catch {}
	if (level >= CURRENT_LOG_LEVEL) {
		const prefix = { 0: "DEBUG", 1: "INFO", 2: "WARN", 3: "ERROR" }[level] || "INFO";
		console.log(`[${prefix}] ${message}`, Object.keys(data).length > 0 ? data : "");
	}
}

async function rateLimitedFetch(url, options = {}, retries = MAX_RETRIES) {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < REQUEST_DELAY_MS) {
		await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - timeSinceLastRequest));
	}
	lastRequestTime = Date.now();

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

			const response = await fetch(url, {
				...options,
				signal: controller.signal,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					...options.headers,
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return response;
		} catch (error) {
			if (attempt < retries && (error.name === "AbortError" || error.message.includes("HTTP 5"))) {
				writeLog(LOG_LEVELS.WARN, `Retry fetch attempt ${attempt + 1}`, { url, error: error.message });
				await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
				continue;
			}
			throw error;
		}
	}
}

function normalizeText(value) {
	return String(value || "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[《》「」『』【】()（）\[\]{}]/g, " ")
		.replace(/[·•・:：;；,.，。!?！？~～'"`]/g, " ")
		.replace(/[\u3000\s]+/g, " ")
		.trim();
}

function calculateContentHash(content) {
	return crypto.createHash("md5").update(content || "").digest("hex");
}

function generateAlternativeTitles(title) {
	const alternatives = new Set();
	alternatives.add(title);
	alternatives.add(title.replace(/[!?！？!]/g, ''));

	if (title.includes('辣妹') && title.includes('阿宅')) {
		const normalized = title.replace(/[!?！？!]/g, '');
		if (normalized.startsWith('没有')) {
			alternatives.add('哪里有温柔对待阿宅的辣妹');
		} else if (normalized.startsWith('哪里有')) {
			alternatives.add('没有温柔对待阿宅的辣妹');
		}
		alternatives.add('辣妹阿宅');
		alternatives.add('宅男辣妹');
	}

	const standardReplace = title
		.replace(/^没有/, '哪里有')
		.replace(/^哪里有/, '没有');
	if (standardReplace !== title) {
		alternatives.add(standardReplace);
	}

	return Array.from(alternatives).filter(t => t !== title);
}

function extractSemanticCore(title) {
	const normalized = normalizeText(title);
	const cores = ['辣妹', '阿宅', '温柔', '宅男', '傲娇', '恋爱', '校园'];
	const matched = cores.filter(c => normalized.includes(c));
	return matched;
}

function hasSharedSemanticCore(title1, title2) {
	const core1 = extractSemanticCore(title1);
	const core2 = extractSemanticCore(title2);
	if (core1.length === 0 || core2.length === 0) return false;
	const shared = core1.filter(c => core2.some(c2 => c2.includes(c) || c.includes(c2)));
	return shared.length >= 1;
}

function calculateSimilarity(text1, text2) {
	const t1 = normalizeText(text1);
	const t2 = normalizeText(text2);
	if (t1 === t2) return 1;
	if (t1.includes(t2) || t2.includes(t1)) return 0.9;

	const semanticMatch = hasSharedSemanticCore(text1, text2);

	const words1 = t1.split(/\s+/).filter(w => w.length >= 2);
	const words2 = t2.split(/\s+/).filter(w => w.length >= 2);
	const common = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
	const total = new Set([...words1, ...words2]).size;
	const baseSimilarity = total > 0 ? (common.length / total) : 0;

	return semanticMatch ? Math.min(Math.max(baseSimilarity * 1.5, 0.6), 1) : baseSimilarity;
}

export class MoegirlContentFetcher {
	constructor(options = {}) {
		this.apiBase = options.apiBase || MOEGIRL_API_BASE;
		this.pageBase = options.pageBase || MOEGIRL_PAGE_BASE;
		this.cacheDir = options.cacheDir || "data/moegirl-cache";
		this.stateFile = options.stateFile || "data/moegirl-sync-state.json";
		this.versionHistoryDir = options.versionHistoryDir || "data/moegirl-versions";
		this.rateLimitMs = options.rateLimitMs || REQUEST_DELAY_MS;
		this.titleCache = new Map();
	}

	async initialize() {
		try {
			await fs.mkdir(this.cacheDir, { recursive: true });
			await fs.mkdir(this.versionHistoryDir, { recursive: true });
			await fs.mkdir("logs", { recursive: true });
		} catch {}
	}

	async fetchByTitle(title, options = {}) {
		const { useCache = true, forceRefresh = false } = options;
		const cacheKey = `title:${title}`;

		if (useCache && !forceRefresh && this.titleCache.has(cacheKey)) {
			writeLog(LOG_LEVELS.DEBUG, `Title cache hit`, { title });
			return this.titleCache.get(cacheKey);
		}

		if (useCache && !forceRefresh) {
			const cached = await this.getCachedContent(title);
			if (cached) {
				writeLog(LOG_LEVELS.DEBUG, `Cache hit for title`, { title });
				this.titleCache.set(cacheKey, cached);
				return cached;
			}
		}

		const searchTitles = [title, ...generateAlternativeTitles(title)];

		for (const searchTitle of searchTitles) {
			try {
				writeLog(LOG_LEVELS.INFO, `Trying search title`, { original: title, searching: searchTitle });

				const opensearchResponse = await rateLimitedFetch(
					`${this.apiBase}?action=opensearch&search=${encodeURIComponent(searchTitle)}&limit=5&format=json`
				);
				const searchData = await opensearchResponse.json();
				const pages = searchData[1] || [];

				if (pages.length > 0) {
					for (const pageName of pages) {
						const content = await this.fetchPageContent(pageName, { forceRefresh: true });
						if (content && content.extractLength > 100) {
							content.matchedTitle = title;
							content.searchedTitles = searchTitles;
							await this.cacheContent(title, content);
							this.titleCache.set(cacheKey, content);
							return content;
						}
					}
				}

				const genResponse = await rateLimitedFetch(
					`${this.apiBase}?action=query&generator=search&gsrsearch=${encodeURIComponent(searchTitle)}&gsrlimit=10&format=json`
				);
				const genData = await genResponse.json();

				if (genData.query?.pages) {
					const pages = Object.values(genData.query.pages).sort((a, b) => (b.index || 0) - (a.index || 0));

					for (const page of pages) {
						const similarity = calculateSimilarity(title, page.title);
						if (similarity >= 0.5) {
							const content = await this.fetchPageContent(page.title, { forceRefresh: true });
							if (content && content.extractLength > 100) {
								content.matchedTitle = title;
								content.searchedTitles = searchTitles;
								content.matchScore = similarity;
								await this.cacheContent(title, content);
								this.titleCache.set(cacheKey, content);
								return content;
							}
						}
					}

					const semanticMatch = pages.find(p => hasSharedSemanticCore(title, p.title));
					if (semanticMatch) {
						const content = await this.fetchPageContent(semanticMatch.title, { forceRefresh: true });
						if (content && content.extractLength > 100) {
							content.matchedTitle = title;
							content.searchedTitles = searchTitles;
							content.matchScore = calculateSimilarity(title, semanticMatch.title);
							await this.cacheContent(title, content);
							this.titleCache.set(cacheKey, content);
							return content;
						}
					}
				}
			} catch (error) {
				writeLog(LOG_LEVELS.WARN, `Failed search attempt`, { searchTitle, error: error.message });
			}
		}

		writeLog(LOG_LEVELS.ERROR, `All search attempts failed`, { title, searchTitles });
		return null;
	}

	async fetchByPageId(pageId, options = {}) {
		const { useCache = true, forceRefresh = false } = options;

		if (useCache && !forceRefresh) {
			const cached = await this.getCachedContentByPageId(pageId);
			if (cached) {
				writeLog(LOG_LEVELS.DEBUG, `Cache hit for page ID`, { pageId });
				return cached;
			}
		}

		try {
			writeLog(LOG_LEVELS.INFO, `Fetching Moegirl page by ID`, { pageId });

			const [infoResponse, extractResponse, categoriesResponse, linksResponse, imagesResponse] = await Promise.all([
				rateLimitedFetch(`${this.apiBase}?action=query&pageids=${pageId}&format=json&prop=info|categories`),
				rateLimitedFetch(`${this.apiBase}?action=query&pageids=${pageId}&format=json&prop=extracts&explaintext=true&exintro=false`),
				rateLimitedFetch(`${this.apiBase}?action=query&pageids=${pageId}&format=json&prop=categories&cllimit=50`),
				rateLimitedFetch(`${this.apiBase}?action=query&pageids=${pageId}&format=json&prop=links&pllimit=50`),
				rateLimitedFetch(`${this.apiBase}?action=query&pageids=${pageId}&format=json&prop=pageimages&pithumbsize=800`),
			]);

			const [infoData, extractData, categoriesData, linksData, imagesData] = await Promise.all([
				infoResponse.json(),
				extractResponse.json(),
				categoriesResponse.json(),
				linksResponse.json(),
				imagesResponse.json(),
			]);

			const pageInfo = infoData?.query?.pages?.[pageId];
			if (!pageInfo || pageInfo.missing) {
				return null;
			}

			const content = this.parseContent({
				pageInfo,
				extract: extractData?.query?.pages?.[pageId]?.extract || "",
				categories: categoriesData?.query?.pages?.[pageId]?.categories || [],
				links: linksData?.query?.pages?.[pageId]?.links || [],
				images: imagesData?.query?.pages?.[pageId]?.thumbnail || null,
			});

			await this.cacheContent(pageInfo.title, content);
			await this.cacheContentByPageId(pageId, content);

			return content;
		} catch (error) {
			writeLog(LOG_LEVELS.ERROR, `Failed to fetch by page ID`, { pageId, error: error.message });
			return null;
		}
	}

	async fetchPageContent(pageName, options = {}) {
		try {
			const [infoResponse, extractResponse, categoriesResponse, linksResponse, imagesResponse] = await Promise.all([
				rateLimitedFetch(`${this.apiBase}?action=query&titles=${encodeURIComponent(pageName)}&format=json&prop=info|categories`),
				rateLimitedFetch(`${this.apiBase}?action=query&titles=${encodeURIComponent(pageName)}&format=json&prop=extracts&explaintext=true&exintro=false`),
				rateLimitedFetch(`${this.apiBase}?action=query&titles=${encodeURIComponent(pageName)}&format=json&prop=categories&cllimit=50`),
				rateLimitedFetch(`${this.apiBase}?action=query&titles=${encodeURIComponent(pageName)}&format=json&prop=links&pllimit=50`),
				rateLimitedFetch(`${this.apiBase}?action=query&titles=${encodeURIComponent(pageName)}&format=json&prop=pageimages&pithumbsize=800`),
			]);

			const [infoData, extractData, categoriesData, linksData, imagesData] = await Promise.all([
				infoResponse.json(),
				extractResponse.json(),
				categoriesResponse.json(),
				linksResponse.json(),
				imagesResponse.json(),
			]);

			const pages = infoData?.query?.pages || {};
			const pageId = Object.keys(pages)[0];
			const pageInfo = pages[pageId];

			if (!pageId || pageId === "-1" || pageInfo?.missing) {
				return null;
			}

			const content = this.parseContent({
				pageInfo,
				extract: extractData?.query?.pages?.[pageId]?.extract || "",
				categories: categoriesData?.query?.pages?.[pageId]?.categories || [],
				links: linksData?.query?.pages?.[pageId]?.links || [],
				images: imagesData?.query?.pages?.[pageId]?.thumbnail || null,
			});

			return content;
		} catch (error) {
			writeLog(LOG_LEVELS.ERROR, `Failed to fetch page content`, { pageName, error: error.message });
			return null;
		}
	}

	parseContent({ pageInfo, extract, categories, links, images }) {
		const categories_list = (categories || [])
			.map(c => c.title?.replace(/^Category:/, "").replace(/^分类:/, ""))
			.filter(Boolean);

		const links_list = (links || [])
			.map(l => l.title)
			.filter(l => !l.startsWith("Category:") && !l.includes(":"))
			.slice(0, 20);

		const contentHash = calculateContentHash(extract);

		return {
			pageId: pageInfo?.pageid,
			title: pageInfo?.title,
			fullTitle: pageInfo?.title,
			pageUrl: pageInfo?.fullurl || `${MOEGIRL_PAGE_BASE}${encodeURIComponent(pageInfo?.title || "")}`,
			touched: pageInfo?.touched,
			lastModified: pageInfo?.touched,
			extract: extract,
			extractLength: extract?.length || 0,
			categories: categories_list,
			relatedArticles: links_list,
			images: images ? [{
				url: images.source || images.original?.source,
				title: images.title || pageInfo?.title,
				alt: (images.title || pageInfo?.title)?.replace(/_/g, " "),
			}] : [],
			contentHash,
			fetchedAt: new Date().toISOString(),
		};
	}

	async cacheContent(title, content) {
		try {
			const cacheKey = this.getCacheKey(title);
			await fs.writeFile(
				path.join(this.cacheDir, `${cacheKey}.json`),
				JSON.stringify(content, null, 2),
				"utf8"
			);
		} catch (error) {
			writeLog(LOG_LEVELS.WARN, `Failed to cache content`, { title, error: error.message });
		}
	}

	async cacheContentByPageId(pageId, content) {
		try {
			await fs.writeFile(
				path.join(this.cacheDir, `pageid-${pageId}.json`),
				JSON.stringify(content, null, 2),
				"utf8"
			);
		} catch (error) {
			writeLog(LOG_LEVELS.WARN, `Failed to cache content by page ID`, { pageId, error: error.message });
		}
	}

	async getCachedContent(title) {
		try {
			const cacheKey = this.getCacheKey(title);
			const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
			const stat = await fs.stat(cachePath);
			const maxAge = 6 * 60 * 60 * 1000;
			if (Date.now() - stat.mtimeMs > maxAge) {
				return null;
			}
			const data = await fs.readFile(cachePath, "utf8");
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	async getCachedContentByPageId(pageId) {
		try {
			const cachePath = path.join(this.cacheDir, `pageid-${pageId}.json`);
			const stat = await fs.stat(cachePath);
			const maxAge = 6 * 60 * 60 * 1000;
			if (Date.now() - stat.mtimeMs > maxAge) {
				return null;
			}
			const data = await fs.readFile(cachePath, "utf8");
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	getCacheKey(title) {
		return crypto.createHash("md5").update(normalizeText(title)).digest("hex");
	}

	async loadSyncState() {
		try {
			const data = await fs.readFile(this.stateFile, "utf8");
			return JSON.parse(data);
		} catch {
			return { articles: {}, lastSync: null };
		}
	}

	async saveSyncState(state) {
		try {
			await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
			await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), "utf8");
		} catch (error) {
			writeLog(LOG_LEVELS.ERROR, `Failed to save sync state`, { error: error.message });
		}
	}

	async checkForUpdates(articles, options = {}) {
		const { skipContentDiff = false, threshold = 0.1 } = options;
		const state = await this.loadSyncState();
		const updates = [];

		for (const article of articles) {
			try {
				const current = await this.fetchByTitle(article.title, { useCache: false, forceRefresh: true });

				if (!current) {
					writeLog(LOG_LEVELS.WARN, `Could not fetch article`, { title: article.title });
					continue;
				}

				const previous = state.articles[article.title];
				const updateInfo = {
					title: article.title,
					pageId: current.pageId,
					pageUrl: current.pageUrl,
					hasChanges: false,
					changeType: null,
					contentHash: current.contentHash,
					previousHash: previous?.contentHash,
					similarity: 1,
				};

				if (!previous) {
					updateInfo.hasChanges = true;
					updateInfo.changeType = "new";
				} else if (previous.contentHash !== current.contentHash) {
					if (skipContentDiff) {
						updateInfo.hasChanges = true;
						updateInfo.changeType = "modified";
					} else {
						const contentSimilarity = calculateSimilarity(previous.extract || "", current.extract || "");
						updateInfo.similarity = contentSimilarity;

						if (contentSimilarity < (1 - threshold)) {
							updateInfo.hasChanges = true;
							updateInfo.changeType = "modified";
						} else if (previous.touched !== current.touched) {
							updateInfo.hasChanges = true;
							updateInfo.changeType = "touched";
						}
					}
				}

				if (updateInfo.hasChanges) {
					await this.saveVersion(article.title, current, previous);
					state.articles[article.title] = {
						pageId: current.pageId,
						pageUrl: current.pageUrl,
						contentHash: current.contentHash,
						lastChecked: new Date().toISOString(),
						lastChanged: new Date().toISOString(),
					};
					updates.push(updateInfo);
					writeLog(LOG_LEVELS.INFO, `Content update detected`, updateInfo);
				}
			} catch (error) {
				writeLog(LOG_LEVELS.ERROR, `Failed to check article`, { title: article.title, error: error.message });
			}
		}

		state.lastSync = new Date().toISOString();
		await this.saveSyncState(state);

		return updates;
	}

	async saveVersion(title, currentContent, previousContent = null) {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const versionFile = path.join(this.versionHistoryDir, `${this.getCacheKey(title)}_${timestamp}.json`);
			const versionData = {
				version: timestamp,
				title,
				current: currentContent,
				previous: previousContent,
				savedAt: new Date().toISOString(),
			};
			await fs.writeFile(versionFile, JSON.stringify(versionData, null, 2), "utf8");
		} catch (error) {
			writeLog(LOG_LEVELS.ERROR, `Failed to save version`, { title, error: error.message });
		}
	}

	async getVersionHistory(title) {
		try {
			const cacheKey = this.getCacheKey(title);
			const files = await fs.readdir(this.versionHistoryDir);
			const versions = files
				.filter(f => f.startsWith(cacheKey))
				.sort()
				.reverse()
				.slice(0, 10);

			const history = [];
			for (const file of versions) {
				const data = await fs.readFile(path.join(this.versionHistoryDir, file), "utf8");
				const version = JSON.parse(data);
				history.push({
					version: version.version,
					savedAt: version.savedAt,
					contentHash: version.current?.contentHash,
				});
			}
			return history;
		} catch {
			return [];
		}
	}

	convertToArticleFormat(content, metadata = {}) {
		return {
			title: content.title,
			description: content.extract?.slice(0, 300)?.replace(/\n+/g, " ").trim() || "",
			content: content.extract,
			categories: content.categories,
			tags: metadata.tags || [],
			image: content.images?.[0]?.url || null,
			bodyImages: content.images || [],
			relatedArticles: content.relatedArticles,
			source: content.pageUrl,
			sourceTitle: content.fullTitle,
			meta: {
				pageId: content.pageId,
				lastModified: content.lastModified,
				fetchedAt: content.fetchedAt,
			},
		};
	}

	filterContent(content, filters = {}) {
		const {
			removePatterns = [],
			keepCategories = [],
			excludeCategories = [],
		} = filters;

		let filtered = { ...content };

		const defaultRemovePatterns = [
			/广告/,
			/推广/,
			/赞助/,
			/声明/,
			/外部链接/,
			/参见.*条目/,
		];

		const allPatterns = [...defaultRemovePatterns, ...removePatterns];

		if (excludeCategories.length > 0) {
			filtered.categories = filtered.categories?.filter(
				c => !excludeCategories.some(exc => c.toLowerCase().includes(exc.toLowerCase()))
			);
		}

		if (keepCategories.length > 0) {
			filtered.categories = filtered.categories?.filter(
				c => keepCategories.some(keep => c.toLowerCase().includes(keep.toLowerCase()))
			);
		}

		return filtered;
	}

	async batchFetch(titles, options = {}) {
		const { concurrency = 3, onProgress = null } = options;
		const results = [];
		let completed = 0;

		const chunks = [];
		for (let i = 0; i < titles.length; i += concurrency) {
			chunks.push(titles.slice(i, i + concurrency));
		}

		for (const chunk of chunks) {
			const chunkResults = await Promise.all(
				chunk.map(title => this.fetchByTitle(title, options))
			);

			for (let i = 0; i < chunk.length; i++) {
				results.push({
					title: chunk[i],
					content: chunkResults[i],
					success: !!chunkResults[i],
				});
			}

			completed += chunk.length;
			if (onProgress) {
				onProgress({ completed, total: titles.length, results });
			}

			writeLog(LOG_LEVELS.INFO, `Batch fetch progress`, { completed, total: titles.length });
		}

		return results;
	}
}

export class MoegirlSyncMonitor {
	constructor(options = {}) {
		this.stateFile = options.stateFile || "data/moegirl-sync-state.json";
		this.alertThreshold = options.alertThreshold || 3;
		this.failureWindowMs = options.failureWindowMs || 24 * 60 * 60 * 1000;
		this.failedRequests = [];
	}

	async recordFailure(title, error) {
		this.failedRequests.push({
			title,
			error: error.message,
			timestamp: new Date().toISOString(),
		});
		this.failedRequests = this.failedRequests.filter(
			f => new Date(f.timestamp).getTime() > Date.now() - this.failureWindowMs
		);
	}

	shouldAlert() {
		const recentFailures = this.failedRequests.length;
		return recentFailures >= this.alertThreshold;
	}

	getFailureReport() {
		return {
			totalFailures: this.failedRequests.length,
			failures: this.failedRequests.slice(-10),
			shouldAlert: this.shouldAlert(),
		};
	}

	async getSyncStatus() {
		try {
			const data = await fs.readFile(this.stateFile, "utf8");
			const state = JSON.parse(data);
			const articles = Object.values(state.articles || {});
			const now = new Date();
			const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

			return {
				lastSync: state.lastSync,
				totalTracked: articles.length,
				recentlyChecked: articles.filter(a => new Date(a.lastChecked) > sixHoursAgo).length,
				failures: this.getFailureReport(),
			};
		} catch {
			return {
				lastSync: null,
				totalTracked: 0,
				recentlyChecked: 0,
				failures: this.getFailureReport(),
			};
		}
	}
}

export async function createMoegirlSyncSystem(options = {}) {
	const fetcher = new MoegirlContentFetcher(options);
	const monitor = new MoegirlSyncMonitor(options);

	await fetcher.initialize();

	return {
		fetcher,
		monitor,

		async fetchArticle(title, options = {}) {
			try {
				const content = await fetcher.fetchByTitle(title, options);
				if (!content) {
					monitor.recordFailure(title, new Error("No content returned"));
				}
				return content;
			} catch (error) {
				monitor.recordFailure(title, error);
				throw error;
			}
		},

		async syncArticles(articles, options = {}) {
			const updates = await fetcher.checkForUpdates(articles, options);

			if (monitor.shouldAlert()) {
				const report = monitor.getFailureReport();
				writeLog(LOG_LEVELS.ERROR, `ALERT: Multiple sync failures detected`, report);
			}

			return updates;
		},

		convertToArticle: (content, metadata) => fetcher.convertToArticleFormat(content, metadata),

		getStatus: () => monitor.getSyncStatus(),

		getHistory: (title) => fetcher.getVersionHistory(title),
	};
}
