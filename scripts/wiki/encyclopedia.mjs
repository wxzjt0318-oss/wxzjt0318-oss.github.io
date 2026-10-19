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

/** 条目是否确实在讲这部作品 */
export function isRelevantWorkArticle(article, { titleCn, titleJp } = {}) {
	if (!article) return false;
	const text = normalizeForMatch(article.fullText || article.intro || "");
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
	return { title, intro, story, sources: used };
}

/**
 * 角色中文简介：Bangumi 简介是日文时，到萌娘百科查同名角色条目。
 * 角色条目必须提到所属作品，避免同名角色张冠李戴。
 */
export async function fetchCharacterBio(
	{ nameCn, workTitles = [] },
	{ fetchForWork = fetchMoegirlArticleForWork, maxLength = 220 } = {},
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
		const text = cleanChineseProse(article.intro).split("\n\n")[0] || "";
		if (text.length < 20) return null;
		return {
			text: text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text,
			source: { label: "萌娘百科", title: article.title, url: article.pageUrl },
		};
	} catch {
		return null;
	}
}
