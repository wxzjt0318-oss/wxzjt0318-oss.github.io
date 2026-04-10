import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_PER_RUN = 1;
const DEFAULT_FALLBACK_IMAGE = "/assets/anime/default.webp";
const DEFAULT_BODY_IMAGE_COUNT = 3;

function ensureArray(value) {
	return Array.isArray(value) ? value : [];
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
	const aliases = new Set();
	const titles = new Set();

	for (const post of posts) {
		const subjectIdMatch = String(post.sourceLink || "").match(/\/subject\/(\d+)/);
		if (subjectIdMatch?.[1]) {
			subjectIds.add(Number(subjectIdMatch[1]));
		}
		if (post.alias) {
			aliases.add(String(post.alias).trim());
		}
		if (post.title) {
			titles.add(normalizeText(post.title));
		}
	}

	return { subjectIds, aliases, titles };
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

	const selected = [];
	for (const item of items) {
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

export function scoreCoverCandidate(candidate, context = {}) {
	if (!candidate?.url) {
		return -1;
	}
	let score = 0;
	const source = candidate.source || "unknown";
	if (source === "bangumi-large") score += 100;
	if (source === "official-og") score += 90;
	if (source === "jikan-search") score += 80;
	if (source === "bangumi-common") score += 70;
	if (source === "bangumi-medium") score += 60;
	if (candidate.width) score += Math.min(candidate.width / 40, 30);
	if (candidate.height) score += Math.min(candidate.height / 40, 20);

	const title = normalizeText(candidate.title || "");
	const targetNames = ensureArray(context.names).map((name) => normalizeText(name)).filter(Boolean);
	if (title && targetNames.some((name) => title.includes(name) || name.includes(title))) {
		score += 25;
	}
	if (context.year && String(candidate.year || "") === String(context.year)) {
		score += 10;
	}
	return score;
}

export function chooseBestCoverImage(candidates, context = {}) {
	const unique = [];
	const seen = new Set();
	for (const candidate of ensureArray(candidates)) {
		if (!candidate?.url || seen.has(candidate.url)) {
			continue;
		}
		seen.add(candidate.url);
		unique.push({ ...candidate, score: scoreCoverCandidate(candidate, context) });
	}
	unique.sort((a, b) => b.score - a.score);
	return {
		selected: unique[0] || null,
		candidates: unique,
	};
}

function shuffleList(items, seedText = "") {
	const seed = String(seedText || "seed");
	const list = [...items];
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	for (let i = list.length - 1; i > 0; i -= 1) {
		hash = (hash * 1664525 + 1013904223) >>> 0;
		const j = hash % (i + 1);
		[list[i], list[j]] = [list[j], list[i]];
	}
	return list;
}

export function pickRandomBodyImages(candidates, preferredUrl = "", count = DEFAULT_BODY_IMAGE_COUNT, seedText = "") {
	const filtered = ensureArray(candidates)
		.filter((item) => item?.url)
		.filter((item) => item.url !== preferredUrl);
	const shuffled = shuffleList(filtered, seedText);
	const picked = shuffled.slice(0, count);
	if (picked.length >= count) {
		return picked;
	}
	const fallbackPool = ensureArray(candidates).filter((item) => item?.url);
	for (const item of fallbackPool) {
		if (picked.length >= count) {
			break;
		}
		if (!picked.some((pickedItem) => pickedItem.url === item.url)) {
			picked.push(item);
		}
	}
	return picked.slice(0, count);
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
	return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(safeDescription)}\ntags: [${safeTags}]\ncategory: ${JSON.stringify(category || "Bangumi 每日追番") }\nlicenseName: \"CC BY 4.0\"\nauthor: \"灵梦\"\nsourceLink: ${JSON.stringify(sourceLink || "")}\ndraft: ${draft ? "true" : "false"}\npubDate: ${published}\npublished: ${published}\npinned: false\nalias: ${JSON.stringify(alias)}\nimage: ${JSON.stringify(image || DEFAULT_FALLBACK_IMAGE)}\n---`;
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
		bodyImages = [],
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

	const highlights = [
		meta.studio ? `**制作阵容明确**：由 ${meta.studio} 参与或主导制作，整体气质和工业稳定性更容易形成统一观感。` : "**制作信息清晰**：公开资料足够完整，适合按既有栏目结构快速梳理。",
		meta.episodes ? `**篇幅相对明确**：当前公开集数信息为 ${meta.episodes}，无论是补番还是追更都比较容易安排节奏。` : "**补番门槛可控**：条目信息完整，适合快速进入作品世界观。",
		ensureArray(tags).length > 0 ? `**题材辨识度高**：从 ${ensureArray(tags).slice(0, 3).join("、")} 这些关键词就能看出作品的核心卖点。` : "**题材方向鲜明**：从现有简介与分类来看，作品主打类型十分明确。",
		meta.progress ? `**追番记录有连续性**：目前个人进度已来到 ${meta.progress}，说明它并非单纯收藏，而是正在持续关注中的作品。` : "**收藏行为本身就是信号**：能进入追番列表，通常代表作品已经具备了持续关注的理由。",
	];

	const staffLines = ensureArray(staff)
		.slice(0, 8)
		.map((item) => `- **${item.relation || "相关人员"}**：${item.name}${item.career ? `（${item.career}）` : ""}`)
		.join("\n");

	const disclaimer = reviewMode
		? "> 本文由 Bangumi 每日自动发文模块生成，当前处于预览/审核模式；发布前可继续人工润色。"
		: "> 本文由 Bangumi 每日自动发文模块依据公开资料与追番记录生成，并会在正文中随机插入三张关联图片以增强阅读体验。";

	const intro = `说实话，重新翻看追番列表时，我第一眼注意到的就是《${title.replace(/^《|》$/g, "")}》。它或许未必是那种靠单一噱头取胜的作品，但从条目公开资料、题材标签和实际追番记录来看，这部作品已经具备了单独写一篇介绍文的价值。下面我会按照站内已经固定下来的长文结构，把它的核心信息与观看要点系统整理一遍。`;
	const imageBlocks = ensureArray(bodyImages).slice(0, DEFAULT_BODY_IMAGE_COUNT).map((item, index) => {
		const alt = item.alt || `${title.replace(/^《|》$/g, "")} 相关图片 ${index + 1}`;
		return `![${alt}](${item.url})`;
	});
	const sectionImageOne = imageBlocks[0] ? `${imageBlocks[0]}\n\n` : "";
	const sectionImageTwo = imageBlocks[1] ? `${imageBlocks[1]}\n\n` : "";
	const sectionImageThree = imageBlocks[2] ? `${imageBlocks[2]}\n\n` : "";

	return `${frontmatter}\n\n${disclaimer}\n\n${intro}\n\n## 一、作品概述\n\n《${title.replace(/^《|》$/g, "")}》${originalTitle && originalTitle !== title.replace(/^《|》$/g, "") ? `（原名：**${originalTitle}**）` : ""} 是我在 Bangumi 追番页中已加入列表的作品之一。目前结合 Bangumi 条目、公开简介与站内追番数据来看，它更偏向 ${ensureArray(tags).slice(0, 3).join("、") || "综合向动画"} 这一类观看体验。${statusLabel ? `在个人收藏状态中，它当前处于 **${statusLabel}**。` : ""}\n\n${summary || description || "当前公开简介较为简略，但从已有信息看，这部作品已经具备了明确的类型定位与稳定的受众预期。"}\n\n## 二、基础信息\n\n| 项目 | 内容 |\n|------|------|\n${infoRows}\n\n## 三、剧情与题材整理\n\n${sectionImageOne}${summary || description || "目前公开资料主要集中在作品定位与基础设定层面。"}\n\n从追番视角来看，这部作品之所以值得单独整理，原因主要有三点：\n\n- **信息密度足够**：无论是 Bangumi 条目本身，还是作品公开简介，都已经能支撑起一篇较完整的入门介绍。\n- **题材卖点明确**：${ensureArray(tags).length > 0 ? `从 ${ensureArray(tags).slice(0, 5).join("、")} 这些标签里，可以迅速看出作品最核心的表达方向。` : "公开标签虽然不算多，但作品定位并不模糊。"}\n- **追番记录真实可追踪**：它已经进入个人追番列表，因此这篇文章不仅是资料整理，也是在为后续补番/追更建立可复用索引。\n\n## 四、制作信息与公开资料\n\n${sectionImageTwo}${staffLines || "- 当前公开可稳定核实的制作人员信息有限，因此这里优先采用 Bangumi 条目与条目摘要中可确认的资料进行整理。"}\n\n除此之外，基础制作信息里最值得注意的还有：\n\n- ${meta.studio ? `**制作相关主体**：${meta.studio}` : "**制作主体**：当前条目未给出足够精简的公开说明，因此需要以后续官方资料为准。"}\n- ${meta.airDate ? `**时间节点**：${meta.airDate}` : "**时间节点**：放送/公开时间仍建议结合官方站点持续核对。"}\n- ${meta.episodes ? `**篇幅信息**：${meta.episodes}` : "**篇幅信息**：当前尚未形成足够稳定的公开篇幅说明。"}\n\n## 五、追番视角下的观看要点\n\n${sectionImageThree}${highlights.map((item) => `- ${item}`).join("\n")}\n\n如果要用一句话概括这部作品在追番列表中的价值，我会说：它不是那种必须靠一口气补完才能理解魅力的类型，而是很适合先抓住基础设定、再根据个人口味决定是否深挖的作品。对于想快速建立自己的追番索引库的人来说，它很适合作为日更文章素材。\n\n## 六、总结\n\n总的来说，《${title.replace(/^《|》$/g, "")}》已经满足“可自动生成单篇介绍文章”的基本条件：有明确条目、有可核实简介、有追番状态、有可用封面，也有足够清晰的题材定位。后续如果官方公开了更多制作阵容、播出进度或角色资料，这篇文章也可以继续在现有结构上增量完善，而不需要推翻重写。\n`;
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

export { DEFAULT_FALLBACK_IMAGE, DEFAULT_MAX_PER_RUN };
