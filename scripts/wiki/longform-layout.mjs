/**
 * 每日自动发文的正文版式：与站内长文同一骨架（基本信息表 → 剧情 → 制作与声优 → 角色 → 系列 → 总结 → 参考资料），
 * 只使用 Bangumi / 萌娘百科 / 维基百科给出的事实，不写空泛的套话。
 *
 * 文末带 AUTO_DRAFT_MARKER：表示这篇仍是脚本生成的资料稿，定时的长文改写任务（docs/longform-rewrite.md）
 * 会据此找到它并改写成带个人语气的深度长文，改写完成后标记随之移除。
 */

export const AUTO_DRAFT_MARKER = "<!-- shirone:auto-draft -->";

const ROLE_ORDER = ["导演", "监督", "副导演", "系列构成", "脚本", "原作", "人物设定", "角色设计", "总作画监督", "音乐", "音响监督", "动画制作", "制作"];

const isJapaneseHeavy = (text) => {
	const s = String(text || "");
	const kana = (s.match(/[぀-ヿ]/g) || []).length;
	return s.length > 0 && kana / s.length > 0.15;
};

const cell = (value) => String(value ?? "").replace(/\|/g, "／").replace(/\n+/g, " ").trim();

function table(rows) {
	const body = rows.filter(([, v]) => v).map(([k, v]) => `| **${k}** | ${cell(v)} |`);
	return body.length ? `| 项目 | 内容 |\n|------|------|\n${body.join("\n")}` : "";
}

function paragraphs(text, max = Infinity) {
	return String(text || "")
		.split(/\n{2,}|\n(?=\S)/)
		.map((p) => p.trim())
		.filter((p) => p && !isJapaneseHeavy(p))
		.slice(0, max);
}

function staffTable(staff) {
	const rank = (relation) => {
		const i = ROLE_ORDER.findIndex((r) => String(relation || "").includes(r));
		return i < 0 ? 999 : i;
	};
	const rows = [...(staff || [])]
		.filter((s) => s?.name && !isJapaneseHeavy(s.name))
		.sort((a, b) => rank(a.relation) - rank(b.relation))
		.slice(0, 10)
		.map((s) => `| ${cell(s.relation || "相关人员")} | ${cell(s.name)} |`);
	return rows.length ? `| 职务 | 人员 |\n|------|------|\n${rows.join("\n")}` : "";
}

function castTable(characters) {
	const rows = (characters || [])
		.filter((c) => (c.name_cn || c.name) && !isJapaneseHeavy(c.name_cn || c.name))
		.slice(0, 8)
		.map((c) => `| ${cell(c.name_cn || c.name)} | ${cell(c.cv || "—")} |`);
	return rows.length ? `| 角色 | 声优 |\n|------|------|\n${rows.join("\n")}` : "";
}

function characterProfiles(characters) {
	return (characters || [])
		.slice(0, 6)
		.map((c) => {
			const name = c.name_cn || c.name;
			const bio = (c.description || c.summary || c.comment || "").trim();
			if (!name || isJapaneseHeavy(name) || !bio || isJapaneseHeavy(bio)) return "";
			return `## ${name}${c.cv ? `（CV：${c.cv}）` : ""}\n\n${bio}`;
		})
		.filter(Boolean)
		.join("\n\n");
}

/**
 * @param {object} p
 * @param {string} p.cleanTitle 作品中文名（不含书名号）
 * @param {string} p.originalTitle 原名
 * @param {string} p.overview 百科导言
 * @param {string} p.summary 剧情（百科剧情优先，其次 Bangumi 简介）
 * @param {object} p.meta studio / airDate / episodes / score / scoreRank / total
 * @param {Array} p.staff [{relation,name}]
 * @param {Array} p.characters [{name,name_cn,cv,description}]
 * @param {Array} p.genreTags
 * @param {string} p.cover 封面 Markdown
 * @param {Array} p.relatedPosts [{title, alias}] 站内同系列文章
 * @param {string} p.sourceLink Bangumi 链接
 */
export function buildLongformBody(p) {
	const { cleanTitle, originalTitle, overview, summary, meta = {}, genreTags = [], cover, relatedPosts = [] } = p;
	const intro = paragraphs(overview, 2);
	const opening = intro.length
		? intro.join("\n\n")
		: `《${cleanTitle}》${meta.airDate ? `于${meta.airDate}开播` : ""}${meta.studio ? `，由${meta.studio}负责动画制作` : ""}。`;

	const info = table([
		["作品名", cleanTitle],
		["原名", originalTitle && originalTitle !== cleanTitle ? originalTitle : ""],
		["类型", genreTags.slice(0, 4).join(" / ")],
		["动画制作", meta.studio],
		["首播", meta.airDate],
		["话数", meta.episodes],
		["Bangumi 评分", meta.score ? `${meta.score}${meta.scoreRank ? `（排名 #${meta.scoreRank}）` : ""}` : ""],
	]);

	const story = paragraphs(summary);
	const staff = staffTable(p.staff);
	const cast = castTable(p.characters);
	const profiles = characterProfiles(p.characters);
	const series = relatedPosts
		.filter((r) => r?.alias && r?.title)
		.map((r) => `- [${r.title.replace(/^《|》$/g, "")}](/posts/${r.alias}/)`);

	const facts = [
		meta.studio ? `由${meta.studio}制作` : "",
		meta.airDate ? `${meta.airDate}开播` : "",
		meta.episodes ? `共${String(meta.episodes).replace(/\s+/g, "")}` : "",
	].filter(Boolean);

	const sections = [
		opening,
		cover,
		`# 一、作品基本信息\n\n${info}`,
		story.length ? `# 二、剧情简介\n\n${story.join("\n\n")}` : "",
		staff || cast
			? `# 三、动画制作与声优\n\n${[staff && `## 制作阵容\n\n${staff}`, cast && `## 声优阵容\n\n${cast}`].filter(Boolean).join("\n\n")}`
			: "",
		profiles ? `# 四、主要角色\n\n${profiles}` : "",
		series.length ? `# 五、系列作品\n\n站内还有同系列的其他文章：\n\n${series.join("\n")}` : "",
		`# 总结\n\n《${cleanTitle}》${facts.length ? `${facts.join("，")}。` : "的基本资料整理到这里。"}`,
	];
	return `${sections.filter(Boolean).join("\n\n")}\n\n${AUTO_DRAFT_MARKER}`;
}
