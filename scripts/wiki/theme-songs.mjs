/**
 * 主题曲与音乐资料（长文改写的补充来源）
 * ─────────────────────────────────────────────────────────────────────────────
 * 百科条目常把主题曲放在单独的子条目里，按作品名搜索的数据库也常匹配不到动画条目，
 * 所以单独从三处抓取 OP / ED / 插入歌：
 *   Bangumi 关联条目      片头曲 / 片尾曲 / 插入歌 / 原声集等音乐条目，含演唱、作词、作曲、发售日
 *   Jikan（MyAnimeList）  各季的 OP / ED 列表（歌名、演唱、使用话数）；按标题搜索时顺带给出 MAL 编号
 *   アニソンジェネレーション  日本动画歌曲数据库，按作品列出全部主题曲、插入歌与演唱者
 *
 * 每个来源返回 {title, url, text} 或 null；任何一站失败都不影响其他来源。
 */

import { decodeEntities, htmlToText } from "./linked-sources.mjs";

const USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const MAX_TEXT = 12000;
const e = encodeURIComponent;
const clip = (text, max = MAX_TEXT) => String(text || "").trim().slice(0, max);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getText(url, accept = "*/*") {
	const res = await fetch(url, {
		headers: { "user-agent": USER_AGENT, accept, "accept-language": "ja,zh;q=0.9,en;q=0.8" },
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
	return res.text();
}
const getJson = async (url) => JSON.parse(await getText(url, "application/json"));

// ── Bangumi 关联音乐条目 ────────────────────────────────────────────────────

/** Bangumi 关联条目里与音乐有关的关系名 */
export const MUSIC_RELATIONS = ["片头曲", "片尾曲", "插入歌", "主题歌", "印象曲", "角色歌", "原声集", "广播剧"];
const MUSIC_INFO_KEYS = ["艺术家", "演唱", "作词", "作曲", "编曲", "发售日期", "厂牌", "价格"];

/** 从 /v0/subjects/{id}/subjects 的结果里挑出音乐条目，主题曲排在前面 */
export function pickMusicRelations(related) {
	const order = (r) => MUSIC_RELATIONS.indexOf(r.relation);
	return (related || [])
		.filter((r) => MUSIC_RELATIONS.includes(r.relation))
		.sort((a, b) => order(a) - order(b));
}

export function describeMusicSubject(relation, subject) {
	const info = (subject?.infobox || [])
		.filter(({ key }) => MUSIC_INFO_KEYS.includes(key))
		.map(({ key, value }) =>
			`${key}：${Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : v?.v || "")).join("、") : value}`,
		);
	const name = subject?.name || "";
	const cn = subject?.name_cn && subject.name_cn !== name ? `（${subject.name_cn}）` : "";
	return [`【${relation}】${name}${cn}`, ...info.map((line) => `  ${line}`)].join("\n");
}

export async function fetchBangumiMusic(bangumiId, limit = 14) {
	if (!bangumiId) return null;
	const related = pickMusicRelations(await getJson(`https://api.bgm.tv/v0/subjects/${e(bangumiId)}/subjects`));
	if (related.length === 0) return null;
	const blocks = [];
	for (const r of related.slice(0, limit)) {
		const subject = await getJson(`https://api.bgm.tv/v0/subjects/${e(r.id)}`).catch(() => ({ name: r.name, name_cn: r.name_cn }));
		blocks.push(`${describeMusicSubject(r.relation, subject)}\n  条目：https://bgm.tv/subject/${r.id}`);
	}
	return {
		title: `Bangumi 关联音乐条目（${related.length} 个）`,
		url: `https://bgm.tv/subject/${bangumiId}`,
		text: clip(blocks.join("\n\n")),
	};
}

// ── Jikan（MyAnimeList 非官方 API） ─────────────────────────────────────────

/** 在 Jikan 搜索结果里挑最可能的动画：日文名完全一致优先，其次 TV 动画 */
export function pickJikanAnime(results, { ja = [], en = [] } = {}) {
	const jaSet = new Set(ja.map((t) => t.trim()));
	const enSet = new Set(en.map((t) => t.trim().toLowerCase()));
	const score = (a) =>
		(jaSet.has(a.title_japanese) ? 4 : 0) +
		(enSet.has(String(a.title_english || "").toLowerCase()) || enSet.has(String(a.title || "").toLowerCase()) ? 2 : 0) +
		(a.type === "TV" ? 1 : 0);
	const best = [...(results || [])].sort((a, b) => score(b) - score(a))[0];
	return best && score(best) >= 2 ? best : null;
}

export function formatJikanThemes(themes) {
	const openings = themes?.openings || [];
	const endings = themes?.endings || [];
	if (openings.length + endings.length === 0) return "";
	return [
		"片头曲（OP）：",
		...openings.map((s) => `  ${s}`),
		"片尾曲（ED）：",
		...endings.map((s) => `  ${s}`),
	].join("\n");
}

/** malId 已知时直接取；否则按日文 / 英文标题搜索。返回值带 malId，供 MAL 页面抓取兜底 */
export async function fetchJikanThemes({ malId = "", ja = [], en = [] } = {}) {
	let id = malId ? String(malId) : "";
	let title = "";
	if (!id) {
		for (const q of [...ja, ...en].filter(Boolean).slice(0, 3)) {
			const s = await getJson(`https://api.jikan.moe/v4/anime?q=${e(q)}&limit=10`).catch(() => null);
			const hit = pickJikanAnime(s?.data, { ja, en });
			if (hit) {
				id = String(hit.mal_id);
				title = hit.title;
				break;
			}
			await sleep(1000); // Jikan 限速：每秒 3 次
		}
	}
	if (!id) return null;
	const themes = (await getJson(`https://api.jikan.moe/v4/anime/${e(id)}/themes`))?.data;
	const text = formatJikanThemes(themes);
	return {
		title: title || `MyAnimeList ${id}`,
		url: `https://myanimelist.net/anime/${id}`,
		text: text ? clip(`来源：MyAnimeList 用户整理的主题曲列表，括号内为使用话数。\n${text}`) : "",
		malId: id,
	};
}

// ── アニソンジェネレーション ────────────────────────────────────────────────

const ANISON_BASE = "http://anison.info/data/";

/** 搜索结果页里的作品链接：[{id, name}] */
export function parseAnisonSearch(html) {
	return [...String(html || "").matchAll(/href="(?:\/data\/|\.\.\/)?program\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
		id: m[1],
		name: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
	}));
}

/** 优先完全同名的作品，其次以查询词开头的，最后取第一条 */
export function pickAnisonProgram(list, query) {
	const q = String(query || "").trim();
	return list.find((p) => p.name === q) || list.find((p) => p.name.startsWith(q)) || list[0] || null;
}

export async function fetchAnisonGeneration(jaTitles = []) {
	for (const query of jaTitles.filter(Boolean).slice(0, 2)) {
		const html = await getText(`${ANISON_BASE}n.php?q=${e(query)}&m=pro`, "text/html");
		const program = pickAnisonProgram(parseAnisonSearch(html), query);
		if (!program) continue;
		const url = `${ANISON_BASE}program/${program.id}.html`;
		const text = htmlToText(await getText(url, "text/html"));
		// 页面开头是站点导航，正文从作品名第二次出现处开始；页尾版权信息之后截断
		const first = text.indexOf(program.name);
		const start = first >= 0 ? text.indexOf(program.name, first + 1) : -1;
		let body = text.slice(start > 0 ? start : 0);
		const end = body.search(/Copyright|アニメソングの総合情報サイト/);
		if (end > 0) body = body.slice(0, end);
		return { title: program.name, url, text: clip(body) };
	}
	return null;
}
