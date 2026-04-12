import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_FILE = path.join(ROOT_DIR, ".cache", "bangumi", "anime.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "src", "data", "bangumi-data.json");

function getStudioFromInfobox(infobox) {
	if (!Array.isArray(infobox)) return "Unknown";

	const targetKeys = ["动画制作", "制作", "製作", "开发"];
	for (const key of targetKeys) {
		const item = infobox.find((entry) => entry?.key === key);
		if (!item) continue;
		if (typeof item.value === "string") {
			return item.value;
		}
		if (Array.isArray(item.value)) {
			const validItem = item.value.find((value) => value?.v);
			if (validItem?.v) return validItem.v;
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

function transformItem(item) {
	const subject = item?.subject || {};
	const detail = item?.subjectDetail || {};
	const subjectId = subject.id || item?.subject_id || 0;
	const ratingValue = item?.rate ?? subject.score ?? 0;
	const progress = Number(item?.ep_status || 0);
	const totalEpisodes = Number(subject.eps || progress || 0);
	const dateValue = subject.date || detail.date || "";
	const year = dateValue ? String(dateValue).slice(0, 4) : "Unknown";
	const tags = Array.isArray(subject.tags)
		? subject.tags.slice(0, 3).map((tag) => (typeof tag === "string" ? tag : tag?.name)).filter(Boolean)
		: ["Unknown"];

	return {
		title: subject.name_cn || subject.name || "Unknown Title",
		status: mapCollectionTypeToStatus(item?.type),
		rating: Number(Number(ratingValue || 0).toFixed(1)),
		cover: subject?.images?.medium || subject?.images?.common || "/assets/anime/default.webp",
		description: (detail?.summary || subject.short_summary || subject.name_cn || subject.name || "").trimStart(),
		episodes: totalEpisodes > 0 ? `${totalEpisodes} episodes` : "Unknown",
		year,
		genre: tags.length > 0 ? tags : ["Unknown"],
		studio: getStudioFromInfobox(detail?.infobox),
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
	const result = items.map(transformItem);
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
