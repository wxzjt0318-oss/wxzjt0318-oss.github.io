export const AUTO_DRAFT_MARKER: "<!-- shirone:auto-draft -->";

export declare function isPublishablePost(
	entry: { draft?: boolean; body?: string } | null | undefined,
	prod: boolean,
): boolean;
