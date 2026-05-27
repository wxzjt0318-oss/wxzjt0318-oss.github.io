import fs from "node:fs/promises";
import path from "node:path";

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
Test Files  1 passed (1)
Tests  8 passed (8)		.replace(/^-|-$/g, "");
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

	for (const post of posts) {
		const subjectIdMatch = String(post.sourceLink || "").match(/\/subject\/(\d+)/);
		if (subjectIdMatch?.[1]) {
			subjectIds.add(Number(subjectIdMatch[1]));
		}
		if (post.title) {
			titles.add(normalizeText(post.title));
		}
	}

	return { subjectIds, titles };
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
		licenseName: "CC BY 4.0",
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
	});

	const frontmatter = buildFrontmatter({
		...filled,
		draft,
		...(manualEdits.frontmatter || {}),
	});

	const cleanTitle = filled.title.replace(/^《|》$/g, "");
	const genreTags = ensureArray(filled.tags);
	const finalQuote = quote || selectOpeningQuote(cleanTitle, genreTags);
	const introText = buildIntroText({ cleanTitle, description, summary, genreTags, meta });
	const infoSection = buildInfoSection({
		cleanTitle,
		originalTitle,
		genreTags,
		filled,
		meta,
	});
	const plotSection = buildPlotSection({ cleanTitle, summary, description, meta });
	const characterSection = buildCharacterSection(characters);
	const staffSection = buildStaffSection(staff);
	const viewingPoints = buildViewingPoints({ cleanTitle, genreTags, meta, summary, characters });
	const summarySection = buildSummarySection({ cleanTitle, genreTags, meta });
	const contentOverride = manualEdits.content || {};

	return `${frontmatter}

> ${finalQuote}

---

# ${cleanTitle}

## 一、作品概述

${contentOverride.intro || introText}

![${cleanTitle}封面](${filled.image})

## 二、基础信息

${contentOverride.info || infoSection}

## 三、剧情简介

${contentOverride.plot || plotSection}

${contentOverride.characters || characterSection}

${contentOverride.staff || staffSection}

## 四、作品看点

${contentOverride.viewingPoints || viewingPoints}

## 五、综合评价

${contentOverride.summary || summarySection}`;
}

function selectOpeningQuote(cleanTitle, genreTags) {
	const genreQuotes = {
		"漫画": [
			`翻开第一页，便被《${cleanTitle}》的世界所吸引——这是属于漫画爱好者的独特浪漫。`,
			`好的漫画总能让人沉浸其中，《${cleanTitle}》正是这样一部值得细细品味的作品。`,
			`当画笔与故事相遇，《${cleanTitle}》用独特的叙事方式诠释了一个令人难忘的世界。`,
		],
		"动画": [
			"每一部动画都是一扇通往异世界的门——而这，正是为你敞开的某一扇。",
			"在光影交织的画面中，总有一些作品能够触动心灵——《" + cleanTitle + "》便是其中之一。",
			"动画的魅力在于它能将想象变为现实，而这部作品正是这种魅力的完美体现。",
		],
		"轻小说": [
			"文字的力量在于它能打开一扇窗，让我们在现实之外看见无限可能——而这本书，正有这样的魅力。",
			"轻小说的世界总是充满惊喜，《" + cleanTitle + "》用文字构建了一个令人向往的奇幻空间。",
			"当想象力化为文字，便有了《" + cleanTitle + "》这样让人沉浸其中的精彩故事。",
		],
		"恋爱": [
			"有些故事，从一次不经意的相遇开始——而它，正是这样一段值得驻足的时光。",
			"爱情的模样有千万种，《" + cleanTitle + "》为我们呈现了其中最动人的那一种。",
			"心动的瞬间总是来得猝不及防，这正是《" + cleanTitle + "》想要传达的美好。",
		],
		"百合": [
			"花季绽放的瞬间，承载着无数细腻而真挚的情愫——这便是它独有的芬芳。",
			"少女之间的情感如同春日里的樱花，纯洁而美好——《" + cleanTitle + "》正是这样的故事。",
			"在青春的画卷中，百合花悄然绽放，诉说着属于她们的独特物语。",
		],
		"奇幻": [
			"当异世界的门扉悄然打开——一段超越想象边界的旅程便由此启程。",
			"奇幻的世界总是充满无限可能，《" + cleanTitle + "》带我们踏上了一段奇妙的冒险之旅。",
			"在魔法与剑交织的世界里，《" + cleanTitle + "》为我们展开了一幅壮丽的史诗画卷。",
		],
		"校园": [
			"青春的篇章里，总有些故事让人难以忘怀——这便是属于那个夏天的记忆。",
			"校园生活总是充满欢笑与泪水，《" + cleanTitle + "》记录下了这段最美好的时光。",
			"教室里的阳光、操场上的奔跑——《" + cleanTitle + "》唤醒了我们对青春的无限回忆。",
		],
		"热血": [
			"燃烧的意志永不熄灭——这便是它赋予每一段旅程的炽热灵魂。",
			"热血与激情交织，《" + cleanTitle + "》点燃了我们心中那团永不熄灭的火焰。",
			"当勇气与信念相遇，便有了《" + cleanTitle + "》这样让人热血沸腾的精彩故事。",
		],
		"治愈": [
			"有些温暖，能够融化心底最柔软的角落——这便是它最轻柔的慰藉。",
			"在疲惫的日子里，《" + cleanTitle + "》如同一杯温热的茶，温暖着我们的心灵。",
			"治愈系的魅力在于它能抚平内心的伤痕，《" + cleanTitle + "》正是这样一部温暖人心的作品。",
		],
		"日常": [
			"最打动人心的，往往不是波澜壮阔——而是那些真切可感的点滴瞬间。",
			"平凡的日常中蕴藏着不平凡的美好，《" + cleanTitle + "》让我们重新发现了生活的乐趣。",
			"日常系作品的魅力在于它的细腻与真实，《" + cleanTitle + "》正是这样一部充满生活气息的佳作。",
		],
		"悬疑": [
			"真相往往隐藏在迷雾之中，《" + cleanTitle + "》将带我们一步步揭开谜题的面纱。",
			"当谜题层层展开，《" + cleanTitle + "》为我们呈现了一场精彩绝伦的推理盛宴。",
			"悬疑的魅力在于它的不可预测性，《" + cleanTitle + "》正是这样一部让人欲罢不能的作品。",
		],
		"科幻": [
			"在科技与未来的交汇点，《" + cleanTitle + "》为我们描绘了一幅令人震撼的未来图景。",
			"科幻的世界总是充满想象，《" + cleanTitle + "》带我们探索了人类未来的无限可能。",
			"当科技的边界被不断拓展，《" + cleanTitle + "》为我们呈现了一个前所未见的未来世界。",
		],
	};

	const tagSet = new Set(genreTags.map((t) => t.toLowerCase()));
	
	for (const [genre, quotes] of Object.entries(genreQuotes)) {
		if (tagSet.has(genre.toLowerCase())) {
			return quotes[Math.floor(Math.random() * quotes.length)];
		}
	}
	
	const defaultQuotes = genreQuotes["动画"];
	return defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)];
}

function buildInfoSection({ cleanTitle, originalTitle, genreTags, filled, meta }) {
	const infoRows = [
		`- **作品名称**：${cleanTitle}`,
		originalTitle && originalTitle !== cleanTitle ? `- **原作标题**：${originalTitle}` : "",
		meta.studio ? `- **动画制作**：${meta.studio}` : "",
		meta.airDate ? `- **首播时间**：${meta.airDate}` : "",
		meta.episodes ? `- **话数信息**：${meta.episodes}` : "",
		genreTags.length > 0 ? `- **题材标签**：${genreTags.join(" / ")}` : "",
		meta.score ? `- **Bangumi 评分**：${meta.score}${meta.scoreRank ? `（排名 #${meta.scoreRank}）` : ""}` : "",
		meta.total ? `- **收藏人数**：${meta.total.toLocaleString()}` : "",
		meta.statusLabel ? `- **追番状态**：${meta.statusLabel}` : "",
		meta.progress ? `- **观看进度**：${meta.progress}` : "",
		meta.startDate ? `- **开始日期**：${meta.startDate}` : "",
		meta.endDate ? `- **完结日期**：${meta.endDate}` : "",
		`- **条目链接**：[Bangumi 页面](${filled.sourceLink})`,
	].filter(Boolean);

	return infoRows.join("\n");
}

function buildIntroText({ cleanTitle, description, summary, genreTags, meta }) {
	const sourceContent = summary || description || "";
	const sentences = sourceContent
		.split(/[。！？]/)
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 10)
		.slice(0, 3);
	const primaryTag = genreTags[0] || "动画";
	const secondaryTags = genreTags.slice(1, 3).join("、");
	const studioInfo = meta.studio ? `由${meta.studio}制作的` : "";
	const airDateInfo = meta.airDate ? `，于${meta.airDate}开播` : "";

	if (sentences.length >= 2) {
		const introTemplates = [
			`《${cleanTitle}》${studioInfo}这部${primaryTag}作品，给人的观感并不是靠单一噱头硬撑起来的。真正吸引人的地方，在于它很快就把作品的核心气质摆到了台面上：${sentences[0]}。${sentences[1]}。${sentences[2] || ""}\n\n如果只看题材标签，它会被归到${primaryTag}${secondaryTags ? `、${secondaryTags}` : ""}这一类之中；但真正让它成立的，还是设定展开后的节奏感，以及角色关系慢慢铺开的过程。`,
			`作为一部${studioInfo}${primaryTag}作品，《${cleanTitle}》${airDateInfo}，凭借其独特的叙事风格吸引了众多观众。${sentences[0]}。${sentences[1]}。${sentences[2] || ""}\n\n这部作品的魅力在于它不仅仅是表面的娱乐，更有着值得细细品味的深层内涵。`,
			`《${cleanTitle}》是一部${primaryTag}${secondaryTags ? `与${secondaryTags}元素交织的` : "题材的"}作品${studioInfo ? `，${studioInfo}精心打造` : ""}。${sentences[0]}。${sentences[1]}。${sentences[2] || ""}\n\n在众多同类型作品中，它凭借独特的气质脱颖而出，值得我们深入了解。`,
		];
		return introTemplates[Math.floor(Math.random() * introTemplates.length)];
	}

	const fallbackSummary = meta.summary ? truncateText(meta.summary, 150) : "它并不是靠高强度冲突推进，而是依靠设定、氛围与人物互动慢慢建立吸引力。";
	const fallbackTemplates = [
		`《${cleanTitle}》是一部${studioInfo}很典型、但又不完全落入套路的${primaryTag}作品${airDateInfo}。${fallbackSummary}\n\n如果你平时会在一堆新作里挑那种"看起来不吵、但越看越顺"的类型，那么它大概率会是能留在片单里的那一部。`,
		`作为一部${primaryTag}作品，《${cleanTitle}》${studioInfo ? `由${meta.studio}制作，` : ""}展现了这一题材的独特魅力。${fallbackSummary}\n\n这部作品或许不是那种一眼惊艳的类型，但它的细腻与深度值得我们慢慢品味。`,
		`《${cleanTitle}》${studioInfo}是一部${primaryTag}题材的作品${airDateInfo}。${fallbackSummary}\n\n它的魅力在于那种润物细无声的叙事方式，让人在不知不觉中沉浸其中。`,
	];
	return fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
}

function buildPlotSection({ cleanTitle, summary, description, meta }) {
	const content = (summary || description || "").trim();
	if (content) {
		const plotTemplates = [
			`${content}\n\n单从剧情入口来看，《${cleanTitle}》并没有把门槛设得很高。它会先用一个足够明确的设定把观众带进去，再通过后续展开补足人物关系、情绪变化与世界观层次。因此即使只是先了解简介，也基本能判断这部作品适不适合自己的口味。`,
			`${content}\n\n从故事架构来看，《${cleanTitle}》采用了一种循序渐进的叙事方式。开篇先用明确的设定吸引注意力，随后通过情节推进逐步展开更深层的世界观与人物关系，让人越看越有味道。`,
			`${content}\n\n《${cleanTitle}》的剧情设计颇具匠心，它没有急于抛出所有信息，而是选择在合适的时机揭示关键信息，让观众在探索的过程中逐渐沉浸其中。这种张弛有度的节奏把控，是这部作品的一大亮点。`,
		];
		return plotTemplates[Math.floor(Math.random() * plotTemplates.length)];
	}

	const fallbackTag = meta.statusLabel ? `结合目前的追番状态「${meta.statusLabel}」来看` : "就目前公开资料来看";
	const noContentTemplates = [
		`${fallbackTag}，《${cleanTitle}》已经具备比较完整的基础信息。虽然详细剧情仍有待进一步补充，但它的类型定位、核心设定与整体观感都足够清晰，适合作为一部可以先收藏、再慢慢确认的作品。`,
		`${fallbackTag}，《${cleanTitle}》的详细剧情简介尚未完全公开。但从已有的信息来看，这部作品的基础设定已经相当扎实，值得我们保持关注并期待后续的剧情展开。`,
		`虽然《${cleanTitle}》的完整剧情简介尚未公开，但${fallbackTag}，这部作品的整体框架已经初具雏形。建议先收藏关注，待更多信息披露后再做深入了解。`,
	];
	return noContentTemplates[Math.floor(Math.random() * noContentTemplates.length)];
}

function buildStaffSection(staff) {
	if (!staff || staff.length === 0) {
		return "";
	}

	const roleOrder = ["导演", "副导演", "系列构成", "脚本", "原作", "角色设计", "总作画监督", "音乐", "音响监督", "动画制作", "制作"];

	const getRolePriority = (relation) => {
		const idx = roleOrder.findIndex(r => relation?.includes(r));
		return idx >= 0 ? idx : 999;
	};

	const sortedStaff = ensureArray(staff)
		.slice()
		.sort((a, b) => getRolePriority(a.relation) - getRolePriority(b.relation))
		.slice(0, 10);

	const staffLines = sortedStaff
		.map((item) => {
			const roleEmoji = {
				"导演": "🎬",
				"副导演": "🎬",
				"系列构成": "✍️",
				"脚本": "✍️",
				"原作": "📖",
				"角色设计": "🎨",
				"总作画监督": "🎨",
				"音乐": "🎵",
				"音响监督": "🎵",
				"动画制作": "🏢",
				"制作": "🏢",
			};

			const emoji = Object.entries(roleEmoji).find(([key]) => item.relation?.includes(key))?.[1] || "👤";
			return `- ${emoji} **${item.relation || "相关人员"}**：${item.name}`;
		})
		.join("\n");

	return `## 制作阵容\n\n${staffLines}`;
}

function buildCharacterSection(characters) {
	if (!characters || characters.length === 0) {
		return "";
	}

	const validatedChars = characters.slice(0, 5).map((char) => {
		const validation = validateCharacterData(char);
		if (!validation.valid) {
			console.warn("角色数据验证警告:", validation.errors);
		}
		return char;
	});

	return `## 主要角色\n\n${validatedChars.map((char, idx) => {
		const charName = char.name || char.name_cn || "未知角色";
		const charNameCN = char.name_cn && char.name !== char.name_cn ? `（${char.name_cn}）` : "";
		const charDesc = (char.comment || char.summary || char.description || "").trim();
		const charCV = char.cv ? `**CV**：${char.cv}` : "";
		const charGender = char.gender ? `**性别**：${char.gender === "male" ? "男" : char.gender === "female" ? "女" : char.gender}` : "";
		const charBirth = char.birth ? `**生日**：${char.birth}` : "";
		const charBlood = char.blood_type ? `**血型**：${char.blood_type}型` : "";

		const metaInfo = [charGender, charBirth, charBlood, charCV].filter(Boolean).join(" | ");
		const descFallback = idx === 0
			? "作为本作的核心角色，其性格特点与成长轨迹是故事的重要看点之一。"
			: "当前公开资料中对该角色的描述还比较有限，但从已知信息来看，这个角色在作品里的存在感并不低。";

		return `### ${charName}${charNameCN}\n\n${charDesc || descFallback}${metaInfo ? `\n\n> ${metaInfo}` : ""}`;
	}).join("\n\n")}`;
}

function buildViewingPoints({ cleanTitle, genreTags, meta, summary, characters }) {
	const tagText = genreTags.length > 0 ? genreTags.slice(0, 5).join("、") : "综合向";
	const hasCharacters = Array.isArray(characters) && characters.length > 0;
	const hasStudio = Boolean(meta.studio);
	const hasScore = Boolean(meta.score);
	const statusLine = meta.statusLabel
		? `目前在追番记录里，它对应的状态是「${meta.statusLabel}」，说明它已经不只是看起来可能不错的候选，而是确实进入了整理范围。`
		: "它已经被纳入追番整理列表，因此这篇文章也具备持续更新和回看的价值。";
	const summaryLine = summary
		? "简介本身已经能提供比较明确的剧情入口，不需要额外查很多资料就能判断它的基本调性。"
		: "即使目前公开简介不算长，作品的类型与观看预期仍然比较好把握。";

	const scoreLine = hasScore
		? `在 Bangumi 上，它获得了 ${meta.score} 分的评价${meta.total ? `，有 ${meta.total.toLocaleString()} 人收藏` : ""}，说明它在观众群体中已经积累了一定的口碑基础。`
		: statusLine;
	const studioLine = hasStudio
		? `${meta.studio} 在业界有着不错的制作水准，这也为作品的画面质量和整体完成度提供了保障。`
		: "";

	return `如果要从入坑角度快速判断《${cleanTitle}》值不值得看，我会先看下面这几点：

- **题材方向够不够明确**：从 ${tagText} 这些标签出发，基本已经能判断它的风格核心与受众取向。
- **第一印象是否顺畅**：${summaryLine}
- **角色或制作信息是否有延伸价值**：${hasCharacters ? "角色资料相对完整，说明后续展开和人物关系会是这部作品的重要组成部分。" : "虽然角色资料暂时不算丰富，但条目基础已经足够支撑一次稳定的入门整理。"}
- **口碑与关注度**：${scoreLine}
${hasStudio ? `- **制作团队实力**：${studioLine}` : ""}

总的来说，《${cleanTitle}》${hasScore && parseFloat(meta.score) >= 7 ? "在口碑上已经得到了不错的认可，" : ""}这类作品最重要的不是第一眼有多炸裂，而是它能不能在你点进去之后，让你愿意继续往下看。只要这一点成立，它就已经完成了最关键的任务。`;
}

function buildSummarySection({ cleanTitle, genreTags, meta }) {
	const primaryTag = genreTags[0] || "这类题材";
	const secondaryTags = genreTags.slice(1, 3).join("、");
	const hasScore = Boolean(meta.score);
	const hasStudio = Boolean(meta.studio);

	const progressLine = meta.progress
		? `如果你已经看到 ${meta.progress.replace(/^已看到\s*/, "")}`
		: "如果你还在犹豫要不要补这部作品";

	const scoreInsight = hasScore
		? `在评分方面，Bangumi 上 ${meta.score} 分${meta.total ? `、${meta.total.toLocaleString()} 人收藏` : ""}的成绩，也从侧面反映了它在核心观众群体中的认可度。`
		: "";
	const studioInsight = hasStudio
		? `${meta.studio} 的制作实力为作品的视觉呈现提供了可靠保障。`
		: "";

	const summaryTemplates = [
		`综合来看，《${cleanTitle}》最稳的优势，在于它的信息结构足够完整：题材明确、基础设定清晰、条目资料可核对，文章整理起来也能自然形成一个比较完整的阅读入口。\n\n${scoreInsight}${studioInsight ? `\n${studioInsight}` : ""}\n\n${progressLine}，那么它至少值得你先留在片单里。尤其是当你本来就对${primaryTag}${secondaryTags ? `、${secondaryTags}` : ""}作品有兴趣时，这类不靠噱头、但节奏和气质都比较稳定的作品，往往更容易留下来。`,
		`从整体来看，《${cleanTitle}》是一部信息完整、定位清晰的作品。${scoreInsight ? `${scoreInsight}` : ""}${studioInsight ? `\n${studioInsight}` : ""}\n\n${progressLine}，建议将其加入你的待看清单。对于喜欢${primaryTag}${secondaryTags ? `、${secondaryTags}` : ""}类型的观众来说，这部作品值得你花时间去体验。`,
		`总的来说，《${cleanTitle}》凭借其扎实的基础信息和清晰的题材定位，为读者提供了一个完整的了解入口。${scoreInsight ? `\n\n${scoreInsight}` : ""}${studioInsight ? `\n${studioInsight}` : ""}\n\n${progressLine}，这部作品的整体质量足以让你放心地将它列入片单。在${primaryTag}这个品类中，它是一个值得信赖的选择。`,
	];
	return summaryTemplates[Math.floor(Math.random() * summaryTemplates.length)];
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
