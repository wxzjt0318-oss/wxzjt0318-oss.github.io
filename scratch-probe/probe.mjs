const UA = "wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const e = encodeURIComponent;
const get = async (u, accept = "*/*") => { const r = await fetch(u, { headers: { "user-agent": UA, accept, "accept-language": "ja,en;q=0.8" } }); return { status: r.status, body: await r.text() }; };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
async function show(n, f) { try { console.log(`\n===== ${n}\n${(await f()).slice(0, 2500)}`); } catch (err) { console.log(`\n===== ${n} ERROR ${err.cause?.code || err.message}`); } }
const props = ["P12489","P8729","P1985","P6367","P4086","P5646","P4983","P4835","P345","P2002","P8600","P11648","P14825","P14311","P11551","P12477","P4087","P1984","P8731","P5849","P5732","P11259","P5905","P11476","P11149","P11176","P8419","P11348","P5737","P6900","P11408","P2671","P31","P495","P136","P272","P449","P144","P580","P582","P1113","P57","P58","P86","P725","P170","P123","P50","P407","P1476","P1448"];
await show("property-labels", async () => {
	const out = [];
	for (let i = 0; i < props.length; i += 45) {
		const j = JSON.parse((await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${props.slice(i, i + 45).join("|")}&props=labels&languages=en&format=json`)).body);
		for (const [k, v] of Object.entries(j.entities)) out.push(`${k}=${v.labels?.en?.value}`);
	}
	return out.join("\n");
});
await show("syoboi-tid-7771", async () => { const r = await get("https://cal.syoboi.jp/db.php?Command=TitleLookup&TID=7771"); return `${r.status}\n${r.body}`; });
await show("syoboi-json-tid", async () => { const r = await get("https://cal.syoboi.jp/json.php?Req=TitleFull&TID=7771"); return `${r.status}\n${r.body}`; });
await show("animehack-search-links", async () => { const r = await get(`https://anime.eiga.com/search/?q=${e("よわよわ先生")}`); return [...r.body.matchAll(/<a[^>]+href="(\/program\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/g)].slice(0, 12).map((m) => `${m[1]} ${strip(m[2]).trim()}`).join("\n"); });
await show("animehack-program-search", async () => { const r = await get(`https://anime.eiga.com/program/search/?q=${e("よわよわ先生")}`); return `${r.status} ` + [...r.body.matchAll(/href="(\/program\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/g)].slice(0, 8).map((m) => `${m[1]} ${strip(m[2]).trim()}`).join("\n"); });
await show("mal-characters", async () => { const r = await get("https://myanimelist.net/anime/60444/Yowayowa_Sensei/characters"); const t = strip(r.body); const i = t.indexOf("Characters & Voice Actors"); return `${r.status}\n${t.slice(i, i + 1500)}`; });
await show("mal-main-sections", async () => { const r = await get("https://myanimelist.net/anime/60444/Yowayowa_Sensei"); const t = strip(r.body); const i = t.indexOf("Synopsis", t.indexOf("Edit Synopsis") > 0 ? t.indexOf("Edit Synopsis") - 20 : 0); const s = r.body.match(/<p itemprop="description">([\s\S]*?)<\/p>/); const th = [...r.body.matchAll(/<span class="theme-song-title">([\s\S]*?)<\/span>/g)].map((m) => strip(m[1])); return `${r.status} desc=${s ? strip(s[1]).slice(0, 600) : "none"}\nthemes=${th}`; });
await show("livechart-anime", async () => { const r = await get("https://www.livechart.me/anime/12955"); const ld = [...r.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]); return `${r.status} ld=${ld.join("\n").slice(0, 2000)}`; });
await show("bangumi-subject-infobox", async () => { const r = JSON.parse((await get("https://api.bgm.tv/v0/subjects/526789")).body); return JSON.stringify(r.infobox).slice(0, 1500); });
await show("wikidata-sitelinks", async () => { const j = JSON.parse((await get("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q131381808&props=sitelinks/urls|labels&languages=ja|zh|en|zh-hans|zh-cn&format=json")).body); const x = j.entities.Q131381808; return JSON.stringify({ labels: x.labels, sitelinks: Object.fromEntries(Object.entries(x.sitelinks).map(([k, v]) => [k, v.url])) }); });
