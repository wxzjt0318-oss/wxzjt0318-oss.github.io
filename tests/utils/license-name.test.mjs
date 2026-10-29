import assert from "node:assert/strict";
import { test } from "node:test";

import { licenseOverrideFromName } from "../../src/utils/license-name.ts";
import { resolveLicenseConfig } from "../../src/utils/license-utils.ts";

const base = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

test("maps known Creative Commons names to their deeds", () => {
	assert.deepEqual(licenseOverrideFromName("CC BY-NC-SA 3.0"), {
		name: "CC BY-NC-SA 3.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
	});
	assert.equal(
		licenseOverrideFromName(" CC BY-SA 4.0 ")?.url,
		"https://creativecommons.org/licenses/by-sa/4.0/",
	);
});

test("leaves unknown or empty names to the site config", () => {
	assert.equal(licenseOverrideFromName("Unlicensed"), undefined);
	assert.equal(licenseOverrideFromName(""), undefined);
	assert.equal(licenseOverrideFromName(undefined), undefined);
	const resolved = resolveLicenseConfig(base, licenseOverrideFromName("Unlicensed"), "灵梦");
	assert.equal(resolved.name, base.name);
});

test("a post's licenseName replaces the site license on the card", () => {
	const resolved = resolveLicenseConfig(base, licenseOverrideFromName("CC BY-SA 4.0"), "灵梦");
	assert.equal(resolved.name, "CC BY-SA 4.0");
	assert.equal(resolved.url, "https://creativecommons.org/licenses/by-sa/4.0/");
	assert.equal(resolved.author.name, "灵梦");
});
