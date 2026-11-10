/**
 * 主题曲资料解析：Bangumi 关联音乐条目、Shikimori 搜索结果挑选与 OP / ED 列表、Wikidata 动画条目挑选。离线运行。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMalThemeSongs, pickWikidataItems } from "../scripts/wiki/linked-sources.mjs";
import {
	describeMusicSubject,
	describeShikimori,
	pickMusicRelations,
	pickShikimoriAnime,
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

describe("Shikimori", () => {
	const results = [
		{ id: 20021, name: "Sword Art Online: Extra Edition", kind: "special" },
		{ id: 11757, name: "Sword Art Online", kind: "tv" },
	];

	it("picks the exact English name, preferring TV", () => {
		assert.equal(pickShikimoriAnime(results, ["Sword Art Online"]).id, 11757);
		assert.equal(pickShikimoriAnime(results, ["Another Title"]), null);
	});

	it("lists opening and ending videos only", () => {
		const text = describeShikimori(
			{ name: "Sword Art Online", japanese: ["ソードアート・オンライン"], kind: "tv", episodes: 25, studios: [{ name: "A-1 Pictures" }] },
			[{ kind: "op", name: "crossing field" }, { kind: "pv", name: "PV" }, { kind: "ed", name: "Yume Sekai" }],
		);
		assert.match(text, /日文名：ソードアート・オンライン/);
		assert.match(text, /制作公司：A-1 Pictures/);
		assert.match(text, /OP｜crossing field/);
		assert.match(text, /ED｜Yume Sekai/);
		assert.doesNotMatch(text, /PV/);
	});
});

describe("pickWikidataItems with adaptations", () => {
	const claim = (value) => [{ mainsnak: { datavalue: { value } } }];
	const tvType = claim({ id: "Q63952888" });

	it("accepts an anime item with no database IDs by its type and Bangumi ID", () => {
		const entities = {
			Q1: { id: "Q1", labels: { ja: { value: "ソードアート・オンライン" } }, claims: { P4087: claim("1") } },
			Q2: { id: "Q2", labels: { ja: { value: "劇場版" } }, claims: { P4086: claim("2") } },
			Q3: { id: "Q3", labels: { ja: { value: "ソードアート・オンライン" } }, claims: { P31: tvType, P5732: claim("23686") } },
		};
		const { anime, source } = pickWikidataItems(entities, { ja: ["ソードアート・オンライン"], bangumiId: "23686" });
		assert.equal(anime.id, "Q3");
		assert.equal(source.id, "Q1");
	});

	it("rejects adaptations whose name and Bangumi ID do not match when a minimum score is set", () => {
		const entities = { Q2: { id: "Q2", labels: { ja: { value: "劇場版" } }, claims: { P4086: claim("2") } } };
		assert.equal(pickWikidataItems(entities, { ja: ["ソードアート・オンライン"], minScore: 2 }).anime, null);
	});

	it("prefers the TV series among several adaptations", () => {
		const entities = {
			Q10: { id: "Q10", labels: { ja: { value: "劇場版" } }, claims: { P4086: claim("1") } },
			Q11: { id: "Q11", labels: { ja: { value: "TV" } }, claims: { P4086: claim("2"), P31: tvType } },
		};
		assert.equal(pickWikidataItems(entities, {}).anime.id, "Q11");
	});
});

describe("parseMalThemeSongs", () => {
	it("splits MAL theme-song rows into openings and endings", () => {
		const html = `<div class="theme-songs js-theme-songs opnening"><table><tr>
			<td width="84%"><span class="theme-song-index">1:</span> <span class="theme-song-title">&quot;crossing field&quot;</span> <span class="theme-song-artist">by LiSA</span> <span class="theme-song-episode">(eps 1-14)</span></td>
			</tr></table></div>
			<div class="theme-songs js-theme-songs ending"><table><tr>
			<td width="84%"><span class="theme-song-title">&quot;Yume Sekai&quot;</span> <span class="theme-song-artist">by Haruka Tomatsu</span></td>
			</tr></table></div>`;
		const text = parseMalThemeSongs(html);
		assert.match(text, /片头曲（OP）：\n {2}1: "crossing field" by LiSA \(eps 1-14\)/);
		assert.match(text, /片尾曲（ED）：\n {2}"Yume Sekai" by Haruka Tomatsu/);
		assert.equal(parseMalThemeSongs("<p>no themes</p>"), "");
	});
});
