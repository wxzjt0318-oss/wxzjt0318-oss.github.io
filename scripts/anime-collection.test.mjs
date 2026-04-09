import { describe, expect, it } from "vitest";

import { mergeCollectionData } from "../src/utils/anime-collection.js";

describe("mergeCollectionData", () => {
	it("merges fresh entries and keeps newer values", () => {
		const cached = [
			{ subject_id: 1, updated_at: "2024-01-01T00:00:00Z", subject: { name: "A" } },
			{ subject_id: 2, updated_at: "2024-01-01T00:00:00Z", subject: { name: "B" } },
		];
		const fresh = [
			{ subject_id: 1, updated_at: "2024-02-01T00:00:00Z", subject: { name: "A2" } },
			{ subject_id: 3, updated_at: "2024-02-01T00:00:00Z", subject: { name: "C" } },
		];

		const merged = mergeCollectionData(cached, fresh);
		expect(merged).toHaveLength(3);
		expect(merged.find((x) => x.subject_id === 1)?.subject.name).toBe("A2");
	});

	it("keeps cached value when fresh data is older", () => {
		const cached = [
			{ subject_id: 2, updated_at: "2024-01-01T00:00:00Z", subject: { name: "B" } },
		];
		const olderFresh = [
			{ subject_id: 2, updated_at: "2023-01-01T00:00:00Z", subject: { name: "B-old" } },
		];

		const merged = mergeCollectionData(cached, olderFresh);
		expect(merged.find((x) => x.subject_id === 2)?.subject.name).toBe("B");
	});
});
