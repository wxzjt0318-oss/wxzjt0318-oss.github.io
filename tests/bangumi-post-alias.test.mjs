/**
 * 自动发文链接测试：只生成英文 alias，冲突时加年份或序号，不回退到 bangumi-<条目ID>。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	englishAlias,
	uniqueEnglishAlias,
} from "../scripts/generate-bangumi-daily-post.mjs";

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
