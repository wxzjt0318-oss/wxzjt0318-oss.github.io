import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	DEFAULT_FALLBACK_IMAGE,
	buildAnimeArticleMarkdown,
	buildReviewReport,
	chooseBestCoverImage,
	createStateRecord,
	detectContentDuplication,
	formatDate,
	readJsonIfExists,
	selectNextAnimeCandidate,
	sanitizeFileName,
	slugifyTitle,
	truncateText,
	pickInfoboxValue,
	writeJson,
} from "./bangumi-daily-posts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const STATE_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-posts-state.json");
const REPORT_FILE = path.join(ROOT_DIR, "reports", "bangumi-daily-posts-latest.json");

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";

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

async function fetchJson(url, init, retries = 3) {
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await fetch(url, {
				headers: {
					"accept": "application/json",
					"user-agent": "wxzjt0318-oss-bangumi-daily-posts/1.0",
					...(init?.headers || {}),
				},
				...init,
			});
			if (response.status === 429) {
				const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000);
				console.warn(`⚠ Rate limited (429) on ${url}, waiting ${waitMs}ms before retry...`);
				await new Promise(r => setTimeout(r, waitMs));
				continue;
			}
			if (!response.ok) {
				throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
			}
			return await response.json();
		} catch (error) {
			if (attempt === retries - 1) throw error;
			const waitMs = 1000 * (attempt + 1);
			console.warn(`⚠ Request failed (attempt ${attempt + 1}/${retries}): ${error.message}, retrying in ${waitMs}ms...`);
			await new Promise(r => setTimeout(r, waitMs));
		}
	}
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
		const bodyStart = raw.indexOf(match[0]) + match[0].length;
		const body = raw.slice(bodyStart).trim();
		const getField = (name) => {
			const fieldMatch = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
			if (!fieldMatch) return "";
			return fieldMatch[1].trim().replace(/^['\"]|['\"]$/g, "");
		};
		const getArrayField = (name) => {
			const fieldMatch = frontmatter.match(new RegExp(`^${name}:\\s*\\[([\\s\\S]*?)\\]`, "m"));
			if (!fieldMatch) return [];
			return fieldMatch[1].split(",").map(s => s.trim().replace(/^['\"]|['\"]$/g, "")).filter(Boolean);
		};
		posts.push({
			filePath: fullPath,
			title: getField("title"),
			description: getField("description"),
			tags: getArrayField("tags"),
			body,
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

async function fetchBangumiCharacters(subjectId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/subjects/${subjectId}/characters`);
	} catch (error) {
		console.warn(`⚠ Failed to fetch Bangumi characters for ${subjectId}: ${error.message}`);
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

function resolveCoverImage(candidate, detail) {
	const names = [candidate?.subject?.name_cn, candidate?.subject?.name, detail?.name_cn, detail?.name].filter(Boolean);
	const bangumiCandidates = collectBangumiImageCandidates(candidate, detail);
	const result = chooseBestCoverImage(bangumiCandidates, { names });
	if (result.selected) {
		return result;
	}
	return {
		selected: { url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback" },
		candidates: [{ url: DEFAULT_FALLBACK_IMAGE, source: "fallback-default", title: names[0] || "fallback", score: 0 }],
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
		draft: options.reviewMode,
		meta,
		staff: extractStaff(detail),
		statusLabel,
		characters: options.characters || [],
	};
}

async function main() {
	const reviewMode = getEnvBoolean("BANGUMI_POST_REVIEW_MODE", false);
	const maxPerRun = getEnvNumber("BANGUMI_POSTS_PER_RUN", 1);
	const cacheFile = path.join(ROOT_DIR, ".cache", "bangumi", "anime.json");
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
	const titleText = candidate?.subject?.name_cn || candidate?.subject?.name || "";
	console.log(`📡 Fetching Bangumi subject detail for ${candidate.subject_id}...`);
	const detail = await fetchBangumiSubjectDetail(candidate.subject_id);
	console.log(`📡 Fetching Bangumi characters for ${candidate.subject_id}...`);
	const characters = await fetchBangumiCharacters(candidate.subject_id);

	console.log(`🖼️ Resolving cover image...`);
	const imageSelection = resolveCoverImage(candidate, detail);
	console.log(`✅ Selected cover: ${imageSelection.selected?.url || "default"}`);

	const payload = buildArticlePayload(candidate, detail, imageSelection, {
		now,
		reviewMode,
		characters,
	});

	console.log("📝 Building Bangumi article markdown...");
	const articleContent = buildAnimeArticleMarkdown(payload);

	console.log("🔍 Checking for content duplication...");
	const newArticle = {
		title: payload.title,
		description: payload.description,
		tags: payload.tags,
		body: articleContent,
	};
	const duplicationCheck = detectContentDuplication(newArticle, existingPosts, {
		similarityThreshold: 70,
		titleWeight: 0.4,
		descriptionWeight: 0.3,
		bodyWeight: 0.3,
		includeDetails: true,
	});

	if (duplicationCheck.hasDuplicate) {
		console.warn(duplicationCheck.message);
		console.warn("⚠️ Content duplication detected, stopping post generation to avoid duplicates.");
		console.warn("   (Set BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE=1 to override and continue)");

		const allowDuplicate = getEnvBoolean("BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE", false);
		if (!allowDuplicate) {
			console.warn("❌ Stopping due to duplicate content (override with BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE=1)");
			process.exit(0);
		}
		console.warn("ℹ️ Overriding duplicate check and continuing with post generation (BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE=1)");
	} else {
		console.log("✅ No content duplication detected.");
	}

	let safeAlias = sanitizeFileName(payload.alias, `bangumi-${candidate.subject_id}`);
	let outputFileName = `${safeAlias}.md`;
	let outputPath = path.join(POSTS_DIR, outputFileName);

	if (existsSync(outputPath)) {
		safeAlias = `bangumi-${candidate.subject_id}`;
		outputFileName = `${safeAlias}.md`;
		outputPath = path.join(POSTS_DIR, outputFileName);
	}

	const relativeOutputPath = path.relative(ROOT_DIR, outputPath).split(path.sep).join("/");

	await fs.writeFile(outputPath, articleContent, "utf8");
	console.log(`✅ Article written to ${outputPath}`);

	const newRecord = createStateRecord({
		subjectId: candidate.subject_id,
		title: payload.title,
		filePath: relativeOutputPath,
		alias: safeAlias,
		sourceLink: payload.sourceLink,
		published: payload.published,
		image: payload.image,
		reviewMode,
	});

	generatedState.generated = [
		...(generatedState.generated || []),
		newRecord,
	];
	await writeJson(STATE_FILE, generatedState);
	console.log(`✅ Updated state file ${STATE_FILE}`);

	await writeJson(REPORT_FILE, buildReviewReport({
		selected: candidate,
		candidates: imageSelection.candidates,
		outputPath,
		statePath: STATE_FILE,
		reviewMode,
	}));
	console.log(`✅ Generated report ${REPORT_FILE}`);
	console.log(`🎉 Bangumi daily post generation completed successfully!`);
}

main().catch((error) => {
	console.error("❌ Bangumi daily post generation failed:", error);
	process.exit(1);
});
