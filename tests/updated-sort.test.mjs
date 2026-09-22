/**
 * 「最近修改数据的时间」倒序排序（番剧页 / 游戏页共享语义）的单元测试。
 *
 * 覆盖：主键倒序、缺失/相同时间的次级排序与输入顺序兜底、纯函数不改入参，
 * 以及用户实例（最近改过的条目必须排最前）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	parseUpdatedTime,
	sortByUpdatedAtDesc,
} from "../src/utils/updated-sort.ts";

test("parseUpdatedTime: 可解析返回时间戳，空/非法返回 0", () => {
	assert.equal(parseUpdatedTime("2026-09-20T19:26:50+08:00"), 1789903610000);
	assert.equal(parseUpdatedTime(""), 0);
	assert.equal(parseUpdatedTime(null), 0);
	assert.equal(parseUpdatedTime(undefined), 0);
	assert.equal(parseUpdatedTime("not-a-date"), 0);
});

test("sortByUpdatedAtDesc: 最近修改的排最前（倒序）", () => {
	const items = [
		{ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" },
		{ id: "newest", updatedAt: "2026-09-20T00:00:00.000Z" },
		{ id: "mid", updatedAt: "2026-05-01T00:00:00.000Z" },
	];
	const sorted = sortByUpdatedAtDesc(items, (i) => i.updatedAt);
	assert.deepEqual(
		sorted.map((i) => i.id),
		["newest", "mid", "old"],
	);
});

test("sortByUpdatedAtDesc: 时间缺失视为最早，排在有时者之后", () => {
	const items = [
		{ id: "none" },
		{ id: "has", updatedAt: "2026-09-01T00:00:00.000Z" },
	];
	const sorted = sortByUpdatedAtDesc(items, (i) => i.updatedAt);
	assert.deepEqual(
		sorted.map((i) => i.id),
		["has", "none"],
	);
});

test("sortByUpdatedAtDesc: 时间相同用 tieBreak，再相同保持输入顺序（稳定）", () => {
	const same = "2026-09-01T00:00:00.000Z";
	const items = [
		{ id: "b", rank: 2, updatedAt: same },
		{ id: "a", rank: 1, updatedAt: same },
		{ id: "c", rank: 1, updatedAt: same },
	];
	const sorted = sortByUpdatedAtDesc(
		items,
		(i) => i.updatedAt,
		(x, y) => x.rank - y.rank,
	);
	// rank 1 在前；同为 rank 1 的 a、c 保持输入顺序（a 在 c 前）
	assert.deepEqual(
		sorted.map((i) => i.id),
		["a", "c", "b"],
	);
});

test("sortByUpdatedAtDesc: 纯函数，不修改入参", () => {
	const items = [
		{ id: "x", updatedAt: "2026-01-01T00:00:00.000Z" },
		{ id: "y", updatedAt: "2026-09-01T00:00:00.000Z" },
	];
	const before = items.map((i) => i.id);
	const sorted = sortByUpdatedAtDesc(items, (i) => i.updatedAt);
	assert.deepEqual(
		items.map((i) => i.id),
		before,
		"入参数组顺序不应被修改",
	);
	assert.notEqual(sorted, items, "应返回新数组");
});

test("sortByUpdatedAtDesc: 用户实例——最近看完的那部排在其他条目之前", () => {
	// 昨天刚更新了《地狱模式…第二季》第十二集的数据，它应排最前
	const items = [
		{ title: "其他老番 A", updatedAt: "2026-05-01T00:00:00.000Z" },
		{ title: "其他老番 B", updatedAt: "2026-06-01T00:00:00.000Z" },
		{
			title: "地狱模式～喜欢挑战特殊成就的玩家在废设定的异世界成为无双～第二季",
			updatedAt: "2026-09-19T20:56:17.000Z",
		},
	];
	const sorted = sortByUpdatedAtDesc(items, (i) => i.updatedAt);
	assert.equal(
		sorted[0].title,
		"地狱模式～喜欢挑战特殊成就的玩家在废设定的异世界成为无双～第二季",
	);
});
