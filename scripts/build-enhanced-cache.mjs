import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", ".cache", "bangumi");

const BANGUMI_TYPE = {
	ANIME: 2,
	ANIME_WATCHING: 3,
	GAME: 4,
};

const CONTENT_TYPE = {
	ANIME: "anime",
	GAME: "game",
	UNKNOWN: "unknown",
};

function detectContentType(subject, itemType) {
	const subjectType = subject?.type;

	if (subjectType === 2) {
		return CONTENT_TYPE.ANIME;
	}
	if (subjectType === 4) {
		return CONTENT_TYPE.GAME;
	}

	const genre = subject?.tags?.map(t => t.name?.toLowerCase()) || [];
	const keywords = [...genre];

	if (keywords.some(k => ["游戏", "game", "galgame", "avg", "slg", "rpg", "stg", "fps", "美少女游戏"].includes(k))) {
		return CONTENT_TYPE.GAME;
	}
	if (keywords.some(k => ["动画", "anime", "ova", "tv"].includes(k))) {
		return CONTENT_TYPE.ANIME;
	}

	return CONTENT_TYPE.UNKNOWN;
}

function normalizeItem(item) {
	const subject = item.subject;
	const type = item.type;
	const subjectType = item.subject_type;

	let contentType;
	if (subjectType === 2) {
		contentType = CONTENT_TYPE.ANIME;
	} else if (subjectType === 4) {
		contentType = CONTENT_TYPE.GAME;
	} else {
		contentType = detectContentType(subject, type);
	}

	return {
		link: `/subject/${subject?.id}`,
		title: subject?.name_cn || subject?.name || "",
		titleRaw: subject?.name || "",
		status: getStatusLabel(type),
		progress: item.ep_status || 0,
		startDate: subject?.date || "",
		endDate: "",
		year: subject?.date ? subject.date.split("-")[0] : "",
		totalEpisodes: subject?.eps || 0,
		description: subject?.short_summary || "",
		cover: subject?.images?.large || subject?.images?.common || "",
		genre: subject?.tags?.slice(0, 5).map(t => t.name) || [],
		contentType: contentType,
		subjectId: subject?.id,
		subjectType: subjectType,
		tags: subject?.tags?.map(t => t.name) || [],
		raw: subject,
	};
}

function getStatusLabel(type) {
	switch (type) {
		case 1: return "wish";
		case 2: return "collect";
		case 3: return "doing";
		case 4: return "on_hold";
		case 5: return "dropped";
		default: return "unknown";
	}
}

async function convertCollectionsToCache() {
	const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
	const collectionFiles = entries
		.filter(e => e.isFile() && e.name.startsWith("collection-"))
		.map(e => e.name);

	const animeItems = [];
	const gameItems = [];
	const unknownItems = [];
	const classificationErrors = [];

	let totalProcessed = 0;
	let totalSkipped = 0;

	for (const file of collectionFiles) {
		const filePath = path.join(CACHE_DIR, file);
		let raw;
		try {
			raw = await fs.readFile(filePath, "utf8");
		} catch (e) {
			console.warn(`⚠️ 无法读取 ${file}: ${e.message}`);
			continue;
		}

		let data;
		try {
			data = JSON.parse(raw);
		} catch (e) {
			console.warn(`⚠️ 跳过 ${file} - 无效 JSON`);
			totalSkipped++;
			continue;
		}

		let items = [];
		if (Array.isArray(data)) {
			items = data;
		} else if (data?.data?.data && Array.isArray(data.data.data)) {
			items = data.data.data;
		} else if (data?.data && Array.isArray(data.data)) {
			items = data.data;
		}

		for (const item of items) {
			totalProcessed++;
			if (!item.subject) {
				totalSkipped++;
				continue;
			}

			const normalized = normalizeItem(item);

			if (normalized.contentType === CONTENT_TYPE.ANIME) {
				animeItems.push(normalized);
			} else if (normalized.contentType === CONTENT_TYPE.GAME) {
				gameItems.push(normalized);
			} else {
				unknownItems.push(normalized);
				classificationErrors.push({
					subjectId: normalized.subjectId,
					title: normalized.title,
					detectedType: "unknown",
					reason: "无法通过类型字段判断内容类型",
					suggestion: "请检查 tags 和其他元数据以确定正确分类",
				});
			}
		}
	}

	const indexData = {
		version: "2.0",
		updatedAt: new Date().toISOString(),
		stats: {
			totalProcessed,
			totalSkipped,
			animeCount: animeItems.length,
			gameCount: gameItems.length,
			unknownCount: unknownItems.length,
			classificationErrorCount: classificationErrors.length,
		},
		classification: {
			anime: CONTENT_TYPE.ANIME,
			game: CONTENT_TYPE.GAME,
			unknown: CONTENT_TYPE.UNKNOWN,
		},
		files: {
			anime: "anime.json",
			game: "games.json",
			unknown: "unclassified.json",
			index: "cache-index.json",
		},
	};

	await fs.writeFile(path.join(CACHE_DIR, "anime.json"), JSON.stringify(animeItems, null, 2), "utf8");
	await fs.writeFile(path.join(CACHE_DIR, "games.json"), JSON.stringify(gameItems, null, 2), "utf8");
	await fs.writeFile(path.join(CACHE_DIR, "unclassified.json"), JSON.stringify(unknownItems, null, 2), "utf8");
	await fs.writeFile(path.join(CACHE_DIR, "cache-index.json"), JSON.stringify(indexData, null, 2), "utf8");

	if (classificationErrors.length > 0) {
		await fs.writeFile(path.join(CACHE_DIR, "classification-errors.json"), JSON.stringify(classificationErrors, null, 2), "utf8");
	}

	console.log("\n📊 缓存生成报告");
	console.log("═".repeat(50));
	console.log(`总处理条目: ${totalProcessed}`);
	console.log(`跳过条目: ${totalSkipped}`);
	console.log(`动漫条目: ${animeItems.length}`);
	console.log(`游戏条目: ${gameItems.length}`);
	console.log(`未分类条目: ${unknownItems.length}`);
	console.log(`分类错误: ${classificationErrors.length}`);
	console.log("═".repeat(50));
	console.log(`✅ 动漫缓存: anime.json`);
	console.log(`✅ 游戏缓存: games.json`);
	console.log(`✅ 未分类缓存: unclassified.json`);
	console.log(`✅ 索引文件: cache-index.json`);

	if (classificationErrors.length > 0) {
		console.log(`⚠️ 分类错误已记录: classification-errors.json`);
	}
}

convertCollectionsToCache().catch(console.error);
