import getReadingTime from "reading-time";
import { visit } from "unist-util-visit";

export function remarkContent() {
	return (tree, { data }) => {
		// --- 安全性检查：确保 data.astro 存在 ---
		if (!data.astro) {
			data.astro = {};
		}
		if (!data.astro.frontmatter) {
			data.astro.frontmatter = {};
		}

		// 定义“手动摘要”的分隔符正则 (支持 或 ，忽略大小写)
		const moreTagRegex = /<!--\s*more\s*-->/i;
		let moreTagFound = false;
		
		let fullText = "";
		let excerptText = "";
		let foundFirstParagraph = false;

		// --- 单次遍历 AST，同时完成摘要提取和全文提取 ---
		visit(tree, (node) => {
			// 检查是否遇到手动摘要分隔符
			if (node.type === "html" && node.value && moreTagRegex.test(node.value)) {
				moreTagFound = true;
				return "skip";
			}

			// 跳过代码块，不计入字数
			if (node.type === "code" || node.type === "inlineCode")
				{return "skip";}

			// 如果找到了手动摘要分隔符，只提取分隔符之前的内容作为摘要
			if (!moreTagFound) {
				const nodeText = getNodeText(node);
				if (nodeText && nodeText.trim().length > 0) {
					// 如果没有手动摘要，且还没找到第一个非空段落
					if (!foundFirstParagraph && node.type === "paragraph") {
						excerptText = nodeText;
						foundFirstParagraph = true;
					}
					// 如果有手动摘要，累积内容作为摘要
					if (moreTagRegex.test(node.value)) {
						moreTagFound = true;
					} else if (!moreTagFound) {
						excerptText += nodeText;
					}
				}
			}

			// 总是累积全文内容（跳过代码块）
			if (node.type === "text" && node.value) {
				fullText += node.value + " ";
			}
		});

		// --- 计算阅读时间 (Reading Time) ---
		// 针对 CJK (中日韩) 字符的字数统计优化
		const cjkPattern =
			/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/g;

		// 使用 matchAll 代替 match，提高性能
		const cjkMatches = [...fullText.matchAll(cjkPattern)];
		const cjkCount = cjkMatches.length;

		// 优化：避免创建新字符串，直接计算非 CJK 单词数
		// 非 CJK 字符（英文/数字/空格/标点）
		const nonCjkPattern = /[^\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]+/g;
		const nonCjkWords = [...fullText.matchAll(nonCjkPattern)]
			.map(match => match[0].trim())
			.filter(word => word.length > 0)
			.length;

		// 估算时间：英文 200词/分，中文 400字/分
		const minutes = nonCjkWords / 200 + cjkCount / 400;
		const totalWords = nonCjkWords + cjkCount;

		// --- 注入数据到 Frontmatter ---
		data.astro.frontmatter.excerpt = excerptText;
		data.astro.frontmatter.minutes = Math.max(1, Math.round(minutes));
		data.astro.frontmatter.words = totalWords;
	};
}

/**
 * 辅助函数：递归从节点中提取纯文本
 */
function getNodeText(node) {
	// 安全性检查
	if (!node) {return "";}

	// 如果是文本节点，直接返回
	if (node.type === "text") {return node.value || "";}

	// 如果是图片，提取 alt 文本 (可选，这里选择提取以保持语义)
	if (node.type === "image") {return node.alt || "";}

	// 跳过代码块和 HTML 标签
	if (
		node.type === "code" ||
		node.type === "inlineCode" ||
		node.type === "html"
	)
		{return "";}

	// 递归处理子节点
	if (node.children && Array.isArray(node.children)) {
		return node.children.map(getNodeText).join("");
	}

	return "";
}
