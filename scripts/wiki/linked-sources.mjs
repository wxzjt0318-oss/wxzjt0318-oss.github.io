/**
 * 经 Wikidata 关联的作品资料（长文改写的补充来源）
 * ─────────────────────────────────────────────────────────────────────────────
 * 先在 Wikidata 找到作品条目，再按它记录的外部编号精确抓取各站资料，避免按标题搜索时错配：
 *   しょぼいカレンダー（P11648）  日文 staff / 声优 / 各话标题 / 首播电视台
 *   アニメハック（P14825）        日文 staff / 声优 / 主题曲 / 简介 / 相关新闻
 *   MyAnimeList（P4086）          英文简介、播出与制作信息、角色与声优、staff
 *   LiveChart.me（P12489）        首播日、话数、制作公司、简介
 *   巴哈姆特 ACG 资料库（P6367）   台湾地区的中文资料（转为简体）
 * 另外按作品名 / 条目编号抓取：
 *   Bangumi API                   完整 infobox（含详细 staff）与官方中文简介
 *   メディア芸術データベース        原作单行本各卷的发售日、出版社、ISBN（来自日本国会图书馆）
 *   Fandom 作品维基               粉丝编写的英文角色资料，可信度较低，只用于补充角色细节
 *
 * 每个来源返回 {title, url, text} 或 null；任何一站失败都不影响其他来源。
 */

import { toSimplified } from "./zh-text.mjs";

const USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const MAX_TEXT = 15000;

/** Wikidata 外部编号属性 */
export const WIKIDATA_PROPS = {
	syoboi: "P11648",
	animehack: "P14825",
	mal: "P4086",
	livechart: "P12489",
	ann: "P1985",
	anidb: "P5646",
	bahamut: "P6367",
	bangumi: "P5732",
	malManga: "P4087",
	annManga: "P1984",
};
const ANIME_ID_PROPS = ["P11648", "P14825", "P4086", "P12489", "P1985", "P5646"];
const SOURCE_ID_PROPS = ["P4087", "P1984", "P8731", "P11149"];

async function getText(url, accept = "*/*") {
	const res = await fetch(url, {
		headers: { "user-agent": USER_AGENT, accept, "accept-language": "ja,zh;q=0.9,en;q=0.8" },
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
	return res.text();
}
const getJson = async (url) => JSON.parse(await getText(url, "application/json"));
const e = encodeURIComponent;
const clip = (text, max = MAX_TEXT) => String(text || "").trim().slice(0, max);

export function decodeEntities(s) {
	return String(s || "")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

/** HTML → 纯文本（块级标签换行） */
export function htmlToText(html) {
	return decodeEntities(
		String(html || "")
			.replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
			.replace(/<!--[\s\S]*?-->/g, " ")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/(p|div|li|tr|h[1-6]|dt|dd|section|table)>/gi, "\n")
			.replace(/<[^>]+>/g, " "),
	)
		.replace(/[ \t　]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** 截取 text 中从 start 到 end 标记之间的部分（找不到标记时退回开头 / 结尾） */
function between(text, start, end, max = MAX_TEXT) {
	const i = start ? text.indexOf(start) : 0;
	const from = i >= 0 ? i : 0;
	const j = end ? text.indexOf(end, from + 1) : -1;
	return clip(text.slice(from, j > from ? j : undefined), max);
}

// ── Wikidata ────────────────────────────────────────────────────────────────

const claimValues = (entity, prop) =>
	(entity?.claims?.[prop] || []).map((c) => c?.mainsnak?.datavalue?.value).filter((v) => v != null);
const claimValue = (entity, prop) => claimValues(entity, prop)[0] ?? null;

/**
 * 从候选条目里挑出动画条目与原作条目：
 * 动画条目带动画数据库编号，优先与 Bangumi 编号一致、其次日文名完全一致；
 * 原作条目带漫画 / 小说数据库编号。
 */
export function pickWikidataItems(entities, { ja = [], bangumiId = "" } = {}) {
	const list = Object.values(entities || {}).filter((x) => x && !x.missing);
	const jaSet = new Set(ja.map((t) => t.trim()).filter(Boolean));
	const labelMatches = (x) => jaSet.has(x.labels?.ja?.value) || (x.aliases?.ja || []).some((a) => jaSet.has(a.value));
	const score = (x) =>
		(bangumiId && claimValues(x, WIKIDATA_PROPS.bangumi).includes(String(bangumiId)) ? 4 : 0) +
		(labelMatches(x) ? 2 : 0);
	const anime = list
		.filter((x) => ANIME_ID_PROPS.some((p) => claimValue(x, p) != null))
		.sort((a, b) => score(b) - score(a))[0] || null;
	const source = list
		.filter((x) => x !== anime && SOURCE_ID_PROPS.some((p) => claimValue(x, p) != null))
		.sort((a, b) => score(b) - score(a))[0] || null;
	return { anime, source };
}

export async function findWikidataItems({ ja = [], en = [], bangumiId = "" }) {
	const ids = new Set();
	if (bangumiId) {
		const s = await getJson(
			`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${e(`haswbstatement:${WIKIDATA_PROPS.bangumi}=${bangumiId}`)}&format=json`,
		).catch(() => null);
		for (const hit of s?.query?.search || []) ids.add(hit.title);
	}
	for (const [term, lang] of [...ja.map((t) => [t, "ja"]), ...en.map((t) => [t, "en"])]) {
		const s = await getJson(
			`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${e(term)}&language=${lang}&limit=7&format=json`,
		).catch(() => null);
		for (const hit of s?.search || []) ids.add(hit.id);
	}
	if (ids.size === 0) return { anime: null, source: null };
	const data = await getJson(
		`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...ids].slice(0, 45).join("|")}&props=labels|aliases|descriptions|claims&languages=ja|zh|en&format=json`,
	);
	return pickWikidataItems(data.entities, { ja, bangumiId });
}

export function describeWikidataItem(item) {
	if (!item) return null;
	const ids = Object.entries(WIKIDATA_PROPS)
		.map(([name, prop]) => [name, claimValue(item, prop)])
		.filter(([, v]) => v != null);
	return {
		title: item.labels?.ja?.value || item.labels?.en?.value || item.id,
		url: `https://www.wikidata.org/wiki/${item.id}`,
		text: [
			`日文名：${item.labels?.ja?.value || ""}`,
			`中文名：${item.labels?.zh?.value || ""}`,
			`英文名：${item.labels?.en?.value || ""}`,
			`说明：${item.descriptions?.en?.value || item.descriptions?.ja?.value || ""}`,
			...ids.map(([name, v]) => `编号｜${name}：${v}`),
		].join("\n"),
		ids: Object.fromEntries(ids),
	};
}

// ── しょぼいカレンダー ──────────────────────────────────────────────────────

export function parseSyoboiTitle(xml) {
	const pick = (tag) => decodeEntities(xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] || "").trim();
	const title = pick("Title");
	if (!title) return null;
	return {
		title,
		text: [
			`作品名：${title}（${pick("TitleYomi")}）`,
			`首播：${pick("FirstYear")}年${pick("FirstMonth")}月 — ${pick("FirstEndYear")}年${pick("FirstEndMonth")}月`,
			`首播电视台：${pick("FirstCh")}`,
			"",
			pick("Comment"),
			"",
			"各话标题：",
			pick("SubTitles"),
		].join("\n"),
	};
}

export async function fetchSyoboi(tid) {
	if (!tid) return null;
	const parsed = parseSyoboiTitle(await getText(`https://cal.syoboi.jp/db.php?Command=TitleLookup&TID=${e(tid)}`, "application/xml"));
	return parsed && { ...parsed, url: `https://cal.syoboi.jp/tid/${tid}`, text: clip(parsed.text) };
}

// ── アニメハック ────────────────────────────────────────────────────────────

export async function fetchAnimeHack(programId) {
	if (!programId) return null;
	const url = `https://anime.eiga.com/program/${e(programId)}/`;
	const text = htmlToText(await getText(url, "text/html"));
	const title = text.match(/^(.+?) : 作品情報/)?.[1]?.trim() || "";
	const start = text.indexOf("作品情報", text.indexOf("新作・今期アニメ") + 1);
	return { title, url, text: clip(text.slice(start > 0 ? start : 0).replace(/\n?(ログイン|新規登録|マイページ)\n?/g, "\n")) };
}

// ── MyAnimeList ─────────────────────────────────────────────────────────────

export async function fetchMyAnimeList(malId) {
	if (!malId) return null;
	const url = `https://myanimelist.net/anime/${e(malId)}`;
	const html = await getText(url, "text/html");
	const title = decodeEntities(html.match(/<h1[^>]*class="title-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/)?.[1] || "").replace(/<[^>]+>/g, "").trim();
	const synopsis = htmlToText(html.match(/<p itemprop="description">([\s\S]*?)<\/p>/)?.[1] || "");
	const text = htmlToText(html);
	const info = between(text, "Alternative Titles", "Statistics", 4000);
	const background = between(text, "Background", "Related Entries", 3000);
	let cast = "";
	try {
		const chars = htmlToText(await getText(`${url}/_/characters`, "text/html"));
		cast = between(chars, "Characters & Voice Actors", "Recent News", 8000);
	} catch {}
	return {
		title,
		url,
		text: clip([`简介：${synopsis}`, info, background.startsWith("Background") ? background : "", cast].filter(Boolean).join("\n\n")),
	};
}

// ── LiveChart.me ────────────────────────────────────────────────────────────

export async function fetchLiveChart(id) {
	if (!id) return null;
	const url = `https://www.livechart.me/anime/${e(id)}`;
	const html = await getText(url, "text/html");
	const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		.map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
		.find((x) => x && x["@type"] !== "WebSite");
	if (!ld) return null;
	return {
		title: ld.name || "",
		url,
		text: clip([
			`名称：${ld.name || ""}`,
			`别名：${(ld.alternateName || []).join("、")}`,
			`类型：${(ld.genre || []).join("、")}`,
			`首播：${ld.datePublished || ""}`,
			`话数：${ld.numberOfEpisodes ?? ""}`,
			`制作公司：${(ld.productionCompany || []).map((c) => c.name).join("、")}`,
			`简介：${ld.description || ""}`,
		].join("\n")),
	};
}

// ── 巴哈姆特 ACG 资料库 ─────────────────────────────────────────────────────

export async function fetchBahamut(id) {
	if (!id) return null;
	const url = `https://acg.gamer.com.tw/acgDetail.php?s=${e(id)}`;
	const text = htmlToText(await getText(url, "text/html"));
	const title = text.match(/^(.+?)[｜|] ?巴哈姆特/m)?.[1]?.trim() || "";
	const start = text.indexOf("作品名稱");
	return { title: toSimplified(title), url, text: toSimplified(clip(text.slice(start > 0 ? start : 0), 8000)) };
}

// ── Bangumi API ─────────────────────────────────────────────────────────────

export async function fetchBangumiSubject(id) {
	if (!id) return null;
	const subject = await getJson(`https://api.bgm.tv/v0/subjects/${e(id)}`);
	const infobox = (subject.infobox || []).map(({ key, value }) =>
		`${key}：${Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : v?.v || "")).join("、") : value}`,
	);
	let characters = [];
	try {
		characters = (await getJson(`https://api.bgm.tv/v0/subjects/${e(id)}/characters`))
			.slice(0, 20)
			.map((c) => `角色｜${c.name}（${c.relation}）：${(c.actors || []).map((a) => a.name).join("、")}`);
	} catch {}
	return {
		title: subject.name_cn || subject.name || "",
		url: `https://bgm.tv/subject/${id}`,
		text: clip([`简介：${subject.summary || ""}`, "", ...infobox, "", ...characters].join("\n")),
	};
}

// ── メディア芸術データベース（原作单行本） ──────────────────────────────────

export function summarizeMediaArtsBooks(bindings) {
	const byVolume = new Map();
	for (const b of bindings) {
		const vol = b.vol?.value || b.label?.value || "";
		const row = {
			vol,
			date: b.date?.value || "",
			publisher: (b.pub?.value || "").split("∥")[0].trim(),
			isbn: b.isbn?.value || "",
			label: b.label?.value || "",
		};
		const prev = byVolume.get(vol);
		if (!prev || (!prev.isbn && row.isbn) || (!prev.date && row.date)) byVolume.set(vol, row);
	}
	return [...byVolume.values()]
		.sort((a, b) => (Number(a.vol) || 0) - (Number(b.vol) || 0) || a.date.localeCompare(b.date))
		.map((r) => `${r.label || `第${r.vol}卷`}｜${r.date}｜${r.publisher}${r.isbn ? `｜ISBN ${r.isbn}` : ""}`);
}

export async function fetchMediaArtsBooks(title) {
	const name = String(title || "").trim();
	if (!name) return null;
	const s = "https://schema.org/";
	const query = `SELECT ?s ?label ?vol ?date ?pub ?isbn WHERE {
		?s <${s}name> ${JSON.stringify(name)} .
		OPTIONAL { ?s <${s}label> ?label } OPTIONAL { ?s <${s}volumeNumber> ?vol }
		OPTIONAL { ?s <${s}datePublished> ?date } OPTIONAL { ?s <${s}publisher> ?pub }
		OPTIONAL { ?s <${s}isbn> ?isbn }
	} LIMIT 300`;
	const json = JSON.parse(await getText(
		`https://mediaarts-db.artmuseums.go.jp/sparql?query=${e(query)}&format=json`,
		"application/sparql-results+json",
	));
	const lines = summarizeMediaArtsBooks(json.results?.bindings || []);
	if (lines.length === 0) return null;
	return {
		title: name,
		url: `https://mediaarts-db.artmuseums.go.jp/search?query=${e(name)}`,
		text: clip(`单行本（共 ${lines.length} 条）：\n${lines.join("\n")}`),
	};
}

// ── Fandom 作品维基 ─────────────────────────────────────────────────────────

/** 粗略清理 wikitext：去掉模板、引用和表格标记，保留链接文字 */
export function cleanWikitext(text) {
	let s = String(text || "").replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "").replace(/<!--[\s\S]*?-->/g, "");
	for (let i = 0; i < 6 && /\{\{[^{}]*\}\}/.test(s); i++) {
		s = s.replace(/\{\{(?:Nihongo|nihongo)\|([^|{}]*)\|([^|{}]*)[^{}]*\}\}/g, "$1（$2）").replace(/\{\{[^{}]*\}\}/g, "");
	}
	return s
		.replace(/\{\|[\s\S]*?\|\}/g, "")
		.replace(/\[\[(?:File|Image|Category|ファイル):[^\]]*\]\]/gi, "")
		.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
		.replace(/\[\[([^\]]*)\]\]/g, "$1")
		.replace(/\[https?:\/\/\S+ ([^\]]*)\]/g, "$1")
		.replace(/'{2,}/g, "")
		.replace(/<[^>]+>/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export async function fetchFandom(englishTitle, limit = 6) {
	const slug = String(englishTitle || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	if (slug.length < 3) return null;
	const api = `https://${slug}.fandom.com/api.php`;
	const search = await getJson(`${api}?action=query&list=search&srsearch=${e(englishTitle)}&srlimit=${limit}&format=json`);
	const titles = (search?.query?.search || []).map((h) => h.title);
	if (titles.length === 0) return null;
	const pages = [];
	for (const title of titles) {
		const page = await getJson(`${api}?action=parse&page=${e(title)}&prop=wikitext&format=json`).catch(() => null);
		const text = cleanWikitext(page?.parse?.wikitext?.["*"] || "");
		if (text) pages.push(`## ${title}\n${text.slice(0, 3000)}`);
	}
	return { title: `${slug}.fandom.com`, url: `https://${slug}.fandom.com/`, text: clip(pages.join("\n\n"), 20000) };
}

// ── 汇总 ────────────────────────────────────────────────────────────────────

const settle = (name, promise) =>
	Promise.resolve(promise).catch((error) => {
		console.warn(`  ⚠ ${name}: ${error.message}`);
		return null;
	});

/** 一组请求的全部关联来源；ja / en 为候选标题，bangumiId 为 Bangumi 条目编号 */
export async function fetchLinkedSources({ ja = [], en = [], bangumiId = "" }) {
	const { anime, source } = (await settle("Wikidata", findWikidataItems({ ja, en, bangumiId }))) || {};
	const animeInfo = describeWikidataItem(anime);
	const sourceInfo = describeWikidataItem(source);
	const ids = animeInfo?.ids || {};
	const englishTitle = anime?.labels?.en?.value || en[0] || "";
	const bookTitle = source?.labels?.ja?.value || ja[ja.length - 1] || "";
	const [syoboi, animehack, mal, livechart, bahamut, bangumi, mediaarts, fandom] = await Promise.all([
		settle("しょぼいカレンダー", fetchSyoboi(ids.syoboi)),
		settle("アニメハック", fetchAnimeHack(ids.animehack)),
		settle("MyAnimeList", fetchMyAnimeList(ids.mal)),
		settle("LiveChart", fetchLiveChart(ids.livechart)),
		settle("巴哈姆特", fetchBahamut(ids.bahamut)),
		settle("Bangumi", fetchBangumiSubject(bangumiId)),
		settle("メディア芸術DB", fetchMediaArtsBooks(bookTitle)),
		settle("Fandom", fetchFandom(englishTitle)),
	]);
	const strip = (x) => x && { title: x.title, url: x.url, text: x.text };
	return {
		wikidata: strip(animeInfo),
		wikidataSource: strip(sourceInfo),
		syoboi,
		animehack,
		mal,
		livechart,
		bahamut,
		bangumi,
		mediaarts,
		fandom,
		annId: ids.ann || null,
	};
}
