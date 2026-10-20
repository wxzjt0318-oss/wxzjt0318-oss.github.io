// 临时：为资料稀缺的作品抓取 AniList / Jikan(MyAnimeList) / Bangumi 数据，结果写入 reports/extra-sources/。合并前删除。
import fs from "node:fs/promises";
const OUT = "reports/extra-sources";
await fs.mkdir(OUT, { recursive: true });
const safe = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { return { error: String(e.cause?.code || e.message) }; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const anilistQuery = `query ($s: String) { Page(perPage: 5) { media(search: $s, type: ANIME) {
  id idMal isAdult format episodes duration startDate { year month day } season seasonYear source
  title { romaji native english } synonyms description(asHtml: false) genres tags { name rank isAdult }
  studios { edges { isMain node { name } } }
  staff(perPage: 25) { edges { role node { name { full native } } } }
  characters(perPage: 25) { edges { role node { name { full native } description } voiceActors(language: JAPANESE) { name { full native } } } }
  relations { edges { relationType node { title { romaji native } format startDate { year } } } }
  externalLinks { site url } } } }`;
const anilist = safe(async function (s) {
	const r = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: anilistQuery, variables: { s } }) });
	return r.ok ? (await r.json()).data?.Page?.media || [] : { error: r.status };
});
const jikan = safe(async function (path) {
	const r = await fetch(`https://api.jikan.moe/v4/${path}`);
	await wait(1200);
	return r.ok ? (await r.json()).data : { error: r.status };
});
const bangumi = safe(async function (path) {
	const r = await fetch(`https://api.bgm.tv/v0/${path}`, { headers: { "User-Agent": "wxzjt0318-oss/blog-fetch" } });
	return r.ok ? await r.json() : { error: r.status };
});
const requests = JSON.parse(await fs.readFile("scripts/tmp/extra-requests.json", "utf8"));
for (const [slug, { searches, bangumiId }] of Object.entries(requests)) {
	const out = { anilist: {}, jikan: {}, bangumi: {} };
	for (const s of searches) {
		out.anilist[s] = await anilist(s);
		await wait(800);
		const found = await jikan(`anime?q=${encodeURIComponent(s)}&sfw=false&limit=5`);
		out.jikan[s] = found;
		for (const a of Array.isArray(found) ? found.slice(0, 2) : []) {
			out.jikan[`${a.mal_id}:full`] = await jikan(`anime/${a.mal_id}/full`);
			out.jikan[`${a.mal_id}:characters`] = await jikan(`anime/${a.mal_id}/characters`);
			out.jikan[`${a.mal_id}:staff`] = await jikan(`anime/${a.mal_id}/staff`);
		}
	}
	if (bangumiId) {
		out.bangumi.subject = await bangumi(`subjects/${bangumiId}`);
		out.bangumi.characters = await bangumi(`subjects/${bangumiId}/characters`);
		out.bangumi.persons = await bangumi(`subjects/${bangumiId}/persons`);
	}
	await fs.writeFile(`${OUT}/${slug}.json`, `${JSON.stringify(out, null, 2)}\n`);
	console.log(`✓ ${slug}`);
}
