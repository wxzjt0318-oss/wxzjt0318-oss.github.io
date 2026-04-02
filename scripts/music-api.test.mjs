import assert from "assert/strict";
import { fetchMetingListWithFailover } from "../src/utils/music-api.js";

function createDualFetch(primaryHandlers, backupHandlers) {
	let primaryCalls = 0;
	let backupCalls = 0;
	const fetchImpl = async (url) => {
		if (url.includes("primary.test")) {
			const handler =
				primaryHandlers[primaryCalls] ??
				primaryHandlers[primaryHandlers.length - 1];
			primaryCalls += 1;
			if (handler.throw) throw handler.throw;
			return {
				ok: handler.ok,
				status: handler.status ?? (handler.ok ? 200 : 500),
				json: async () => handler.json,
			};
		}
		if (url.includes("backup.test")) {
			const handler =
				backupHandlers[backupCalls] ?? backupHandlers[backupHandlers.length - 1];
			backupCalls += 1;
			if (handler.throw) throw handler.throw;
			return {
				ok: handler.ok,
				status: handler.status ?? (handler.ok ? 200 : 500),
				json: async () => handler.json,
			};
		}
		throw new Error("Unknown URL");
	};
	fetchImpl.getCounts = () => ({ primaryCalls, backupCalls });
	return fetchImpl;
}

const commonArgs = {
	primaryApi:
		"https://primary.test?server=:server&type=:type&id=:id&auth=:auth&r=:r",
	backupApi:
		"https://backup.test?server=:server&type=:type&id=:id&auth=:auth&r=:r",
	server: "netease",
	type: "playlist",
	id: "123",
	timeoutMs: 5000,
	maxRetries: 3,
	retryDelayMs: 1,
	unknownSong: "Unknown Song",
	unknownArtist: "Unknown Artist",
};

const fetch1 = createDualFetch(
	[
		{
			ok: true,
			json: {
				data: [
					{ id: 1, name: "Song A", artist: "Artist A", duration: 120, url: "u" },
				],
			},
		},
	],
	[]
);
const result1 = await fetchMetingListWithFailover({
	...commonArgs,
	fetchImpl: fetch1,
});
assert.equal(result1.usedBackup, false);
assert.equal(result1.list.length, 1);
assert.equal(result1.list[0].title, "Song A");

const fetch2 = createDualFetch(
	[
		{ ok: false, status: 500, json: {} },
		{ ok: false, status: 500, json: {} },
		{ ok: false, status: 500, json: {} },
	],
	[
		{
			ok: true,
			json: [
				{
					id: 2,
					title: "Song B",
					author: "Artist B",
					duration: 10001,
					url: "u2",
					pic: "c2",
				},
			],
		},
	]
);
const result2 = await fetchMetingListWithFailover({
	...commonArgs,
	fetchImpl: fetch2,
});
assert.equal(result2.usedBackup, true);
assert.equal(result2.list.length, 1);
assert.equal(result2.list[0].duration, 10);
const counts2 = fetch2.getCounts();
assert.equal(counts2.primaryCalls, 3);
assert.equal(counts2.backupCalls, 1);

const fetch3 = createDualFetch(
	[
		{ throw: new Error("network") },
		{ throw: new Error("network") },
		{ throw: new Error("network") },
	],
	[
		{ ok: false, status: 500, json: {} },
		{ ok: false, status: 500, json: {} },
		{ ok: false, status: 500, json: {} },
	]
);
let failed = false;
try {
	await fetchMetingListWithFailover({
		...commonArgs,
		fetchImpl: fetch3,
	});
} catch {
	failed = true;
}
assert.equal(failed, true);

console.log("music-api.test.mjs passed");
