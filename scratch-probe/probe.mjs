const UA = "wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const t = "よわよわ先生";
async function show(name, url, ua = UA) {
	try {
		const res = await fetch(url, { headers: { "user-agent": ua, "accept-language": "ja,en;q=0.8", accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8" } });
		const body = await res.text();
		console.log(`\n===== ${name} ${res.status} ${res.headers.get("content-type")} len=${body.length}`);
		console.log("  HEAD:", body.slice(0, 700).replace(/\s+/g, " "));
	} catch (e) { console.log(`\n===== ${name} ERROR ${e.message}`); }
}
await show("nicopedia-browser", `https://dic.nicovideo.jp/a/${encodeURIComponent(t)}`, BROWSER);
await show("pixiv-browser", `https://dic.pixiv.net/a/${encodeURIComponent(t)}`, BROWSER);
await show("jikan", `https://api.jikan.moe/v4/anime?q=${encodeURIComponent("Yowayowa Sensei")}&limit=2`);
await show("ann", `https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=~${encodeURIComponent("Yowayowa Sensei")}`);
await show("ann-search", `https://cdn.animenewsnetwork.com/encyclopedia/reports.xml?id=155&type=anime&search=${encodeURIComponent("Yowayowa")}`);
await show("kitsu", `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent("Yowayowa Sensei")}&page[limit]=1`);
await show("mediaarts", `https://mediaarts-db.artmuseums.go.jp/api/search?fieldId=animation&keyword=${encodeURIComponent(t)}`);
