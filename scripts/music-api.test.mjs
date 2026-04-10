import { describe, expect, it } from "vitest";

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
				backupHandlers[backupCalls] ??
				backupHandlers[backupHandlers.length - 1];
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

describe("fetchMetingListWithFailover", () => {
	it("uses primary API when it succeeds", async () => {
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
			[],
		);
		const result = await fetchMetingListWithFailover({
			...commonArgs,
			fetchImpl: fetch1,
		});
		expect(result.usedBackup).toBe(false);
		expect(result.list).toHaveLength(1);
		expect(result.list[0].title).toBe("Song A");
	});

	it("falls back to backup API after primary failures", async () => {
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
			],
		);
		const result = await fetchMetingListWithFailover({
			...commonArgs,
			fetchImpl: fetch2,
		});
		expect(result.usedBackup).toBe(true);
		expect(result.list).toHaveLength(1);
		expect(result.list[0].duration).toBe(10);
		const counts = fetch2.getCounts();
		expect(counts.primaryCalls).toBe(3);
		expect(counts.backupCalls).toBe(1);
	});

	it("throws when both primary and backup fail", async () => {
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
			],
		);

		await expect(
			fetchMetingListWithFailover({
				...commonArgs,
				fetchImpl: fetch3,
			}),
		).rejects.toBeTruthy();
	});
});
