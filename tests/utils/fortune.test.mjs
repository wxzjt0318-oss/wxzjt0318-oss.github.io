import assert from "node:assert/strict";
import { test } from "node:test";

const { dateSeed, drawLot, getAlmanac } = await import(
	"../../src/utils/fortune.ts"
);

test("the almanac is the same for everyone on the same day", () => {
	assert.deepEqual(getAlmanac("2026-11-13"), getAlmanac("2026-11-13"));
	assert.notDeepEqual(getAlmanac("2026-11-13"), getAlmanac("2026-11-14"));
});

test("good and bad never share an activity, and counts stay in range", () => {
	for (let day = 1; day <= 28; day++) {
		const almanac = getAlmanac(`2026-11-${String(day).padStart(2, "0")}`);
		assert.ok(almanac.good.length >= 2 && almanac.good.length <= 4);
		assert.ok(almanac.bad.length >= 2 && almanac.bad.length <= 4);
		const names = [...almanac.good, ...almanac.bad].map((entry) => entry.name);
		assert.equal(new Set(names).size, names.length);
		assert.ok(names.every((name) => !name.includes("{n}")));
		assert.ok(almanac.stars >= 1 && almanac.stars <= 5);
		assert.equal(almanac.drinks.length, 2);
	}
});

test("weekday-only activities stay out of weekends", () => {
	// 2026-11-14 / 15 是周六、周日
	for (const date of ["2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"]) {
		const names = [...getAlmanac(date).good, ...getAlmanac(date).bad].map(
			(entry) => entry.name,
		);
		for (const name of ["开会", "面试", "上线发布", "申请加薪"])
			assert.ok(!names.includes(name));
	}
});

test("a lot is fixed per day and topic, and unknown topics fall back to 其他", () => {
	assert.deepEqual(
		drawLot("2026-11-13", "coding"),
		drawLot("2026-11-13", "coding"),
	);
	const lot = drawLot("2026-11-13", "commit");
	assert.ok(lot.rank.verses.includes(lot.verse));
	assert.ok(lot.advice.length > 0);
	assert.deepEqual(
		drawLot("2026-11-13", "nope"),
		drawLot("2026-11-13", "other"),
	);
});

test("every rank is reachable over a year of draws", () => {
	const seen = new Set();
	for (let day = 1; day <= 365; day++) {
		const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
		seen.add(drawLot(date, "coding").rank.id);
	}
	assert.deepEqual([...seen].sort(), ["bad", "fair", "good", "great", "plain"]);
});

test("dateSeed rejects malformed dates", () => {
	assert.equal(dateSeed("2026-11-13"), 20261113);
	assert.equal(dateSeed("nope"), 0);
});
