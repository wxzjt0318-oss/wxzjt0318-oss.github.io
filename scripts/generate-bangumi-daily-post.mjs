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
import {
	DEFAULT_SOURCES,
	fetchCharacterBio,
	fetchWorkEncyclopedia,
	truncateAtSentence,
} from "./wiki/encyclopedia.mjs";
import { findDuplicatePost, postIdentities, seasonKey } from "./wiki/duplicate-guard.mjs";
import { buildTaxonomy } from "./wiki/taxonomy.mjs";
import { applyGlossary } from "./wiki/zh-glossary.mjs";
import {
	cleanChineseProse,
	hasKana,
	isMostlyJapanese,
	jpToSimplified,
	kanaRatio,
	normalizeStudioName,
	toSimplified,
} from "./wiki/zh-text.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT_DIR, "src", "content", "posts");
const STATE_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-posts-state.json");
const REPORT_FILE = path.join(ROOT_DIR, "reports", "bangumi-daily-posts-latest.json");

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";
// 人工撰写的作品引言（封面下方的引用块），按 Bangumi 条目 ID 索引；没有时按剧情自动生成
const QUOTES_FILE = path.join(ROOT_DIR, "scripts", "wiki", "post-quotes.json");
// 与已有文章（多为自主编辑文章）是同一作品而跳过的条目，随每日发文提交
const SKIPPED_FILE = path.join(ROOT_DIR, "scripts", "wiki", "skipped-subjects.json");
// 人工撰写的分类短语与特色标签（按 Bangumi 条目 ID 索引）
const TAXONOMY_FILE = path.join(ROOT_DIR, "scripts", "wiki", "post-taxonomy.json");

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

const BANGUMI_MIN_INTERVAL_MS = 250;
let lastBangumiRequestAt = 0;

async function fetchJson(url, init, retries = 3) {
	for (let attempt = 0; attempt < retries; attempt++) {
		const wait = BANGUMI_MIN_INTERVAL_MS - (Date.now() - lastBangumiRequestAt);
		if (wait > 0) await new Promise((r) => setTimeout(r, wait));
		lastBangumiRequestAt = Date.now();
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
			identities: postIdentities(raw),
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

function summarizeStudio(value) {
	if (!value) return "";
	return normalizeStudioName(String(value).split(/[（(]/)[0].trim());
}

function extractStaff(detail) {
	const infobox = Array.isArray(detail?.infobox) ? detail.infobox : [];
	// 「製作 / 制作」通常是制作委员会（整串日文），不列入
	const interestingKeys = ["原作", "导演", "监督", "系列构成", "人物设定", "音乐", "动画制作"];
	const staff = [];
	for (const key of interestingKeys) {
		const value = pickInfoboxValue({ infobox }, [key]);
		// 纯假名的人名（笔名等）没有通行中文写法，不放进中文正文
		const name = value
			? key === "动画制作"
				? normalizeStudioName(value)
				: cleanChineseProse(jpToSimplified(value)) || jpToSimplified(value)
			: "";
		if (name && !isMostlyJapanese(name)) {
			staff.push({ relation: key, name });
		}
	}
	return staff;
}

function buildMeta(candidate, detail, statusLabel) {
	const studio = summarizeStudio(
		pickInfoboxValue(detail, ["动画制作", "制作公司", "Studio"]),
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

async function fetchBangumiCharacterDetail(characterId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/characters/${characterId}`);
	} catch (error) {
		console.warn(`⚠ Failed to fetch Bangumi character ${characterId}: ${error.message}`);
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

const NARRATOR_RE = /^(ナレーション|ナレーター|旁白|解说|Narrator)$/i;
const RELATION_ORDER = { 主角: 0, 配角: 1, 客串: 2 };

/** 角色中文名：Bangumi 角色 infobox「简体中文名」→ 日文汉字名转简体 → 放弃（纯假名名不进正文） */
export function resolveCharacterNameCn(character, characterDetail) {
	const fromInfobox = toSimplified(
		pickInfoboxValue(characterDetail, ["简体中文名", "中文名", "译名"]),
	).trim();
	if (fromInfobox && !hasKana(fromInfobox)) return fromInfobox;
	const original = String(character?.name || characterDetail?.name || "").trim();
	if (original && !hasKana(original)) return jpToSimplified(original);
	return "";
}

/**
 * 角色资料中文化：Bangumi 角色详情补中文名与基础信息；简介是日文时改用萌娘百科角色条目。
 * 没有中文名的角色与旁白不进入正文。
 */
async function enrichCharacters(characters, { workTitles, fetchDetail, fetchBio }) {
	const list = (Array.isArray(characters) ? characters : [])
		.filter((c) => c?.name && !NARRATOR_RE.test(String(c.name).trim()))
		.sort((a, b) => (RELATION_ORDER[a.relation] ?? 9) - (RELATION_ORDER[b.relation] ?? 9))
		.slice(0, 8);

	const result = [];
	for (const character of list) {
		if (result.length >= 5) break;
		const detail = character.id ? await fetchDetail(character.id) : null;
		const nameCn = resolveCharacterNameCn(character, detail);
		if (!nameCn) {
			console.log(`  · 跳过无中文名角色：${character.name}`);
			continue;
		}

		let description = cleanChineseProse(character.summary || detail?.summary || "");
		let bioSource = null;
		if (description.length < 30) {
			const bio = await fetchBio({ nameCn, workTitles });
			if (bio?.text && bio.text.length > description.length) {
				description = bio.text;
				bioSource = bio.source;
			}
		}
		description = truncateAtSentence(description, 320);

		const actor = Array.isArray(character.actors) ? character.actors[0] : null;
		const birth =
			detail?.birth_mon && detail?.birth_day ? `${detail.birth_mon}月${detail.birth_day}日` : "";
		result.push({
			bioSource,
			name: nameCn,
			name_cn: nameCn,
			description,
			cv: actor?.name ? jpToSimplified(actor.name) : "",
			gender: detail?.gender || "",
			birth,
			blood_type: detail?.blood_type ? ["", "A", "B", "AB", "O"][detail.blood_type] || "" : "",
		});
	}
	return result;
}

const SEASON_SUFFIX = { s2: "season-2", s3: "season-3", s4: "season-4", s5: "season-5", ova: "ova", movie: "movie", part: "part-2" };

function slugifyEnglish(name) {
	return String(name || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80)
		.replace(/-+$/g, "");
}

/** Bangumi infobox「别名」里的全部值 */
function infoboxAliases(detail) {
	const item = (Array.isArray(detail?.infobox) ? detail.infobox : []).find((e) => e?.key === "别名");
	const values = Array.isArray(item?.value) ? item.value : [item?.value];
	return values.map((v) => (typeof v === "string" ? v : v?.v || "")).filter(Boolean);
}

/**
 * 文章英文链接：百科导言里的英文名 → Bangumi 别名里的英文名，再按季度 / OVA / 剧场版加后缀。
 * 都没有时返回空字符串，由调用方回退到 bangumi-<条目ID>。
 */
export function englishAlias({ detail, encyclopedia, titleCn }) {
	const english =
		encyclopedia?.englishTitle ||
		infoboxAliases(detail).find((v) => /^[A-Za-z0-9][A-Za-z0-9 :;'’!?.,&\-–]+$/.test(v) && /\s/.test(v)) ||
		"";
	const base = slugifyEnglish(english);
	if (base.length < 3) return "";
	const suffix = seasonKey(titleCn || "", [detail?.platform].filter(Boolean))
		.split("+")
		.map((k) => SEASON_SUFFIX[k])
		.filter((k) => k && !base.includes(k))
		.join("-");
	return suffix ? `${base}-${suffix}` : base;
}

/** 百科来源 → 文章许可证：引用萌娘百科须遵循 NC-SA，仅引用维基百科须遵循 SA */
function resolveLicense(sources) {
	if (sources.some((s) => s.key === "moegirl")) return "CC BY-NC-SA 3.0";
	if (sources.some((s) => s.key === "wikipedia")) return "CC BY-SA 4.0";
	return "CC BY 4.0";
}

function buildArticlePayload(candidate, detail, imageSelection, options) {
	const { titleCn, titleJp, encyclopedia } = options;
	const articleTitle = `《${titleCn}》`;
	const alias = englishAlias({ detail, encyclopedia, titleCn }) || `bangumi-${candidate.subject_id}`;
	const bangumiSummary = cleanChineseProse(
		detail?.summary || candidate?.subject?.short_summary || "",
	);
	const intro = encyclopedia?.intro || "";
	const story = encyclopedia?.story || "";
	const description = truncateText(
		(intro.split("\n\n")[0] || "").length >= 30
			? intro.split("\n\n")[0]
			: bangumiSummary || intro || titleCn,
		120,
	);
	const statusLabel = deriveStatusLabel(candidate?.type);
	const meta = buildMeta(candidate, detail, statusLabel);
	// 分类与标签对齐自主编辑文章：人工撰写的分类短语 / 特色标签优先，其余由题材、原作类型、放送季度组成
	const { category, tags } = buildTaxonomy({
		rawTags: [
			...(Array.isArray(detail?.tags) ? detail.tags : []),
			...(Array.isArray(candidate?.subject?.tags) ? candidate.subject.tags : []),
		],
		airDate: meta.airDate,
		override: options.taxonomy || null,
	});
	const sources = [...(encyclopedia?.sources || [])];
	for (const character of options.characters || []) {
		const ref = character.bioSource;
		if (ref && !sources.some((s) => s.url === ref.url)) {
			sources.push({ key: "moegirl", label: ref.label, title: ref.title, url: ref.url, license: "CC BY-NC-SA 3.0", usage: "角色资料" });
		}
	}
	return {
		subjectId: candidate.subject_id,
		title: articleTitle,
		originalTitle: titleJp && titleJp !== titleCn ? titleJp : "",
		description,
		overview: intro,
		summary: story || bangumiSummary,
		tags,
		category,
		sourceLink: `https://bgm.tv/subject/${candidate.subject_id}`,
		published: formatDate(options.now),
		alias,
		image: imageSelection.selected?.url || DEFAULT_FALLBACK_IMAGE,
		draft: options.reviewMode,
		meta,
		staff: extractStaff(detail),
		statusLabel,
		characters: options.characters || [],
		references: sources,
		licenseName: resolveLicense(sources),
		quote: options.quote || null,
	};
}

/** 正文日文占比（排除「原作标题」「原名」等刻意保留原文的信息行） */
export function measureJapaneseRatio(markdown) {
	const body = String(markdown || "")
		.replace(/^---\n[\s\S]*?\n---/, "")
		.split("\n")
		.filter((line) => !/\*\*(原作标题|原名|CV)\*\*/.test(line) && !/^!\[/.test(line))
		.join("\n");
	return kanaRatio(body);
}

/** 读取追番快照（或 legacy 缓存），归一化为 Bangumi 收藏条目结构 */
export async function loadSnapshotCollections() {
	// 数据源优先级：
	// 1. 上游 anime:sync 快照 src/data/anime-snapshots/bangumi.json（CI 每日刷新，与追番页同源）
	// 2. 兼容 legacy 缓存 .cache/bangumi/anime.json
	const snapshotFile = path.join(ROOT_DIR, "src", "data", "anime-snapshots", "bangumi.json");
	const legacyCacheFile = path.join(ROOT_DIR, ".cache", "bangumi", "anime.json");
	const snapshot = await readJsonIfExists(snapshotFile, null);
	const legacyCache = snapshot ? null : await readJsonIfExists(legacyCacheFile, null);

	const STATUS_TO_TYPE = { watching: 3, completed: 2, planned: 1, onHold: 4, dropped: 5 };

	let normalizedCollections = [];
	if (Array.isArray(snapshot?.items) && snapshot.items.length > 0) {
		normalizedCollections = snapshot.items
			.map((item) => {
				const subjectId = Number(
					String(item.identity?.subjectId || "").match(/\d+/)?.[0] ||
						String(item.link || "").match(/\/subject\/(\d+)/)?.[1] ||
						0,
				);
				return {
					subject_id: subjectId,
					type: STATUS_TO_TYPE[item.status] || 0,
					ep_status: Number(item.progress?.watched || 0),
					updated_at: item.period?.end || item.period?.start || `${item.year || "1970"}-01-01`,
					subject: {
						id: subjectId,
						name: item.title || "",
						name_cn: item.title || "",
						date: item.period?.start || "",
						eps: Number(item.progress?.total || 0),
						short_summary: item.description || "",
						tags: (Array.isArray(item.genres) ? item.genres : []).map((name) => ({ name })),
						images: {
							large: item.cover || "",
							common: item.cover || "",
							medium: item.cover || "",
						},
					},
				};
			})
			.filter((candidate) => candidate.subject_id > 0);
	} else if (Array.isArray(legacyCache)) {
		normalizedCollections = legacyCache.map((item) => ({
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
		}));
	} else if (Array.isArray(legacyCache?.data)) {
		normalizedCollections = legacyCache.data;
	}
	normalizedCollections = normalizedCollections.filter((candidate) => candidate.subject_id > 0);
	return { collections: normalizedCollections, snapshotFile, legacyCacheFile };
}

/**
 * 为一个收藏条目组装文章数据：抓 Bangumi 详情 / 角色 → 百科增强 → 中文化 → payload。
 * 每日发文与存量重写共用这一流程。
 */
export async function composeArticle(candidate, { now = new Date(), reviewMode = false } = {}) {
	console.log(`📡 Fetching Bangumi subject detail for ${candidate.subject_id}...`);
	const detail = await fetchBangumiSubjectDetail(candidate.subject_id);
	console.log(`📡 Fetching Bangumi characters for ${candidate.subject_id}...`);
	const rawCharacters = await fetchBangumiCharacters(candidate.subject_id);

	console.log(`🖼️ Resolving cover image...`);
	const imageSelection = resolveCoverImage(candidate, detail);
	console.log(`✅ Selected cover: ${imageSelection.selected?.url || "default"}`);

	// 标题：优先 Bangumi 中文名（转简体）；只有日文名时，借助百科条目标题补中文名。
	const titleJp = (detail?.name || candidate?.subject?.name || "").trim();
	let titleCn = toSimplified(detail?.name_cn || candidate?.subject?.name_cn || "").trim();
	if (!titleCn || hasKana(titleCn)) titleCn = "";

	// 百科增强：萌娘百科优先，中文维基百科兜底（BANGUMI_POST_WIKI=0 全部关闭，
	// BANGUMI_POST_MOEGIRL=0 / BANGUMI_POST_WIKIPEDIA=0 单独关闭）。失败时回退 Bangumi 简介。
	let encyclopedia = null;
	if (getEnvBoolean("BANGUMI_POST_WIKI", true)) {
		const sources = DEFAULT_SOURCES.filter((source) =>
			source.key === "moegirl"
				? getEnvBoolean("BANGUMI_POST_MOEGIRL", true)
				: getEnvBoolean("BANGUMI_POST_WIKIPEDIA", true),
		);
		console.log(`📚 查询百科资料（${sources.map((s) => s.label).join(" → ") || "无"}）...`);
		encyclopedia = await fetchWorkEncyclopedia({ titleCn, titleJp }, { sources }).catch((error) => {
			console.warn(`⚠ 百科增强失败，回退 Bangumi 简介：${error.message}`);
			return null;
		});
		for (const ref of encyclopedia?.sources || []) {
			console.log(`  ✓ 已采用${ref.label}条目：${ref.title}`);
		}
	}
	if (!titleCn && encyclopedia?.title && !hasKana(encyclopedia.title)) {
		titleCn = encyclopedia.title;
	}
	if (!titleCn) {
		titleCn = jpToSimplified(titleJp) || `Bangumi 条目 ${candidate.subject_id}`;
		console.warn(`⚠ 未找到中文作品名，暂用原名：${titleCn}`);
	}

	console.log("👥 整理角色中文资料...");
	const fetchBio = getEnvBoolean("BANGUMI_POST_WIKI", true) && getEnvBoolean("BANGUMI_POST_MOEGIRL", true)
		? fetchCharacterBio
		: async () => null;
	const characters = await enrichCharacters(rawCharacters, {
		workTitles: [titleCn, titleJp, encyclopedia?.title].filter(Boolean),
		fetchDetail: fetchBangumiCharacterDetail,
		fetchBio,
	});

	const curatedQuotes = await readJsonIfExists(QUOTES_FILE, {});
	const curatedTaxonomy = await readJsonIfExists(TAXONOMY_FILE, {});
	const payload = buildArticlePayload(candidate, detail, imageSelection, {
		now,
		reviewMode,
		characters,
		titleCn,
		titleJp,
		encyclopedia,
		quote: curatedQuotes[String(candidate.subject_id)] || null,
		taxonomy: curatedTaxonomy[String(candidate.subject_id)] || null,
	});
	return { payload, imageSelection, detail, rawCharacters, encyclopedia, titleCn, titleJp };
}

async function recordSkipped(skipped, item, hit) {
	const id = String(item.subject_id);
	const file = path.basename(hit.file);
	console.log(`⏭ 跳过 ${id}（${item.subject?.name_cn || item.subject?.name}）：与已有文章 ${file} 是同一作品`);
	skipped[id] = { title: item.subject?.name_cn || item.subject?.name || "", duplicateOf: file };
	await fs.writeFile(SKIPPED_FILE, `${JSON.stringify(skipped, null, "\t")}\n`, "utf8");
}

async function main() {
	const reviewMode = getEnvBoolean("BANGUMI_POST_REVIEW_MODE", false);
	const maxPerRun = getEnvNumber("BANGUMI_POSTS_PER_RUN", 1);
	const now = new Date();

	const { collections: normalizedCollections, snapshotFile, legacyCacheFile } = await loadSnapshotCollections();
	if (normalizedCollections.length === 0) {
		console.log(`ℹ No Bangumi snapshot found at ${snapshotFile} (or legacy cache ${legacyCacheFile}), skipping daily article generation.`);
		return;
	}

	const generatedState = await readJsonIfExists(STATE_FILE, { generated: [] });
	const existingPosts = await readExistingPosts();
	// 已判定为「与已有文章重复」的条目：跳过，避免每天重新抓取后再判重一次
	const skipped = await readJsonIfExists(SKIPPED_FILE, {});
	const selectionState = {
		...generatedState,
		generated: [
			...(generatedState.generated || []),
			...Object.keys(skipped).map((id) => ({ subjectId: Number(id) })),
		],
	};
	// 多选几个候选：前面的被判重时顺延到下一个
	const pool = selectNextAnimeCandidate({
		collections: normalizedCollections,
		generatedState: selectionState,
		existingPosts,
		maxPerRun: maxPerRun + 5,
	});
	const selected = [];
	let composed = null;
	for (const item of pool) {
		const quickHit = findDuplicatePost(
			{ titleCn: item.subject?.name_cn, titleJp: item.subject?.name },
			existingPosts,
		);
		if (quickHit) {
			await recordSkipped(skipped, item, quickHit);
			continue;
		}
		console.log(`📝 Generating Bangumi daily post for subject ${item.subject_id}...`);
		const result = await composeArticle(item, { now, reviewMode });
		const hit = findDuplicatePost(
			{
				titleCn: result.titleCn,
				titleJp: result.titleJp,
				encyclopediaTitles: (result.encyclopedia?.sources || []).map((ref) => ref.title),
				forms: [result.detail?.platform, ...(result.payload.tags || [])].filter(Boolean),
			},
			existingPosts,
		);
		if (hit) {
			await recordSkipped(skipped, item, hit);
			continue;
		}
		selected.push(item);
		composed = result;
		break;
	}

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
	const { payload, imageSelection } = composed;

	// Alias 唯一性保障：slugify 归一化会让不同动画撞名（如多部"第二季"都归一化为
	// "2nd-season"，"Working!!" 系列都归一化为 "working"），alias 重复会导致多篇文章
	// 共享同一 URL 互相覆盖。与已有文章 alias 或目标文件名冲突时，回退到稳定的
	// `bangumi-{subjectId}`。
	const fallbackAlias = `bangumi-${candidate.subject_id}`;
	const existingAliases = new Set(existingPosts.map((post) => post.alias).filter(Boolean));
	let safeAlias = sanitizeFileName(payload.alias, fallbackAlias);
	if (safeAlias !== fallbackAlias && existingAliases.has(safeAlias)) {
		console.warn(`⚠ Alias "${safeAlias}" is already taken, falling back to "${fallbackAlias}".`);
		safeAlias = fallbackAlias;
	}
	payload.alias = safeAlias;

	console.log("📝 Building Bangumi article markdown...");
	const articleContent = applyGlossary(buildAnimeArticleMarkdown(payload));
	const japaneseRatio = measureJapaneseRatio(articleContent);
	if (japaneseRatio > 0.03) {
		console.warn(`⚠ 正文仍含 ${(japaneseRatio * 100).toFixed(1)}% 日文假名，请检查：${payload.title}`);
	} else {
		console.log(`✅ 中文检查通过（假名占比 ${(japaneseRatio * 100).toFixed(1)}%）`);
	}

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

	// 文件名固定为 bangumi-<条目ID>.md（各维护脚本依赖这个命名），链接用英文 alias
	let outputFileName = `bangumi-${candidate.subject_id}.md`;
	let outputPath = path.join(POSTS_DIR, outputFileName);

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

const isDirectRun =
	process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
	main().catch((error) => {
		console.error("❌ Bangumi daily post generation failed:", error);
		process.exit(1);
	});
}
