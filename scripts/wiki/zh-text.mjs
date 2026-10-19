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

/** 日文汉字（含新字体）→ 简体中文；假名保持不变；日文中点「・」统一为「·」 */
export function jpToSimplified(text) {
	const value = normalizeMiddleDot(text);
	return value ? converter("jp")(value) : "";
}

/** 日文中点（U+30FB / 半角 U+FF65）→ 中文间隔号「·」 */
export function normalizeMiddleDot(text) {
	return String(text ?? "").replace(/[\u30fb\uff65]/g, "·");
}

/**
 * 日本动画公司的通行中文 / 官方英文写法。Bangumi 的「动画制作」常写片假名，
 * 中文资料一般使用这里的写法。新出现的公司补进来即可。
 */
const STUDIO_NAMES = [
	["プロダクション リード", "Production Reed"],
	["プロダクションリード", "Production Reed"],
	["苇プロダクション", "苇Production"],
	["葦プロダクション", "苇Production"],
	["手冢プロダクション", "手冢制作公司"],
	["手塚プロダクション", "手冢制作公司"],
	["st.シルバー", "Studio Silver"],
	["スタジオシルバー", "Studio Silver"],
	["アルボアニメーション", "Arvo Animation"],
	["ティー・エヌ・ケー", "TNK"],
	["トムス・エンタテインメント", "TMS娱乐"],
	["エイトビット", "8bit"],
	["オクルトノボル", "Okuruto Noboru"],
	["シンエイ動画", "新锐动画"],
	["シンエイ动画", "新锐动画"],
	["studioぱれっと", "studio Palette"],
	["スタジオぱれっと", "studio Palette"],
	["ハヤブサフィルム", "Hayabusa Film"],
	["パッショーネ", "Passione"],
	["アクタス", "ACTAS"],
	["ゼロジー", "ZERO-G"],
	["セイバーワークス", "SABER WORKS"],
	["スタジオ フラッド", "Studio Flad"],
	["スタジオフラッド", "Studio Flad"],
	["ドライブ", "Drive"],
	["グラス", "GRASS"],
	["第6スタジオ", "第6工作室"],
	["スタジオディーン", "Studio DEEN"],
	["スタジオ・ディーン", "Studio DEEN"],
	["ぴえろ", "Studio Pierrot"],
	["マッドハウス", "MADHOUSE"],
	["サンライズ", "日升动画"],
	["ボンズ", "BONES"],
	["シャフト", "SHAFT"],
	["ディオメディア", "动画工房"],
	["動画工房", "动画工房"],
	["京都アニメーション", "京都动画"],
	["ライデンフィルム", "LIDENFILMS"],
	["ノーマッド", "NOMAD"],
	["ジーベック", "XEBEC"],
	["フッズエンタテインメント", "Hoods Entertainment"],
	["ゆめ太カンパニー", "Yumeta Company"],
	["スタジオコメット", "Studio Comet"],
	["エンカレッジフィルムズ", "ENCOURAGE FILMS"],
	["ブレインズ・ベース", "Brain's Base"],
	["ディーンゲン", "DEEN"],
];

/** 动画公司名中文化：替换已知片假名公司名，去掉「[旧称]」类附注 */
export function normalizeStudioName(value) {
	let text = normalizeMiddleDot(String(value ?? "").trim());
	for (const [ja, zh] of STUDIO_NAMES) {
		text = text.split(normalizeMiddleDot(ja)).join(zh);
	}
	return jpToSimplified(text.replace(/\s*\[[^\]]*\]\s*/g, "").trim());
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

const LATIN_GLOSS_RE = /^[A-Za-z][A-Za-z0-9 .'’&\-:!?]*$/;
const CJK_CHAR_RE = /[\u4e00-\u9fff]/;

/**
 * 去掉中文词后面的日文 / 英文对照括注（支持嵌套）：
 *   守护者(ガーディアン) → 守护者；灰之魔女（灰の魔女） → 灰之魔女；
 *   安兹·乌尔·恭（Ainz Ooal Gown） → 安兹·乌尔·恭；
 *   小野寺小咲（日语：小野寺（おのでら） 小咲（こさき）） → 小野寺小咲
 * 只删含假名、或紧跟在汉字后的纯拉丁字母括注；其余括号内容保留。
 */
export function stripForeignGlosses(text) {
	const input = String(text ?? "");
	const OPEN = { "（": "）", "(": ")" };
	const out = [];
	const stack = [];
	for (const ch of input) {
		if (ch in OPEN) {
			stack.push({ open: ch, start: out.length });
			out.push(ch);
			continue;
		}
		const top = stack.at(-1);
		if (top && (ch === "）" || ch === ")")) {
			stack.pop();
			const inner = out.slice(top.start + 1).join("");
			const before = out[top.start - 1] || "";
			const glossy =
				hasKana(inner) ||
				/^\s*(日语|日文|日語|英语|英文|英語|罗马字|羅馬字|假名|原名)\s*[:：]/.test(
					inner,
				) ||
				(LATIN_GLOSS_RE.test(inner.trim()) && CJK_CHAR_RE.test(before)) ||
				inner.trim() === "";
			if (glossy) {
				out.length = top.start;
			} else {
				out.push(ch);
			}
			continue;
		}
		out.push(ch);
	}
	return out.join("");
}

/** 去掉萌娘百科模板残留：[mask]…[/mask]、[黑幕] 等标记（保留文字） */
export function stripWikiMarkup(text) {
	return String(text ?? "").replace(
		/\[\/?(?:mask|heimu|黑幕|ruby|lj|color|size|center)[^\]]*\]/gi,
		"",
	);
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
	const simplified = normalizeMiddleDot(
		toSimplified(
			stripCitationMarks(
				stripForeignNotes(
					stripForeignGlosses(stripWikiMarkup(String(text ?? ""))),
				),
			),
		),
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
