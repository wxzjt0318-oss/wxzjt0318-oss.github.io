/**
 * 自动发文的「同一作品」判重：防止为自主编辑文章已经写过的作品再生成一篇。
 * ─────────────────────────────────────────────────────────────────────────────
 * 旧逻辑只比 Bangumi 条目 ID 与中文标题全等，自主编辑文章常常：
 *   - 没有 bgm.tv 链接（sourceLink 为空或指向萌娘百科）；
 *   - 标题带副标题（「《月光下的异世界之旅》——被神抛弃之人的……」）；
 *   - 用了另一种中文译名（安闲 / 安逸领主、关于邻家的天使大人 / 关于我在无意间被隔壁的天使）。
 * 于是同一部作品被重复发文。
 *
 * 新逻辑给每篇文章与候选作品提取一组「身份」：中文标题、日文原名、
 * 萌娘百科 / 维基百科条目名（含 sourceLink 指向的条目），统一成「基础标题 + 季度标记」比较。
 * 季度 / OVA / 剧场版标记不同视为不同作品（第一季与第二季可以各写一篇）。
 */

const CN_NUM = {
	一: 1,
	二: 2,
	三: 3,
	四: 4,
	五: 5,
	六: 6,
	七: 7,
	八: 8,
	九: 9,
	十: 10,
};

function toNumber(raw) {
	if (/^\d+$/.test(raw)) return Number(raw);
	if (raw === "十") return 10;
	if (raw.startsWith("十")) return 10 + (CN_NUM[raw[1]] || 0);
	if (raw.endsWith("十")) return (CN_NUM[raw[0]] || 1) * 10;
	return CN_NUM[raw] || 0;
}

const SEASON_PATTERNS = [
	[/第\s*([一二三四五六七八九十\d]+)\s*[季期幕]/, (m) => `s${toNumber(m[1])}`],
	[/(\d+)\s*(?:st|nd|rd|th)\s*season/i, (m) => `s${Number(m[1])}`],
	[/season\s*(\d+)/i, (m) => `s${Number(m[1])}`],
	[/第\s*(\d+)\s*期/, (m) => `s${Number(m[1])}`],
	[/\s(II|Ⅱ)(?=\s|$)/, () => "s2"],
	[/\s(III|Ⅲ)(?=\s|$)/, () => "s3"],
	[
		/第\s*([一二三四五六七八九十\d]+)\s*部分|第\s*(\d+)\s*クール|part\s*(\d+)|後半|后半/i,
		() => "part",
	],
	[/OVA|OAD/i, () => "ova"],
	[/剧场版|劇場版|电影|映画|movie|总集篇|総集編/i, () => "movie"],
];

/**
 * 季度 / 形式标记集合（排序后拼接），无标记 = 第一季 / TV 本篇。
 * forms：标签或 Bangumi platform 字段（如 "OVA"、"剧场版"），弥补标题里没写形式的特别篇。
 */
export function seasonKey(title, forms = []) {
	const text = [String(title || ""), ...forms].join(" ").normalize("NFKC");
	const keys = new Set();
	for (const [re, key] of SEASON_PATTERNS) {
		const m = text.match(re);
		if (m) keys.add(key(m));
	}
	keys.delete("s1");
	return [...keys].sort().join("+");
}

const STRIP_RE =
	/[《》「」『』【】“”"'‘’()（）[\]{}·•・:：;；,.，。!?！？~～|｜\-－_\s]/g;

/** 拆成「基础标题」与「副标题」（都已去掉季度标记与标点） */
export function splitTitle(title) {
	let text = String(title || "")
		.normalize("NFKC")
		.replace(/^\s*[《「『]/, "")
		.replace(/https?:\/\/[^/]+\//, "");
	try {
		text = decodeURIComponent(text);
	} catch {}
	for (const [re] of SEASON_PATTERNS) text = text.replace(re, " ");
	let sub = "";
	const cut = text.search(/——|―|～|~|｜|\||\s-\S|》/);
	if (cut >= 4) {
		sub = text.slice(cut);
		text = text.slice(0, cut);
	}
	const colon = text.search(/[：:]/);
	if (colon >= 4) {
		sub = text.slice(colon) + sub;
		text = text.slice(0, colon);
	}
	return {
		base: text.toLowerCase().replace(STRIP_RE, ""),
		sub: sub.toLowerCase().replace(STRIP_RE, ""),
	};
}

/** 去掉季度标记与副标题后的基础标题，用于跨译名 / 跨写法比较 */
export function baseTitle(title) {
	return splitTitle(title).base;
}

function identity(name, season) {
	const { base, sub } = splitTitle(name);
	return base.length >= 3 ? { key: `${base}#${season}`, sub } : null;
}

/** 两段文字最长公共子串的长度 */
function longestCommonRun(a, b) {
	let best = 0;
	const prev = new Array(b.length + 1).fill(0);
	for (let i = 1; i <= a.length; i += 1) {
		let diag = 0;
		for (let j = 1; j <= b.length; j += 1) {
			const keep = prev[j];
			prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
			if (prev[j] > best) best = prev[j];
			diag = keep;
		}
	}
	return best;
}

/**
 * 副标题算「同一个」：任一方为空、两者相同，或两者都是长副标题且共享 6 字以上的片段。
 * 最后一种是同一条轻小说长副标题的不同中译（「极致游戏玩家在废设定的异世界无双」与
 * 「喜欢挑战特殊成就的玩家在废设定的异世界成为无双」）；特别篇的短副标题不会因此被合并。
 */
function sameSubtitle(a, b) {
	if (!a || !b || a === b) return true;
	return a.length >= 8 && b.length >= 8 && longestCommonRun(a, b) >= 6;
}

/** 基础标题与季度相同，且副标题算同一个，才算同一作品 */
function sameWork(a, b) {
	return a.key === b.key && sameSubtitle(a.sub, b.sub);
}

/** 从已有文章原文提取身份：标题、原作标题、正文开头的「日语：…」、sourceLink 指向的百科条目 */
export function postIdentities(raw) {
	const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
	const field = (k) =>
		(fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1] || "")
			.trim()
			.replace(/^["']|["']$/g, "");
	const title = field("title");
	const tags = (fm.match(/^tags:\s*\[(.*)\]$/m)?.[1] || "")
		.replace(/["']/g, "")
		.split(",");
	const season = seasonKey(title, tags);
	const names = [title];
	const original = raw.match(/\*\*(?:原作标题|原名)\*\*\s*(?:：|\|)\s*([^|\n]+)/)?.[1]?.trim();
	if (original) names.push(original);
	const jp = raw
		.slice(0, 3000)
		.match(/[（(]\s*日[语文]\s*[:：]\s*([^；;）)]+)/)?.[1];
	if (jp) names.push(jp);
	const source = field("sourceLink");
	if (/moegirl|wikipedia/.test(source)) names.push(source.split("/").pop());
	return names.map((n) => identity(n, season)).filter(Boolean);
}

/** 候选作品的身份：中文名、日文名、采用的百科条目名，季度标记统一取自候选自身的标题 */
export function candidateIdentities({
	titleCn,
	titleJp,
	encyclopediaTitles = [],
	forms = [],
}) {
	const season = seasonKey(titleCn, forms) || seasonKey(titleJp, forms);
	const ownBases = [titleCn, titleJp].map(baseTitle).filter(Boolean);
	// 百科条目常是整个系列共用的页面：候选标题 = 条目名 + 额外字（「零之使魔F」「…Ω」）说明它是续作，
	// 这时条目名不能代表候选本身，不参与比较
	const pages = encyclopediaTitles.filter((page) => {
		const base = baseTitle(page);
		return !ownBases.some(
			(own) => own.length > base.length && own.startsWith(base),
		);
	});
	return [titleCn, titleJp, ...pages]
		.map((n) => identity(n, season))
		.filter(Boolean);
}

/** 返回与候选重复的已有文章文件名，没有则 null */
export function findDuplicatePost(candidate, existingPosts) {
	const ids = candidateIdentities(candidate);
	for (const post of existingPosts) {
		const hit = (post.identities || []).find((id) =>
			ids.some((own) => sameWork(own, id)),
		);
		if (hit) return { file: post.filePath, identity: hit.key };
	}
	return null;
}
