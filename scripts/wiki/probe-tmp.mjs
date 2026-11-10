// 临时探测脚本（合并前删除）：用正常的抓取 UA 测试候选资料站在 Actions 上是否可用
const UA = "wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const q = encodeURIComponent("ソードアート・オンライン");
const urls = [
  "https://api.jikan.moe/v4/anime/11757/themes",
  `http://anison.info/data/n.php?q=${q}&m=pro`,
  `https://anison.info/data/n.php?q=${q}&m=pro`,
  "https://vgmdb.net/search?q=sword+art+online&type=album",
  "https://musicbrainz.org/ws/2/release-group?query=crossing%20field%20AND%20artist:LiSA&fmt=json&limit=3",
  "https://shikimori.one/api/animes/11757",
  "https://kitsu.app/api/edge/anime/6589/streaming-links",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    console.log(`PROBE ${r.status} ${r.url} len=${t.length} :: ${t.replace(/\s+/g, " ").slice(0, 300)}`);
    const links = [...t.matchAll(/href="([^"]*program[^"]*)"[^>]*>([^<]{0,60})/g)].slice(0, 8).map((m) => `${m[1]}=>${m[2]}`);
    if (links.length) console.log(`  LINKS ${links.join(" | ")}`);
  } catch (e) { console.log(`PROBE ERR ${u} ${e.message} ${e.cause?.code || ""}`); }
}
// Wikidata：SAO 相关条目
const get = async (u) => (await fetch(u, { headers: { "user-agent": UA } })).json();
const s = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=ja&limit=10&format=json`);
const ids = s.search.map((h) => h.id);
const more = await get(`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent("Sword Art Online anime television series")}&srlimit=10&format=json`);
ids.push(...more.query.search.map((h) => h.title));
const ents = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...new Set(ids)].join("|")}&props=labels|claims&languages=ja|en&format=json`)).entities;
for (const x of Object.values(ents)) {
  const v = (p) => (x.claims?.[p] || []).map((c) => JSON.stringify(c.mainsnak?.datavalue?.value?.id || c.mainsnak?.datavalue?.value)).join(",");
  console.log(`WD ${x.id} ja=${x.labels?.ja?.value} en=${x.labels?.en?.value} P31=${v("P31")} P144=${v("P144")} P4969=${v("P4969").slice(0, 200)} mal=${v("P4086")} syoboi=${v("P11648")} bgm=${v("P5732")}`);
}
