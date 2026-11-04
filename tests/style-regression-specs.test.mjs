import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	EXCLUDED_STYLE_SPECS,
	listStyleRegressionSpecs,
} from "../scripts/ci/list-style-regression-specs.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SITE_TESTS = join(ROOT, "tests", "site");

test("style runner includes every applicable site spec and excludes local-only suites", () => {
	const discovered = readdirSync(SITE_TESTS)
		.filter((name) => name.endsWith(".spec.ts"))
		.sort();
	const expected = discovered.filter((name) => !EXCLUDED_STYLE_SPECS.has(name));

	assert.deepEqual(listStyleRegressionSpecs(), expected);
	assert.equal(expected.length, discovered.length - EXCLUDED_STYLE_SPECS.size);
	assert.ok(expected.includes("series.spec.ts"));
	assert.ok(expected.includes("taxonomy.spec.ts"));
	assert.ok(!expected.includes("visual.spec.ts"));
	assert.ok(!expected.includes("comments.spec.ts"));
	assert.ok(!expected.includes("waline.spec.ts"));
});
