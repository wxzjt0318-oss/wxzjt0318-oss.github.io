/**
 * 有官方 API 的书志 / 作品数据库（长文改写的补充来源）
 * ─────────────────────────────────────────────────────────────────────────────
 * 各自独立开关（环境变量 WIKI_SOURCE_<NAME>=0 关闭，缺省开启），失败不影响其他来源。
 * 能从 Wikidata 拿到编号时按编号抓取；否则按作品标题搜索，并用标题相关性丢掉对不上的条目。
 * 不抓网页，也不实现任何访问控制绕过。
 *
 *   aniSearch        Wikidata P12477 → GET /v1/anime/{id}/full（详情、集数、角色、职员）
 *                    公开 API 没有按标题检索的端点，全量标题表 24 小时只能拉一次，故无编号时跳过
 *   MangaUpdates     标题搜索后核对；Wikidata P11149 是站内 slug，命中结果 URL 时优先用它
 *   VNDB Kana        Wikidata P3180，或标题搜索。只走 api.vndb.org/kana，5 分钟不超过 200 次
 *   bilibili 游戏 Wiki  仅当作品本身或 Wikidata 原作是游戏 / 视觉小说，或 Bangumi 类型为游戏
 *   RanobeDB         轻小说书志（非商业、ODbL）
 *   NDL サーチ       OpenSearch，图书，iss-ndl-opac（非营利书目）
 *
 * 返回 {title, url, text} 或 null。
 */

import { requestJson, requestText, sourceEnabled } from "./source-http.mjs";

const MAX_TEXT = 12_000;
const clip = (text, max = MAX_TEXT) =>
	String(text || "")
		.trim()
		.slice(0, max);
const e = encodeURIComponent;

/** 视频游戏、视觉小说。用来判断要不要查 bilibili 游戏 Wiki。 */
export const GAME_INSTANCE_IDS = new Set(["Q7889", "Q689445"]);
const NOVEL_INSTANCE_IDS = new Set(["Q747381", "Q104213567"]);
const MANGA_INSTANCE_IDS = new Set(["Q8274", "Q21198342"]);

export function normalizeTitle(value) {
	return String(value || "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]|【[^】]*】/g, "")
		.replace(
			/[\s　・･·:：\-—_~～'’"“”「」『』()（）,，.。!！?？/／&＆+＋]+/g,
			"",
		);
}

/**
 * 1 = 规范化后完全相同；0.9 = 候选标题以查询开头（卷名、外传，查询至少 4 字）；
 * 0.85 = 查询以候选标题开头（查询带季数、候选是系列名，系列名至少 5 字，避免 date / live 这类短词）。
 */
export function titleMatchScore(queries, candidates) {
	const qs = [
		...new Set(
			(queries || []).map(normalizeTitle).filter((q) => q.length >= 2),
		),
	];
	const cs = [
		...new Set(
			(candidates || []).map(normalizeTitle).filter((c) => c.length >= 2),
		),
	];
	let best = 0;
	for (const q of qs) {
		for (const c of cs) {
			if (q === c) best = Math.max(best, 1);
			else if (q.length >= 4 && c.startsWith(q)) best = Math.max(best, 0.9);
			else if (c.length >= 5 && q.startsWith(c)) best = Math.max(best, 0.85);
		}
	}
	return best;
}

export function workMedium(instanceIds = []) {
	if (instanceIds.some((id) => NOVEL_INSTANCE_IDS.has(id))) return "novel";
	if (instanceIds.some((id) => MANGA_INSTANCE_IDS.has(id))) return "manga";
	return "";
}

export function isGameOrGameAdaptation({
	bangumiType = "",
	instanceIds = [],
} = {}) {
	if (String(bangumiType) === "4") return true;
	return instanceIds.some((id) => GAME_INSTANCE_IDS.has(id));
}

const SEASON_TAIL =
	/\s*(?:第?[0-9０-９一二三四五六七八九十]+期|第[0-9０-９一二三四五六七八九十]+シーズン|第[0-9一二三四五六七八九十]+季|[0-9]+(?:st|nd|rd|th)\s*season|season\s*\d+|[vｖ])\s*$/i;

/** 季数标题先还原成系列名，再保留原查询。最多 3 条，避免把「〇〇V」当成另一个作品去搜。 */
export function searchOrder(queries) {
	const ordered = [];
	for (const raw of queries || []) {
		const query = String(raw || "").trim();
		if (query.length < 2) continue;
		const base = query.replace(SEASON_TAIL, "").trim();
		if (base.length >= 2 && base !== query) ordered.push(base);
		ordered.push(query);
	}
	return [...new Set(ordered)].slice(0, 3);
}

/** 卷号紧跟系列名的标题，优先于「系列名 + 外传词」。 */
export function volumeBias(queries, title) {
	const qs = (queries || []).map(normalizeTitle).filter((q) => q.length >= 6);
	const n = normalizeTitle(title);
	if (qs.some((q) => q === n)) return 2;
	if (qs.some((q) => n.startsWith(q) && /^[0-9]/.test(n.slice(q.length))))
		return 1;
	return 0;
}

export function rankByTitle(queries, items, titlesOf) {
	return (items || [])
		.map((item) => {
			const titles = titlesOf(item).filter(Boolean);
			return {
				item,
				score: titleMatchScore(queries, titles),
				bias: Math.max(0, ...titles.map((t) => volumeBias(queries, t))),
			};
		})
		.filter((row) => row.score >= 0.85)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.bias - a.bias ||
				titlesOf(a.item).join("").length - titlesOf(b.item).join("").length,
		);
}

function linesOf(rows) {
	return rows.filter(Boolean).join("\n");
}

function stripTags(value) {
	return String(value || "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/\s+\n/g, "\n")
		.trim();
}

export function formatYmd(value) {
	const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})$/);
	if (!match) return String(value || "");
	const [, year, month, day] = match;
	if (month === "99" || month === "00") return year;
	if (day === "99" || day === "00") return `${year}-${month}`;
	return `${year}-${month}-${day}`;
}

const pack = (title, url, text) =>
	text ? { title: title || "", url: url || "", text: clip(text) } : null;

// ── aniSearch ───────────────────────────────────────────────────────────────

export function formatAniSearch(payload) {
	const entry = payload?.results?.[0];
	if (!entry?.id) return null;
	const details = entry.details || {};
	const episodes = details.episodes?.ja || details.episodes?.en || [];
	const characters = (details.characters || []).filter(
		(c) => c?.role === "main" || c?.role === "supporting",
	);
	const synopsis =
		entry.releases?.ja?.synopsis ||
		entry.releases?.en?.synopsis ||
		entry.releases?.zh?.synopsis;
	const synopsisLine = synopsis?.text
		? `简介：${stripTags(synopsis.text)}${synopsis.source === "anisearch" ? `（来源 aniSearch，${entry.url}）` : ""}`
		: "";
	const text = linesOf([
		"资料来自 aniSearch API。转载其自行撰写的简介时请同时给出条目链接。",
		`名称：${entry.title || ""}`,
		entry.title_native ? `原名：${entry.title_native}` : "",
		`形式：${entry.type || ""}　状态：${entry.status || ""}　话数：${entry.episodes ?? "?"}`,
		`播出：${entry.aired_from || "?"} — ${entry.aired_to || "?"}${entry.season ? `（${entry.season}）` : ""}`,
		(entry.studios || []).length
			? `制作：${entry.studios
					.map((s) => s.name)
					.filter(Boolean)
					.join("、")}`
			: "",
		entry.external_ids?.myanimelist
			? `MAL：${entry.external_ids.myanimelist}`
			: "",
		synopsisLine,
		episodes.length ? "分集：" : "",
		...episodes
			.slice(0, 30)
			.map(
				(ep) =>
					`  第${ep.number}话 ${ep.title || ""}${ep.publication ? `（${ep.publication}）` : ""}`,
			),
		characters.length ? "角色（日文声优）：" : "",
		...characters.slice(0, 15).map((c) => {
			const voice = c.voices?.ja?.[0]?.person?.name || "";
			return `  ${c.name || ""}${c.role ? `（${c.role}）` : ""}${voice ? `：${voice}` : ""}`;
		}),
		(details.staff || []).length ? "职员：" : "",
		...(details.staff || [])
			.slice(0, 20)
			.flatMap((group) =>
				(group.creators || [])
					.slice(0, 4)
					.map((person) => `  ${group.name || ""}：${person.name || ""}`),
			),
	]);
	return pack(entry.title_native || entry.title, entry.url, text);
}

async function fetchAniSearch(id) {
	if (!/^[1-9]\d*$/.test(String(id || ""))) return null;
	const payload = await requestJson(
		"anisearch",
		`https://api.anisearch.com/v1/anime/${e(id)}/full`,
	);
	return formatAniSearch(payload);
}

// ── MangaUpdates ────────────────────────────────────────────────────────────

export function formatMangaUpdates(series, { medium = "" } = {}) {
	if (!series?.series_id && !series?.title) return null;
	const authors = (series.authors || [])
		.map((a) => `${a.type || "Author"}：${a.name}`)
		.filter((s) => !s.endsWith("："));
	const publishers = (series.publishers || []).map(
		(p) =>
			`${p.type || ""}：${p.publisher_name}${p.notes ? `（${p.notes}）` : ""}`,
	);
	const magazines = (series.publications || []).map(
		(p) => `${p.publication_name || ""}（${p.publisher_name || ""}）`,
	);
	const related = (series.related_series || [])
		.slice(0, 8)
		.map((r) => `${r.relation_type || "关联"}：${r.related_series_name || ""}`);
	const text = linesOf([
		"资料来自 MangaUpdates API。",
		medium
			? `期望体裁：${medium === "novel" ? "小说" : "漫画"}（仅用于多条命中时打破平分）`
			: "",
		`名称：${series.title || ""}`,
		`类型：${series.type || ""}　年份：${series.year || ""}　状态：${series.status || ""}`,
		series.completed != null ? `完结：${series.completed ? "是" : "否"}` : "",
		authors.length ? `作者：\n${authors.map((s) => `  ${s}`).join("\n")}` : "",
		publishers.length
			? `出版社：\n${publishers.map((s) => `  ${s}`).join("\n")}`
			: "",
		magazines.length
			? `连载：\n${magazines.map((s) => `  ${s}`).join("\n")}`
			: "",
		related.length
			? `关联作品：\n${related.map((s) => `  ${s}`).join("\n")}`
			: "",
		series.description
			? `简介：${stripTags(series.description).slice(0, 1500)}`
			: "",
	]);
	return pack(series.title, series.url, text);
}

function muTitles(record) {
	return [record?.title, record?.record?.title];
}

async function fetchMangaUpdates({ queries, slug, medium }) {
	let chosen = null;
	let chosenBySlug = false;
	let bestScore = 0;
	for (const query of searchOrder(queries)) {
		const payload = await requestJson(
			"mangaupdates",
			"https://api.mangaupdates.com/v1/series/search",
			{
				method: "POST",
				body: JSON.stringify({ search: query, stype: "title", perpage: 10 }),
			},
		);
		const results = (payload?.results || []).map((row) => row.record || row);
		const bySlug = slug
			? results.find((row) => String(row.url || "").includes(`/series/${slug}`))
			: null;
		if (bySlug?.series_id) {
			chosen = bySlug;
			chosenBySlug = true;
			break;
		}
		const ranked = rankByTitle(queries, results, (row) => [row.title]);
		if (medium) {
			ranked.sort((a, b) => {
				const bonus = (row) =>
					String(row.item.type || "").toLowerCase() ===
					(medium === "novel" ? "novel" : "manga")
						? 0.05
						: 0;
				return b.score + bonus(b) - (a.score + bonus(a)) || b.bias - a.bias;
			});
		}
		if (ranked[0] && ranked[0].score > bestScore) {
			bestScore = ranked[0].score;
			chosen = ranked[0].item;
		}
		if (bestScore >= 0.9) break;
	}
	if (!chosen?.series_id) return null;
	if (!chosenBySlug && titleMatchScore(queries, muTitles(chosen)) < 0.85)
		return null;
	const series = await requestJson(
		"mangaupdates",
		`https://api.mangaupdates.com/v1/series/${e(chosen.series_id)}`,
	);
	return formatMangaUpdates(series, { medium });
}

// ── VNDB ────────────────────────────────────────────────────────────────────

function vndbPlain(value) {
	return String(value || "")
		.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g, "$2")
		.replace(/\[\/?[a-z]+(?:=[^\]]+)?\]/gi, "")
		.trim();
}

export function formatVndb(results, { byId = false } = {}) {
	const list = (results || []).filter((row) => row?.id).slice(0, 3);
	if (list.length === 0) return null;
	const blocks = list.map((vn) =>
		linesOf([
			`名称：${vn.title || ""}${vn.alttitle ? `（${vn.alttitle}）` : ""}`,
			`编号：${vn.id}　发售：${vn.released || "?"}`,
			(vn.developers || []).length
				? `开发：${vn.developers
						.map((d) => d.name)
						.filter(Boolean)
						.join("、")}`
				: "",
			vn.length_minutes
				? `游玩时长（用户平均）：${vn.length_minutes} 分钟`
				: "",
			(vn.staff || []).slice(0, 12).length
				? `职员：${[...new Set((vn.staff || []).slice(0, 12).map((s) => `${s.role || ""} ${s.name || ""}`.trim()))].join("；")}`
				: "",
			vn.description ? `简介：${vndbPlain(vn.description).slice(0, 800)}` : "",
		]),
	);
	const text = linesOf([
		"资料来自 VNDB Kana API（非商业）。这里是视觉小说 / 游戏条目，可能是改编或外传，不是动画条目本身。",
		byId
			? "以下按 Wikidata 编号精确取得。"
			: "以下按标题搜索，并已做相关性校验。",
		...blocks,
	]);
	const first = list[0];
	return pack(first.title, `https://vndb.org/${first.id}`, text);
}

const VNDB_FIELDS =
	"title,alttitle,released,length_minutes,description,developers.name,staff{role,name}";

async function fetchVndb({ queries, id }) {
	if (id && /^v\d+$/i.test(String(id))) {
		const payload = await requestJson("vndb", "https://api.vndb.org/kana/vn", {
			method: "POST",
			body: JSON.stringify({
				filters: ["id", "=", String(id)],
				fields: VNDB_FIELDS,
				results: 1,
			}),
		});
		return formatVndb(payload?.results, { byId: true });
	}
	let ranked = [];
	let bestScore = 0;
	for (const query of searchOrder(queries)) {
		const payload = await requestJson("vndb", "https://api.vndb.org/kana/vn", {
			method: "POST",
			body: JSON.stringify({
				filters: ["search", "=", query],
				fields: VNDB_FIELDS,
				results: 8,
				sort: "searchrank",
			}),
		});
		const next = rankByTitle(queries, payload?.results || [], (vn) => [
			vn.title,
			vn.alttitle,
			...(vn.aliases || []),
			...(vn.titles || []).flatMap((t) => [t.title, t.latin]),
		]);
		if (next[0] && next[0].score > bestScore) {
			bestScore = next[0].score;
			ranked = next;
		}
		if (bestScore >= 0.9) break;
	}
	return formatVndb(ranked.map((row) => row.item));
}

// ── bilibili 游戏 Wiki ──────────────────────────────────────────────────────

export function parseBiliRoster(html) {
	const rows = [];
	const seen = new Set();
	for (const tr of String(html || "").matchAll(
		/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,
	)) {
		if (/<th[\s>]/i.test(tr[1])) continue;
		const cells = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
			(m) => stripTags(m[1]),
		);
		const href = tr[1].match(/href="([^"]+)"/i)?.[1] || "";
		let code = "";
		try {
			const url = new URL(href, "https://wiki.biligame.com");
			if (!/(^|\.)biligame\.com$/i.test(url.hostname)) continue;
			code = (url.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
		} catch {
			continue;
		}
		if (!/^[a-z0-9-]+$/.test(code) || seen.has(code)) continue;
		seen.add(code);
		rows.push({ name: cells[0] || code, code });
	}
	return rows;
}

/** 子站名必须等于作品名，或在去掉 wiki 后缀后以作品名开头。避免短名误配。 */
export function pickBiliWiki(rows, queries) {
	const qs = [
		...new Set(
			(queries || []).map(normalizeTitle).filter((q) => q.length >= 2),
		),
	];
	let best = null;
	let bestRank = 0;
	let bestLen = Number.POSITIVE_INFINITY;
	for (const row of rows || []) {
		const names = [
			row.name,
			String(row.name || "").replace(/(bwiki|wiki|百科)$/i, ""),
		];
		for (const name of names) {
			const normalized = normalizeTitle(name);
			if (!normalized) continue;
			for (const query of qs) {
				let rank = 0;
				if (normalized === query) rank = 2;
				else if (query.length >= 2 && normalized.startsWith(query)) rank = 1;
				if (
					rank > bestRank ||
					(rank === bestRank && rank > 0 && normalized.length < bestLen)
				) {
					best = row;
					bestRank = rank;
					bestLen = normalized.length;
				}
			}
		}
	}
	return bestRank > 0 ? best : null;
}

async function biliApi(code, params) {
	const url = `https://wiki.biligame.com/${e(code)}/api.php?${new URLSearchParams({ format: "json", ...params })}`;
	return requestJson("biligame", url);
}

async function fetchBiliGame(queries) {
	const roster = await requestText(
		"biligame",
		"https://wiki.biligame.com/tools/api.php",
		{
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			body: new URLSearchParams({
				action: "parse",
				text: "<bwikilist />",
				contentmodel: "wikitext",
				format: "json",
			}).toString(),
		},
	);
	const parsed = JSON.parse(roster);
	const html = parsed?.parse?.text?.["*"] || parsed?.parse?.text || "";
	const wiki = pickBiliWiki(parseBiliRoster(html), queries);
	if (!wiki) return null;
	const search = await biliApi(wiki.code, {
		action: "query",
		list: "search",
		srsearch: queries[0],
		srlimit: "5",
		srnamespace: "0",
	});
	const titles = (search?.query?.search || [])
		.map((hit) => hit.title)
		.filter(Boolean)
		.slice(0, 3);
	if (titles.length === 0) return null;
	const pages = await biliApi(wiki.code, {
		action: "query",
		prop: "extracts",
		explaintext: "1",
		exchars: "2000",
		titles: titles.join("|"),
	});
	const extracts = Object.values(pages?.query?.pages || {})
		.filter((page) => page?.extract && page.missing == null)
		.slice(0, 3);
	if (extracts.length === 0) return null;
	const text = linesOf([
		`资料来自哔哩哔哩游戏 Wiki（${wiki.name}，https://wiki.biligame.com/${wiki.code}/）的 MediaWiki API。只在作品是游戏或游戏改编时抓取，供角色设定补充。`,
		...extracts.map(
			(page) => `## ${page.title}\n${String(page.extract).slice(0, 2000)}`,
		),
	]);
	return pack(wiki.name, `https://wiki.biligame.com/${wiki.code}/`, text);
}

// ── RanobeDB ────────────────────────────────────────────────────────────────

export function formatRanobeBook(book) {
	const data = book?.book || book;
	if (!data?.id) return null;
	const series = data.series || {};
	const authors = [];
	for (const edition of data.editions || []) {
		for (const person of edition.staff || []) {
			if (person.role_type === "author" || person.role_type === "artist") {
				authors.push(
					`${person.role_type === "author" ? "作者" : "插画"}：${person.name}`,
				);
			}
		}
	}
	const publishers = (data.publishers || []).map(
		(p) =>
			`${p.publisher_type || ""}：${p.name}${p.romaji ? `（${p.romaji}）` : ""}（${p.lang || ""}）`,
	);
	const releases = (data.releases || [])
		.filter((r) => r?.isbn13)
		.slice(0, 6)
		.map(
			(r) =>
				`${formatYmd(r.release_date)}｜${r.title || ""}｜${r.format || ""}｜ISBN ${r.isbn13}`,
		);
	const volumes = (series.books || [])
		.map((b) => b.title_orig || b.title)
		.filter(Boolean);
	const text = linesOf([
		"资料来自 RanobeDB API v0（非商业，ODbL）。",
		`系列：${series.title_orig || series.title || data.title_orig || data.title || ""}`,
		[...new Set(authors)].length
			? `创作者：${[...new Set(authors)].join("；")}`
			: "",
		publishers.length ? `出版：${publishers.join("；")}` : "",
		volumes.length
			? `卷目（${volumes.length}）：\n${volumes
					.slice(0, 30)
					.map((v) => `  ${v}`)
					.join("\n")}`
			: "",
		releases.length
			? `本卷发行：\n${releases.map((v) => `  ${v}`).join("\n")}`
			: "",
	]);
	return pack(
		series.title_orig || data.title_orig || data.title,
		`https://ranobedb.org/book/${data.id}`,
		text,
	);
}

function ranobeTitles(book) {
	return [book?.title, book?.title_orig, book?.romaji, book?.romaji_orig];
}

async function fetchRanobe(queries) {
	let ranked = [];
	for (const query of searchOrder(queries)) {
		const payload = await requestJson(
			"ranobedb",
			`https://ranobedb.org/api/v0/books?limit=30&q=${e(query)}`,
		);
		ranked = rankByTitle(queries, payload?.books || [], ranobeTitles);
		if (ranked[0]?.score >= 0.9) break;
	}
	let fallback = null;
	let fallbackScore = 0;
	for (const row of ranked.slice(0, 3)) {
		const detail = await requestJson(
			"ranobedb",
			`https://ranobedb.org/api/v0/book/${e(row.item.id)}`,
		);
		const data = detail?.book || detail;
		const seriesScore = titleMatchScore(queries, [
			data?.series?.title,
			data?.series?.title_orig,
			data?.series?.romaji,
			data?.series?.romaji_orig,
		]);
		if (seriesScore >= 1) return formatRanobeBook(detail);
		if (seriesScore >= 0.85 && seriesScore > fallbackScore) {
			fallback = detail;
			fallbackScore = seriesScore;
		}
	}
	return fallback ? formatRanobeBook(fallback) : null;
}

// ── 国立国会図書館サーチ ────────────────────────────────────────────────────

const NDL_SKIP =
	/画集|ドラマCD|ドラマＣＤ|ビジュアルガイド|パンフレット|pamphlet|マガジン|設定資料|ファンブック|fan\s*book/i;

export function parseNdlRss(xml) {
	const items = [];
	for (const block of String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/g)) {
		const item = block[1];
		const take = (tag) =>
			item.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1]?.trim() ||
			"";
		const isbn =
			[...item.matchAll(/<dc:identifier\b([^>]*)>([^<]*)<\/dc:identifier>/g)]
				.filter((m) => /isbn/i.test(m[1]))
				.map((m) => m[2].trim())[0] || "";
		items.push({
			title: take("dc:title") || take("title"),
			link: take("link"),
			creator: take("dc:creator") || take("author"),
			publisher: take("dc:publisher"),
			issued: take("dcterms:issued") || take("dc:date"),
			isbn,
			categories: [...item.matchAll(/<category>([^<]*)<\/category>/g)].map(
				(m) => m[1],
			),
		});
	}
	return items;
}

export function selectNdlBooks(items, queries) {
	const seen = new Set();
	return (items || [])
		.filter((item) => item.isbn && !NDL_SKIP.test(item.title || ""))
		.map((item) => ({ item, score: titleMatchScore(queries, [item.title]) }))
		.filter((row) => row.score >= 0.85)
		.sort(
			(a, b) =>
				String(a.item.issued).localeCompare(String(b.item.issued)) ||
				b.score - a.score,
		)
		.filter((row) => {
			if (seen.has(row.item.isbn)) return false;
			seen.add(row.item.isbn);
			return true;
		})
		.slice(0, 15)
		.map((row) => row.item);
}

export function formatNdlBooks(items) {
	if (!items?.length) return null;
	const text = linesOf([
		"书目来自国立国会图书馆サーチ OpenSearch API（数据提供者：国立国会图书馆藏书 iss-ndl-opac）。非营利书目引用，已限定图书并丢掉标题对不上的记录。",
		...items.map((item) =>
			[
				item.title,
				item.issued,
				item.creator,
				item.publisher,
				item.isbn ? `ISBN ${item.isbn}` : "",
			]
				.filter(Boolean)
				.join("｜"),
		),
	]);
	return pack(
		items[0].title,
		items[0].link || "https://ndlsearch.ndl.go.jp/",
		text,
	);
}

async function fetchNdl(queries) {
	const titles = [...searchOrder(queries), ...queries];
	for (const query of searchOrder(queries)) {
		const xml = await requestText(
			"ndl",
			`https://ndlsearch.ndl.go.jp/api/opensearch?dpid=iss-ndl-opac&mediatype=books&cnt=25&title=${e(query)}`,
			{ accept: "application/xml", timeoutMs: 40_000 },
		);
		const books = selectNdlBooks(parseNdlRss(xml), titles);
		if (books.length > 0) return formatNdlBooks(books);
	}
	return null;
}

// ── 汇总 ────────────────────────────────────────────────────────────────────

const settle = async (name, task) => {
	try {
		return await task();
	} catch (error) {
		console.warn(`  ⚠ ${name}: ${error.message}`);
		return null;
	}
};

/**
 * @param {{ ja?: string[], en?: string[], zh?: string[], ids?: Record<string, string>, bangumiType?: string|number, instanceIds?: string[], enabled?: typeof sourceEnabled }} input
 */
export async function fetchCatalogSources({
	ja = [],
	en = [],
	zh = [],
	ids = {},
	bangumiType = "",
	instanceIds = [],
	enabled = sourceEnabled,
} = {}) {
	const queries = [
		...new Set(
			[...ja, ...en, ...zh]
				.map((t) => String(t || "").trim())
				.filter((t) => t.length >= 2),
		),
	];
	const medium = workMedium(instanceIds);
	const game = isGameOrGameAdaptation({ bangumiType, instanceIds });
	// 相关性校验要用全部标题（含英文）。网络请求由 searchOrder 限制为最多 3 次，
	// 不能在这里先切掉英文，否则日文季名对不上 MangaUpdates 的英文条目。
	const [anisearch, mangaupdates, vndb, biligame, ranobedb, ndl] =
		await Promise.all([
			enabled("anisearch")
				? settle("aniSearch", () => fetchAniSearch(ids.anisearch))
				: null,
			enabled("mangaupdates") && queries.length
				? settle("MangaUpdates", () =>
						fetchMangaUpdates({
							queries,
							slug: ids.mangaupdates || "",
							medium,
						}),
					)
				: null,
			enabled("vndb") && (ids.vndb || queries.length)
				? settle("VNDB", () => fetchVndb({ queries, id: ids.vndb || "" }))
				: null,
			enabled("biligame") && game && queries.length
				? settle("bilibili 游戏 Wiki", () => fetchBiliGame(queries))
				: null,
			enabled("ranobedb") && queries.length
				? settle("RanobeDB", () => fetchRanobe(queries))
				: null,
			enabled("ndl") && queries.length
				? settle("NDL", () => fetchNdl(queries))
				: null,
		]);
	return { anisearch, mangaupdates, vndb, biligame, ranobedb, ndl };
}
