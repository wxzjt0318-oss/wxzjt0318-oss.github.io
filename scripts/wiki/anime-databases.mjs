/**
 * 动画数据库资料：Anime News Network 百科（staff / 声优 / 分集，结构化）与 Kitsu（简介、播出日期、话数）
 * ─────────────────────────────────────────────────────────────────────────────
 * 供长文改写核对制作信息用，按英文 / 罗马字标题搜索；两者都只用来核对事实，不照搬原文。
 * ニコニコ大百科、pixiv 百科事典会拦截 GitHub Actions 的请求（403），AniList 接口已停用，均未接入。
 */

const USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";

async function getText(url, accept) {
	const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.text();
}

const decode = (s) =>
	String(s || "")
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.trim();

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";

/** 把一个 ANN <anime> 条目整理成按行的纯文本 */
export function annEntryToText(xml) {
	const lines = [];
	const head = xml.match(/^<anime\b[^>]*>/)?.[0] || "";
	lines.push(`名称：${decode(attr(head, "name"))}（${attr(head, "type")}）`);
	for (const m of xml.matchAll(/<info\b([^>]*?)(?<!\/)>([\s\S]*?)<\/info>/g)) {
		const type = attr(m[1], "type");
		if (type === "Picture") continue;
		const lang = attr(m[1], "lang");
		lines.push(`${type}${lang ? `（${lang}）` : ""}：${decode(m[2])}`);
	}
	for (const m of xml.matchAll(/<episode\b[^>]*num="([^"]*)"[^>]*>([\s\S]*?)<\/episode>/g)) {
		lines.push(`第${m[1]}话：${decode(m[2])}`);
	}
	for (const m of xml.matchAll(/<staff\b[^>]*>([\s\S]*?)<\/staff>/g)) {
		const task = decode(m[1].match(/<task>([\s\S]*?)<\/task>/)?.[1]);
		const person = decode(m[1].match(/<person\b[^>]*>([\s\S]*?)<\/person>/)?.[1]);
		if (task && person) lines.push(`Staff｜${task}：${person}`);
	}
	for (const m of xml.matchAll(/<cast\b([^>]*)>([\s\S]*?)<\/cast>/g)) {
		const lang = attr(m[1], "lang");
		if (lang && lang !== "JA") continue;
		const role = decode(m[2].match(/<role>([\s\S]*?)<\/role>/)?.[1]);
		const person = decode(m[2].match(/<person\b[^>]*>([\s\S]*?)<\/person>/)?.[1]);
		if (role && person) lines.push(`声优｜${role}：${person}`);
	}
	for (const m of xml.matchAll(/<credit\b[^>]*>([\s\S]*?)<\/credit>/g)) {
		const task = decode(m[1].match(/<task>([\s\S]*?)<\/task>/)?.[1]);
		const company = decode(m[1].match(/<company\b[^>]*>([\s\S]*?)<\/company>/)?.[1]);
		if (task && company) lines.push(`公司｜${task}：${company}`);
	}
	return lines.join("\n");
}

/** Anime News Network 百科：按标题子串搜索，最多返回 3 个条目（系列的多季会一起出现） */
export async function fetchAnnEntries(title, limit = 3) {
	const query = String(title || "").trim();
	if (query.length < 3) return [];
	const xml = await getText(
		`https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=~${encodeURIComponent(query)}`,
		"application/xml",
	);
	return [...xml.matchAll(/<anime\b[\s\S]*?<\/anime>/g)].slice(0, limit).map((m) => {
		const head = m[0].match(/^<anime\b[^>]*>/)[0];
		return {
			title: decode(attr(head, "name")),
			url: `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${attr(head, "id")}`,
			text: annEntryToText(m[0]),
		};
	});
}

/** Anime News Network 百科：按条目编号精确抓取（编号来自 Wikidata） */
export async function fetchAnnEntryById(id) {
	if (!id) return null;
	const xml = await getText(`https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=${encodeURIComponent(id)}`, "application/xml");
	const entry = xml.match(/<anime\b[\s\S]*?<\/anime>/)?.[0];
	if (!entry) return null;
	const head = entry.match(/^<anime\b[^>]*>/)[0];
	return {
		title: decode(attr(head, "name")),
		url: `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${attr(head, "id")}`,
		text: annEntryToText(entry),
	};
}

/** Kitsu：按标题搜索，返回最相关的 2 个条目 */
export async function fetchKitsuEntries(title, limit = 2) {
	const query = String(title || "").trim();
	if (query.length < 2) return [];
	const json = JSON.parse(
		await getText(
			`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=${limit}`,
			"application/vnd.api+json",
		),
	);
	return (json.data || []).map(({ attributes: a = {} }) => ({
		title: a.canonicalTitle || "",
		url: a.slug ? `https://kitsu.app/anime/${a.slug}` : "",
		text: [
			`标题：${a.canonicalTitle || ""}`,
			...Object.entries(a.titles || {}).map(([k, v]) => `标题（${k}）：${v}`),
			`形式：${a.subtype || ""}`,
			`播出：${a.startDate || "?"} — ${a.endDate || "?"}`,
			`话数：${a.episodeCount ?? "?"}`,
			`简介：${a.synopsis || ""}`,
		].join("\n"),
	}));
}
