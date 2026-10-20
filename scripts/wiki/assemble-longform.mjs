/**
 * 把长文稿件写回文章：替换 description / category / tags / 引言 / 正文，保留其余 frontmatter 与封面。
 * 见 docs/longform-rewrite.md。
 *
 *   node scripts/wiki/assemble-longform.mjs <稿件目录> <slug> [...slug]
 *
 * 稿件 <稿件目录>/<slug>.md 开头 5 行依次为：
 *   description: ...                          单行，120–200 字
 *   quote: ...                                封面上方的引言，一句话，不含 "> "
 *   category: ...                             概括作品主题的短语
 *   tags: ["...", "..."]                      JSON 数组，最多 7 个
 *   refs: [名称](链接) | [名称](链接)          参考资料；留空则保留文章原有的「参考资料」小节
 * 其后为正文 Markdown（不含 frontmatter / 引言 / 参考资料），用单独一行 {{COVER}} 标记封面位置。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS = path.join(ROOT, "src", "content", "posts");
const HEAD_KEYS = ["description", "quote", "category", "tags", "refs"];

export function assembleLongform(draftText, postText) {
	const lines = draftText.replace(/\r\n/g, "\n").split("\n");
	const head = {};
	for (const key of HEAD_KEYS) {
		const line = lines.shift();
		if (!line?.startsWith(`${key}:`)) throw new Error(`expected "${key}:" line, got: ${line}`);
		head[key] = line.slice(key.length + 1).trim();
	}
	const tags = JSON.parse(head.tags);
	if (!Array.isArray(tags) || tags.length === 0 || tags.length > 7) throw new Error("tags must be an array of 1–7 items");
	let body = lines.join("\n").trim();
	if (!body.includes("{{COVER}}")) throw new Error("body must contain a {{COVER}} line");

	let fm = postText.match(/^---\n([\s\S]*?)\n---/)[1];
	const set = (key, value) => {
		const re = new RegExp(`^${key}:.*$`, "m");
		fm = re.test(fm) ? fm.replace(re, () => `${key}: ${value}`) : `${fm}\n${key}: ${value}`;
	};
	const refs = head.refs.split(/\s*\|\s*/).filter(Boolean);
	set("description", JSON.stringify(head.description));
	set("category", JSON.stringify(head.category));
	set("tags", JSON.stringify(tags).replace(/","/g, '", "'));
	const refSection = refs.length
		? `## 参考资料\n\n${refs.map((r) => `- ${r}`).join("\n")}`
		: (postText.match(/## 参考资料[\s\S]*$/)?.[0] || "").trim();
	if (/moegirl/.test(refSection)) set("licenseName", '"CC BY-NC-SA 3.0"');

	const title = (fm.match(/^title: "《?(.*?)》?"$/m) || [])[1] || "";
	const image = (fm.match(/^image: "?([^"\n]+)"?$/m) || [])[1];
	body = body.replace("{{COVER}}", `![${title}封面](${image})\n*${title}*`);
	const out = `---\n${fm}\n---\n\n> ${head.quote}\n\n${body}\n${refSection ? `\n---\n\n${refSection}\n` : ""}`;
	return {
		markdown: out,
		title,
		chineseChars: (body.match(/[一-鿿]/g) || []).length,
		kana: (body.match(/[぀-ヿ]/g) || []).length,
	};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [dir, ...slugs] = process.argv.slice(2);
	if (!dir || slugs.length === 0) {
		console.error("用法：node scripts/wiki/assemble-longform.mjs <稿件目录> <slug> [...slug]");
		process.exit(1);
	}
	for (const slug of slugs) {
		const file = path.join(POSTS, `${slug}.md`);
		const result = assembleLongform(fs.readFileSync(path.join(dir, `${slug}.md`), "utf8"), fs.readFileSync(file, "utf8"));
		fs.writeFileSync(file, result.markdown);
		console.log(`${slug} ${result.title}：${result.chineseChars} 字，假名 ${result.kana}`);
	}
}
