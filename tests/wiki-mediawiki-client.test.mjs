/**
 * MediaWiki 客户端对 403 挑战页的处理。不访问外网。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMediaWikiClient } from "../scripts/wiki/mediawiki.mjs";

describe("createMediaWikiClient blocked responses", () => {
	it("does not retry a Cloudflare 403 or treat the challenge page as an article", async () => {
		let calls = 0;
		const client = createMediaWikiClient({
			name: "萌娘百科",
			api: "https://zh.moegirl.org.cn/api.php",
			pageBase: "https://zh.moegirl.org.cn/",
			userAgent: "test",
			cacheDir: "",
			fetchImpl: async () => {
				calls += 1;
				return {
					status: 403,
					statusText: "Forbidden",
					ok: false,
					headers: {
						get: (name) =>
							String(name).toLowerCase() === "cf-mitigated"
								? "challenge"
								: null,
					},
				};
			},
		});
		await assert.rejects(
			() => client.fetchArticleForWork("约会大作战 第五季"),
			/Cloudflare 挑战页，未绕过/,
		);
		assert.equal(calls, 1);
	});
});
