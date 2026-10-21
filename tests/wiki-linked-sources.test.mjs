/**
 * 关联来源解析：Wikidata 条目挑选、しょぼいカレンダー XML、wikitext 清理、单行本汇总。离线运行。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cleanWikitext,
	htmlToText,
	parseSyoboiTitle,
	pickWikidataItems,
	summarizeMediaArtsBooks,
} from "../scripts/wiki/linked-sources.mjs";

const claim = (value) => [{ mainsnak: { datavalue: { value } } }];

describe("pickWikidataItems", () => {
	const entities = {
		Q1: { id: "Q1", labels: { ja: { value: "よわよわ先生" } }, claims: { P4087: claim("154376") } },
		Q2: { id: "Q2", labels: { ja: { value: "別の作品" } }, claims: { P4086: claim("1") } },
		Q3: { id: "Q3", labels: { ja: { value: "よわよわ先生" } }, claims: { P4086: claim("60444"), P11648: claim("7771") } },
	};

	it("prefers the anime item whose Japanese label matches", () => {
		const { anime, source } = pickWikidataItems(entities, { ja: ["よわよわ先生"] });
		assert.equal(anime.id, "Q3");
		assert.equal(source.id, "Q1");
	});

	it("prefers an item carrying the same Bangumi ID", () => {
		const withBangumi = { ...entities, Q2: { ...entities.Q2, claims: { ...entities.Q2.claims, P5732: claim("526789") } } };
		assert.equal(pickWikidataItems(withBangumi, { ja: ["よわよわ先生"], bangumiId: "526789" }).anime.id, "Q2");
	});

	it("returns nulls when nothing qualifies", () => {
		assert.deepEqual(pickWikidataItems({}, {}), { anime: null, source: null });
	});
});

describe("parseSyoboiTitle", () => {
	it("keeps staff, cast and episode titles", () => {
		const xml = `<TitleItem><Title>よわよわ先生</Title><TitleYomi>よわよわせんせい</TitleYomi><Comment>*スタッフ
:監督:石踊宏
*キャスト
:鶸村ひより:高野麻里佳</Comment><FirstYear>2026</FirstYear><FirstMonth>4</FirstMonth><FirstEndYear>2026</FirstEndYear><FirstEndMonth>6</FirstEndMonth><FirstCh>AT-X</FirstCh><SubTitles>*01*こわこわ先生</SubTitles></TitleItem>`;
		const parsed = parseSyoboiTitle(xml);
		assert.equal(parsed.title, "よわよわ先生");
		assert.match(parsed.text, /首播：2026年4月 — 2026年6月/);
		assert.match(parsed.text, /首播电视台：AT-X/);
		assert.match(parsed.text, /:監督:石踊宏/);
		assert.match(parsed.text, /\*01\*こわこわ先生/);
	});

	it("returns null for an error response", () => {
		assert.equal(parseSyoboiTitle("<Result><Code>400</Code></Result>"), null);
	});
});

describe("cleanWikitext", () => {
	it("drops templates and keeps link text", () => {
		const text = cleanWikitext("{{Infobox|a=1|b={{x}}}}{{Nihongo|Hiyori Hiwamura|鶸村 ひより|Hiwamura}} is the '''heroine''' of [[Yowayowa Sensei|the series]].<ref>x</ref>");
		assert.equal(text, "Hiyori Hiwamura（鶸村 ひより） is the heroine of the series.");
	});
});

describe("htmlToText", () => {
	it("strips scripts and tags, decodes entities", () => {
		assert.equal(htmlToText("<script>x</script><p>A &amp; B</p><div>C&#39;s</div>"), "A & B\nC's");
	});
});

describe("summarizeMediaArtsBooks", () => {
	it("keeps one row per volume, preferring rows with an ISBN", () => {
		const rows = summarizeMediaArtsBooks([
			{ vol: { value: "2" }, date: { value: "2023-05" }, pub: { value: "講談社　∥　コウダンシャ" }, label: { value: "よわよわ先生 2" } },
			{ vol: { value: "1" }, date: { value: "2023-03-16" }, pub: { value: "講談社" }, label: { value: "よわよわ先生 1" } },
			{ vol: { value: "1" }, date: { value: "2023-03-16" }, pub: { value: "講談社" }, isbn: { value: "9784065309964" }, label: { value: "よわよわ先生 1" } },
		]);
		assert.deepEqual(rows, [
			"よわよわ先生 1｜2023-03-16｜講談社｜ISBN 9784065309964",
			"よわよわ先生 2｜2023-05｜講談社",
		]);
	});
});
