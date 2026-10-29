import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveLicenseConfig } from "../../src/utils/license-utils.ts";

const base = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

test("falls back to the site config and site author without an override", () => {
	assert.deepEqual(resolveLicenseConfig(base, null, "Site Author"), {
		...base,
		author: { name: "Site Author", url: "" },
		source: "",
	});
});

test("merges omitted license fields from the site config", () => {
	assert.deepEqual(
		resolveLicenseConfig(base, { name: "CC BY 4.0" }, "Site Author"),
		{
			enable: true,
			name: "CC BY 4.0",
			url: base.url,
			author: { name: "Site Author", url: "" },
			source: "",
		},
	);
});

test("accepts a string shorthand for the license name", () => {
	assert.deepEqual(
		resolveLicenseConfig(base, "CC BY 4.0", "Site Author"),
		{
			enable: true,
			name: "CC BY 4.0",
			url: base.url,
			author: { name: "Site Author", url: "" },
			source: "",
		},
	);
});

test("supports an author string or an author object with a link", () => {
	assert.deepEqual(
		resolveLicenseConfig(base, { author: "Guest" }, "Site Author").author,
		{ name: "Guest", url: "" },
	);
	assert.deepEqual(
		resolveLicenseConfig(
			base,
			{ author: { name: "Guest", url: "https://example.com/guest" } },
			"Site Author",
		).author,
		{ name: "Guest", url: "https://example.com/guest" },
	);
});

test("carries the reprint source and lets the post override enable", () => {
	const resolved = resolveLicenseConfig(
		base,
		{
			enable: false,
			name: "All Rights Reserved",
			url: "https://example.com/rights",
			source: "https://original.example/post",
		},
		"Site Author",
	);

	assert.equal(resolved.enable, false);
	assert.equal(resolved.name, "All Rights Reserved");
	assert.equal(resolved.url, "https://example.com/rights");
	assert.equal(resolved.source, "https://original.example/post");
});

test("falls back to the site config for blank name or url", () => {
	assert.deepEqual(
		resolveLicenseConfig(base, { name: "  ", url: "" }, "Site Author"),
		{
			...base,
			author: { name: "Site Author", url: "" },
			source: "",
		},
	);
});
