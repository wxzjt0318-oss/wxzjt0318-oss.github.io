import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	DEFAULT_FALLBACK_IMAGE,
	buildAnimeArticleMarkdown,
	buildReviewReport,
	chooseBestCoverImage,
	createStateRecord,
	formatDate,
	readJsonIfExists,
	selectNextAnimeCandidate,
	sanitizeFileName,
	slugifyTitle,
	truncateText,
	pickInfoboxValue,
	pickRandomBodyImages,
	writeJson,
} from "./bangumi-daily-posts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const CACHE_DIR = path.join(ROOT_DIR, ".cache", "bangumi");
const STATE_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-posts-state.json");
const REPORT_FILE = path.join(ROOT_DIR, "reports", "bangumi-daily-posts-latest.json");
const DEFAULT_CACHE_FILE = path.join(CACHE_DIR, "anime.json");

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";
const JIKAN_API_BASE = "https://api.jikan.moe/v4";

function getEnvBoolean(name, defaultValue = false) {
	const raw = process.env[name];
	if (raw == null || raw === "") {
		return defaultValue;
	}
	return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function getEnvNumber(name, defaultValue) {
	const raw = Number(process.env[name]);
	return Number.isFinite(raw) && raw > 0 ? raw : defaultValue;
}

async function fetchJson(url, init) {
	const response = await fetch(url, {
		headers: {
			"accept": "application/json",
			"user-agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
			...(init?.headers || {}),
		},
		...init,
	});
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
	}
	return await response.json();
}

async function readExistingPosts() {
	const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
	const posts = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) {
			continue;
		}
		const fullPath = path.join(POSTS_DIR, entry.name);
		const raw = await fs.readFile(fullPath, "utf8");
		const match = raw.match(/^---\n([\s\S]*?)\n---/);
		if (!match) {
			continue;
		}
		const frontmatter = match[1];
		const getField = (name) => {
			const fieldMatch = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
			if (!fieldMatch) return "";
			return fieldMatch[1].trim().replace(/^['\"]|['\"]$/g, "");
		};
		posts.push({
			filePath: fullPath,
			title: getField("title"),
			alias: getField("alias"),
			sourceLink: getField("sourceLink"),
		});
	}
	return posts;
}

function deriveStatusLabel(type) {
	const mapping = {
		1: "想看",
		2: "看过",
		3: "在看",
		4: "搁置",
		5: "抛弃",
	};
	return mapping[type] || "已收藏";
}

function buildTags(candidate, detail) {
	const tags = [];
	const subjectTags = Array.isArray(candidate?.subject?.tags) ? candidate.subject.tags : [];
	for (const tag of subjectTags) {
		const name = typeof tag === "string" ? tag : tag?.name;
		if (name && !tags.includes(name)) {
			tags.push(name);
		}
		if (tags.length >= 5) break;
	}
	const platform = pickInfoboxValue(detail, ["放送星期", "播放电视台", "平台"]);
	if (platform && !tags.includes(platform) && tags.length < 6) {
		tags.push(platform);
	}
	if (!tags.includes("Bangumi") && tags.length < 6) {
		tags.push("Bangumi");
	}
	return tags;
}

function summarizeStudio(value) {
	if (!value) return "";
	return String(value).split(/[（(]/)[0].trim();
}

function extractStaff(detail) {
	const infobox = Array.isArray(detail?.infobox) ? detail.infobox : [];
	const interestingKeys = ["导演", "监督", "系列构成", "人物设定", "动画制作", "製作", "制作"];
	const staff = [];
	for (const key of interestingKeys) {
		const value = pickInfoboxValue({ infobox }, [key]);
		if (value) {
			staff.push({ relation: key, name: value });
		}
	}
	return staff;
}

function buildMeta(candidate, detail, statusLabel) {
	const studio = summarizeStudio(
		pickInfoboxValue(detail, ["动画制作", "製作", "制作", "制作公司", "Studio"]),
	);
	const airDate = candidate?.subject?.date || detail?.date || "";
	const episodes = candidate?.subject?.eps || detail?.eps || candidate?.ep_status || "";
	return {
		studio,
		airDate,
		episodes: episodes ? `${episodes} 话` : "",
		progress: candidate?.ep_status ? `已看到 ${candidate.ep_status} 话` : "",
		statusLabel,
	};
}

async function fetchBangumiSubjectDetail(subjectId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/subjects/${subjectId}`);
	} catch (error) {
		console.warn(`⚠ Failed to fetch Bangumi subject detail for ${subjectId}: ${error.message}`);
		return null;
	}
}

async function fetchJikanImageCandidates(name) {
	if (!name) return [];
	try {
		const result = await fetchJson(`${JIKAN_API_BASE}/anime?q=${encodeURIComponent(name)}&limit=5`);
		const list = Array.isArray(result?.data) ? result.data : [];
		return list
			.flatMap((item) => {
				const jpg = item?.images?.jpg?.large_image_url || item?.images?.jpg?.image_url;
				const webp = item?.images?.webp?.large_image_url || item?.images?.webp?.image_url;
				return [jpg, webp]
					.filter(Boolean)
					.map((url) => ({
						url,
						title: item?.title || item?.title_english || item?.title_japanese || "",
						year: item?.year || "",
						width: 720,
						height: 1080,
						source: "jikan-search",
					}));
			})
			.slice(0, 6);
	} catch (error) {
		console.warn(`⚠ Failed to search fallback image via Jikan: ${error.message}`);
		return [];
	}
}

function collectBangumiImageCandidates(candidate, detail) {
	const images = [];
	const subject = candidate?.subject || {};
	const detailImages = detail?.images || {};
	const add = (url, source, width, height, title) => {
		if (!url) return;
		images.push({ url, source, width, height, title });
	};
	add(detailImages.large, "bangumi-large", 1200, 1700, subject?.name_cn || subject?.name || detail?.name);
	add(detailImages.common, "bangumi-common", 900, 1280, subject?.name_cn || subject?.name || detail?.name);
	add(subject?.images?.large, "bangumi-large", 1200, 1700, subject?.name_cn || subject?.name);
	add(subject?.images?.common, "bangumi-common", 900, 1280, subject?.name_cn || subject?.name);
	add(subject?.images?.medium, "bangumi-medium", 600, 800, subject?.name_cn || subject?.name);
	return images;
}

async function resolveCoverImage(candidate, detail) {
	const names = [candidate?.subject?.name_cn, candidate?.subject?.name, detail?.name_cn, detail?.name].filter(Boolean);
	const bangumiCandidates = collectBangumiImageCandidates(candidate, detail);
	const jikanCandidates = bangumiCandidates.length > 0 ? [] : await fetchJikanImageCandidates(names[0] || names[1] || "");
	const allCandidates = [...bangumiCandidates, ...jikanCandidates];
	const result = chooseBestCoverImage(allCandidates, {
		names,
		year: (candidate?.subject?.date || "").slice(0, 4),
	});
	if (result.selected) {
		return {
			...result,
			bodyImages: pickRandomBodyImages(
				result.candidates.map((item) => ({
					url: item.url,
					alt: `${names[0] || names[1] || "动漫作品"} 相关图片`,
				})),
				result.selected.url,
				3,
				`${candidate.subject_id}-${names[0] || names[1] || "anime"}`,
			),
		};
	}
	return {
		selected: { url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback" },
		candidates: [{ url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback", score: 0 }],
		bodyImages: [
			{ url: DEFAULT_FALLBACK_IMAGE, alt: `${names[0] || "动漫作品"} 相关图片 1` },
			{ url: DEFAULT_FALLBACK_IMAGE, alt: `${names[0] || "动漫作品"} 相关图片 2` },
			{ url: DEFAULT_FALLBACK_IMAGE, alt: `${names[0] || "动漫作品"} 相关图片 3` },
		],
	};
}

function buildArticlePayload(candidate, detail, imageSelection, options) {
	const titleText = candidate?.subject?.name_cn || candidate?.subject?.name || detail?.name_cn || detail?.name || `Bangumi 条目 ${candidate.subject_id}`;
	const articleTitle = `《${titleText}》`;
	const alias = slugifyTitle(candidate?.subject?.name || candidate?.subject?.name_cn || titleText, `bangumi-${candidate.subject_id}`);
	const description = truncateText(
		detail?.summary || candidate?.subject?.short_summary || candidate?.subject?.name_cn || candidate?.subject?.name,
		120,
	);
	const statusLabel = deriveStatusLabel(candidate?.type);
	const tags = buildTags(candidate, detail);
	const meta = buildMeta(candidate, detail, statusLabel);
	return {
		subjectId: candidate.subject_id,
		title: articleTitle,
		originalTitle: candidate?.subject?.name || detail?.name || "",
		description,
		summary: (detail?.summary || candidate?.subject?.short_summary || "").trim(),
		tags,
		category: tags[0] ? `${tags[0]}作品介绍` : "Bangumi 每日追番",
		sourceLink: `https://bgm.tv/subject/${candidate.subject_id}`,
		published: formatDate(options.now),
		alias,
		image: imageSelection.selected?.url || DEFAULT_FALLBACK_IMAGE,
		bodyImages: imageSelection.bodyImages || [],
		draft: options.reviewMode,
		meta,
		staff: extractStaff(detail),
		statusLabel,
		reviewMode: options.reviewMode,
	};
}

async function main() {
	const reviewMode = getEnvBoolean("BANGUMI_POST_REVIEW_MODE", false);
	const maxPerRun = getEnvNumber("BANGUMI_POSTS_PER_RUN", 1);
	const cacheFile = process.env.BANGUMI_ANIME_CACHE_FILE
		? path.resolve(ROOT_DIR, process.env.BANGUMI_ANIME_CACHE_FILE)
		: path.join(ROOT_DIR, "src", "data", "bangumi-data.json");
	const now = new Date();

	const rawCollections = await readJsonIfExists(cacheFile, null);
	const normalizedCollections = Array.isArray(rawCollections)
		? rawCollections.map((item) => ({
			subject_id: Number(String(item.link || "").match(/\/subject\/(\d+)/)?.[1] || 0),
			type: item.status === "watching" ? 3 : item.status === "completed" ? 2 : item.status === "planned" ? 1 : item.status === "on_hold" ? 4 : item.status === "dropped" ? 5 : 0,
			ep_status: Number(item.progress || 0),
			updated_at: item.endDate || item.startDate || `${item.year || "1970"}-01-01`,
			subject: {
				id: Number(String(item.link || "").match(/\/subject\/(\d+)/)?.[1] || 0),
				name: item.title || "",
				name_cn: item.title || "",
				date: item.startDate || "",
				eps: Number(item.totalEpisodes || 0),
				short_summary: item.description || "",
				tags: Array.isArray(item.genre) ? item.genre.map((name) => ({ name })) : [],
				images: {
					large: item.cover || "",
					common: item.cover || "",
					medium: item.cover || "",
				},
			},
		}))
		: Array.isArray(rawCollections?.data)
			? rawCollections.data
			: [];
	if (normalizedCollections.length === 0) {
		console.log(`ℹ No Bangumi anime cache data found at ${cacheFile}, skipping daily article generation.`);
		return;
	}

	const generatedState = await readJsonIfExists(STATE_FILE, { generated: [] });
	const existingPosts = await readExistingPosts();
	const selected = selectNextAnimeCandidate({
		collections: normalizedCollections,
		generatedState,
		existingPosts,
		maxPerRun,
	});

	if (selected.length === 0) {
		console.log("ℹ No new Bangumi anime candidates available for article generation.");
		await writeJson(REPORT_FILE, buildReviewReport({
			selected: null,
			candidates: [],
			outputPath: "",
			statePath: STATE_FILE,
			reviewMode,
		}));
		return;
	}

	const candidate = selected[0];
	console.log(`📝 Generating Bangumi daily post for subject ${candidate.subject_id}...`);
	const detail = (await fetchBangumiSubjectDetail(candidate.subject_id)) || {};
	const imageSelection = await resolveCoverImage(candidate, detail);
	const payload = buildArticlePayload(candidate, detail, imageSelection, { reviewMode, now });
	const markdown = buildAnimeArticleMarkdown(payload);
	const fileName = `${sanitizeFileName(payload.title.replace(/^《|》$/g, ""))}.md`;
	const outputPath = path.join(POSTS_DIR, fileName);

	try {
		await fs.access(outputPath);
		console.log(`ℹ Post already exists at ${outputPath}, skipping write.`);
		return;
	} catch {}

	await fs.writeFile(outputPath, markdown, "utf8");
	console.log(`✅ Wrote generated article: ${path.relative(ROOT_DIR, outputPath)}`);

	const nextState = {
		generated: [
			createStateRecord({
				subjectId: payload.subjectId,
				title: payload.title,
				filePath: path.relative(ROOT_DIR, outputPath).replace(/\\/g, "/"),
				alias: payload.alias,
				sourceLink: payload.sourceLink,
				published: payload.published,
				image: payload.image,
				reviewMode,
			}),
			...((generatedState?.generated || []).filter((entry) => Number(entry.subjectId) !== Number(payload.subjectId))),
		],
	};
	await writeJson(STATE_FILE, nextState);
	await writeJson(REPORT_FILE, buildReviewReport({
		selected: payload,
		candidates: imageSelection.candidates,
		outputPath: path.relative(ROOT_DIR, outputPath).replace(/\\/g, "/"),
		statePath: path.relative(ROOT_DIR, STATE_FILE).replace(/\\/g, "/"),
		reviewMode,
	}));
	console.log(`✅ Updated state: ${path.relative(ROOT_DIR, STATE_FILE)}`);
	console.log(`✅ Wrote review report: ${path.relative(ROOT_DIR, REPORT_FILE)}`);
}

main().catch((error) => {
	console.error("✘ Bangumi daily post generation failed");
	console.error(error);
	process.exit(1);
});
