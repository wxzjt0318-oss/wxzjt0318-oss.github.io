/**
 * 自动发文的分类与标签，对齐自主编辑文章的写法：
 *   - 分类：一句概括作品主旨的短语（如「大龄冒险者的生存指南」），
 *     优先取 scripts/wiki/post-taxonomy.json 里人工撰写的，没有时退回「<主题材>作品介绍」；
 *   - 标签：题材 2～3 个 + 原作类型 + 放送季度 + 作品特色 1～2 个 + 系列名（同系列多季可聚合），
 *     不再出现 Bangumi、制作公司、播出星期等与内容无关的标签。
 */

import { isGenreTag } from "../moegirl/rewrite-bangumi-posts.mjs";
import { toSimplified } from "./zh-text.mjs";

const SOURCE_TAGS = new Map([
	["轻小说改", "轻小说改"],
	["轻改", "轻小说改"],
	["漫画改", "漫画改"],
	["漫改", "漫画改"],
	["游戏改", "游戏改"],
	["GAL改", "游戏改"],
	["小说改", "小说改"],
	["原创", "原创"],
]);
const FORM_TAGS = new Set(["OVA", "OAD", "剧场版"]);
const NOT_GENRE = new Set(["轻小说", "漫画", "动画化", "R18", "萌系", "宅系"]);

function airSeason(airDate) {
	const m = String(airDate || "").match(/^(\d{4})-(\d{1,2})/);
	return m ? `${m[1]}年${Number(m[2])}月` : "";
}

export function buildTaxonomy({
	rawTags = [],
	airDate = "",
	override = null,
	maxTags = 7,
} = {}) {
	const names = rawTags
		.map((t) => toSimplified(typeof t === "string" ? t : t?.name || "").trim())
		.filter(Boolean);

	const source = names.map((t) => SOURCE_TAGS.get(t)).find(Boolean) || "";
	const form = names.find((t) => FORM_TAGS.has(t)) || "";
	const themes = (override?.themes || []).filter(Boolean);
	const genres = [];
	for (const t of names) {
		if (SOURCE_TAGS.has(t) || FORM_TAGS.has(t) || NOT_GENRE.has(t)) continue;
		if (!isGenreTag(t) || genres.includes(t) || themes.includes(t)) continue;
		genres.push(t);
		if (genres.length >= 3) break;
	}

	// 系列名与 OVA / 剧场版形式优先保留；超出上限时先减题材、再减特色标签
	const fixed = [
		source,
		form,
		airSeason(airDate),
		override?.series || "",
	].filter(Boolean);
	let genreCount = Math.min(genres.length, override?.series ? 2 : 3);
	let themeCount = Math.min(themes.length, 2);
	while (fixed.length + genreCount + themeCount > maxTags && genreCount > 1)
		genreCount--;
	while (fixed.length + genreCount + themeCount > maxTags && themeCount > 1)
		themeCount--;
	const tags = [
		...genres.slice(0, genreCount),
		source,
		form,
		airSeason(airDate),
		...themes.slice(0, themeCount),
		override?.series || "",
	].filter(Boolean);
	const unique = [...new Set(tags)].slice(0, maxTags);

	const category =
		override?.category ||
		(genres[0] ? `${genres[0]}作品介绍` : "Bangumi 每日追番");
	return { category, tags: unique, genres };
}
