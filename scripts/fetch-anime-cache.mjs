import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", ".cache", "bangumi");
const BANGUMI_API_BASE = "https://api.bgm.tv/v0";

const BANGUMI_TYPE = {
	ANIME: 2,
	GAME: 4,
};

async function readJsonIfExists(filePath, defaultValue) {
	try {
		const content = await fs.readFile(filePath, "utf8");
		return JSON.parse(content);
	} catch {
		return defaultValue;
	}
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			const response = await fetch(url, {
				...options,
				signal: controller.signal,
				headers: {
					"User-Agent": "BangumiDailyPosts/1.0",
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			clearTimeout(timeout);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.json();
		} catch (error) {
			if (i === maxRetries - 1) throw error;
			console.log(`⚠️ 请求失败 (${i + 1}/${maxRetries}): ${error.message}`);
			await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
		}
	}
}

async function fetchSubjectDetail(subjectId) {
	const url = `${BANGUMI_API_BASE}/subjects/${subjectId}`;
	return await fetchWithRetry(url);
}

async function fetchAnimeCollections(userId = "@me") {
	console.log(`📡 正在获取用户 ${userId} 的动漫收藏...`);

	const collections = [];
	const pageSize = 30;
	let page = 1;
	let hasMore = true;

	while (hasMore) {
		try {
			const url = `${BANGUMI_API_BASE}/users/${userId}/collections?type=${BANGUMI_TYPE.ANIME}&page=${page}&max_results=${pageSize}`;
			console.log(`📄 获取第 ${page} 页...`);

			const data = await fetchWithRetry(url);

			if (!data || !data.data || data.data.length === 0) {
				hasMore = false;
				break;
			}

			collections.push(...data.data);

			if (data.data.length < pageSize) {
				hasMore = false;
			} else {
				page++;
			}

			await new Promise(resolve => setTimeout(resolve, 500));
		} catch (error) {
			console.error(`❌ 获取第 ${page} 页失败: ${error.message}`);
			hasMore = false;
		}
	}

	return collections;
}

async function fetchAnimeCalendar() {
	console.log(`📡 正在获取Bangumi每周动漫日程...`);

	try {
		const data = await fetchWithRetry("https://api.bgm.tv/calendar");
		if (data && Array.isArray(data)) {
			const allAnime = [];
			for (const day of data) {
				if (day.items && Array.isArray(day.items)) {
					allAnime.push(...day.items);
				}
			}
			console.log(`✅ 获取到 ${allAnime.length} 部动漫`);
			return allAnime;
		}
		return [];
	} catch (error) {
		console.error(`❌ 获取动漫日程失败: ${error.message}`);
		return [];
	}
}

async function logCacheOperation(operation, details) {
	const logEntry = {
		timestamp: new Date().toISOString(),
		operation,
		details,
		success: true,
	};

	try {
		const logFile = path.join(CACHE_DIR, "cache-operations.log");
		const existingLogs = await readJsonIfExists(logFile, []);
		existingLogs.push(logEntry);
		if (existingLogs.length > 100) {
			existingLogs.splice(0, existingLogs.length - 100);
		}
		await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2), "utf8");
	} catch (error) {
		console.warn(`⚠️ 写入日志失败: ${error.message}`);
	}
}

async function buildCacheReport() {
	const report = {
		generatedAt: new Date().toISOString(),
		files: {},
		totalAnime: 0,
		totalGames: 0,
		totalUnclassified: 0,
	};

	try {
		const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
		const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith(".json"));

		for (const file of jsonFiles) {
			try {
				const content = await fs.readFile(path.join(CACHE_DIR, file.name), "utf8");
				const data = JSON.parse(content);
				if (Array.isArray(data)) {
					report.files[file.name] = {
						type: "array",
						count: data.length,
					};
					if (file.name === "anime.json") report.totalAnime = data.length;
					if (file.name === "games.json") report.totalGames = data.length;
					if (file.name === "unclassified.json") report.totalUnclassified = data.length;
				} else if (data.stats) {
					report.files[file.name] = {
						type: "index",
						stats: data.stats,
					};
				}
			} catch (error) {
				report.files[file.name] = { error: error.message };
			}
		}
	} catch (error) {
		report.error = error.message;
	}

	return report;
}

async function buildAnimeCacheFromCollections() {
	console.log("🔄 开始构建动漫缓存...\n");

	let animeSubjects = [];

	const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
	const subjectFiles = entries
		.filter(e => e.isFile() && e.name.startsWith("subject-") && e.name.endsWith(".json"))
		.map(e => e.name);

	if (subjectFiles.length > 0) {
		console.log(`📁 发现 ${subjectFiles.length} 个缓存的 subject 文件`);

		for (const fileName of subjectFiles) {
			try {
				const content = await fs.readFile(path.join(CACHE_DIR, fileName), "utf8");
				const data = JSON.parse(content);
				const subject = data.data || data;

				if (subject.type === BANGUMI_TYPE.ANIME) {
					animeSubjects.push(subject);
				}
			} catch (error) {
				console.warn(`⚠️ 读取 ${fileName} 失败: ${error.message}`);
			}
		}
	}

	if (animeSubjects.length === 0) {
		console.log(`📡 从Bangumi日历API获取动漫数据...`);
		const calendarAnime = await fetchAnimeCalendar();
		if (calendarAnime.length > 0) {
			animeSubjects.push(...calendarAnime);
		}
	}

	if (animeSubjects.length === 0) {
		console.log("⚠️ 未获取到任何动漫数据");
		await logCacheOperation("build-anime-cache", { success: false, reason: "No anime data found" });
		return;
	}

	console.log(`\n📊 获取到 ${animeSubjects.length} 条动漫记录`);

	const animeItems = [];
	const classificationErrors = [];

	for (const subject of animeSubjects) {
		if (!subject || !subject.id) {
			classificationErrors.push({
				subject: subject,
				error: "缺少 subject.id 字段",
			});
			continue;
		}

		const subjectType = subject.type;

		if (subjectType !== BANGUMI_TYPE.ANIME) {
			classificationErrors.push({
				subjectId: subject.id,
				title: subject.name_cn || subject.name,
				error: `类型不匹配: 预期 ${BANGUMI_TYPE.ANIME} (动漫), 实际 ${subjectType}`,
			});
			continue;
		}

		animeItems.push({
			link: `/subject/${subject.id}`,
			title: subject.name_cn || subject.name || "",
			titleRaw: subject.name || "",
			status: "collect",
			progress: 0,
			startDate: subject.date || "",
			endDate: "",
			year: subject.date ? subject.date.split("-")[0] : "",
			totalEpisodes: subject.eps || 0,
			description: subject.summary || "",
			cover: subject.images?.large || subject.images?.common || "",
			genre: subject.tags?.slice(0, 5).map(t => t.name) || [],
			contentType: "anime",
			subjectId: subject.id,
			subjectType: subjectType,
			tags: subject.tags?.map(t => t.name) || [],
			raw: subject,
		});
	}

	const indexData = {
		version: "2.0",
		updatedAt: new Date().toISOString(),
		source: "bangumi-api",
		stats: {
			totalProcessed: animeSubjects.length,
			animeCount: animeItems.length,
			gameCount: 0,
			unknownCount: classificationErrors.length,
			classificationErrorCount: classificationErrors.length,
		},
		classification: {
			anime: "anime",
			game: "game",
			unknown: "unknown",
		},
		files: {
			anime: "anime.json",
			game: "games.json",
			unknown: "unclassified.json",
			index: "cache-index.json",
		},
	};

	await fs.writeFile(path.join(CACHE_DIR, "anime.json"), JSON.stringify(animeItems, null, 2), "utf8");
	await fs.writeFile(path.join(CACHE_DIR, "cache-index.json"), JSON.stringify(indexData, null, 2), "utf8");

	const cacheReport = await buildCacheReport();
	await fs.writeFile(path.join(CACHE_DIR, "cache-report.json"), JSON.stringify(cacheReport, null, 2), "utf8");

	if (classificationErrors.length > 0) {
		await fs.writeFile(path.join(CACHE_DIR, "classification-errors.json"), JSON.stringify(classificationErrors, null, 2), "utf8");
	}

	console.log("\n📊 动漫缓存构建报告");
	console.log("═".repeat(50));
	console.log(`总处理条目: ${animeSubjects.length}`);
	console.log(`动漫条目: ${animeItems.length}`);
	console.log(`分类错误: ${classificationErrors.length}`);
	console.log("═".repeat(50));
	console.log(`✅ 动漫缓存: anime.json`);
	console.log(`✅ 索引文件: cache-index.json`);
	console.log(`✅ 缓存报告: cache-report.json`);

	if (classificationErrors.length > 0) {
		console.log(`⚠️ 分类错误已记录: classification-errors.json`);
	}

	await logCacheOperation("build-anime-cache", {
		success: true,
		totalProcessed: animeSubjects.length,
		animeCount: animeItems.length,
		errors: classificationErrors.length,
	});
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

const command = process.argv[2] || "build";

if (command === "build") {
	buildAnimeCacheFromCollections().catch(console.error);
} else if (command === "fetch") {
	const userId = process.argv[3] || "@me";
	fetchAnimeCollections(userId).then(data => {
		console.log(`\n✅ 获取到 ${data.length} 条收藏`);
		process.exit(0);
	}).catch(err => {
		console.error(`❌ 获取失败: ${err.message}`);
		process.exit(1);
	});
} else {
	console.log("用法: node fetch-anime-cache.mjs [build|fetch] [userId]");
}
