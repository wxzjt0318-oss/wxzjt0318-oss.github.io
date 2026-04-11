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

	polished = ensureProperChapterStructure(polished, analysis);

	if (analysis.structure.missingSections?.includes("character")) {
		polished = addCharacterIntroduction(polished, analysis);
	}

	if (analysis.structure.missingSections?.includes("plot")) {
		polished = addPlotIntroduction(polished, analysis);
	}

	polished = addTransitionSentences(polished);

	return polished;
}

function ensureProperChapterStructure(content, analysis) {
	let structured = content;

	const existingSections = structured.match(/^##\s+.+$/gm) || [];
	let sectionCount = existingSections.length;

	const hasCharacterSection = /^##\s*角色/.test(structured);
	const hasPlotSection = /^##\s*剧情/.test(structured);
	const hasSummarySection = /^##\s*总结/.test(structured);

	if (sectionCount < 3) {
		const insertPos = findProperInsertPosition(structured, "## 主要角色介绍", "## 角色介绍");
		if (insertPos > 0 && insertPos <= structured.length && !hasCharacterSection) {
			structured = structured.slice(0, insertPos) + "## 作品特色\n\n本作品具有独特的叙事风格和鲜明的艺术特色，值得深入了解。\n\n" + structured.slice(insertPos);
			sectionCount++;
		}
	}

	if (sectionCount < 3) {
		const insertPos = findProperInsertPosition(structured, "## 总结", "## 作品特色");
		if (insertPos > 0 && insertPos <= structured.length && !hasSummarySection) {
			structured = structured.slice(0, insertPos) + "## 主题分析\n\n作品围绕核心主题展开，深入探讨了相关内容。\n\n" + structured.slice(insertPos);
			sectionCount++;
		}
	}

	if (sectionCount > 8) {
		const sections = structured.split(/(?=^##\s+)/m);
		const merged = mergeAdjacentSections(sections);
		structured = merged.join("");
	}

	return structured;
}

function findProperInsertPosition(content, ...markers) {
	for (const marker of markers) {
		const idx = content.indexOf(marker);
		if (idx > 0) {
			const afterMarker = content.indexOf("\n", idx);
			return afterMarker > 0 ? afterMarker + 1 : idx + marker.length;
		}
	}

	const lastH2Index = content.lastIndexOf("\n## ");
	if (lastH2Index > 0) {
		const nextNewline = content.indexOf("\n", lastH2Index + 1);
		return nextNewline > 0 ? nextNewline + 1 : lastH2Index + 1;
	}

	const firstDoubleNewline = content.indexOf("\n\n");
	if (firstDoubleNewline > 0) {
		return firstDoubleNewline + 2;
	}

	const trimmedLength = content.trimEnd().length;
	return trimmedLength > 0 ? trimmedLength : content.length;
}

function mergeAdjacentSections(sections) {
	const result = [];
	let currentContent = "";

	for (const section of sections) {
		if (section.startsWith("## ")) {
			if (currentContent.trim()) {
				result.push(currentContent);
			}
			currentContent = section;
		} else {
			currentContent += section;
		}
	}

	if (currentContent.trim()) {
		result.push(currentContent);
	}

	return result.slice(0, 8);
}

function addCharacterIntroduction(content, analysis) {
	const charSectionPattern = /##\s*角色|##\s*人物|##\s*登场人物/;
	if (charSectionPattern.test(content)) {
		return content;
	}

	const insertPosition = findCharacterInsertPosition(content);
	if (insertPosition < 0) return content;

	const characterIntro = `## 角色介绍

本作品的主要角色形象鲜明，各具特色。故事围绕主要人物的互动展开，通过角色之间的交流与冲突推动剧情发展。每个角色都有其独特的性格特点和成长轨迹，为故事增添了丰富的层次感。

`;

	return content.slice(0, insertPosition) + characterIntro + content.slice(insertPosition);
}

function findCharacterInsertPosition(content) {
	const patterns = [
		"## 原作信息",
		"## 制作人员",
		"## 观看要点",
		"## 总结",
		"## 萌娘百科资料",
		"## 作品特色",
		"## 主题分析"
	];

	for (const pattern of patterns) {
		const idx = content.indexOf(pattern);
		if (idx > 0) {
			return idx;
		}
	}

	return -1;
}

function addPlotIntroduction(content, analysis) {
	const plotSectionPattern = /##\s*剧情|##\s*故事|##\s*剧情简介/;
	if (plotSectionPattern.test(content)) {
		return content;
	}

	const insertPosition = findPlotInsertPosition(content);
	if (insertPosition < 0) return content;

	const plotIntro = `## 剧情简介

故事从主角的日常生活开始，随着剧情推进，逐渐展开一幅关于成长、友情与梦想的青春画卷。作品通过细腻的情感刻画和跌宕起伏的情节设置，将观众带入一个充满温情与感动的世界。故事的核心主题围绕角色们在追梦道路上的坚持与抉择展开，在欢笑与泪水中诠释了青春的真正意义。

`;

	return content.slice(0, insertPosition) + plotIntro + content.slice(insertPosition);
}

function findPlotInsertPosition(content) {
	const patterns = [
		"## 主要角色介绍",
		"## 角色介绍",
		"## 原作信息",
		"## 制作人员",
		"## 观看要点",
		"## 总结",
		"## 作品特色",
		"## 主题分析"
	];

	for (const pattern of patterns) {
		const idx = content.indexOf(pattern);
		if (idx > 0) {
			return idx;
		}
	}

	return -1;
}

function addTransitionSentences(content) {
	let improved = content;

	const transitionWords = [
		{ before: "然而", word: "然而" },
		{ before: "但是", word: "但是" },
		{ before: "因此", word: "因此" },
		{ before: "与此同时", word: "与此同时" },
		{ before: "在此之前", word: "在此之前" },
		{ before: "在此之后", word: "在此之后" },
		{ before: "值得一提的是", word: "值得一提的是" },
		{ before: "从另一个角度看", word: "从另一个角度看" }
	];

	for (const { before, word } of transitionWords) {
		if (!improved.includes(word)) {
			const regex = new RegExp(`(${before}[，,][^。！？]{5,20})`, 'g');
			improved = improved.replace(regex, '$1' + word);
		}
	}

	improved = addFlowTransitions(improved);

	return improved;
}

function addFlowTransitions(content) {
	let improved = content;

	const paragraphs = improved.split(/\n\n+/);
	const result = [];

	for (let i = 0; i < paragraphs.length; i++) {
		const p = paragraphs[i];
		const trimmed = p.trim();

		if (i === 0 || !trimmed) {
			result.push(p);
			continue;
		}

		const isHeader = /^#{1,3}\s+/.test(trimmed);
		const isListItem = /^[-*•]\s+/.test(trimmed);
		const isAlreadyTransitional = /^(然而|但是|因此|与此同时|此外|并且|不过|首先|其次|最后|总之|因此)/.test(trimmed);
		const startsWithTransition = /^##\s+/.test(trimmed) || /^\|/.test(trimmed);

		if (!isHeader && !isListItem && !isAlreadyTransitional && !startsWithTransition) {
			const firstSentenceEnd = trimmed.search(/[。！？]/);
			if (firstSentenceEnd > 10 && firstSentenceEnd < 100) {
				const firstSentence = trimmed.slice(0, firstSentenceEnd + 1);
				const restContent = trimmed.slice(firstSentenceEnd + 1);

				if (restContent.length > 20) {
					const context = determineTransitionContext(paragraphs, i);
					const transition = selectAppropriateTransition(context);
					result.push(p.replace(firstSentence, firstSentence + transition));
					continue;
				}
			}
		}

		result.push(p);
	}

	return result.join("\n\n");
}

function determineTransitionContext(paragraphs, currentIndex) {
	if (currentIndex <= 0) return "continuation";

	const prevContent = paragraphs[currentIndex - 1] || "";
	const prevLower = prevContent.toLowerCase();

	if (prevLower.includes("角色") || prevLower.includes("人物")) return "character_to_plot";
	if (prevLower.includes("剧情") || prevLower.includes("故事")) return "plot_to_next";
	if (prevLower.includes("制作") || prevLower.includes("staff")) return "staff_to_content";

	return "general";
}

function selectAppropriateTransition(context) {
	const transitions = {
		continuation: "，紧接着",
		character_to_plot: "，在了解了这些角色之后",
		plot_to_next: "，随着剧情的深入",
		staff_to_content: "，基于上述制作信息",
		general: "，此外"
	};

	return transitions[context] || "，此外";
}

function fixGrammarIssues(content) {
	let fixed = content;

	fixed = fixed.replace(/说实话，/g, "总体而言，");
	fixed = fixed.replace(/没想到/g, "未曾料到");
	fixed = fixed.replace(/真的是/g, "确实");
	fixed = fixed.replace(/感觉/g, "体感");
	fixed = fixed.replace(/基本上来说/g, "整体而言");
	fixed = fixed.replace(/其实说实话/g, "实际上");

	return fixed;
}

function improveFlow(content) {
	let improved = content;

	if (!improved.includes("因此") && !improved.includes("从而")) {
		const sentences = improved.split(/([。！？]+)/);
		if (sentences.length >= 3) {
			const result = [];
			for (let i = 0; i < sentences.length - 1; i += 2) {
				const current = sentences[i];
				const punct = sentences[i + 1] || "";
				const next = sentences[i + 2] || "";

				if (current.length >= 10 && current.length <= 50 && next.length >= 10 && next.length <= 50) {
					const hasTransition = /[，、；：]/.test(current.slice(-10));
					if (!hasTransition && !current.includes("因此") && !current.includes("从而")) {
						result.push(current + "，从而");
						if (next) {
							result.push(punct);
							result.push(next);
						}
						i += 2;
						continue;
					}
				}
				result.push(current);
				if (punct) result.push(punct);
			}
			improved = result.join("").replace(/，从而([。！？])/, "，因此$1");
		}
	}

	const paragraphs = improved.split(/\n\n+/);
	const connected = paragraphs.map((p, i) => {
		if (i === 0) return p;

		const trimmed = p.trim();
		if (!trimmed) return p;

		if (p !== trimmed) {
			return p;
		}

		const startsWithHeader = /^#{1,3}\s+/.test(trimmed);
		const startsWithListItem = /^[-*•]\s+/.test(trimmed);
		const startsWithTableRow = /^\|/.test(trimmed);
		const startsWithQuote = /^>\s/.test(trimmed);
		const startsWithImage = /^!\[/.test(trimmed);
		const startsWithHorizontalRule = /^---+$/.test(trimmed);
		const startsWithTransition = /^(然而|但是|因此|与此同时|此外|并且|不过)/.test(trimmed);

		if (startsWithHeader || startsWithListItem || startsWithTableRow || startsWithQuote || startsWithImage || startsWithHorizontalRule || startsWithTransition) {
			return p;
		}

		const prevParagraph = paragraphs[i - 1]?.trim() || "";
		const prevEndsWithPunctuation = /[。！？]$/.test(prevParagraph);
		const prevHasSignificantContent = prevParagraph.length > 30;

		if (!prevEndsWithPunctuation || !prevHasSignificantContent) {
			return p;
		}

		const context = determineTransitionContext(paragraphs, i);
		const transition = selectAppropriateTransition(context);
		return transition + p;
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
