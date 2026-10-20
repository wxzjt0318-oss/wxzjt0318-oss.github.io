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
