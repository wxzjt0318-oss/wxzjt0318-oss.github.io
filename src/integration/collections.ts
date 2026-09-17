import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * Content collection definitions for Shirone, packaged so a user's
 * `src/content.config.ts` stays three lines long:
 *
 * ```ts
 * import { defineCollections } from "shirones/collections";
 * export const collections = defineCollections();
 * ```
 */

export interface DefineCollectionsOptions {
	/**
	 * Directory holding `posts/`, `moments/` and `spec/`, relative to the
	 * project root.
	 * @default "shirones/content"
	 */
	contentDir?: string;
	/** Override individual sub-directories. */
	paths?: {
		posts?: string;
		moments?: string;
		spec?: string;
		series?: string;
	};
}

const DEFAULT_CONTENT_DIR = "shirones/content";

function normaliseBase(value: string): string {
	const trimmed = value.replace(/^\.\//, "").replace(/\/+$/, "");
	return `./${trimmed}`;
}

/**
 * The post schema. Kept identical to the source template so content authored
 * against the git-clone workflow works unchanged in package mode.
 */
export const postSchema = z.object({
	title: z.string(),
	published: z.date(),
	publishedAt: z.date().optional(),
	updated: z.date().optional(),
	updatedAt: z.date().optional(),
	pinned: z.boolean().optional().default(false),
	draft: z.boolean().optional().default(false),
	comment: z.boolean().optional().default(true),
	description: z.string().optional().default(""),
	image: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	category: z.string().optional().nullable().default(""),
	/** Series slug the post belongs to (empty = none; single series per post). */
	series: z
		.string()
		.optional()
		.default("")
		.transform((value) => value.trim()),
	/** Position inside the series; falls back to publication order when absent. */
	seriesOrder: z.number().int().optional(),
	lang: z.string().optional().default(""),

	/* Post encryption */
	encrypted: z.boolean().optional().default(false),
	password: z
		.union([z.string(), z.number()])
		.transform((v) => String(v))
		.optional(),
	passwordHint: z.string().optional().default(""),
	hideHomeContent: z.boolean().optional().default(true),

	/* Post alias & custom permalink */
	alias: z.string().optional(),
	permalink: z.string().optional(),

	/* For internal use */
	prevUrl: z.string().optional(),
	nextUrl: z.string().optional(),
	prevTitle: z.string().default(""),
	prevSlug: z.string().default(""),
	nextTitle: z.string().default(""),
	nextSlug: z.string().default(""),
});

/** Schema for the short-form "moments" timeline. */
export const momentSchema = z.object({
	published: z.date(),
	pinned: z.boolean().optional().default(false),
	location: z.string().optional().default(""),
	/** Mood icon (Iconify name, e.g. `material-symbols:sentiment-excited-outline-rounded`). */
	mood: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	images: z
		.array(
			z.object({
				src: z.string(),
				alt: z.string().optional().default(""),
			}),
		)
		.optional()
		.default([]),
	draft: z.boolean().optional().default(false),
});

/** Schema for free-form spec pages (currently just `about.md`). */
export const specSchema = z.object({});

/**
 * Schema for series entities. Each entry is one series; the Markdown body is
 * the optional overview rendered on the series page.
 */
export const seriesSchema = z.object({
	title: z.string(),
	status: z.enum(["ongoing", "completed"]).optional().default("ongoing"),
	defaultCategory: z.string().optional().default(""),
});

/**
 * Build the `collections` export for `src/content.config.ts`.
 */
export function defineCollections(options: DefineCollectionsOptions = {}) {
	const root = normaliseBase(options.contentDir ?? DEFAULT_CONTENT_DIR);

	const postsBase = options.paths?.posts
		? normaliseBase(options.paths.posts)
		: `${root}/posts`;
	const momentsBase = options.paths?.moments
		? normaliseBase(options.paths.moments)
		: `${root}/moments`;
	const specBase = options.paths?.spec
		? normaliseBase(options.paths.spec)
		: `${root}/spec`;
	const seriesBase = options.paths?.series
		? normaliseBase(options.paths.series)
		: `${root}/series`;

	return {
		posts: defineCollection({
			loader: glob({ base: postsBase, pattern: "**/*.{md,mdx}" }),
			schema: postSchema,
		}),
		spec: defineCollection({
			loader: glob({ base: specBase, pattern: "**/*.{md,mdx}" }),
			schema: specSchema,
		}),
		series: defineCollection({
			loader: glob({ base: seriesBase, pattern: "**/*.md" }),
			schema: seriesSchema,
		}),
		moments: defineCollection({
			loader: glob({ base: momentsBase, pattern: "**/*.md" }),
			schema: momentSchema,
		}),
	} as const;
}

export default defineCollections;
