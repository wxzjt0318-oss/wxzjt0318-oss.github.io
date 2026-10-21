/**
 * 列出仍是脚本资料稿的文章（正文带 AUTO_DRAFT_MARKER，或仍是旧版「一、作品概述 / 三、剧情简介」模板），
 * 并生成 scripts/wiki/source-requests.json 所需的查询清单。供长文改写任务使用，见 docs/longform-rewrite.md。
 *
 *   node scripts/wiki/find-auto-drafts.mjs            # 打印待改写文章
 *   node scripts/wiki/find-auto-drafts.mjs --requests # 同时写出 source-requests.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTO_DRAFT_MARKER } from "./longform-layout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const POSTS = path.join(ROOT, "src", "content", "posts");

const field = (fm, key) => (fm.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, "m")) || [])[1] || "";

export async function findAutoDrafts() {
	const drafts = [];
	for (const name of (await fs.readdir(POSTS)).filter((f) => f.endsWith(".md")).sort()) {
		const raw = await fs.readFile(path.join(POSTS, name), "utf8");
		const legacy = raw.includes("## 一、作品概述") && raw.includes("## 三、剧情简介");
		if (!legacy && !raw.includes(AUTO_DRAFT_MARKER)) continue;
		const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
		const title = field(fm, "title").replace(/^《|》$/g, "");
		const original = (raw.match(/\*\*(?:原名|原作标题)\*\*\s*(?:\||：)\s*([^|\n]+)/) || [])[1]?.trim() || "";
		// 声优表 / 角色小节里的前三个角色名（只看「声优阵容」表，不把「导演」等职务当成角色）
		const castTable = raw.match(/## 声优阵容[\s\S]*?(?=\n#|$)/)?.[0] || "";
		const characters = [
			...castTable.matchAll(/^\| ([^|*\n]+?) \| [^|\n]+ \|$/gm),
			...raw.matchAll(/^###? ([^\n（(]+)[（(]CV/gm),
		]
			.map((m) => m[1].trim())
			.filter((n) => n && !/角色|职务|项目|-{3}/.test(n))
			.filter((n, i, a) => a.indexOf(n) === i)
			.slice(0, 3);
		const alias = field(fm, "alias");
		drafts.push({ slug: name.slice(0, -3), title, original, alias, characters, sourceLink: field(fm, "sourceLink") });
	}
	return drafts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const drafts = await findAutoDrafts();
	for (const d of drafts) console.log(`${d.slug}\t${d.title}\t${d.sourceLink}`);
	console.log(`共 ${drafts.length} 篇待改写`);
	if (process.argv.includes("--requests") && drafts.length) {
		const base = (t) => t.replace(/\s*(第[一二三四五六七八九十\d]+[季期部]|第\d+部分|OVA|OAD|剧场版)\s*/g, " ").trim();
		const baseJa = (t) => t.replace(/\s*(第?[0-9０-９一二三四五六七八九十]+期|第[0-9０-９]+シーズン|[0-9]+(st|nd|rd|th) Season|OVA|OAD|劇場版)\s*/gi, " ").trim();
		// zh：中文标题与角色名（萌娘百科、中文维基）；ja：日文原名（日文维基优先，英文维基也用它搜索）；en：罗马字 / 英文标题
		const requests = Object.fromEntries(
			drafts.map((d) => [
				d.slug,
				{
					zh: [...new Set([base(d.title), d.title, ...d.characters].filter(Boolean))],
					ja: [...new Set([d.original, baseJa(d.original)].filter(Boolean))],
					// 英文链接还原成罗马字 / 英文标题，供 Anime News Network、Kitsu 搜索
					en: [
						d.alias
							.replace(/-(season-\d+|part-\d+|ova|oad|movie|\d{4}|\d+)$/g, "")
							.replace(/-/g, " "),
					].filter((t) => t.length >= 3),
				},
			]),
		);
		await fs.writeFile(path.join(__dirname, "source-requests.json"), `${JSON.stringify(requests, null, "\t")}\n`);
		console.log("已写出 scripts/wiki/source-requests.json");
	}
}
