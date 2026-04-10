import { getMoegirlPageSDK } from "./moegirl-sdk.mjs";
import { MediaWikiApi } from 'wiki-saikou';

const MOEGIRL_API_URL = 'https://zh.moegirl.org.cn/api.php';
const api = new MediaWikiApi(MOEGIRL_API_URL);

export async function getMoegirlCharacters(pageName) {
	try {
		const page = await getMoegirlPageSDK(pageName);
		if (!page) return null;

		const charPattern = /{{角色信息([^}]+)}}/gi;
		const chars = [];
		let match;

		while ((match = charPattern.exec(page.extract)) !== null) {
			const charInfo = match[1];
			const nameMatch = charInfo.match(/name\s*=\s*([^|]+)/i);
			const cvMatch = charInfo.match(/cv\s*=\s*([^|]+)/i);
			const descMatch = charInfo.match(/description\s*=\s*([^|]+)/i);

			if (nameMatch) {
				chars.push({
					name: nameMatch[1].trim(),
					cv: cvMatch ? cvMatch[1].trim() : "",
					description: descMatch ? descMatch[1].trim() : "",
					source: "moegirl"
				});
			}
		}

		if (chars.length > 0) return chars;

		const sectionPattern = /===\s*角色\s*===+([\s\S]*?)(?====|$)/gi;
		const sectionMatch = sectionPattern.exec(page.extract);

		if (sectionMatch) {
			const roleSection = sectionMatch[1];
			const roleMatches = roleSection.matchAll(/^\|\s*([^|]+)\s*\|\s*([^|]+)/gm);
			for (const [, name, desc] of roleMatches) {
				chars.push({
					name: name.trim(),
					description: desc.trim(),
					cv: "",
					source: "moegirl"
				});
			}
		}

		return chars.length > 0 ? chars : null;
	} catch (error) {
		console.warn(`获取萌娘百科角色失败: ${error.message}`);
		return null;
	}
}

export async function analyzeMoegirlArticle(content, title) {
	const analysis = {
		title,
		structure: analyzeStructure(content),
		language: analyzeLanguage(content),
		style: analyzeStyle(content),
		suggestions: [],
		score: 0
	};

	analysis.suggestions = generateSuggestions(analysis);
	analysis.score = calculateScore(analysis);

	return analysis;
}

function analyzeStructure(content) {
	const sections = {
		hasIntro: false,
		hasCharacterSection: false,
		hasPlotSection: false,
		hasStaffSection: false,
		hasInfoBox: false,
		sectionOrder: [],
		missingSections: []
	};

	const sectionPatterns = [
		{ pattern: /##\s*作品简介|##\s*简介|##\s*介绍/, type: "intro" },
		{ pattern: /##\s*角色|##\s*人物|##\s*登场人物/, type: "character" },
		{ pattern: /##\s*剧情|##\s*故事|##\s*剧情简介/, type: "plot" },
		{ pattern: /##\s*制作人员|##\s*配音|##\s*声优/, type: "staff" },
		{ pattern: /^{{/m, type: "infobox" }
	];

	for (const { pattern, type } of sectionPatterns) {
		if (pattern.test(content)) {
			sections[`has${type.charAt(0).toUpperCase() + type.slice(1)}`] = true;
			sections.sectionOrder.push(type);
		}
	}

	const requiredSections = ["intro", "character", "plot"];
	for (const section of requiredSections) {
		if (!sections[`has${section.charAt(0).toUpperCase() + section.slice(1)}`]) {
			sections.missingSections.push(section);
		}
	}

	return sections;
}

function analyzeLanguage(content) {
	const issues = {
		passiveVoice: [],
		informalExpressions: [],
		grammarIssues: [],
		typos: []
	};

	const passivePatterns = [
		{ pattern: /被[\u4e00-\u9fa5]{1,3}所/, line: 0 },
		{ pattern: /由[^,.，、]+所[^,.，、]+的/, line: 0 }
	];

	const informalPatterns = [
		{ pattern: /说实话/, severity: "low" },
		{ pattern: /没想到/, severity: "low" },
		{ pattern: /真的是/, severity: "low" },
		{ pattern: /感觉/, severity: "medium" }
	];

	const moegirlStylePatterns = [
		{ pattern: /《([^》]+)》/, replacement: "「$1」" },
		{ pattern: /\[{2}/, replacement: "[[" },
		{ pattern: /\]{2}/, replacement: "]]" }
	];

	return {
		issues,
		moegirlCompliance: checkMoegirlStyle(content),
		suggestions: []
	};
}

function checkMoegirlStyle(content) {
	const checks = {
		useOfBrackets: (content.match(/《/g) || []).length > 0 ? "needs_fix" : "ok",
		useOfBold: (content.match(/\*\*[^*]+\*\*/g) || []).length > 3 ? "good" : "needs_more",
		useOfHeaders: (content.match(/^##\s+/gm) || []).length >= 3 ? "good" : "needs_more",
		listStructure: (content.match(/^\s*[-*]\s+/gm) || []).length >= 2 ? "good" : "needs_more"
	};

	let complianceScore = 0;
	for (const check of Object.values(checks)) {
		if (check === "good" || check === "ok") complianceScore++;
	}

	return {
		checks,
		score: complianceScore / Object.keys(checks).length
	};
}

function analyzeStyle(content) {
	return {
		academicTone: content.includes("因此") || content.includes("从而"),
		encyclopedic: content.includes("是") && content.includes("的"),
		narrativeFlow: analyzeNarrativeFlow(content),
		balance: analyzeBalance(content)
	};
}

function analyzeNarrativeFlow(content) {
	const transitions = content.match(/(此外|与此同时|因此|不过|然而|但是|首先|其次|最后|总之)/g) || [];
	return {
		count: transitions.length,
		diversity: new Set(transitions).size,
		score: transitions.length >= 3 ? "good" : "needs_improvement"
	};
}

function analyzeBalance(content) {
	const sections = content.split(/##\s+/).length - 1;
	return {
		sectionCount: sections,
		isBalanced: sections >= 3 && sections <= 8,
		score: sections >= 3 && sections <= 8 ? "good" : "needs_improvement"
	};
}

function generateSuggestions(analysis) {
	const suggestions = [];

	if (analysis.structure.missingSections.includes("character")) {
		suggestions.push({
			type: "structure",
			priority: "high",
			message: "建议添加角色介绍章节"
		});
	}

	if (analysis.structure.missingSections.includes("plot")) {
		suggestions.push({
			type: "structure",
			priority: "high",
			message: "建议添加剧情介绍章节"
		});
	}

	if (analysis.style.narrativeFlow.score === "needs_improvement") {
		suggestions.push({
			type: "style",
			priority: "medium",
			message: "建议增加过渡词以改善文章流畅度"
		});
	}

	if (analysis.style.balance.score === "needs_improvement") {
		suggestions.push({
			type: "structure",
			priority: "medium",
			message: "建议调整章节数量(当前3-8章为宜)"
		});
	}

	if (analysis.language.moegirlCompliance.score < 0.7) {
		suggestions.push({
			type: "style",
			priority: "high",
			message: "建议参考萌娘百科的格式规范进行调整"
		});
	}

	return suggestions;
}

function calculateScore(analysis) {
	let score = 100;

	if (analysis.structure.missingSections.length > 0) {
		score -= analysis.structure.missingSections.length * 15;
	}

	if (analysis.style.narrativeFlow.score === "needs_improvement") {
		score -= 10;
	}

	if (analysis.style.balance.score === "needs_improvement") {
		score -= 10;
	}

	if (analysis.language.moegirlCompliance.score < 0.5) {
		score -= 20;
	}

	return Math.max(0, Math.min(100, score));
}

export function polishArticleContent(content, analysis) {
	let polished = content;

	polished = fixGrammarIssues(polished);
	polished = improveFlow(polished);
	polished = standardizeFormat(polished);
	polished = enhanceMoegirlStyle(polished);

	return polished;
}

function fixGrammarIssues(content) {
	let fixed = content;

	fixed = fixed.replace(/说实话，/g, "总体而言，");
	fixed = fixed.replace(/没想到/g, "未曾料到");
	fixed = fixed.replace(/真的是/g, "确实");
	fixed = fixed.replace(/感觉/g, "体感");

	return fixed;
}

function improveFlow(content) {
	let improved = content;

	if (!improved.includes("因此") && !improved.includes("从而")) {
		improved = improved.replace(/(\S{10,20}。)(\S{10,20}。)/g, "$1因此$2");
	}

	const paragraphs = improved.split(/\n\n+/);
	const connected = paragraphs.map((p, i) => {
		if (i > 0 && !/[，、。；：]/.test(p.slice(0, 5))) {
			return "此外，" + p;
		}
		return p;
	});

	return connected.join("\n\n");
}

function standardizeFormat(content) {
	let formatted = content;

	formatted = formatted.replace(/《([^》]+)》/g, "「$1」");

	formatted = formatted.replace(/^\s*[-]\s+/gm, "• ");

	formatted = formatted.replace(/\n{3,}/g, "\n\n");

	return formatted;
}

function enhanceMoegirlStyle(content) {
	let enhanced = content;

	if (!enhanced.includes("==概述==") && !enhanced.includes("==简介==")) {
		enhanced = enhanced.replace(/(#\s+[^\n]+\n)/, "$1\n==概述==\n\n");
	}

	const charSectionMatch = enhanced.match(/##\s*角色[^\n]*\n([\s\S]*?)(?=##|$)/);
	if (charSectionMatch && !charSectionMatch[1].includes("'''")) {
		enhanced = enhanced.replace(/##\s*角色[^\n]*\n/, "## 角色\n\n'''本条目介绍的是作品的登场角色。'''\n\n");
	}

	return enhanced;
}

export function qualityCheck(content, title) {
	const checks = {
		informationAccuracy: checkInformationAccuracy(content),
		structuralIntegrity: checkStructuralIntegrity(content),
		languageStandard: checkLanguageStandard(content),
		styleConsistency: checkStyleConsistency(content)
	};

	const allPassed = Object.values(checks).every(c => c.passed);

	return {
		passed: allPassed,
		checks,
		report: generateQualityReport(checks, title)
	};
}

function checkInformationAccuracy(content) {
	const hasInfobox = /^{{/m.test(content);
	const hasCitations = /\[\[来源::/m.test(content) || content.includes("参考来源");
	const hasFactualStatements = (content.match(/[是并非]/g) || []).length >= 5;

	return {
		passed: hasInfobox || hasFactualStatements,
		details: {
			hasInfobox,
			hasCitations,
			hasFactualStatements
		}
	};
}

function checkStructuralIntegrity(content) {
	const hasTitle = content.includes("# title:");
	const hasDate = /pubDate:\s*\d{4}-\d{2}-\d{2}/.test(content);
	const hasTags = /tags:\s*\[/.test(content);
	const hasContent = content.split(/##\s+/).length >= 4;

	return {
		passed: hasTitle && hasDate && hasTags && hasContent,
		details: {
			hasTitle,
			hasDate,
			hasTags,
			hasContent,
			sectionCount: content.split(/##\s+/).length - 1
		}
	};
}

function checkLanguageStandard(content) {
	const issues = [];
	const hasProperPunctuation = /[，。、；：""'']/g.test(content);
	const noExcessiveCasual = !/(说实话|真的|没想到)/.test(content.slice(0, 500));
	const properLineBreaks = (content.match(/\n\n/g) || []).length >= 2;

	if (!hasProperPunctuation) issues.push("标点符号使用不规范");
	if (!noExcessiveCasual) issues.push("开头部分存在过于口语化的表达");
	if (!properLineBreaks) issues.push("段落划分不够清晰");

	return {
		passed: issues.length === 0,
		details: {
			hasProperPunctuation,
			noExcessiveCasual,
			properLineBreaks
		},
		issues
	};
}

function checkStyleConsistency(content) {
	const wikiLinks = (content.match(/\[\[/g) || []).length;
	const boldText = (content.match(/\*\*/g) || []).length / 2;
	const headers = (content.match(/^##\s+/gm) || []).length;

	const isConsistent = wikiLinks >= 2 && boldText >= 2 && headers >= 3;

	return {
		passed: isConsistent,
		details: {
			wikiLinks,
			boldText,
			headers
		}
	};
}

function generateQualityReport(checks, title) {
	let report = `# 质量检查报告: ${title}\n\n`;
	report += `检查时间: ${new Date().toISOString()}\n\n`;
	report += `## 检查结果\n\n`;

	for (const [checkName, result] of Object.entries(checks)) {
		const status = result.passed ? "✅ 通过" : "❌ 未通过";
		report += `### ${checkName}: ${status}\n\n`;

		if (result.details) {
			for (const [key, value] of Object.entries(result.details)) {
				report += `- ${key}: ${value}\n`;
			}
			report += "\n";
		}

		if (result.issues && result.issues.length > 0) {
			report += "问题:\n";
			for (const issue of result.issues) {
				report += `- ${issue}\n`;
			}
			report += "\n";
		}
	}

	report += `---\n\n`;
	report += `**总体结论**: ${result => Object.values(checks).every(c => c.passed) ? "✅ 所有检查项目均已通过" : "❌ 存在未通过项目，请根据上述建议进行修改"}\n`;

	return report;
}
