/**
 * 中文文本规范化工具（自动发文专用）
 * ─────────────────────────────────────────────────────────────────────────────
 * - toSimplified：繁体 → 简体（OpenCC，港台用字一并转换）
 * - jpToSimplified：日文汉字（新字体）→ 简体，用于人名 / 制作公司名（平賀才人 → 平贺才人）
 * - kanaRatio / isMostlyJapanese：按假名占比判断一段文本是否仍是日文
 * - cleanChineseProse：去掉「（日语：…）」类外文注释、引用角标、假名为主的段落
 *
 * opencc-js 只在脚本中使用（devDependency），加载失败时退化为原样返回，不阻断发文。
 */

import * as OpenCC from "opencc-js";

let twToCn = null;
let jpToCn = null;

function converter(kind) {
	try {
		if (kind === "tw") {
			twToCn ??= OpenCC.Converter({ from: "tw", to: "cn" });
			return twToCn;
		}
		jpToCn ??= OpenCC.Converter({ from: "jp", to: "cn" });
		return jpToCn;
	} catch {
		return (text) => text;
	}
}

/** 繁体中文 → 简体中文 */
export function toSimplified(text) {
	const value = String(text ?? "");
	return value ? converter("tw")(value) : "";
}

/** 日文汉字（含新字体）→ 简体中文；假名保持不变 */
export function jpToSimplified(text) {
	const value = String(text ?? "");
	return value ? converter("jp")(value) : "";
}

const KANA_RE = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ]/g;
const CJK_RE = /[一-鿿]/g;

/** 假名字符数 / （假名 + 汉字）字符数 */
export function kanaRatio(text) {
	const value = String(text ?? "");
	const kana = value.match(KANA_RE)?.length ?? 0;
	const cjk = value.match(CJK_RE)?.length ?? 0;
	const total = kana + cjk;
	return total === 0 ? 0 : kana / total;
}

/** 文本中是否含有假名 */
export function hasKana(text) {
	return /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ]/.test(String(text ?? ""));
}

/**
 * 判断文本是否「以日文为主」。中文正文偶尔夹带作品原名（几个假名）不算日文，
 * 阈值 0.15 足以区分「中文 + 原名」与「整段日文」。
 */
export function isMostlyJapanese(text, threshold = 0.15) {
	return kanaRatio(text) > threshold;
}

/** 去掉百科正文里的外文注释：（日语：ゼロの使い魔；英语：…） */
export function stripForeignNotes(text) {
	return String(text ?? "")
		.replace(
			/[（(]\s*(?:日语|日文|日語|英语|英文|英語|罗马字|羅馬字|假名|原名)\s*[:：][^（）()]*[）)]/g,
			"",
		)
		.replace(
			/[，,]?\s*(?:日语|日文|英语|英文)\s*[:：]\s*[^，。；;）)]*[぀-ヿ][^，。；;）)]*/g,
			"",
		);
}

/** 去掉引用角标 [1]、[注 2]、[来源请求] 等 */
export function stripCitationMarks(text) {
	return String(text ?? "").replace(
		/\[(?:\d+|注\s*\d+|註\s*\d+|来源请求|來源請求|需要更新|谁？|誰？)\]/g,
		"",
	);
}

/**
 * 百科 / Bangumi 文本统一清洗为简体中文段落：
 * 繁转简 → 去外文注释与角标 → 丢弃以日文为主的段落 → 合并多余空行。
 */
export function cleanChineseProse(text) {
	const simplified = toSimplified(
		stripCitationMarks(stripForeignNotes(String(text ?? ""))),
	);
	return simplified
		.replace(/\r\n/g, "\n")
		.split(/\n{2,}/)
		.map((para) =>
			para
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.join("\n"),
		)
		.filter((para) => para && !isMostlyJapanese(para))
		.join("\n\n")
		.replace(/[ \t]+/g, " ")
		.trim();
}
