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

const openings = [
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
	return openings[Math.floor(Math.random() * openings.length)];
}

export async function readEnhancedCache(cacheDir) {
	const indexPath = path.join(cacheDir, "cache-index.json");
	const animePath = path.join(cacheDir, "anime.json");
	const gamesPath = path.join(cacheDir, "games.json");
	const unclassifiedPath = path.join(cacheDir, "unclassified.json");

	const index = await readJsonIfExists(indexPath, null);
	const anime = await readJsonIfExists(animePath, []);
	const games = await readJsonIfExists(gamesPath, []);
	const unclassified = await readJsonIfExists(unclassifiedPath, []);

	return {
		index,
		anime,
		games,
		unclassified,
		stats: index?.stats || { animeCount: 0, gameCount: 0, unknownCount: 0 },
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

export function buildFrontmatter({
	title,
	description,
	tags,
	category,
	sourceLink,
	published,
	alias,
	image,
	draft,
}) {
	const safeDescription = description || "";
	const safeTags = ensureArray(tags).slice(0, 8).map((tag) => JSON.stringify(tag)).join(", ");
	return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(safeDescription)}\ntags: [${safeTags}]\ncategory: ${JSON.stringify(category || "Bangumi 每日追番") }\nlicenseName: "CC BY 4.0"\nauthor: "灵梦"\nsourceLink: ${JSON.stringify(sourceLink || "")}\ndraft: ${draft ? "true" : "false"}\npubDate: ${published}\npublished: ${published}\npinned: false\nalias: ${JSON.stringify(alias)}\nimage: ${JSON.stringify(image || DEFAULT_FALLBACK_IMAGE)}\n---`;
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
		draft,
		meta = {},
		staff = [],
		statusLabel,
		reviewMode = false,
	} = payload;

	const frontmatter = buildFrontmatter({
		title,
		description,
		tags,
		category,
		sourceLink,
		published,
		alias,
		image,
		draft,
	});

	const infoRows = buildInfoTableRows({
		"作品名": title.replace(/^《|》$/g, ""),
		"原名": originalTitle,
		"Bangumi 条目": subjectId ? `[${subjectId}](${sourceLink})` : sourceLink,
		"放送时间": meta.airDate,
		"话数": meta.episodes,
		"制作公司": meta.studio,
		"追番状态": statusLabel,
		"个人进度": meta.progress,
		"类型标签": ensureArray(tags).join(" / "),
	});

	const genreDisclaimer = {
		恋爱: "> 有些故事，从一次不经意的相遇开始——而它，正是这样一段值得驻足的时光。",
		百合: "> 花季绽放的瞬间，承载着无数细腻而真挚的情愫——这便是它独有的芬芳。",
		奇幻: "> 当异世界的门扉悄然打开——一段超越想象边界的旅程便由此启程。",
		校园: "> 青春的篇章里，总有些故事让人难以忘怀——这便是属于那个夏天的记忆。",
		热血: "> 燃烧的意志永不熄灭——这便是它赋予每一段旅程的炽热灵魂。",
		治愈: "> 有些温暖，能够融化心底最柔软的角落——这便是它最轻柔的慰藉。",
		日常: "> 最打动人心的，往往不是波澜壮阔——而是那些真切可感的点滴瞬间。",
	};

	let disclaimer = reviewMode
		? "> 逐字斟酌，只为呈现最恰当的落笔——本文尚在预览打磨中，期待以更完整的形态与你相遇。"
		: "> 每一部作品都是一扇通往异世界的门——而这，正是为你敞开的某一扇。";
	
	const tagSet = new Set(ensureArray(tags).map(t => t.toLowerCase()));
	for (const [genre, tmpl] of Object.entries(genreDisclaimer)) {
		if (tagSet.has(genre.toLowerCase())) {
			disclaimer = tmpl;
			break;
		}
	}

	const intro = `《${title.replace(/^《|》$/g, "")}》是${meta?.studio || '某动画公司'}制作的动画作品。`;

	const staffLines = ensureArray(staff)
		.slice(0, 8)
		.map((item) => `- **${item.relation || "相关人员"}**：${item.name}`)
		.join("\n");

	const synopsisText = summary || description || "目前公开资料主要集中在作品定位与基础设定层面。";

	return `${frontmatter}\n\n${disclaimer}\n\n${intro}\n\n## 一、作品概述\n\n《${title.replace(/^《|》$/g, "")}》${originalTitle && originalTitle !== title.replace(/^《|》$/g, "") ? `（原名：**${originalTitle}**）` : ""} 是我在 Bangumi 追番页中已加入列表的作品之一。目前结合 Bangumi 条目、公开简介与站内追番数据来看，它更偏向 ${ensureArray(tags).slice(0, 3).join("、") || "综合向动画"} 这一类观看体验。${statusLabel ? `在个人收藏状态中，它当前处于 **${statusLabel}**。` : ""}\n\n${synopsisText}\n\n## 二、基础信息\n\n| 项目 | 内容 |\n|------|------|\n${infoRows}\n\n## 三、剧情与题材整理\n\n${summary || description || "目前公开资料主要集中在作品定位与基础设定层面。"}\n\n从追番视角来看，这部作品之所以值得单独整理，原因主要有三点：\n\n- **信息密度足够**：无论是 Bangumi 条目本身，还是作品公开简介，都已经能支撑起一篇较完整的入门介绍。\n- **题材卖点明确**：${ensureArray(tags).length > 0 ? `从 ${ensureArray(tags).slice(0, 5).join("、")} 这些标签里，可以迅速看出作品最核心的表达方向。` : "公开标签虽然不算多，但作品定位并不模糊。"}\n- **追番记录真实可追踪**：它已经进入个人追番列表，因此这篇文章不仅是资料整理，也是在为后续补番/追更建立可复用索引。\n\n## 四、制作信息与公开资料\n\n${staffLines || "- 当前公开可稳定核实的制作人员信息有限，因此这里优先采用 Bangumi 条目与条目摘要中可确认的资料进行整理。"}\n\n除此之外，基础制作信息里最值得注意的还有：\n\n- ${meta.studio ? `**制作相关主体**：${meta.studio}` : "**制作主体**：当前条目未给出足够精简的公开说明，因此需要以后续官方资料为准。"}\n- ${meta.airDate ? `**时间节点**：${meta.airDate}` : "**时间节点**：放送/公开时间仍建议结合官方站点持续核对。"}\n- ${meta.episodes ? `**篇幅信息**：${meta.episodes}` : "**篇幅信息**：当前尚未形成足够稳定的公开篇幅说明。"}\n\n## 五、追番视角下的观看要点\n\n- **制作阵容明确**：由 ${meta.studio || '某制作方'} 参与或主导制作，整体气质和工业稳定性更容易形成统一观感。\n- **篇幅相对可控**：${meta.episodes ? `当前公开集数信息为 ${meta.episodes}，无论是补番还是追更都比较容易安排节奏。` : "补番门槛可控，条目信息完整，适合快速进入作品世界观。"}\n- **题材辨识度高**：从 ${ensureArray(tags).slice(0, 3).join("、") || "综合向"} 这些关键词就能看出作品的核心卖点。\n- **追番记录有连续性**：${meta.progress ? `目前个人进度已来到 ${meta.progress}，说明它并非单纯收藏，而是正在持续关注中的作品。` : "收藏行为本身就是信号：能进入追番列表，通常代表作品已经具备了持续关注的理由。"}\n\n如果要用一句话概括这部作品在追番列表中的价值，我会说：它不是那种必须靠一口气补完才能理解魅力的类型，而是很适合先抓住基础设定、再根据个人口味决定是否深挖的作品。对于想快速建立自己的追番索引库的人来说，它很适合作为日更文章素材。\n\n## 六、总结\n\n总的来说，《${title.replace(/^《|》$/g, "")}》已经满足「可自动生成单篇介绍文章」的基本条件：有明确条目、有可核实简介、有追番状态、有可用封面，也有足够的标签信息来组织内容。\n\n对于还没入坑的朋友，我的建议是：如果你的阅番量足够大、对快节奏作品已经审美疲劳，那么它值得你花时间去慢慢品味——很多作品的魅力，往往需要静下心来才能发现。`;
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

export function rewriteArticleContent({ title, originalTitle, description, summary, tags, meta, staff, characters, moegirlData, bangumiData }) {
	const cleanTitle = title.replace(/^《|》$/g, "");
	const genreTags = ensureArray(tags);

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

	let quote = genreQuotes[genreTags[0]] || genreQuotes["动画"];
	const tagSet = new Set(genreTags.map((t) => t.toLowerCase()));
	for (const [genre, tmpl] of Object.entries(genreQuotes)) {
		if (tagSet.has(genre.toLowerCase())) {
			quote = tmpl;
			break;
		}
	}

	const introContent = rewriteIntro({
		title: cleanTitle,
		originalTitle,
		description,
		summary,
		genreTags,
		meta,
		moegirlData,
		bangumiData
	});

	const infoRows = buildInfoRows({ title: cleanTitle, originalTitle, meta, tags: genreTags, statusLabel: meta.statusLabel });
	const staffSection = buildStaffSection(staff);
	const characterSection = buildCharacterSection(characters);
	const moegirlSection = buildMoegirlSection(moegirlData);
	const viewingPoints = buildViewingPoints({ title: cleanTitle, tags: genreTags, meta });
	const summarySection = buildSummarySection({ title: cleanTitle, tags: genreTags });

	return {
		quote,
		introContent,
		infoRows,
		staffSection,
		characterSection,
		moegirlSection,
		viewingPoints,
		summarySection
	};
}

function rewriteIntro({ title, originalTitle, description, summary, genreTags, meta, moegirlData, bangumiData }) {
	let introText = "";

	const sourceContent = summary || description || "";

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

	if (!introText && sourceContent) {
		const sentences = sourceContent.split(/[。！？]/).filter(s => s.trim().length > 10);
		if (sentences.length > 0) {
			introText = sentences.slice(0, 3).join("。") + "。";
		}
	}

	if (!introText) {
		introText = `${title}是${genreTags[0] || "动画"}作品中的代表作之一。`;
	}

	return introText;
}

function buildInfoRows({ title, originalTitle, meta, tags, statusLabel }) {
	const rows = [
		["作品名称", title],
	];

	if (originalTitle && originalTitle !== title) {
		rows.push(["原名", originalTitle]);
	}

	if (meta.studio) {
		rows.push(["动画制作", meta.studio]);
	}

	if (meta.airDate) {
		rows.push(["首播时间", meta.airDate]);
	}

	if (meta.episodes) {
		rows.push(["话数", meta.episodes]);
	}

	if (tags && tags.length > 0) {
		rows.push(["题材标签", tags.join(" / ")]);
	}

	if (statusLabel) {
		rows.push(["追番状态", statusLabel]);
	}

	return rows.map(([label, value]) => `| **${label}** | ${value} |`).join("\n");
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

	const mainChars = characters.slice(0, 6);

	return `## 主要角色介绍

${mainChars.map((char) => {
	const charName = char.name || char.name_cn || "未知角色";
	const charDesc = char.comment || char.summary || "";
	const charCV = char.accent ? `**CV**：${char.accent}` : "";
	return `### ${charName}

${charDesc}${charCV ? `\n\n${charCV}` : ""}`;
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

function buildViewingPoints({ title, tags, meta }) {
	const tagText = tags.length > 0 ? tags.slice(0, 5).join("、") : "综合向";

	return `从追番视角来看，这部作品之所以值得单独整理，原因主要有三点：

- **信息密度足够**：无论是 Bangumi 条目本身，还是作品公开简介，都已经能支撑起一篇较完整的入门介绍。
- **题材卖点明确**：从 ${tagText} 这些标签里，可以迅速看出作品最核心的表达方向。
- **追番记录真实可追踪**：它已经进入个人追番列表，因此这篇文章不仅是资料整理，也是在为后续补番/追更建立可复用索引。

如果要用一句话概括这部作品在追番列表中的价值，我会说：它不是那种必须靠一口气补完才能理解魅力的类型，而是很适合先抓住基础设定、再根据个人口味决定是否深挖的作品。`;
}

function buildSummarySection({ title, tags }) {
	return `总的来说，《${title}》已经满足「可自动生成单篇介绍文章」的基本条件：有明确条目、有可核实简介、有追番状态、有可用封面，也有足够的标签信息来组织内容。

对于还没入坑的朋友，我的建议是：如果你的阅番量足够大、对快节奏作品已经审美疲劳，那么它值得你花时间去慢慢品味——很多作品的魅力，往往需要静下心来才能发现。`;
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
		draft,
		meta = {},
		staff = [],
		statusLabel,
		reviewMode = false,
		moegirlContent = null,
		characters = [],
	} = payload;

	const frontmatter = buildFrontmatter({
		title,
		description,
		tags,
		category,
		sourceLink,
		published,
		alias,
		image,
		draft,
	});

	const rewritten = rewriteArticleContent({
		title,
		originalTitle,
		description,
		summary,
		tags,
		meta: { ...meta, statusLabel },
		staff,
		characters,
		moegirlData: moegirlContent?.[0] || null,
		bangumiData: payload
	});

	const cleanTitle = title.replace(/^《|》$/g, "");

	return `${frontmatter}

> ${rewritten.quote}

${rewritten.introContent}

![封面图片](${image || DEFAULT_FALLBACK_IMAGE})

## 原作信息

${rewritten.infoRows}

${rewritten.staffSection}

${rewritten.characterSection}

${rewritten.moegirlSection}

## 观看要点

${rewritten.viewingPoints}

## 总结

${rewritten.summarySection}`;
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

export { DEFAULT_FALLBACK_IMAGE, DEFAULT_MAX_PER_RUN };
