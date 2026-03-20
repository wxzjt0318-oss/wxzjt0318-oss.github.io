import type { CollectionEntry } from "astro:content";
import { permalinkConfig } from "../config";
import { removeFileExtension } from "./url-utils";

type PostEntry = CollectionEntry<"posts">;

let postIdMap: Map<string, number> | null = null;

export function initPostIdMap(posts: PostEntry[]): Map<string, number> {
	if (postIdMap) {
		return postIdMap;
	}

	const sortedPosts = [...posts].sort(
		(a, b) => a.data.published.getTime() - b.data.published.getTime(),
	);

	postIdMap = new Map();
	sortedPosts.forEach((post, index) => {
		postIdMap!.set(post.id, index + 1);
	});

	return postIdMap;
}

export function getPostNumericId(postId: string): number {
	if (!postIdMap) {
		console.warn("Post ID map not initialized. Returning 0 for post_id.");
		return 0;
	}
	return postIdMap.get(postId) ?? 0;
}

export function clearPostIdMap(): void {
	postIdMap = null;
}

export function generatePermalinkSlug(post: PostEntry): string {
	if (post.data.permalink) {
		return post.data.permalink.replace(/^\/+/, "").replace(/\/+$/, "");
	}

	if (!permalinkConfig.enable) {
		if (post.data.alias) {
			return post.data.alias.replace(/^\/+/, "").replace(/\/+$/, "");
		}
		return removeFileExtension(post.id);
	}

	let format = permalinkConfig.format;

	if (format.includes("/")) {
		console.warn(
			"Permalink format contains '/' which is not supported. Removing slashes.",
		);
		format = format.replace(/\//g, "-");
	}

	const published = post.data.published;
	const postname = removeFileExtension(post.id);
	const category = post.data.category || "uncategorized";

	const slug = format
		.replace(/%year%/g, published.getFullYear().toString())
		.replace(
			/%monthnum%/g,
			(published.getMonth() + 1).toString().padStart(2, "0"),
		)
		.replace(/%day%/g, published.getDate().toString().padStart(2, "0"))
		.replace(/%hour%/g, published.getHours().toString().padStart(2, "0"))
		.replace(
			/%minute%/g,
			published.getMinutes().toString().padStart(2, "0"),
		)
		.replace(
			/%second%/g,
			published.getSeconds().toString().padStart(2, "0"),
		)
		.replace(/%post_id%/g, getPostNumericId(post.id).toString())
		.replace(/%postname%/g, postname)
		.replace(/%category%/g, category);

	return slug;
}

export function hasCustomPermalink(
	post: PostEntry | { data: { permalink?: string } },
): boolean {
	return !!post.data.permalink;
}

export function getPermalinkPath(post: PostEntry): string {
	const slug = generatePermalinkSlug(post);
	return `/${slug}/`;
}
