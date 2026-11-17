/**
 * 资料稿标记。每日发文（scripts/wiki/longform-layout.mjs）写在正文末尾。
 * 长文改写去掉这段标记，并把 frontmatter 的 draft 改回 false，文章才算发布。
 */
export const AUTO_DRAFT_MARKER = "<!-- shirone:auto-draft -->";

/**
 * 生产构建里，访客能看到的文章必须同时满足：不是草稿，正文也不含资料稿标记。
 * 开发服务器仍返回 true，方便本地预览草稿。
 *
 * @param {{ draft?: boolean, body?: string }} entry
 * @param {boolean} prod
 */
export function isPublishablePost(entry, prod) {
	if (!prod) return true;
	if (entry?.draft === true) return false;
	const body = typeof entry?.body === "string" ? entry.body : "";
	if (body.includes(AUTO_DRAFT_MARKER)) return false;
	return true;
}
