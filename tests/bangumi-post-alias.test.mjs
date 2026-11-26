/**
 * 自动发文链接测试：只生成英文 alias，冲突时加年份或序号，不回退到 bangumi-<条目ID>。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	englishAlias,
	uniqueEnglishAlias,
} from "../scripts/generate-bangumi-daily-post.mjs";
import {
	extractEnglishTitle,
	resolveEnglishTitle,
} from "../scripts/wiki/encyclopedia.mjs";

describe("englishAlias", () => {
	it("returns an empty string instead of a numeric fallback", () => {
		assert.equal(englishAlias({ detail: {}, encyclopedia: null, titleCn: "某作品" }), "");
	});

	it("slugifies the English title", () => {
		assert.equal(
			englishAlias({ detail: {}, encyclopedia: { englishTitle: "Frieren: Beyond Journey's End" }, titleCn: "葬送的芙莉莲" }),
			"frieren-beyond-journeys-end",
		);
	});

	it("does not repeat a season number the English title already carries", () => {
		assert.equal(
			englishAlias({
				detail: {},
				encyclopedia: { englishTitle: "Kono Subarashii Sekai ni Shukufuku o 2" },
				titleCn: "为美好的世界献上祝福！ 第二季",
			}),
			"kono-subarashii-sekai-ni-shukufuku-o-season-2",
		);
		assert.equal(
			englishAlias({
				detail: {},
				encyclopedia: { englishTitle: "Overlord II" },
				titleCn: "OVERLORD 第二季",
			}),
			"overlord-season-2",
		);
		assert.equal(
			englishAlias({
				detail: {},
				encyclopedia: { englishTitle: "Kanojo, Okarishimasu 3rd Season" },
				titleCn: "租借女友 第三季",
			}),
			"kanojo-okarishimasu-season-3",
		);
	});

	it("accepts a single-word Latin Bangumi alias", () => {
		assert.equal(
			englishAlias({
				detail: { infobox: [{ key: "别名", value: [{ v: "Overlord" }] }] },
				encyclopedia: null,
				titleCn: "OVERLORD 第二季",
			}),
			"overlord-season-2",
		);
	});

	it("accepts a Bangumi alias whose only extra punctuation is a tilde", () => {
		assert.equal(
			englishAlias({
				detail: {
					infobox: [{
						key: "别名",
						value: [
							{ v: "无职转生 ～在异世界认真地活下去～" },
							{ v: "Jobless Reincarnation ~I Will Seriously Try If I Go to Another World~" },
						],
					}],
				},
				encyclopedia: null,
				titleCn: "无职转生～到了异世界就拿出真本事～",
			}),
			"jobless-reincarnation-i-will-seriously-try-if-i-go-to-another-world",
		);
	});

	it("does not chop Chinese out of a mixed alias", () => {
		assert.equal(
			englishAlias({
				detail: { infobox: [{ key: "别名", value: "OVERLORD 第二季" }] },
				encyclopedia: null,
				titleCn: "OVERLORD 第二季",
			}),
			"",
		);
	});

	it("rejects a Latin alias that is only a format word", () => {
		assert.equal(
			englishAlias({
				detail: { infobox: [{ key: "别名", value: ["2nd Season", "OVA"] }] },
				encyclopedia: null,
				titleCn: "某作品 第二季",
			}),
			"",
		);
	});
});

describe("extractEnglishTitle", () => {
	it("reads 英语 / 英文名 / 英語 labels", () => {
		assert.equal(
			extractEnglishTitle("《葬送的芙莉莲》（日语：葬送のフリーレン，英语：Frieren: Beyond Journey's End）"),
			"Frieren: Beyond Journey's End",
		);
		assert.equal(extractEnglishTitle("英文名：Classroom of the Elite"), "Classroom of the Elite");
		assert.equal(extractEnglishTitle("英語：The Familiar of Zero"), "The Familiar of Zero");
		assert.equal(extractEnglishTitle("英文名称：Mushoku Tensei: Jobless Reincarnation"), "Mushoku Tensei: Jobless Reincarnation");
	});

	it("normalizes a unicode minus and an em dash inside the English title", () => {
		assert.equal(
			extractEnglishTitle("英语：Re:Zero \u2212 Starting Life in Another World"),
			"Re:Zero - Starting Life in Another World",
		);
		assert.equal(
			extractEnglishTitle("英文：Foo \u2014 Bar"),
			"Foo - Bar",
		);
	});

	it("returns empty when the intro has no English label", () => {
		assert.equal(
			extractEnglishTitle("《Re:从零开始的异世界生活》（日语：Re:ゼロから始める異世界生活），为改编自长月达平所著作同名轻小说的电视动画。"),
			"",
		);
		assert.equal(extractEnglishTitle("她教英语，恶魔血统已经很淡。"), "");
	});
});

describe("resolveEnglishTitle", () => {
	it("uses a Latin wiki page title when the extract has no 英语 label", () => {
		assert.equal(
			resolveEnglishTitle({
				title: "OVERLORD (動畫)",
				intro: "《OVERLORD》（日语：オーバーロード）是日本小说家丸山黄金创作的轻小说系列《OVERLORD》，改编电视动画。",
				enwikiTitle: "",
			}),
			"OVERLORD",
		);
	});

	it("uses the English Wikipedia sitelink when the Chinese extract omits the English name", () => {
		assert.equal(
			resolveEnglishTitle({
				title: "Re:從零開始的異世界生活 (動畫)",
				intro: "《Re:从零开始的异世界生活》（日语：Re:ゼロから始める異世界生活），为改编自长月达平所著作同名轻小说的电视动画，由WHITE FOX制作。",
				enwikiTitle: "Re:Zero (TV series)",
			}),
			"Re:Zero",
		);
		assert.equal(
			resolveEnglishTitle({
				title: "零之使魔",
				intro: "《零之使魔》（ゼロの使い魔）是一部由山口升创作的轻小说，曾被改编为动画。",
				enwikiTitle: "The Familiar of Zero",
			}),
			"The Familiar of Zero",
		);
	});

	it("prefers an explicit 英语 label over the sitelink", () => {
		assert.equal(
			resolveEnglishTitle({
				title: "无职转生",
				intro: "《无职转生》（日语：無職転生，英语：Mushoku Tensei: Jobless Reincarnation）是轻小说。",
				enwikiTitle: "Mushoku Tensei",
			}),
			"Mushoku Tensei: Jobless Reincarnation",
		);
	});

	it("does not invent a title from Chinese prose or a list sitelink", () => {
		assert.equal(
			resolveEnglishTitle({
				title: "爱神巧克力",
				intro: "《爱神巧克力进行时》是于2015年1月1日开始在腾讯动漫连载的漫画作品。",
				enwikiTitle: "",
			}),
			"",
		);
		assert.equal(
			resolveEnglishTitle({
				title: "零之使魔",
				intro: "《零之使魔》是一部动画。",
				enwikiTitle: "List of The Familiar of Zero episodes",
			}),
			"",
		);
	});
});

describe("uniqueEnglishAlias", () => {
	it("keeps a free alias", () => {
		assert.equal(uniqueEnglishAlias("working", new Set(), "2010"), "working");
	});

	it("adds the air year, then a counter", () => {
		assert.equal(uniqueEnglishAlias("working", new Set(["working"]), "2010"), "working-2010");
		assert.equal(
			uniqueEnglishAlias("working", new Set(["working", "working-2010"]), "2010"),
			"working-2",
		);
		assert.equal(uniqueEnglishAlias("working", new Set(["working", "working-2"]), ""), "working-3");
	});
});
