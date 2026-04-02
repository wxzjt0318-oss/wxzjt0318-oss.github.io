import assert from "assert/strict";
import { mergeCollectionData } from "../src/utils/anime-collection.js";

const cached = [
  { subject_id: 1, updated_at: "2024-01-01T00:00:00Z", subject: { name: "A" } },
  { subject_id: 2, updated_at: "2024-01-01T00:00:00Z", subject: { name: "B" } },
];
const fresh = [
  { subject_id: 1, updated_at: "2024-02-01T00:00:00Z", subject: { name: "A2" } },
  { subject_id: 3, updated_at: "2024-02-01T00:00:00Z", subject: { name: "C" } },
];

const merged = mergeCollectionData(cached, fresh);
assert.equal(merged.length, 3);
const updated = merged.find((x) => x.subject_id === 1);
assert.equal(updated.subject.name, "A2");

const olderFresh = [
  { subject_id: 2, updated_at: "2023-01-01T00:00:00Z", subject: { name: "B-old" } },
];
const merged2 = mergeCollectionData(cached, olderFresh);
const unchanged = merged2.find((x) => x.subject_id === 2);
assert.equal(unchanged.subject.name, "B");

console.log("anime-collection.test.mjs passed");
