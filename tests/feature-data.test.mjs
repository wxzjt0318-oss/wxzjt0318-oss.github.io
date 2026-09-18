import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	filterByDisabledKeys,
	resolveDevicesData,
	resolveProjectsData,
	resolveSkillsData,
	resolveTimelineData,
} from "../src/utils/feature-data.ts";

describe("Feature Data & Resolver Tests", () => {
	it("filterByDisabledKeys correctly filters items by key/id/name/title", () => {
		const items = [
			{ key: "item-1", name: "One" },
			{ key: "item-2", name: "Two" },
			{ key: "item-3", name: "Three" },
		];

		const filtered = filterByDisabledKeys(items, ["item-2"]);
		assert.equal(filtered.length, 2);
		assert.deepEqual(
			filtered.map((i) => i.key),
			["item-1", "item-3"],
		);
	});

	it("resolveProjectsData applies disabledKeys correctly", () => {
		const items = [
			{ key: "project-a", name: "A" },
			{ key: "project-b", name: "B" },
			{ key: "project-c", name: "C" },
		];
		const config = {
			enable: true,
			categories: [],
			disabledKeys: ["project-b"],
		};
		const resolved = resolveProjectsData(config, items);
		assert.ok(resolved.some((p) => p.key === "project-a"));
		assert.ok(resolved.some((p) => p.key === "project-c"));
		assert.ok(!resolved.some((p) => p.key === "project-b"));
	});

	it("resolveSkillsData applies disabledNames correctly", () => {
		const config = {
			enable: true,
			categories: [],
			disabledNames: ["PHP"],
		};
		const resolved = resolveSkillsData(config);
		assert.ok(resolved.some((s) => s.name === "TypeScript"));
		assert.ok(!resolved.some((s) => s.name === "PHP"));
	});

	it("resolveTimelineData applies disabledTitles and order correctly", () => {
		const items = [
			{ title: "Senior Frontend Engineer", date: "2024.01" },
			{
				title: "Computer Science & Engineering Degree",
				date: "2020.09 – 2024.06",
			},
		];
		const config = {
			enable: true,
			categories: [],
			order: "asc",
			disabledTitles: ["Senior Frontend Engineer"],
		};
		const resolved = resolveTimelineData(config, items);
		assert.ok(!resolved.some((t) => t.title === "Senior Frontend Engineer"));
		// asc 排序下最旧的条目应排在首位
		assert.equal(resolved[0].title, "Computer Science & Engineering Degree");
	});

	it("resolveTimelineData sorts correctly by date in desc and asc order", () => {
		const customItems = [
			{ title: "Old", date: "2021.05" },
			{ title: "Recent", date: "2024.10" },
			{ title: "Present", date: "2025.01 - Present" },
			{ title: "Middle", date: "2023.01" },
		];
		const descRes = resolveTimelineData({ order: "desc" }, customItems);
		assert.deepEqual(
			descRes.map((i) => i.title),
			["Present", "Recent", "Middle", "Old"],
		);

		const ascRes = resolveTimelineData({ order: "asc" }, customItems);
		assert.deepEqual(
			ascRes.map((i) => i.title),
			["Old", "Middle", "Recent", "Present"],
		);
	});

	it("resolveDevicesData applies disabledIds correctly", () => {
		const items = [
			{ id: "device-a", name: "A" },
			{ id: "device-b", name: "B" },
		];
		const config = {
			enable: true,
			categories: [],
			disabledIds: ["device-b"],
		};
		const resolved = resolveDevicesData(config, items);
		assert.ok(resolved.some((d) => d.id === "device-a"));
		assert.ok(!resolved.some((d) => d.id === "device-b"));
	});
});
