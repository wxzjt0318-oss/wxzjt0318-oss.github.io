/**
 * 主题曲与音乐资料（长文改写的补充来源）
 * ─────────────────────────────────────────────────────────────────────────────
 * 百科条目常把主题曲放在单独的子条目里（日文维基「〇〇 (アニメ)」由 fetch-sources.mjs 另行抓取），
 * 按作品名搜索的数据库也常匹配不到动画条目，所以另从两处抓取：
 *   Bangumi 关联条目   片头曲 / 片尾曲 / 插入歌 / 原声集等音乐条目，含演唱、作词、作曲、发售日（最可靠）
 *   Shikimori          与 MAL 共用编号的动画数据库：基本信息与 OP / ED 视频列表；
 *                      Wikidata 没记 MAL 编号时，用它按英文名搜到的编号去抓 MAL 页面
 * 实测不可用：Jikan（Actions 上连接超时）、VGMdb（Cloudflare 拦截）、MusicBrainz（经常 503）；
 * アニソンジェネレーション页面声明 noai，不抓取。
 *
 * 每个来源返回 {title, url, text} 或 null；任何一站失败都不影响其他来源。
 */

const USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const MAX_TEXT = 12000;
const e = encodeURIComponent;
const clip = (text, max = MAX_TEXT) => String(text || "").trim().slice(0, max);

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

// ── Shikimori ───────────────────────────────────────────────────────────────

const SHIKIMORI = "https://shikimori.one";

/** 在 Shikimori 搜索结果里挑英文 / 罗马字名完全一致的动画，TV 动画优先 */
export function pickShikimoriAnime(results, en = []) {
	const names = new Set(en.filter(Boolean).map((t) => t.trim().toLowerCase()));
	const hits = (results || []).filter((a) => names.has(String(a.name || "").trim().toLowerCase()));
	return hits.find((a) => a.kind === "tv") || hits[0] || null;
}

/** 条目详情 → 文本：日文 / 英文名、类型、话数、播出日期、制作公司，以及 OP / ED 视频列表 */
export function describeShikimori(anime, videos = []) {
	const list = (xs) => (xs || []).filter(Boolean).join("、");
	const songs = (videos || []).filter((v) => v.kind === "op" || v.kind === "ed");
	return [
		`名称：${anime.name || ""}`,
		`日文名：${list(anime.japanese)}`,
		`英文名：${list(anime.english)}`,
		`类型：${anime.kind || ""}｜话数：${anime.episodes ?? ""}`,
		`播出：${anime.aired_on || ""} — ${anime.released_on || ""}`,
		`制作公司：${list((anime.studios || []).map((x) => x.name))}`,
		...(songs.length
			? ["主题曲视频（用户上传，名称可能不规范，只用于核对）：", ...songs.map((v) => `  ${v.kind.toUpperCase()}｜${v.name || ""}`)]
			: []),
	].join("\n");
}

/** malId 已知时直接取（Shikimori 与 MAL 编号相同）；否则按英文 / 罗马字名搜索。返回值带 malId */
export async function fetchShikimori({ malId = "", en = [] } = {}) {
	let id = malId ? String(malId) : "";
	for (const q of [...new Set(en.filter(Boolean))].slice(0, 2)) {
		if (id) break;
		const hit = pickShikimoriAnime(await getJson(`${SHIKIMORI}/api/animes?search=${e(q)}&limit=10`), en);
		if (hit) id = String(hit.id);
	}
	if (!id) return null;
	const anime = await getJson(`${SHIKIMORI}/api/animes/${e(id)}`);
	const videos = anime.videos || (await getJson(`${SHIKIMORI}/api/animes/${e(id)}/videos`).catch(() => []));
	return {
		title: anime.name || `Shikimori ${id}`,
		url: `${SHIKIMORI}/animes/${id}`,
		text: clip(describeShikimori(anime, videos)),
		malId: id,
	};
}
