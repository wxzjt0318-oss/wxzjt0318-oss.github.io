/**
 * 主题曲资料解析：Bangumi 关联音乐条目、Jikan 搜索结果挑选与 OP / ED 格式化、アニソンジェネレーション搜索页。离线运行。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickWikidataItems } from "../scripts/wiki/linked-sources.mjs";
import {
	describeMusicSubject,
	formatJikanThemes,
	parseAnisonSearch,
	pickAnisonProgram,
	pickJikanAnime,
	pickMusicRelations,
} from "../scripts/wiki/theme-songs.mjs";

describe("Bangumi music relations", () => {
	it("keeps music relations only, theme songs first", () => {
		const picked = pickMusicRelations([
			{ id: 1, relation: "原声集" },
			{ id: 2, relation: "续集" },
			{ id: 3, relation: "片尾曲" },
			{ id: 4, relation: "片头曲" },
		]);
		assert.deepEqual(picked.map((r) => r.id), [4, 3, 1]);
	});

	it("describes a single with its artist and release date", () => {
		const text = describeMusicSubject("片头曲", {
			name: "crossing field",
			infobox: [
				{ key: "艺术家", value: "LiSA" },
				{ key: "发售日期", value: "2012-08-08" },
				{ key: "播放电视台", value: "无关字段" },
			],
		});
		assert.match(text, /^【片头曲】crossing field/);
		assert.match(text, /艺术家：LiSA/);
		assert.match(text, /发售日期：2012-08-08/);
		assert.doesNotMatch(text, /无关字段/);
	});
});

describe("Jikan", () => {
	const results = [
		{ mal_id: 20021, title: "Sword Art Online: Extra Edition", title_japanese: "ソードアート・オンライン Extra Edition", type: "Special" },
		{ mal_id: 11757, title: "Sword Art Online", title_english: "Sword Art Online", title_japanese: "ソードアート・オンライン", type: "TV" },
	];

	it("prefers the exact Japanese title", () => {
		assert.equal(pickJikanAnime(results, { ja: ["ソードアート・オンライン"] }).mal_id, 11757);
	});

	it("rejects results that match no title", () => {
		assert.equal(pickJikanAnime(results, { ja: ["別の作品"] }), null);
	});

	it("formats openings and endings", () => {
		const text = formatJikanThemes({ openings: ['1: "crossing field" by LiSA (eps 1-14)'], endings: ['1: "Yume Sekai" by Haruka Tomatsu'] });
		assert.match(text, /片头曲（OP）：\n {2}1: "crossing field"/);
		assert.match(text, /片尾曲（ED）：\n {2}1: "Yume Sekai"/);
		assert.equal(formatJikanThemes({ openings: [], endings: [] }), "");
	});
});

describe("アニソンジェネレーション", () => {
	const html = `<a href="/data/program/111.html">ソードアート・オンライン オルタナティブ</a>
		<a href="program/222.html"><b>ソードアート・オンライン</b></a>`;

	it("parses program links and prefers the exact name", () => {
		const list = parseAnisonSearch(html);
		assert.deepEqual(list, [
			{ id: "111", name: "ソードアート・オンライン オルタナティブ" },
			{ id: "222", name: "ソードアート・オンライン" },
		]);
		assert.equal(pickAnisonProgram(list, "ソードアート・オンライン").id, "222");
		assert.equal(pickAnisonProgram([], "x"), null);
	});
});

describe("pickWikidataItems with adaptations", () => {
	const claim = (value) => [{ mainsnak: { datavalue: { value } } }];
	it("prefers the TV series among several adaptations", () => {
		const entities = {
			Q10: { id: "Q10", labels: { ja: { value: "劇場版" } }, claims: { P4086: claim("1") } },
			Q11: { id: "Q11", labels: { ja: { value: "TV" } }, claims: { P4086: claim("2"), P31: claim({ id: "Q63952888" }) } },
		};
		assert.equal(pickWikidataItems(entities, {}).anime.id, "Q11");
	});
});
