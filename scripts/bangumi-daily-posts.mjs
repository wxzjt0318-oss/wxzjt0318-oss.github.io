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
		.replace(/^-|-$/g, "");
	if (normalized) {
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

export function selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun = DEFAULT_MAX_PER_RUN }) {
	const items = ensureArray(collections)
		.filter((item) => item?.subject_id || item?.subject?.id)
		.map((item) => ({
			...item,
			subject_id: Number(item.subject_id || item?.subject?.id),
		}))
		.sort((a, b) => {
			const aTime = Date.parse(a.updated_at || a.comment_updated_at || a.created_at || a.subject?.date || 0) || 0;
			const bTime = Date.parse(b.updated_at || b.comment_updated_at || b.created_at || b.subject?.date || 0) || 0;
			return bTime - aTime;
		});

	const generatedIds = new Set(ensureArray(generatedState?.generated).map((entry) => Number(entry.subjectId)));
	const existing = buildExistingPostIndex(existingPosts || []);

	const shuffled = [...items];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	const selected = [];
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
	const filled = autoFillMetadata(metadata);
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

export function buildEnhancedArticleMarkdown(payload) {
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
		moegirlContent = null,
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

	const genreQuotes = {
		"漫画": `"${cleanTitle}——两个完全不同的人，因为某种奇妙的化学反应走到了一起。"`,
		"动画": `"每一部作品都是一扇通往异世界的门——而这，正是为你敞开的某一扇。"`,
		"轻小说": `"文字的力量在于它能打开一扇窗，让我们在现实之外看见无限可能——而这本书，正有这样的魅力。"`,
		"恋爱": "有些故事，从一次不经意的相遇开始——而它，正是这样一段值得驻足的时光。",
		"百合": "花季绽放的瞬间，承载着无数细腻而真挚的情愫——这便是它独有的芬芳。",
		"奇幻": "当异世界的门扉悄然打开——一段超越想象边界的旅程便由此启程。",
		"校园": "青春的篇章里，总有些故事让人难以忘怀——这便是属于那个夏天的记忆。",
		"热血": "燃烧的意志永不熄灭——这便是它赋予每一段旅程的炽热灵魂。",
		"治愈": "有些温暖，能够融化心底最柔软的角落——这便是它最轻柔的慰藉。",
		"日常": "最打动人心的，往往不是波澜壮阔——而是那些真切可感的点滴瞬间。",
	};

	const finalQuote = quote || (() => {
		let selectedQuote = genreQuotes[genreTags[0]] || genreQuotes["动画"];
		const tagSet = new Set(genreTags.map((t) => t.toLowerCase()));
		for (const [genre, tmpl] of Object.entries(genreQuotes)) {
			if (tagSet.has(genre.toLowerCase())) {
				selectedQuote = tmpl;
				break;
			}
		}
		return selectedQuote;
	})();

	const introText = buildIntroText({
		cleanTitle,
		originalTitle,
		description,
		summary,
		genreTags,
		meta,
		moegirlData: moegirlContent?.[0] || null,
	});

	const infoRows = buildInfoTableRows({
		"作品名": cleanTitle,
		...(originalTitle && originalTitle !== cleanTitle ? { "原名": originalTitle } : {}),
		...(meta.studio ? { "动画制作": meta.studio } : {}),
		...(meta.airDate ? { "首播时间": meta.airDate } : {}),
		...(meta.episodes ? { "话数": meta.episodes } : {}),
		...(genreTags.length > 0 ? { "题材标签": genreTags.join(" / ") } : {}),
		...(meta.statusLabel ? { "追番状态": meta.statusLabel } : {}),
	});

	const staffSection = buildStaffSection(staff);
	const characterSection = buildCharacterSection(characters);
	const moegirlSection = buildMoegirlSection(moegirlContent);
	const viewingPoints = buildViewingPoints({ cleanTitle, genreTags, meta });
	const summarySection = buildSummarySection({ cleanTitle, genreTags });

	const contentOverride = manualEdits.content || {};

	return `${frontmatter}

> ${finalQuote}

${contentOverride.intro || introText}

![封面图片](${filled.image})

## 原作信息

${infoRows}

${contentOverride.staff || staffSection}

${contentOverride.characters || characterSection}

${contentOverride.moegirl || moegirlSection}

## 观看要点

${contentOverride.viewingPoints || viewingPoints}

## 总结

${contentOverride.summary || summarySection}`;
}

function buildIntroText({ cleanTitle, originalTitle, description, summary, genreTags, meta, moegirlData }) {
	let introText = "";

	if (moegirlData && moegirlData.extract) {
		const cleaned = moegirlData.extract
			.replace(/\[\[来源::[^\]]+\]\]/g, "")
			.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
			.replace(/{{[^}]+}}/g, "")
			.trim();

		if (cleaned.length > 100) {
			introText = cleaned;
		}
	}

	if (!introText && (summary || description)) {
		const sourceContent = summary || description || "";
		const sentences = sourceContent.split(/[。！？]/).filter(s => s.trim().length > 10);
		if (sentences.length > 0) {
			introText = sentences.slice(0, 3).join("。") + "。";
		}
	}

	if (!introText) {
		introText = `${cleanTitle}是${genreTags[0] || "动画"}作品中的代表作之一，讲述了${meta.summary ? truncateText(meta.summary, 80) : "一段值得驻足的故事"}。`;
	}

	return introText;
}

function buildStaffSection(staff) {
	if (!staff || staff.length === 0) {
		return "";
	}

	const staffLines = ensureArray(staff)
		.slice(0, 8)
		.map((item) => `- **${item.relation || "相关人员"}**：${item.name}`)
		.join("\n");

	return `- **制作人员**：
${staffLines}`;
}

function buildCharacterSection(characters) {
	if (!characters || characters.length === 0) {
		return "";
	}

	const validatedChars = characters.slice(0, 6).map((char) => {
		const validation = validateCharacterData(char);
		if (!validation.valid) {
			console.warn("角色数据验证警告:", validation.errors);
		}
		return char;
	});

	return `## 主要角色介绍

${validatedChars.map((char) => {
	const charName = char.name || char.name_cn || "未知角色";
	const charDesc = char.comment || char.summary || char.description || "";
	const charCV = char.cv ? `**CV**：${char.cv}` : "";
	const charBackground = char.background || "";
	const charPersonality = char.personality || "";
	const charArc = char.arc || "";

	let charContent = `### ${charName}\n\n${charDesc}`;

	if (charCV) {
		charContent += `\n\n${charCV}`;
	}

	if (charBackground) {
		charContent += `\n\n**角色背景**：${charBackground}`;
	}

	if (charPersonality) {
		charContent += `\n\n**性格特点**：${charPersonality}`;
	}

	if (charArc) {
		charContent += `\n\n**角色弧线**：${charArc}`;
	}

	return charContent;
}).join("\n\n")}`;
}

function buildMoegirlSection(moegirlData) {
	if (!moegirlData) {
		return "";
	}

	const items = [];
	if (moegirlData.categories) {
		moegirlData.categories.forEach(cat => {
			if (!cat.includes("条目") && !cat.includes("分类")) {
				items.push(cat);
			}
		});
	}

	if (moegirlData.relatedPages && moegirlData.relatedPages.length > 0) {
		items.push(...moegirlData.relatedPages.slice(0, 5).map(p => p.title));
	}

	if (items.length === 0) {
		return "";
	}

	return `## 萌娘百科资料

本文节选自萌娘百科条目，内容经过重新编写整理。`;
}

function buildViewingPoints({ cleanTitle, genreTags, meta }) {
	const tagText = genreTags.length > 0 ? genreTags.slice(0, 5).join("、") : "综合向";

	return `从追番视角来看，这部作品之所以值得单独整理，原因主要有三点：

- **信息密度足够**：无论是 Bangumi 条目本身，还是作品公开简介，都已经能支撑起一篇较完整的入门介绍。
- **题材卖点明确**：从 ${tagText} 这些标签里，可以迅速看出作品最核心的表达方向。
- **追番记录真实可追踪**：它已经进入个人追番列表，因此这篇文章不仅是资料整理，也是在为后续补番/追更建立可复用索引。

如果要用一句话概括这部作品在追番列表中的价值，我会说：它不是那种必须靠一口气补完才能理解魅力的类型，而是很适合先抓住基础设定、再根据个人口味决定是否深挖的作品。`;
}

function buildSummarySection({ cleanTitle, genreTags }) {
	return `总的来说，《${cleanTitle}》已经满足「可自动生成单篇介绍文章」的基本条件：有明确条目、有可核实简介、有追番状态、有可用封面，也有足够的标签信息来组织内容。

对于还没入坑的朋友，我的建议是：如果你的阅番量足够大、对快节奏作品已经审美疲劳，那么它值得你花时间去慢慢品味——很多作品的魅力，往往需要静下心来才能发现。`;
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
		draft,
		meta = {},
		staff = [],
		characters = [],
		moegirlContent = null,
		quote,
		manualEdits,
	} = payload;

	return buildEnhancedArticleMarkdown({
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
		draft,
		meta,
		staff,
		characters,
		moegirlContent,
		quote,
		manualEdits,
	});
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
