import fs from "node:fs/promises";
import path from "node:path";
import { buildLongformBody } from "./wiki/longform-layout.mjs";

const DEFAULT_MAX_PER_RUN = 1;
const DEFAULT_FALLBACK_IMAGE = "/assets/anime/default.webp";

const CONTENT_TYPE = {
	ANIME: "anime",
	GAME: "game",
	UNKNOWN: "unknown",
};

function ensureArray(value) {
	return Array.isArray(value) ? value : [];
}

const ARTICLE_SCHEMA = {
	required: ["title", "category", "author", "published", "image"],
	optional: ["description", "tags", "sourceLink", "alias", "pinned", "licenseName", "pubDate", "draft"],
	stringFields: ["title", "description", "category", "author", "sourceLink", "alias", "licenseName"],
	dateFields: ["published", "pubDate"],
	urlFields: ["image", "sourceLink"],
	arrayFields: ["tags"],
	booleanFields: ["draft", "pinned"],
};

const CHARACTER_SCHEMA = {
	required: ["name"],
	optional: ["cv", "description", "background", "personality", "arc"],
};

const OPENINGS = [
	"我原本以为这又是一部普通的作品，但看完第一集后彻底改变了看法",
	"说实话，这个标题并没有第一时间吸引我的注意，但内容却远超预期",
	"打开第一页的时候，我完全没有想到会陷得这么深",
	"如果你是这类题材的爱好者，那么这部作品绝对值得你花时间细细品味",
	"起初我只是想随便看看，没想到却一口气追完了全部内容",
	"这部作品最打动我的，是那些看似平凡却充满温度的细节",
	"在我看过的同类作品中，它绝对是独树一帜的存在",
	"那种需要静下心来慢慢体会的感觉，在这部作品中体现得淋漓尽致",
];

function getRandomOpening() {
	return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

export function validateArticleMetadata(metadata) {
	const errors = [];
	const warnings = [];

	for (const field of ARTICLE_SCHEMA.required) {
		if (!metadata[field] && metadata[field] !== false) {
			errors.push(`缺少必需字段: ${field}`);
		}
	}

	for (const [field, value] of Object.entries(metadata)) {
		if (ARTICLE_SCHEMA.stringFields.includes(field) && typeof value !== "string" && typeof value !== "undefined") {
			errors.push(`字段 ${field} 必须是字符串类型`);
		}

		if (ARTICLE_SCHEMA.dateFields.includes(field) && value) {
			const date = new Date(value);
			if (isNaN(date.getTime())) {
				errors.push(`字段 ${field} 日期格式无效: ${value}`);
			}
		}

		if (ARTICLE_SCHEMA.urlFields.includes(field) && value && !isValidUrl(value)) {
			warnings.push(`字段 ${field} URL格式可能无效: ${value}`);
		}

		if (ARTICLE_SCHEMA.arrayFields.includes(field) && value && !Array.isArray(value)) {
			errors.push(`字段 ${field} 必须是数组类型`);
		}

		if (ARTICLE_SCHEMA.booleanFields.includes(field) && typeof value !== "boolean" && typeof value !== "undefined") {
			errors.push(`字段 ${field} 必须是布尔类型`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		metadata,
	};
}

function isValidUrl(string) {
	try {
		new URL(string);
		return true;
	} catch {
		return /^(https?:\/\/|\/|\.\/|\.\.\/)/.test(string);
	}
}

export function validateCharacterData(char) {
	const errors = [];

	if (!char.name) {
		errors.push("角色缺少名称");
	}

	if (char.cv && typeof char.cv !== "string") {
		errors.push("角色CV必须是字符串");
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings: [],
	};
}

export function validateCacheEntry(item) {
	const errors = [];
	const warnings = [];

	if (!item.link && !item.subjectId) {
		errors.push("缺少唯一标识符 (link 或 subjectId)");
	}

	if (!item.title && !item.titleRaw) {
		errors.push("缺少标题信息");
	}

	if (!item.contentType) {
		errors.push("缺少内容类型标识 (contentType)");
	}

	if (item.contentType === CONTENT_TYPE.UNKNOWN) {
		warnings.push("内容类型未知，需要人工审核");
	}

	if (item.contentType && !Object.values(CONTENT_TYPE).includes(item.contentType)) {
		errors.push(`无效的内容类型: ${item.contentType}`);
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		item,
	};
}

export function verifyCacheClassification(cachedItems) {
	const verificationReport = {
		timestamp: new Date().toISOString(),
		totalItems: cachedItems.length,
		validItems: 0,
		invalidItems: 0,
		animeItems: 0,
		gameItems: 0,
		unclassifiedItems: 0,
		errors: [],
		warnings: [],
	};

	for (const item of cachedItems) {
		const validation = validateCacheEntry(item);

		if (validation.valid) {
			verificationReport.validItems++;
		} else {
			verificationReport.invalidItems++;
			verificationReport.errors.push({
				subjectId: item.subjectId,
				title: item.title,
				errors: validation.errors,
			});
		}

		if (validation.warnings.length > 0) {
			verificationReport.warnings.push({
				subjectId: item.subjectId,
				title: item.title,
				warnings: validation.warnings,
			});
		}

		switch (item.contentType) {
			case CONTENT_TYPE.ANIME:
				verificationReport.animeItems++;
				break;
			case CONTENT_TYPE.GAME:
				verificationReport.gameItems++;
				break;
			default:
				verificationReport.unclassifiedItems++;
		}
	}

	return verificationReport;
}

export function filterByContentType(items, contentType) {
	return items.filter(item => item.contentType === contentType);
}

export function getCacheStats(cachedData) {
	return {
		anime: cachedData.anime?.length || 0,
		games: cachedData.games?.length || 0,
		unclassified: cachedData.unclassified?.length || 0,
		total: cachedData.anime?.length + cachedData.games?.length + cachedData.unclassified?.length || 0,
	};
}

export function normalizeText(value) {
	return String(value || "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[《》「」『』【】()（）\[\]{}]/g, " ")
		.replace(/[·•・:：;；,.，。!?！？~～'"`]/g, " ")
		.replace(/[\u3000\s]+/g, " ")
		.trim();
}

export function slugifyTitle(value, fallback = "") {
	const normalized = normalizeText(value)
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9\s-]/g, " ")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	if (normalized && normalized.length >= 5) {
		return normalized.slice(0, 80);
	}
	return fallback || "bangumi-subject";
}

export function sanitizeFileName(value, fallback = "bangumi-subject") {
	const sanitized = String(value || "")
		.replace(/[<>:"/\\|?*]/g, " ")
		.replace(/[\u0000-\u001f]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return sanitized || fallback;
}

export function formatDate(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function truncateText(value, maxLength = 120) {
	const text = String(value || "").replace(/\s+/g, " ").trim();
	if (!text) {
		return "";
	}
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function pickInfoboxValue(subjectDetail, keys) {
	const infobox = ensureArray(subjectDetail?.infobox);
	for (const key of keys) {
		const item = infobox.find((entry) => entry?.key === key);
		if (!item) {
			continue;
		}
		const queue = [item.value];
		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}
			if (typeof current === "string" && current.trim()) {
				return current.trim();
			}
			if (Array.isArray(current)) {
				queue.push(...current);
				continue;
			}
			if (typeof current === "object") {
				if (typeof current.v === "string" && current.v.trim()) {
					return current.v.trim();
				}
				if (typeof current.value === "string" && current.value.trim()) {
					return current.value.trim();
				}
			}
		}
	}
	return "";
}

export function buildExistingPostIndex(posts) {
	const subjectIds = new Set();
	const titles = new Set();
	const normalizedTitles = new Map();

	for (const post of posts) {
		const subjectIdMatch = String(post.sourceLink || "").match(/\/subject\/(\d+)/);
		if (subjectIdMatch?.[1]) {
			subjectIds.add(Number(subjectIdMatch[1]));
		}
		if (post.title) {
			const normalized = normalizeText(post.title);
			titles.add(normalized);
			if (!normalizedTitles.has(normalized)) {
				normalizedTitles.set(normalized, []);
			}
			normalizedTitles.get(normalized).push(post.title);
		}
	}

	return { subjectIds, titles, normalizedTitles };
}

export function detectDuplicatePosts(existingPosts, newTitle, options = {}) {
	const {
		threshold = 0.8,
		includeFilePath = false,
	} = options;

	if (!newTitle || !existingPosts || existingPosts.length === 0) {
		return { hasDuplicate: false, duplicates: [], message: null };
	}

	const normalizedNewTitle = normalizeText(newTitle);
	const duplicates = [];

	for (const post of existingPosts) {
		if (!post.title) continue;

		const normalizedPostTitle = normalizeText(post.title);

		if (normalizedNewTitle === normalizedPostTitle) {
			duplicates.push({
				type: "exact",
				existingTitle: post.title,
				newTitle,
				filePath: includeFilePath ? post.filePath : null,
				reason: "标题完全匹配（忽略标点符号和大小写）",
			});
			continue;
		}

		const similarity = calculateSimilarity(normalizedNewTitle, normalizedPostTitle);
		if (similarity >= threshold) {
			duplicates.push({
				type: "similar",
				existingTitle: post.title,
				newTitle,
				similarity: Math.round(similarity * 100) / 100,
				filePath: includeFilePath ? post.filePath : null,
				reason: `相似度 ${Math.round(similarity * 100)}% 超过阈值 ${Math.round(threshold * 100)}%`,
			});
		}
	}

	const message = duplicates.length > 0
		? `⚠️ 检测到 ${duplicates.length} 个重复文章:\n${
			duplicates.map((d, i) =>
				`  [${i + 1}] ${d.type === "exact" ? "完全匹配" : "相似"}: "${d.existingTitle}" vs "${d.newTitle}" (${d.reason})`
			).join("\n")
		}`
		: null;

	return {
		hasDuplicate: duplicates.length > 0,
		duplicates,
		message,
		detectedAt: new Date().toISOString(),
	};
}

function calculateSimilarity(str1, str2) {
	if (str1 === str2) return 1;
	if (!str1.length || !str2.length) return 0;

	const chars1 = str1.split("");
	const chars2 = str2.split("");

	let matches = 0;
	for (const char of chars1) {
		const idx = chars2.indexOf(char);
		if (idx !== -1) {
			matches++;
			chars2.splice(idx, 1);
		}
	}

	const maxLength = Math.max(str1.length, str2.length);
	return matches / maxLength;
}

export const SIMILARITY_THRESHOLD = 70;

export function tokenize(text) {
	if (!text) return [];
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 2);
}

export function calculateJaccard(set1, set2) {
	if (set1.size === 0 || set2.size === 0) return 0;

	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);

	return intersection.size / union.size;
}

export function calculateCosineSimilarity(vec1, vec2) {
	if (!vec1 || !vec2) return 0;

	const keys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
	let dotProduct = 0;
	let norm1 = 0;
	let norm2 = 0;

	for (const key of keys) {
		const v1 = vec1[key] || 0;
		const v2 = vec2[key] || 0;
		dotProduct += v1 * v2;
		norm1 += v1 * v1;
		norm2 += v2 * v2;
	}

	if (norm1 === 0 || norm2 === 0) return 0;
	return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

export function createTFVector(tokens) {
	const vector = {};
	for (const token of tokens) {
		vector[token] = (vector[token] || 0) + 1;
	}
	return vector;
}

export function extractContentFeatures(article) {
	const features = {
		title: article.title || "",
		description: article.description || "",
		tags: Array.isArray(article.tags) ? article.tags : [],
		body: article.body || article.content || "",
		keyParagraphs: [],
	};

	if (features.body) {
		const paragraphs = features.body
			.split(/\n\n+/)
			.map((p) => p.trim())
			.filter((p) => p.length >= 30);

		features.keyParagraphs = paragraphs
			.slice(0, 5)
			.concat(paragraphs.slice(-3));
	}

	return features;
}

export function detectContentDuplication(
	newArticle,
	existingArticles,
	options = {}
) {
	const {
		similarityThreshold = SIMILARITY_THRESHOLD,
		titleWeight = 0.4,
		descriptionWeight = 0.3,
		bodyWeight = 0.3,
		includeDetails = true,
	} = options;

	const threshold = similarityThreshold / 100;
	const duplicates = [];
	const newFeatures = extractContentFeatures(newArticle);
	const newTitleTokens = new Set(tokenize(newFeatures.title));
	const newDescTokens = new Set(tokenize(newFeatures.description));
	const newBodyTokens = new Set(tokenize(newFeatures.body));
	const newBodyVector = createTFVector(tokenize(newFeatures.body));

	for (const existing of existingArticles) {
		if (!existing.title && !existing.body && !existing.content) continue;

		const existingFeatures = extractContentFeatures(existing);

		const titleJaccard = calculateJaccard(
			newTitleTokens,
			new Set(tokenize(existingFeatures.title))
		);

		const descJaccard = calculateJaccard(
			newDescTokens,
			new Set(tokenize(existingFeatures.description))
		);

		const existingBodyVector = createTFVector(tokenize(existingFeatures.body));
		const bodyCosine = calculateCosineSimilarity(newBodyVector, existingBodyVector);

		const overallSimilarity =
			(titleJaccard * titleWeight) +
			(descJaccard * descriptionWeight) +
			(bodyCosine * bodyWeight);

		if (overallSimilarity >= threshold) {
			const duplicate = {
				type: "content",
				newTitle: newArticle.title || "Untitled",
				existingTitle: existing.title || "Untitled",
				overallSimilarity: Math.round(overallSimilarity * 10000) / 100,
				titleSimilarity: Math.round(titleJaccard * 10000) / 100,
				descriptionSimilarity: Math.round(descJaccard * 10000) / 100,
				bodySimilarity: Math.round(bodyCosine * 10000) / 100,
				reason: `内容相似度 ${Math.round(overallSimilarity * 100)}% 超过阈值 ${similarityThreshold}%`,
				filePath: existing.filePath || null,
				sourceLink: existing.sourceLink || null,
				details: includeDetails ? {
					newKeyParagraphs: newFeatures.keyParagraphs,
					existingKeyParagraphs: existingFeatures.keyParagraphs,
				} : null,
			};

			duplicates.push(duplicate);
		}
	}

	duplicates.sort((a, b) => b.overallSimilarity - a.overallSimilarity);

	const message = duplicates.length > 0
		? `⚠️ 检测到 ${duplicates.length} 篇内容重复文章（阈值 ${similarityThreshold}%）:\n${
			duplicates.slice(0, 3).map((d, i) =>
				`  [${i + 1}] ${d.newTitle} ↔ ${d.existingTitle}\n      相似度: ${d.overallSimilarity}% (标题:${d.titleSimilarity}%, 摘要:${d.descriptionSimilarity}%, 正文:${d.bodySimilarity}%)`
			).join("\n")
		}${duplicates.length > 3 ? `\n      ... (显示前3篇，共${duplicates.length}篇)` : ""}`
		: null;

	return {
		hasDuplicate: duplicates.length > 0,
		duplicates,
		message,
		similarityThreshold,
		detectedAt: new Date().toISOString(),
		canOverride: true,
	};
}

const COLLECTION_TYPE_PRIORITY = {
	3: 1,  // 在看 - 最高优先级
	2: 2,  // 看过
	1: 3,  // 想看
	4: 4,  // 搁置
	5: 5,  // 抛弃 - 最低优先级
};

export function selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun = DEFAULT_MAX_PER_RUN }) {
	const items = ensureArray(collections)
		.filter((item) => item?.subject_id || item?.subject?.id)
		.map((item) => ({
			...item,
			subject_id: Number(item.subject_id || item?.subject?.id),
		}));

	const generatedIds = new Set(ensureArray(generatedState?.generated).map((entry) => Number(entry.subjectId)));
	const existing = buildExistingPostIndex(existingPosts || []);

	const groups = new Map();
	for (const item of items) {
		const priority = COLLECTION_TYPE_PRIORITY[item.type] ?? 99;
		if (!groups.has(priority)) {
			groups.set(priority, []);
		}
		groups.get(priority).push(item);
	}

	const sortedPriorities = [...groups.keys()].sort((a, b) => a - b);

	const selected = [];
	for (const priority of sortedPriorities) {
		if (selected.length >= maxPerRun) {
			break;
		}

		const group = groups.get(priority);
		const shuffled = [...group];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		for (const item of shuffled) {
			if (selected.length >= maxPerRun) {
				break;
			}
			const subjectId = Number(item.subject_id);
			if (!subjectId || generatedIds.has(subjectId) || existing.subjectIds.has(subjectId)) {
				continue;
			}

			const names = [item.subject?.name_cn, item.subject?.name]
				.filter(Boolean)
				.map((name) => normalizeText(name));
			if (names.some((name) => existing.titles.has(name))) {
				continue;
			}

			selected.push(item);
		}
	}

	return selected;
}

export function chooseBestCoverImage(candidates, context = {}) {
	const unique = [];
	const seen = new Set();
	for (const candidate of ensureArray(candidates)) {
		if (!candidate?.url || seen.has(candidate.url)) {
			continue;
		}
		seen.add(candidate.url);
		let score = 0;
		if (candidate.source === "bangumi-large") score = 100;
		else if (candidate.source === "bangumi-common") score = 80;
		else if (candidate.source === "bangumi-medium") score = 60;
		unique.push({ ...candidate, score });
	}
	unique.sort((a, b) => b.score - a.score);
	return {
		selected: unique[0] || null,
		candidates: unique,
	};
}

export function autoFillMetadata(payload) {
	const {
		title,
		titleRaw,
		description,
		summary,
		tags,
		subjectId,
		sourceLink,
		image,
		published,
		alias,
		meta = {},
		category,
		licenseName,
	} = payload;

	const cleanTitle = title || titleRaw || "未知作品";

	const autoDescription = description || summary || meta.summary || "";
	const finalDescription = autoDescription.length > 50
		? truncateText(autoDescription, 200)
		: autoDescription;

	const finalAlias = alias || slugifyTitle(cleanTitle);
	const finalCategory = category || determineCategory(tags, meta);
	const finalTags = ensureArray(tags).length > 0
		? tags
		: (meta.genres?.slice(0, 5) || []);

	const finalSourceLink = sourceLink || (subjectId ? `https://bgm.tv/subject/${subjectId}` : "");

	return {
		title: cleanTitle,
		description: finalDescription,
		tags: finalTags,
		category: finalCategory,
		sourceLink: finalSourceLink,
		published: published || formatDate(),
		alias: finalAlias,
		image: image || DEFAULT_FALLBACK_IMAGE,
		draft: false,
		pinned: false,
		licenseName: licenseName || "CC BY 4.0",
		author: "灵梦",
		pubDate: published || formatDate(),
	};
}

function determineCategory(tags, meta) {
	const tagSet = new Set(ensureArray(tags).map(t => t.toLowerCase()));
	const genreSet = new Set(ensureArray(meta?.genres)?.map(g => g.toLowerCase()));

	if (tagSet.has("轻小说") || genreSet.has("轻小说")) return "轻小说推荐";
	if (tagSet.has("漫画") || genreSet.has("漫画")) return "漫画推荐";
	if (tagSet.has("游戏") || genreSet.has("游戏")) return "游戏推荐";
	if (tagSet.has("音乐") || genreSet.has("音乐")) return "音乐推荐";
	if (tagSet.has("动画") || genreSet.has("动画") || tagSet.has("anime")) return "二次元";
	return "二次元";
}

export function buildFrontmatter(metadata) {
	const filled = {
		...autoFillMetadata(metadata),
		...(typeof metadata.draft === "boolean" ? { draft: metadata.draft } : {}),
		...(typeof metadata.pinned === "boolean" ? { pinned: metadata.pinned } : {}),
	};
	const validation = validateArticleMetadata(filled);

	if (!validation.valid) {
		console.warn("元数据验证警告:", validation.errors);
	}

	const safeDescription = filled.description || "";
	const safeTags = ensureArray(filled.tags).slice(0, 8).map((tag) => JSON.stringify(tag)).join(", ");

	return `---\ntitle: ${JSON.stringify(filled.title)}\ndescription: ${JSON.stringify(safeDescription)}\ntags: [${safeTags}]\ncategory: ${JSON.stringify(filled.category)}\nlicenseName: ${JSON.stringify(filled.licenseName)}\nauthor: ${JSON.stringify(filled.author)}\nsourceLink: ${JSON.stringify(filled.sourceLink)}\ndraft: ${filled.draft ? "true" : "false"}\npubDate: ${filled.pubDate}\npublished: ${filled.published}\npinned: ${filled.pinned}\nalias: ${JSON.stringify(filled.alias)}\nimage: ${JSON.stringify(filled.image)}\n---`;
}

function buildInfoTableRows(info) {
	return Object.entries(info)
		.filter(([, value]) => value)
		.map(([key, value]) => `| **${key}** | ${String(value).replace(/\n+/g, " ")} |`)
		.join("\n");
}

export function buildAnimeArticleMarkdown(payload) {
	const {
		subjectId,
		title,
		originalTitle,
		description,
		summary,
		tags,
		category,
		sourceLink,
		published,
		alias,
		image,
		draft = false,
		meta = {},
		staff = [],
		characters = [],
		quote = null,
		manualEdits = {},
		relatedPosts = [],
		overview = "",
		references = [],
		licenseName,
	} = payload;

	const filled = autoFillMetadata({
		title,
		originalTitle,
		description,
		summary,
		tags,
		subjectId,
		sourceLink,
		image,
		published,
		alias,
		meta,
		category,
		licenseName,
	});

	const frontmatter = buildFrontmatter({
		...filled,
		draft,
		...(manualEdits.frontmatter || {}),
	});

	const cleanTitle = filled.title.replace(/^《|》$/g, "");
	const genreTags = ensureArray(filled.tags);
	const finalQuote = quote || buildSynopsisQuote(summary) || `《${cleanTitle}》`;
	const body = buildLongformBody({
		cleanTitle,
		originalTitle,
		overview,
		summary: summary || description,
		meta,
		staff,
		characters,
		genreTags,
		cover: `![${cleanTitle}封面](${filled.image})\n*${cleanTitle}*`,
		relatedPosts,
	});
	const referenceSection = buildReferenceSection({ cleanTitle, sourceLink: filled.sourceLink, references });

	return `${frontmatter}

> ${finalQuote}

${body}

---

${referenceSection}
`;
}


/**
 * 引言优先用作品自己的故事开端：取中文剧情的前一两句（≤ 72 字），
 * 与手写文章「以作品设定开篇」的引言一致；没有中文剧情时退回作品名。
 */
export function buildSynopsisQuote(summary, maxLength = 72) {
	const text = String(summary || "")
		.split(/\n+/)
		.map((line) => line.trim())
		.find((line) => line.length >= 12 && !/[\u3040-\u30ff]/.test(line));
	if (!text) return "";
	const sentences = text.match(/[^。！？!?]+[。！？!?]?/g) || [];
	let quote = "";
	for (const sentence of sentences) {
		if ((quote + sentence).length > maxLength) break;
		quote += sentence;
		if (quote.length >= 28) break;
	}
	quote = quote.trim();
	if (quote.length < 12) return "";
	return /[。！？!?…」』]$/.test(quote) ? quote : `${quote}……`;
}

/** 参考资料与许可证声明（百科内容必须署名并保留出处链接） */
function buildReferenceSection({ cleanTitle, sourceLink, references }) {
	const lines = [`- [Bangumi 番组计划「${cleanTitle}」](${sourceLink})：基础信息、角色与制作人员`];
	for (const ref of ensureArray(references)) {
		lines.push(`- [${ref.label}「${ref.title}」](${ref.url})：${ref.usage || "作品介绍与剧情"}（${ref.license}）`);
	}
	return `## 参考资料\n\n${lines.join("\n")}`;
}






export async function readJsonIfExists(filePath, fallback) {
	try {
		const raw = await fs.readFile(filePath, "utf8");
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

export async function writeJson(filePath, value) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function createStateRecord({ subjectId, title, filePath, alias, sourceLink, published, image, reviewMode }) {
	return {
		subjectId,
		title,
		filePath,
		alias,
		sourceLink,
		image,
		published,
		status: reviewMode ? "review" : "published",
		generatedAt: new Date().toISOString(),
	};
}

export function buildReviewReport({ selected, candidates, outputPath, statePath, reviewMode }) {
	return {
		generatedAt: new Date().toISOString(),
		reviewMode,
		selectedAnime: selected,
		coverCandidates: candidates,
		outputPath,
		statePath,
	};
}

export { DEFAULT_FALLBACK_IMAGE, DEFAULT_MAX_PER_RUN, ARTICLE_SCHEMA, CHARACTER_SCHEMA };
