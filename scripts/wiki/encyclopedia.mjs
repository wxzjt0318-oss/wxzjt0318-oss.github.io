/**
 * 作品百科资料聚合：萌娘百科优先，中文维基百科兜底，输出统一清洗过的简体中文文本
 * ─────────────────────────────────────────────────────────────────────────────
 *   fetchWorkEncyclopedia({ titleCn, titleJp })
 *     → { title, intro, story, sources: [{ label, title, url, license }] } | null
 *   fetchCharacterBio({ nameCn, workTitles })
 *     → { text, source } | null
 *
 * 相关性校验：条目正文必须提到作品名（中文名 / 日文原名 / 其系列名），且具有
 * 动画 / 漫画 / 轻小说 / 游戏等 ACG 语境，避免同名条目（人名、地名、普通词汇）混入。
 *
 * 所有外部请求失败都只返回 null，不抛错，保证发文主流程不受百科可用性影响。
 */

import {
	fetchMoegirlArticleForWork,
	MOEGIRL_LICENSE,
} from "../moegirl/scraper.mjs";
import { findStorySection, titleVariants } from "./mediawiki.mjs";
import {
	fetchWikipediaArticleForWork,
	WIKIPEDIA_LICENSE,
} from "./wikipedia.mjs";
import { cleanChineseProse, hasKana, toSimplified } from "./zh-text.mjs";

const ACG_CONTEXT_RE =
	/动画|動畫|動畫|番剧|TV动画|电视动画|漫画|漫畫|轻小说|輕小說|小说|游戏|遊戲|声优|聲優|配音/;

export const DEFAULT_SOURCES = [
	{
		key: "moegirl",
		label: "萌娘百科",
		license: MOEGIRL_LICENSE,
		fetchForWork: fetchMoegirlArticleForWork,
	},
	{
		key: "wikipedia",
		label: "维基百科",
		license: WIKIPEDIA_LICENSE,
		fetchForWork: fetchWikipediaArticleForWork,
	},
];

function normalizeForMatch(text) {
	return toSimplified(String(text || ""))
		.toLowerCase()
		.replace(/[\s·・:：!！?？、，,.。「」『』《》〈〉“”"'’\-－_~～]/g, "");
}

/** 去掉百科标题里的消歧后缀：零之使魔（动画） → 零之使魔 */
export function stripDisambiguation(title) {
	return toSimplified(String(title || ""))
		.replace(/\s*[（(][^（）()]*[）)]\s*$/, "")
		.trim();
}

/** 从百科导言的「（日语：…；英语：Xxx）」里取作品英文名，用作文章英文链接 */
export function extractEnglishTitle(intro) {
	const m = String(intro || "").match(/英[语文語]\s*[:：]\s*([A-Za-z0-9][^；;（）()，,、\n]*)/);
	const name = m?.[1]?.split("/")[0].trim() || "";
	return /^[A-Za-z0-9 :;'’!?.,&\-–]+$/.test(name) && name.length >= 3 ? name : "";
}

/** 条目是否确实在讲这部作品 */
export function isRelevantWorkArticle(article, { titleCn, titleJp } = {}) {
	if (!article) return false;
	// 作品名必须出现在导言里（或与条目标题相符）：公司、人物等条目只会在正文
	// 作品列表里提到它，不能当作作品介绍（如「京都动画」条目里的《中二病》）
	const text = normalizeForMatch(article.intro || "");
	const pageTitle = normalizeForMatch(stripDisambiguation(article.title));
	if (
		!ACG_CONTEXT_RE.test(toSimplified(article.fullText || article.intro || ""))
	) {
		return false;
	}
	const names = [titleCn, titleJp]
		.filter(Boolean)
		.flatMap((t) => titleVariants(t))
		.map(normalizeForMatch)
		.filter((n) => n.length >= 2);
	return names.some(
		(name) =>
			text.includes(name) ||
			(pageTitle.length >= 2 &&
				(name.includes(pageTitle) || pageTitle.includes(name))),
	);
}

function cleanIntro(article) {
	return cleanChineseProse(article?.intro || "");
}

function cleanStory(article) {
	return cleanChineseProse(findStorySection(article));
}

/**
 * 聚合作品百科资料。导言与剧情各自取「第一个有足够中文内容」的来源，
 * sources 只列出实际被采用的条目，用于正文出处与许可证声明。
 */
export async function fetchWorkEncyclopedia(
	{ titleCn, titleJp },
	{ sources = DEFAULT_SOURCES, minLength = 40 } = {},
) {
	const titles = [titleCn, titleJp].filter(Boolean);
	if (titles.length === 0) return null;

	let intro = "";
	let story = "";
	let title = "";
	let englishTitle = "";
	const used = [];

	for (const source of sources) {
		if (intro && story) break;
		let article = null;
		try {
			// 导言门槛放低：维基百科常见「一句话导言 + 完整剧情章节」的条目
			article = await source.fetchForWork(titles, {
				minIntroLength: 15,
				accept: (a) => isRelevantWorkArticle(a, { titleCn, titleJp }),
			});
		} catch (error) {
			console.warn(`⚠ ${source.label}抓取失败：${error.message}`);
			continue;
		}
		if (!article) continue;

		let contributed = false;
		englishTitle ||= extractEnglishTitle(article.intro);
		const articleIntro = cleanIntro(article);
		if (!intro && articleIntro.length >= minLength) {
			intro = articleIntro;
			contributed = true;
		}
		const articleStory = cleanStory(article);
		if (!story && articleStory.length >= minLength) {
			story = articleStory;
			contributed = true;
		}
		if (contributed) {
			title ||= stripDisambiguation(article.title);
			used.push({
				key: source.key,
				label: source.label,
				title: article.title,
				url: article.pageUrl,
				license: source.license,
			});
		}
	}

	if (!intro && !story) return null;
	return { title, intro, story, sources: used, englishTitle };
}

const PROFILE_HEADING_RE =
	/^(简介|人物简介|角色简介|人物介绍|角色介绍|人物|经历|人物经历|概要|性格|形象|人物形象)$/;

/** 在句号处截断，避免把句子切成半截 */
export function truncateAtSentence(text, maxLength) {
	if (text.length <= maxLength) return text;
	const cut = text.slice(0, maxLength);
	const end = Math.max(
		cut.lastIndexOf("。"),
		cut.lastIndexOf("！"),
		cut.lastIndexOf("？"),
	);
	return end >= maxLength * 0.4
		? cut.slice(0, end + 1)
		: `${cut.slice(0, maxLength - 1)}…`;
}

/**
 * 角色简介 = 萌娘百科导言首句（「X是……的登场角色」）+ 人物简介章节。
 * 只有导言一句时内容太单薄，补上简介 / 经历章节的首段。
 */
export function composeCharacterBio(article, maxLength = 300) {
	const lead = cleanChineseProse(article?.intro || "").split("\n\n")[0] || "";
	const parts = [lead];
	if (lead.length < 80) {
		const section = (article?.sections || []).find(
			(s) => PROFILE_HEADING_RE.test(s.heading) && s.text,
		);
		const extra = cleanChineseProse(section?.text || "").split("\n\n")[0] || "";
		if (extra && !lead.includes(extra)) parts.push(extra);
	}
	return truncateAtSentence(parts.filter(Boolean).join(""), maxLength);
}

/**
 * 角色中文简介：Bangumi 简介是日文时，到萌娘百科查同名角色条目。
 * 角色条目必须提到所属作品，避免同名角色张冠李戴。
 */
export async function fetchCharacterBio(
	{ nameCn, workTitles = [] },
	{ fetchForWork = fetchMoegirlArticleForWork, maxLength = 300 } = {},
) {
	const name = String(nameCn || "").trim();
	if (!name || hasKana(name)) return null;
	const works = workTitles
		.filter(Boolean)
		.flatMap((t) => titleVariants(t))
		.map(normalizeForMatch)
		.filter((n) => n.length >= 2);
	if (works.length === 0) return null;

	try {
		const article = await fetchForWork([name], {
			minIntroLength: 20,
			searchLimit: 3,
			accept: (a) => {
				const text = normalizeForMatch(a.fullText || "");
				return works.some((w) => text.includes(w));
			},
		});
		if (!article) return null;
		const text = composeCharacterBio(article, maxLength);
		if (text.length < 20) return null;
		return {
			text,
			source: { label: "萌娘百科", title: article.title, url: article.pageUrl },
		};
	} catch {
		return null;
	}
}
