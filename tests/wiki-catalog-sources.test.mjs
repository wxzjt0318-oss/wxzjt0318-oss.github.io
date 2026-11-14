/**
 * 书志 API 的标题校验和响应整理。只用夹具，不访问外网。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatAniSearch,
	formatMangaUpdates,
	formatNdlBooks,
	formatRanobeBook,
	formatVndb,
	formatYmd,
	isGameOrGameAdaptation,
	parseBiliRoster,
	parseNdlRss,
	pickBiliWiki,
	rankByTitle,
	searchOrder,
	selectNdlBooks,
	titleMatchScore,
	volumeBias,
} from "../scripts/wiki/catalog-sources.mjs";
import { sourceEnabled } from "../scripts/wiki/source-http.mjs";

describe("titleMatchScore", () => {
	it("accepts a season title against the series, and a volume title that starts with the series", () => {
		assert.equal(titleMatchScore(["约会大作战 第五季"], ["约会大作战"]), 0.85);
		assert.equal(
			titleMatchScore(
				["デート・ア・ライブ"],
				["デート・ア・ライブ : 十香デッドエンド"],
			),
			0.9,
		);
		assert.equal(titleMatchScore(["Date A Live"], ["Date A Live (Novel)"]), 1);
	});

	it("rejects unrelated titles and titles that only contain the series name in the middle", () => {
		assert.equal(
			titleMatchScore(
				["转生为第七王子，随心所欲的魔法学习之路"],
				["西格蒙德·弗洛伊德"],
			),
			0,
		);
		assert.equal(
			titleMatchScore(
				["デート・ア・ライブ"],
				["選んでデート・ア・ライブ-Date a live best selection"],
			),
			0,
		);
		assert.equal(titleMatchScore(["Date A Live"], ["Date"]), 0);
	});
});

describe("searchOrder", () => {
	it("searches the series name before a season title and still keeps the English title", () => {
		assert.deepEqual(
			searchOrder(["デート・ア・ライブV", "デート・ア・ライブ", "date a live"]),
			["デート・ア・ライブ", "デート・ア・ライブV", "date a live"],
		);
	});

	it("does not treat an English database title as the Japanese season name", () => {
		assert.equal(
			titleMatchScore(
				["デート・ア・ライブV", "デート・ア・ライブ"],
				["Date a Live"],
			),
			0,
		);
		assert.equal(
			titleMatchScore(["デート・ア・ライブ", "date a live"], ["Date a Live"]),
			1,
		);
	});
});

describe("rankByTitle", () => {
	it("prefers a numbered volume over a side story when both start with the series name", () => {
		const ranked = rankByTitle(
			["デート・ア・ライブ"],
			[
				{ title: "デート・ア・ライブ アンコール" },
				{ title: "デート・ア・ライブ2 四糸乃パペット" },
			],
			(item) => [item.title],
		);
		assert.equal(ranked[0].item.title, "デート・ア・ライブ2 四糸乃パペット");
		assert.equal(
			volumeBias(["デート・ア・ライブ"], "デート・ア・ライブ2 四糸乃パペット"),
			1,
		);
		assert.equal(
			volumeBias(["デート・ア・ライブ"], "デート・ア・ライブ アンコール"),
			0,
		);
	});
});

describe("isGameOrGameAdaptation", () => {
	it("is true for a Bangumi game or a visual-novel / video-game Wikidata type", () => {
		assert.equal(isGameOrGameAdaptation({ bangumiType: 4 }), true);
		assert.equal(isGameOrGameAdaptation({ instanceIds: ["Q7889"] }), true);
		assert.equal(isGameOrGameAdaptation({ instanceIds: ["Q689445"] }), true);
	});

	it("is false for an ordinary anime adaptation", () => {
		assert.equal(
			isGameOrGameAdaptation({
				bangumiType: 2,
				instanceIds: ["Q63952888", "Q747381"],
			}),
			false,
		);
	});
});

describe("source switches", () => {
	it("stays on unless the env value is an explicit off", () => {
		assert.equal(sourceEnabled("anisearch", {}), true);
		assert.equal(sourceEnabled("vndb", { WIKI_SOURCE_VNDB: "0" }), false);
		assert.equal(sourceEnabled("ndl", { WIKI_SOURCE_NDL: "off" }), false);
		assert.equal(
			sourceEnabled("ranobedb", { WIKI_SOURCE_RANOBEDB: "1" }),
			true,
		);
	});
});

describe("formatAniSearch", () => {
	it("keeps episodes, main cast and staff from a /full payload and credits the synopsis", () => {
		const packed = formatAniSearch({
			results: [
				{
					id: 9,
					url: "https://www.anisearch.com/anime/9,example",
					title: "Example",
					title_native: "例",
					type: "TV-Series",
					status: "Completed",
					episodes: 1,
					aired_from: "2024-04-01",
					aired_to: "2024-06-01",
					studios: [{ name: "Studio" }],
					external_ids: { myanimelist: 1 },
					releases: {
						ja: { synopsis: { text: "简介正文", source: "anisearch" } },
					},
					details: {
						episodes: {
							ja: [{ number: "1", title: "始まり", publication: "2024-04-01" }],
						},
						characters: [
							{
								name: "主人公",
								role: "main",
								voices: { ja: [{ person: { name: "声优甲" } }] },
							},
							{ name: "路人", role: "background" },
						],
						staff: [{ name: "Direction", creators: [{ name: "监督乙" }] }],
					},
				},
			],
		});
		assert.match(packed.text, /始まり/);
		assert.match(packed.text, /声优甲/);
		assert.match(packed.text, /监督乙/);
		assert.match(
			packed.text,
			/https:\/\/www\.anisearch\.com\/anime\/9,example/,
		);
		assert.doesNotMatch(packed.text, /路人/);
	});
});

describe("formatMangaUpdates", () => {
	it("keeps authors, serialization, publishers and related works", () => {
		const packed = formatMangaUpdates({
			series_id: 1,
			title: "Date a Live",
			url: "https://www.mangaupdates.com/series/e7ec9g3/date-a-live",
			type: "Manga",
			year: "2012",
			status: "Ongoing",
			authors: [{ name: "TACHIBANA Koushi", type: "Author" }],
			publishers: [{ publisher_name: "Kadokawa Shoten", type: "Original" }],
			publications: [
				{ publication_name: "Shounen Ace", publisher_name: "Kadokawa Shoten" },
			],
			related_series: [
				{
					relation_type: "Adapted From",
					related_series_name: "Date A Live (Novel)",
				},
			],
			description: "<p>Hello</p>",
		});
		assert.match(packed.text, /TACHIBANA Koushi/);
		assert.match(packed.text, /Shounen Ace/);
		assert.match(packed.text, /Kadokawa Shoten/);
		assert.match(packed.text, /Date A Live \(Novel\)/);
		assert.match(packed.text, /Hello/);
		assert.doesNotMatch(packed.text, /<p>/);
	});
});

describe("formatVndb", () => {
	it("labels title-search hits as visual novels and keeps developers", () => {
		const packed = formatVndb([
			{
				id: "v12702",
				title: "Date A Live: Rinne Utopia",
				alttitle: "デート・ア・ライブ 凛祢ユートピア",
				released: "2013-06-27",
				developers: [{ name: "COMPILE HEART Inc." }],
				staff: [{ role: "staff", name: "Tsunako" }],
				description: "A [url=https://vndb.org/v12702]game[/url].",
			},
		]);
		assert.equal(packed.url, "https://vndb.org/v12702");
		assert.match(packed.text, /视觉小说/);
		assert.match(packed.text, /COMPILE HEART Inc\./);
		assert.match(packed.text, /A game\./);
		assert.doesNotMatch(packed.text, /\[url/);
	});
});

describe("formatRanobeBook", () => {
	it("lists the series volumes, author and publisher", () => {
		const packed = formatRanobeBook({
			book: {
				id: 7294,
				title: "Date A Live, Vol. 1",
				title_orig: "デート・ア・ライブ 十香デッドエンド",
				editions: [
					{
						staff: [
							{ role_type: "author", name: "橘公司" },
							{ role_type: "artist", name: "つなこ" },
						],
					},
				],
				publishers: [
					{
						publisher_type: "imprint",
						name: "富士見ファンタジア文庫",
						romaji: "Fujimi Fantasia Bunko",
						lang: "ja",
					},
				],
				releases: [
					{
						release_date: 20110325,
						title: "十香デッドエンド",
						format: "print",
						isbn13: "9784829136232",
					},
				],
				series: {
					title_orig: "デート・ア・ライブ",
					books: [
						{ title_orig: "デート・ア・ライブ 十香デッドエンド" },
						{ title_orig: "デート・ア・ライブ2 四糸乃パペット" },
					],
				},
			},
		});
		assert.match(packed.text, /橘公司/);
		assert.match(packed.text, /富士見ファンタジア文庫/);
		assert.match(packed.text, /四糸乃パペット/);
		assert.match(packed.text, /ISBN 9784829136232/);
		assert.equal(formatYmd(20111199), "2011-11");
	});
});

describe("NDL OpenSearch", () => {
	const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>デート・ア・ライブ : 十香デッドエンド</title>
  <link>https://ndlsearch.ndl.go.jp/books/R1</link>
  <dc:title>デート・ア・ライブ : 十香デッドエンド</dc:title>
  <dc:creator>橘公司</dc:creator>
  <dc:publisher>KADOKAWA</dc:publisher>
  <dcterms:issued>2011.3</dcterms:issued>
  <dc:identifier xsi:type="dcndl:ISBN">978-4-8291-3623-2</dc:identifier>
  <category>図書</category>
</item>
<item>
  <dc:title>デート・ア・ライブつなこ画集 SPIRIT</dc:title>
  <link>https://ndlsearch.ndl.go.jp/books/R2</link>
  <dcterms:issued>2014.1</dcterms:issued>
  <dc:identifier xsi:type="dcndl:ISBN">978-4-04-072183-5</dc:identifier>
  <category>図書</category>
</item>
<item>
  <dc:title>選んでデート・ア・ライブ</dc:title>
  <link>https://ndlsearch.ndl.go.jp/books/R3</link>
  <dc:identifier xsi:type="dcndl:ISBN">978-0-0000-0000-0</dc:identifier>
  <category>図書</category>
</item>
</channel></rss>`;

	it("keeps the matching tankobon and drops artbooks and mid-title hits", () => {
		const selected = selectNdlBooks(parseNdlRss(xml), ["デート・ア・ライブ"]);
		assert.deepEqual(
			selected.map((item) => item.isbn),
			["978-4-8291-3623-2"],
		);
		const packed = formatNdlBooks(selected);
		assert.match(packed.text, /国立国会图书馆サーチ/);
		assert.match(packed.text, /978-4-8291-3623-2/);
		assert.doesNotMatch(packed.text, /画集/);
	});
});

describe("bilibili game wiki roster", () => {
	const html = `<table><tr><th>名称</th><th>域名</th></tr>
<tr><td>原神</td><td><a href="https://wiki.biligame.com/ys">wiki.biligame.com/ys</a></td></tr>
<tr><td>碧蓝航线WIKI</td><td><a href="http://wiki.biligame.com/blhx">wiki.biligame.com/blhx</a></td></tr>
<tr><td>别的站</td><td><a href="https://example.com/nope">example.com/nope</a></td></tr>
</table>`;

	it("reads subwiki codes and matches only the game whose name fits", () => {
		const rows = parseBiliRoster(html);
		assert.deepEqual(
			rows.map((row) => row.code),
			["ys", "blhx"],
		);
		assert.equal(pickBiliWiki(rows, ["原神"])?.code, "ys");
		assert.equal(pickBiliWiki(rows, ["碧蓝航线"])?.code, "blhx");
		assert.equal(pickBiliWiki(rows, ["约会大作战"]), null);
	});
});
