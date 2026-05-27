import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_FILE = path.join(ROOT_DIR, ".cache", "bangumi", "anime.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-data.json");

const BANGUMI_API_BASE = "https://api.bgm.tv/v0";
const MAX_CONCURRENT = 5;
const REQUEST_DELAY_MS = 200;

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": "wxzjt0318-oss-sync-bangumi-cache/1.0",
		},
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} (${url})`);
	}
	return response.json();
}

async function fetchSubjectDetail(subjectId) {
	try {
		return await fetchJson(`${BANGUMI_API_BASE}/subjects/${subjectId}`);
	} catch (error) {
		console.warn(`⚠ Failed to fetch detail for subject ${subjectId}: ${error.message}`);
		return null;
	}
}

async function fetchAllSubjectDetails(subjectIds) {
	const detailMap = new Map();
	const queue = [...subjectIds];
	let running = 0;

	await new Promise((resolve) => {
		function runNext() {
			if (queue.length === 0 && running === 0) {
				resolve();
				return;
			}
			while (running < MAX_CONCURRENT && queue.length > 0) {
				const id = queue.shift();
				running++;
				setTimeout(() => {
					fetchSubjectDetail(id).then((detail) => {
						if (detail) {
							detailMap.set(id, detail);
						}
					}).finally(() => {
						running--;
						runNext();
					});
				}, REQUEST_DELAY_MS);
			}
		}
		runNext();
	});

	return detailMap;
}

function cleanStudioName(raw, key) {
	if (!raw || typeof raw !== "string") return raw;
	if (key === "动画制作") return raw;
	if (raw.length <= 40) return raw;
	const PERSON_RE = /^[\u3040-\u309f\u30a0-\u30ff]{1,3}[\u4e00-\u9fff]{1,4}$/;
	const inSquare = raw.match(/[【\[]([^】\]]+)[】\]]/);
	if (inSquare) {
		const parts = inSquare[1].split(/[、,，]/);
		for (const p of parts) {
			const cleaned = p.replace(/[（(][^）)]*[）)]/g, "").trim();
			if (cleaned.length > 1 && !PERSON_RE.test(cleaned)) return cleaned;
		}
	}
	const inParens = raw.match(/[（(]([^）)]+)[）)]/);
	if (inParens) {
		const parts = inParens[1].split(/[、,，]/);
		for (const p of parts) {
			const trimmed = p.trim();
			if (trimmed.length > 1 && !PERSON_RE.test(trimmed)) return trimmed;
		}
	}
	const before = raw.split(/製作委員会|制作委员会|製作委員/)[0];
	if (before && before !== raw) {
		const cleaned = before.replace(/[「」『』【】\[\]]/g, "").trim();
		if (cleaned.length > 1) return cleaned;
	}
	return raw.length > 60 ? raw.slice(0, 57) + "..." : raw;
}

function getStudioFromInfobox(infobox) {
	if (!Array.isArray(infobox)) return "Unknown";

	const targetKeys = ["动画制作", "制作", "製作", "开发"];
	for (const key of targetKeys) {
		const item = infobox.find((entry) => entry?.key === key);
		if (!item) continue;
		if (typeof item.value === "string") {
			return cleanStudioName(item.value, key);
		}
		if (Array.isArray(item.value)) {
			const validItem = item.value.find((value) => value?.v);
			if (validItem?.v) return cleanStudioName(validItem.v, key);
		}
	}

	return "Unknown";
}

const KNOWN_STUDIOS = new Set([
	"a-1 pictures", "a-1pictures", "bones", "kyoto animation", "kyotoanimation",
	"madhouse", "shaft", "ufotable", "trigger", "cloverworks", "clover works",
	"lidenfilms", "liden films", "p.a. works", "pa works", "passione",
	"white fox", "silver link", "silverlink", "diomedéa", "diomedea",
	"typhoon graphics", "connect", "tezuka productions", "toei animation",
	"tms entertainment", "sunrise", "production ig", "production.ig",
	"j.c.staff", "jc staff", "feel.", "feel", "studio 3hz", "3hz",
	"studio bind", "mappa", "studio kafka", "kafka", "studio kai", "studiokai",
	"studio colorido", "colorido", "studio pierrot", "pierrot",
	"studio deen", "deen", "asread", "tnk", "satelight", "brains base",
	"brainsbase", "production ims", "lerche", "studio gokumi", "gokumi",
	"studio mili", "encourage films", "project no.9", "project no.6",
	"studio elle", "seven", "seven arcs", "arvo animation", "cloud hearts",
	"yokohama animation laboratory", "na", "signal.md", "liberation",
	"c2c", "studio polon", "bazooka studios", "studio massket",
	"hornet", "rabbit gate", "quad", "studio ling", "studio hōkiboshi",
]);

function getStudioFromTags(tags) {
	if (!Array.isArray(tags)) return "Unknown";
	for (const tag of tags) {
		const name = (typeof tag === "string" ? tag : tag?.name || "").trim();
		if (!name) continue;
		const norm = name.toLowerCase().replace(/[\s\-_.]/g, "");
		if (KNOWN_STUDIOS.has(norm)) return name;
		for (const studio of KNOWN_STUDIOS) {
			if (norm.includes(studio.replace(/[\s\-_.]/g, ""))) return name;
		}
	}
	return "Unknown";
}

function mapCollectionTypeToStatus(type) {
	switch (type) {
		case 3:
			return "watching";
		case 2:
			return "completed";
		case 1:
			return "planned";
		case 4:
			return "onhold";
		case 5:
			return "dropped";
		default:
			return "planned";
	}
}

function normalizeArray(input) {
	if (Array.isArray(input)) {
		return input;
	}
	if (Array.isArray(input?.data)) {
		return input.data;
	}
	return [];
}

function transformItem(item, detailFromApi) {
	const subject = item?.subject || {};
	const detail = detailFromApi || item?.subjectDetail || {};
	const subjectId = subject.id || item?.subject_id || 0;
	const ratingValue = item?.rate ?? subject.score ?? 0;
	const progress = Number(item?.ep_status || 0);
	const totalEpisodes = Number(subject.eps || progress || 0);
	const dateValue = subject.date || detail.date || "";
	const year = dateValue ? String(dateValue).slice(0, 4) : "Unknown";
	const tags = Array.isArray(subject.tags)
		? subject.tags.slice(0, 3).map((tag) => (typeof tag === "string" ? tag : tag?.name)).filter(Boolean)
		: ["Unknown"];

	const studioFromInfobox = getStudioFromInfobox(detail?.infobox);
	const studio = studioFromInfobox !== "Unknown"
		? studioFromInfobox
		: getStudioFromTags(detail?.tags || subject?.tags || []);

	return {
		title: subject.name_cn || subject.name || "Unknown Title",
		status: mapCollectionTypeToStatus(item?.type),
		rating: Number(Number(ratingValue || 0).toFixed(1)),
		cover: subject?.images?.medium || subject?.images?.common || "/assets/anime/default.webp",
		description: (detail?.summary || subject.short_summary || subject.name_cn || subject.name || "").trimStart(),
		episodes: totalEpisodes > 0 ? `${totalEpisodes} episodes` : "Unknown",
		year,
		genre: tags.length > 0 ? tags : ["Unknown"],
		studio,
		link: subjectId ? `https://bgm.tv/subject/${subjectId}` : "#",
		progress,
		totalEpisodes,
		startDate: dateValue,
		endDate: dateValue,
		updatedAt: item?.updated_at || item?.updatedAt || "",
	};
}

async function main() {
	const raw = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
	const items = normalizeArray(raw);

	const subjectIds = items
		.map((item) => Number(item?.subject?.id || item?.subject_id || 0))
		.filter((id) => id > 0);

	console.log(`📡 Fetching subject details for ${subjectIds.length} items...`);
	const detailMap = await fetchAllSubjectDetails(subjectIds);
	console.log(`✅ Fetched details for ${detailMap.size}/${subjectIds.length} items`);

	const result = items.map((item) => {
		const subjectId = Number(item?.subject?.id || item?.subject_id || 0);
		return transformItem(item, detailMap.get(subjectId) || null);
	});
	const statusStats = result.reduce(
		(stats, item) => {
			stats[item.status] = (stats[item.status] || 0) + 1;
			return stats;
		},
		{ watching: 0, completed: 0, planned: 0, onhold: 0, dropped: 0 },
	);

	await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, "utf8");

	console.log(`✅ Synced ${result.length} Bangumi anime items to ${OUTPUT_FILE}`);
	console.log(
		`📊 Status stats: watching=${statusStats.watching}, completed=${statusStats.completed}, planned=${statusStats.planned}, onhold=${statusStats.onhold}, dropped=${statusStats.dropped}`,
	);
}

main().catch((error) => {
	console.error("✘ Failed to sync Bangumi cache to src/data/bangumi-data.json");
	console.error(error);
	process.exit(1);
});
