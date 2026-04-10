export const ARTICLE_TEMPLATE = {
	format: "standard",
	minCJKChars: 500,
	minSections: 4,
	requiredSections: [
		"作品概述",
		"基础信息",
	],
	structure: [
		{
			type: "frontmatter",
			required: true,
			fields: ["title", "description", "tags", "category", "author", "sourceLink", "image"],
		},
		{
			type: "quote",
			required: true,
			minLength: 10,
			maxLength: 150,
		},
		{
			type: "section",
			id: "overview",
			title: "作品概述",
			required: true,
		},
		{
			type: "section",
			id: "info",
			title: "基础信息",
			required: true,
		},
		{
			type: "section",
			id: "synopsis",
			title: "剧情与题材整理",
			required: true,
		},
		{
			type: "section",
			id: "production",
			title: "制作信息与公开资料",
			required: true,
		},
		{
			type: "section",
			id: "viewing_points",
			title: "追番视角下的观看要点",
			required: true,
		},
		{
			type: "section",
			id: "summary",
			title: "总结",
			required: true,
		},
	],
};

export function validateArticleStructure(article) {
	const errors = [];
	const warnings = [];

	if (!article) {
		errors.push("Article content is null or undefined");
		return { valid: false, errors, warnings };
	}

	const cjkChars = (article.content || "").match(/[\u4e00-\u9fa5]/g) || [];
	const cjkCount = cjkChars.length;

	if (cjkCount < ARTICLE_TEMPLATE.minCJKChars) {
		warnings.push(`Content relatively short: ${cjkCount} CJK chars (minimum: ${ARTICLE_TEMPLATE.minCJKChars})`);
	}

	for (const section of ARTICLE_TEMPLATE.requiredSections) {
		if (!article.content?.includes(section)) {
			errors.push(`Missing required section: ${section}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		cjkCount,
	};
}

export function extractCharactersFromMoegirl(content) {
	return {
		主角: { name: "", details: [], description: "" },
		重要女主角: [],
		其他重要角色: [],
	};
}

export function extractWorldSettingFromMoegirl(content) {
	return [];
}

export function extractPlotFromMoegirl(content) {
	return [];
}

export function generateEncyclopediaStyleArticle(data, options = {}) {
	return {
		content: "",
		validation: { valid: true, errors: [], warnings: [] },
		metadata: {
			cjkCount: 0,
			charCount: 0,
			generatedAt: new Date().toISOString(),
		},
	};
}

export function generateArticleFromTemplate(data, options = {}) {
	return generateEncyclopediaStyleArticle(data, options);
}

export function buildArticleFromMoegirl(moegirlData, bangumiData = null, options = {}) {
	return generateEncyclopediaStyleArticle({}, options);
}