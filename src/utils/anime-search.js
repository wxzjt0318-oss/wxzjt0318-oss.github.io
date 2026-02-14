export function normalizeText(input) {
	if (!input) return "";
	let s = String(input).normalize("NFKC").toLowerCase();
	s = s.replace(/[\u3000\s]+/g, " ");
	s = s.replace(/[·•・]/g, " ");
	s = s.replace(/[’'"]/g, "");
	s = s.replace(/[()（）[\]{}<>《》「」『』【】]/g, " ");
	s = s.replace(/[:：;；,.，。!?！？…~\-_=+|\\\/]/g, " ");
	s = s.replace(/[#$%^&*]/g, " ");
	s = s.replace(/\s+/g, " ").trim();
	return s;
}

function stripBracketed(input) {
	if (!input) return "";
	const s = String(input).replace(
		/[\(\（【\[《『「][^)\）】\]》』」]*[\)\）】\]》』」]/g,
		" ",
	);
	return s.replace(/\s+/g, " ").trim();
}

function stripSeason(input) {
	if (!input) return "";
	let s = String(input);
	s = s.replace(/第\s*[0-9一二三四五六七八九十]+\s*(季|期|部)/gi, " ");
	s = s.replace(/\bseason\s*\d+\b/gi, " ");
	s = s.replace(/\b\d+(st|nd|rd|th)\s*season\b/gi, " ");
	s = s.replace(/\bs\s*\d+\b/gi, " ");
	return s.replace(/\s+/g, " ").trim();
}

export function buildAltTitles(...titles) {
	const set = new Set();
	for (const t of titles) {
		const raw = String(t || "").trim();
		if (!raw) continue;
		set.add(raw);
		const noBracket = stripBracketed(raw);
		if (noBracket) set.add(noBracket);
		const noSeason = stripSeason(raw);
		if (noSeason) set.add(noSeason);
		const mix = stripSeason(noBracket);
		if (mix) set.add(mix);
	}
	return Array.from(set);
}

export function buildSearchIndex(tokens) {
	const set = new Set();
	for (const t of tokens || []) {
		const raw = String(t || "").trim();
		if (!raw) continue;
		set.add(raw.toLowerCase());
		const norm = normalizeText(raw);
		if (norm) set.add(norm);
		const compact = norm.replace(/\s+/g, "");
		if (compact) set.add(compact);
	}
	return Array.from(set).join(" ");
}

export function isValidStudio(input, unknownText) {
	if (!input) return false;
	const raw = String(input).trim();
	if (!raw) return false;
	if (unknownText && raw === unknownText) return false;
	const norm = normalizeText(raw);
	if (!norm) return false;
	const lowered = norm.toLowerCase();
	const invalid = new Set([
		"unknown",
		"未知",
		"未定",
		"不明",
		"n/a",
		"na",
		"null",
		"undefined",
	]);
	if (invalid.has(lowered)) return false;
	if (!/[a-z0-9\u4e00-\u9fff]/i.test(norm)) return false;
	return true;
}

