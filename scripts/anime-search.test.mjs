import assert from "assert/strict";
import {
	buildAltTitles,
	buildSearchIndex,
	isValidStudio,
	normalizeText,
} from "../src/utils/anime-search.js";

function normalizeQuery(input) {
	if (!input) return "";
	let s = String(input).normalize("NFKC").toLowerCase();
	s = s.replace(/[\u3000\s]+/g, " ");
	s = s.replace(/[·•・]/g, " ");
	s = s.replace(/[’'"]/g, "");
	s = s.replace(/[()（）[\]{}<>《》「」『』【】]/g, " ");
	s = s.replace(/[:：;；,.，。!?！？…~\-_=+|\\/]/g, " ");
	s = s.replace(/[#$%^&*]/g, " ");
	s = s.replace(/\s+/g, " ").trim();
	return s;
}

function compactQuery(input) {
	return normalizeQuery(input).replace(/\s+/g, "");
}

function editDistance(a, b, max) {
	const alen = a.length;
	const blen = b.length;
	if (Math.abs(alen - blen) > max) return max + 1;
	const dp = new Array(blen + 1);
	for (let j = 0; j <= blen; j++) dp[j] = j;
	for (let i = 1; i <= alen; i++) {
		let prev = dp[0];
		dp[0] = i;
		let minRow = dp[0];
		for (let j = 1; j <= blen; j++) {
			const tmp = dp[j];
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const val = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
			dp[j] = val;
			prev = tmp;
			if (val < minRow) minRow = val;
		}
		if (minRow > max) return max + 1;
	}
	return dp[blen];
}

function matchSearchIndex(index, term) {
	if (!term) return true;
	const norm = normalizeQuery(term);
	if (!norm) return true;
	if (index.includes(norm)) return true;
	const compact = compactQuery(term);
	if (compact && index.includes(compact)) return true;
	const tokens = norm.split(" ").filter(Boolean);
	if (tokens.length > 1 && tokens.every((t) => index.includes(t)))
		return true;
	if (norm.length < 3) return false;
	const idxTokens = index.split(/\s+/).filter(Boolean);
	const maxDistance = Math.max(1, Math.floor(norm.length * 0.25));
	for (const tok of idxTokens) {
		if (tok.length < 3) continue;
		if (Math.abs(tok.length - norm.length) > maxDistance) continue;
		if (editDistance(tok, norm, maxDistance) <= maxDistance) return true;
	}
	return false;
}

const altTitles = buildAltTitles(
	"鬼灭之刃 第2季",
	"Demon Slayer: Kimetsu no Yaiba Season 2",
	"劇場版 鬼灭之刃",
);
assert(altTitles.some((t) => t.includes("鬼灭之刃")));
assert(altTitles.some((t) => t.includes("Demon Slayer")));

const index = buildSearchIndex([
	"Re:ゼロから始める異世界生活",
	"Re Zero",
	"异世界",
	"Studio White Fox",
]);
assert(index.includes("re zero"));
assert(index.includes(normalizeText("Re:ゼロから始める異世界生活")));
assert(index.includes("rezero"));
assert(matchSearchIndex(index, "Re Zero"));
assert(matchSearchIndex(index, "Re:ゼロ"));
assert(matchSearchIndex(index, "异世界"));

assert.equal(isValidStudio("WIT STUDIO", "未知"), true);
assert.equal(isValidStudio(undefined, "未知"), false);
assert.equal(isValidStudio("", "未知"), false);
assert.equal(isValidStudio("??", "未知"), false);

console.log("anime-search.test.mjs passed");

