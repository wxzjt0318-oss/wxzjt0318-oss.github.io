const UA = "wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
const t = "よわよわ先生";
async function show(name, url, init = {}) {
	try {
		const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ja,en;q=0.8", ...(init.headers || {}) }, ...init });
		const body = await res.text();
		console.log(`\n===== ${name} ${res.status} ${res.headers.get("content-type")} len=${body.length} final=${res.url}`);
		for (const m of ["id=\"article\"", "class=\"article", "<article", "__NEXT_DATA__", "<h1", "id=\"bbs", "<footer", "a-contents", "article-body", "dic-article", "itemprop=\"articleBody\""]) {
			const i = body.indexOf(m);
			if (i >= 0) console.log(`  [${m}] @${i}: ${body.slice(i, i + 220).replace(/\s+/g, " ")}`);
		}
		console.log("  HEAD:", body.slice(0, 400).replace(/\s+/g, " "));
	} catch (e) { console.log(`\n===== ${name} ERROR ${e.message}`); }
}
await show("nicopedia", `https://dic.nicovideo.jp/a/${encodeURIComponent(t)}`);
await show("pixiv", `https://dic.pixiv.net/a/${encodeURIComponent(t)}`);
await show("jawiki", `https://ja.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(t)}`);
await show("anilist", "https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query: "query($s:String){Page(perPage:2){media(search:$s,type:ANIME){id title{native romaji english} episodes}}}", variables: { s: t } }) });
await show("enwiki", `https://en.wikipedia.org/w/api.php?format=json&action=query&list=search&srsearch=${encodeURIComponent(t)}`);
