import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedShironesPaths, ShironesOptions } from "./types.ts";

/**
 * Directory name used for user content/config. Intentionally identical to the
 * published package name so that documentation and the on-disk layout match.
 */
export const DEFAULT_CONTENT_ROOT = "shirones";

/** Cache/scratch directory created inside the user's project. */
export const CACHE_DIR_NAME = ".shirones";

/**
 * Locate the package root by walking up from this module until a `package.json`
 * is found. Works both when bundled into `dist/index.js` (package root is one
 * level up from the bundle) and when running from source inside the repo.
 */
export function findPackageRoot(fromUrl: string): string {
	let dir = resolve(fileURLToPath(fromUrl), "..");
	for (let depth = 0; depth < 10; depth += 1) {
		if (existsSync(join(dir, "package.json"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	// Fall back to the directory containing the entry module.
	return resolve(fileURLToPath(fromUrl), "..");
}

/**
 * `true` when the theme is executing from an installed npm package rather than
 * from a checkout of the Shirone repository. Mirrors Starlight/Stalux detection.
 */
export function detectPluginMode(fromUrl: string): boolean {
	return fromUrl.includes("/node_modules/") || fromUrl.includes("\\node_modules\\");
}

/**
 * `true` when the theme executes from its own repository checkout (the
 * git-clone/source workflow) rather than from an installed copy. In that case
 * the "user" directories default to the repository's own `src/config`,
 * `src/config/data` and `src/content` — the layout `astro.config.mjs` and the
 * repo scripts have always assumed.
 */
export function detectInRepoMode(
	projectRoot: string,
	packageRoot: string,
): boolean {
	// `config.root` arrives as a `file:` URL *with* a trailing slash, so
	// `fileURLToPath` yields `/path/to/repo/` while `findPackageRoot()` returns
	// `/path/to/repo`. Strip the trailing separator before comparing, or every
	// repository checkout is misdetected as package mode.
	return (
		normalisePath(projectRoot).toLowerCase() ===
		normalisePath(packageRoot).toLowerCase()
	);
}

function toAbsolute(projectRoot: string, candidate: string): string {
	return isAbsolute(candidate) ? candidate : resolve(projectRoot, candidate);
}

/**
 * Resolve every directory the integration needs, applying user overrides.
 */
export function resolvePaths(
	options: ShironesOptions,
	projectRootUrl: URL,
	moduleUrl: string,
): ResolvedShironesPaths {
	const projectRoot = fileURLToPath(projectRootUrl);
	const packageRoot = findPackageRoot(moduleUrl);
	const isPluginMode = detectPluginMode(moduleUrl);
	const isInRepo = detectInRepoMode(projectRoot, packageRoot);

	// In plugin mode the published tarball keeps sources under `src/`.
	const packageSrc = existsSync(join(packageRoot, "src"))
		? join(packageRoot, "src")
		: packageRoot;

	const contentRootName = options.paths?.root ?? DEFAULT_CONTENT_ROOT;
	const contentRoot = toAbsolute(projectRoot, contentRootName);

	// Source mode points the "user" directories at the repository's own
	// layout; an explicit `options.paths` entry always wins. Package mode
	// keeps the `shirones/` content root.
	const configDir = options.paths?.config
		? toAbsolute(projectRoot, options.paths.config)
		: isInRepo
			? join(packageSrc, "config")
			: join(contentRoot, "config");

	const dataDir = options.paths?.data
		? toAbsolute(projectRoot, options.paths.data)
		: isInRepo
			? join(packageSrc, "config", "data")
			: join(configDir, "data");

	const contentDir = options.paths?.content
		? toAbsolute(projectRoot, options.paths.content)
		: isInRepo
			? join(packageSrc, "content")
			: join(contentRoot, "content");

	return {
		projectRoot,
		packageRoot,
		packageSrc,
		configDir,
		dataDir,
		contentDir,
		cacheDir: join(projectRoot, CACHE_DIR_NAME),
		isPluginMode,
		isInRepo,
	};
}

/** Normalise a filesystem path for comparison across platforms. */
export function normalisePath(value: string): string {
	return value.replace(/\\/g, "/").replace(/\/+$/, "");
}
