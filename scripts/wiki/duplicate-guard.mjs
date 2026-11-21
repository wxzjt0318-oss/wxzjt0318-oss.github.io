/**
 * 自动发文的「同一作品」判重：防止为已经写过的作品再生成一篇。
 * ─────────────────────────────────────────────────────────────────────────────
 * 早期逻辑只比 Bangumi 条目 ID 与中文标题全等，会漏掉：
 *   - 没有 bgm.tv 链接（sourceLink 为空或指向萌娘百科）的自主编辑文章；
 *   - 标题带副标题，或中文译名不同（安闲 / 安逸领主）；
 *   - 漫画与动画条目号不同、译名差一个字（正相反的你与我 / 相反的你和我）、
 *     英文别名或文章 alias 才对得上的同一作品。
 *
 * 每篇文章与候选作品提取一组身份再比较：
 *   - 中文标题、日文原名、英文名、百科条目名、Bangumi「别名」；
 *   - 归一化：汉字之间的「与 / 跟」折成「和」，译名前缀「正」可有可无；
 *   - 英文名与 alias 折成同一 slug；
 *   - 条目 ID：文章自己的 sourceLink / `bangumi-<id>.md`，以及候选的关联
 *     漫画、小说、动画条目（原作 / 书籍 / 改编）。关联 ID 还要季度一致，
 *     避免「原作漫画」把第二季也判成已覆盖。
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

/**
 * 同一作品的不同载体。续集、前传、相同世界观、音乐条目不算。
 * Bangumi `/subjects/{id}/subjects` 的 `relation` 用这些名字。
 */
export const SAME_WORK_RELATIONS = new Set([
	"书籍",
	"漫画",
	"小说",
	"轻小说",
	"原作",
	"动画",
	"动画化",
	"漫画化",
	"小说化",
	"改编",
]);

/** 汉字之间的「与 / 跟」是译名差异（你与我 / 你和我），不改日文里的「与え」 */
function foldHanVariants(text) {
	return String(text || "")
		.replace(/妳/g, "你")
		.replace(/([\u4e00-\u9fff])[与與跟]([\u4e00-\u9fff])/g, "$1和$2");
}

/** 拆成「基础标题」与「副标题」（都已去掉季度标记与标点） */
export function splitTitle(title) {
	let text = foldHanVariants(
		String(title || "")
			.normalize("NFKC")
			.replace(/^\s*[《「『]/, "")
			.replace(/https?:\/\/[^/]+\//, ""),
	);
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
	return base.length >= 3
		? { kind: "title", key: `${base}#${season}`, sub, season }
		: null;
}

/** 英文名 / alias → slug。短于 5 或没有字母的结果不参与比较。 */
function latinSlug(value) {
	const slug = String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80)
		.replace(/-+$/g, "");
	if (!/[a-z]/.test(slug) || slug.length < 5) return "";
	if (/^(season|ova|movie|part)(-\d+)?$/.test(slug)) return "";
	return slug;
}

function identitiesFromName(name, season) {
	const out = [];
	const title = identity(name, season);
	if (title) out.push(title);
	const slug = latinSlug(name);
	if (slug) out.push({ kind: "slug", key: `slug:${slug}`, sub: "", season });
	return out;
}

function subjectIdentity(id, season, own) {
	const n = String(id ?? "").match(/\d+/)?.[0];
	if (!n || n === "0") return null;
	return {
		kind: "subject",
		key: `id:${n}`,
		sub: "",
		season,
		own: Boolean(own),
	};
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

/**
 * 基础标题与季度相同，且副标题算同一个，才算同一作品。
 * 「正」开头的译名（正相反 / 相反）在去掉这一个字之后相同，也算同一作品。
 * 条目 ID：两边都是「这篇自己的条目」时直接相同；其中一边只是关联条目时，
 * 还要季度一致。英文 slug 必须连季度一起相同。
 */
function sameWork(a, b) {
	if ((a.kind || "title") !== (b.kind || "title")) return false;
	if (a.kind === "subject") {
		if (a.key !== b.key) return false;
		if (a.own && b.own) return true;
		return (a.season || "") === (b.season || "");
	}
	if (a.kind === "slug") {
		return a.key === b.key && (a.season || "") === (b.season || "");
	}
	if (!sameSubtitle(a.sub, b.sub)) return false;
	if (a.key === b.key) return true;
	const [baseA, seasonA = ""] = a.key.split("#");
	const [baseB, seasonB = ""] = b.key.split("#");
	if (seasonA !== seasonB) return false;
	const strip = (s) => (s.startsWith("正") ? s.slice(1) : s);
	const left = strip(baseA);
	const right = strip(baseB);
	return (
		left === right && left.length >= 4 && (left !== baseA || right !== baseB)
	);
}

/**
 * 从已有文章原文提取身份：标题、原作标题、正文里的「日语 / 英语：…」、
 * alias、sourceLink 指向的百科条目，以及这篇自己的 Bangumi 条目 ID。
 * `extra.subjectIds` 用来补上文件名 `bangumi-<id>.md` 里的编号。
 */
export function postIdentities(raw, extra = {}) {
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
	const names = [title, field("alias")];
	const original = raw
		.match(/\*\*(?:原作标题|原名)\*\*\s*(?:：|\|)\s*([^|\n]+)/)?.[1]
		?.trim();
	if (original) names.push(original);
	// 在「，英语：…」处截断。旧正则会把日文名和后面的英文名粘成一个身份，对不上 Bangumi 原名。
	const head = raw.slice(0, 4000);
	for (const match of head.matchAll(
		/(?:日语|日文|英语|英文|英文名|罗马字|罗马音)\s*[:：]\s*([^，,、；;）)\n]+)/g,
	)) {
		names.push(match[1]);
	}
	const source = field("sourceLink");
	if (/moegirl|wikipedia/.test(source)) names.push(source.split("/").pop());
	const ids = new Set();
	const sourceId = source.match(/\/subject\/(\d+)/)?.[1];
	if (sourceId) ids.add(sourceId);
	for (const id of extra.subjectIds || []) {
		const n = String(id ?? "").match(/\d+/)?.[0];
		if (n) ids.add(n);
	}
	return [
		...names.flatMap((n) => identitiesFromName(n, season)),
		...[...ids].map((id) => subjectIdentity(id, season, true)).filter(Boolean),
	];
}

/**
 * 候选作品的身份。季度标记统一取自候选自身的标题。
 * 百科条目和别名若只是候选标题的前缀（系列总页），说明候选是续作，不参与比较。
 * `subjectIds` 是候选自己的条目；`relatedSubjectIds` 是同一作品的漫画 / 小说 / 动画条目。
 */
export function candidateIdentities({
	titleCn,
	titleJp,
	encyclopediaTitles = [],
	aliases = [],
	forms = [],
	subjectIds = [],
	relatedSubjectIds = [],
}) {
	const season = seasonKey(titleCn, forms) || seasonKey(titleJp, forms);
	const ownBases = [titleCn, titleJp].map(baseTitle).filter(Boolean);
	const broaderThanCandidate = (page) => {
		const base = baseTitle(page);
		return ownBases.some(
			(own) => own.length > base.length && own.startsWith(base),
		);
	};
	const names = [titleCn, titleJp, ...encyclopediaTitles, ...aliases].filter(
		(page) => page && !broaderThanCandidate(page),
	);
	return [
		...names.flatMap((n) => identitiesFromName(n, season)),
		...subjectIds
			.map((id) => subjectIdentity(id, season, true))
			.filter(Boolean),
		...relatedSubjectIds
			.map((id) => subjectIdentity(id, season, false))
			.filter(Boolean),
	];
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
