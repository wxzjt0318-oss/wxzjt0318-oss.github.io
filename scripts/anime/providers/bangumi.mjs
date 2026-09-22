const BANGUMI_API_BASE = "https://api.bgm.tv";
const BANGUMI_WEB_BASE = "https://bgm.tv";
const USER_AGENT = "Shirone/1.0 (https://github.com/shirone; AnimeSync)";
// 主站 HTML 列表页需要浏览器 UA（api 故障时的回退数据源）
const BROWSER_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATUS_COLLECTIONS = [
	{ type: 3, status: "watching" },
	{ type: 2, status: "completed" },
	{ type: 1, status: "planned" },
	{ type: 4, status: "onHold" },
	{ type: 5, status: "dropped" },
];

/**
 * API type → 主站列表页 URL 段名（对动画与游戏均适用，经实测验证）。
 * 注意「在看/在玩」的段名是 do，不是 watch/playing（无效段名会被主站静默回退到 wish）。
 */
const HTML_STATUS_SEGMENTS = {
	3: "do",
	2: "collect",
	1: "wish",
	4: "on_hold",
	5: "dropped",
};

function extractStudioFromInfobox(infobox) {
	if (!Array.isArray(infobox)) return undefined;
	const targetKeys = [
		"动画制作",
		"制作",
		"製作",
		"开发",
		"Animation Production",
	];

	for (const key of targetKeys) {
		const item = infobox.find((i) => i.key === key);
		if (item) {
			if (typeof item.value === "string" && item.value.trim()) {
				return item.value.trim();
			}
			if (Array.isArray(item.value)) {
				const validItem = item.value.find(
					(v) => v && (v.v || typeof v === "string"),
				);
				if (validItem) {
					return typeof validItem === "string"
						? validItem.trim()
						: validItem.v?.trim();
				}
			}
		}
	}
	return undefined;
}

async function fetchJson(url, timeoutMs = 15000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": USER_AGENT,
				Accept: "application/json",
			},
		});
		if (!res.ok) {
			return { ok: false, status: res.status, statusText: res.statusText };
		}
		const data = await res.json();
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error };
	} finally {
		clearTimeout(timer);
	}
}

async function fetchSubjectDetail(subjectId) {
	const res = await fetchJson(
		`${BANGUMI_API_BASE}/v0/subjects/${subjectId}`,
		10000,
	);
	if (res.ok && res.data) {
		return res.data;
	}
	return null;
}

/**
 * 获取单个状态类别的用户收藏列表
 */
async function fetchCollectionType(userId, type, status, options) {
	const pageSize = Math.min(Math.max(10, options.pageSize || 50), 100);
	const maxItems = options.maxItems || 100;
	const minDelayMs = options.minDelayMs || 200;

	let offset = 0;
	let hasMore = true;
	const collected = [];

	while (hasMore && collected.length < maxItems) {
		const limit = Math.min(pageSize, maxItems - collected.length);
		const url = `${BANGUMI_API_BASE}/v0/users/${encodeURIComponent(userId)}/collections?subject_type=2&type=${type}&limit=${limit}&offset=${offset}`;

		const res = await fetchJson(url);
		if (!res.ok) {
			if (res.status === 404) {
				console.log(
					`   [Bangumi] User ${userId} has no data or 404 for type ${type}`,
				);
				return [];
			}
			console.warn(
				`   [Bangumi] Request failed for type ${type}: HTTP ${res.status || res.error?.message}`,
			);
			break;
		}

		const data = res.data;
		if (data && Array.isArray(data.data) && data.data.length > 0) {
			collected.push(...data.data);
			if (
				data.data.length < limit ||
				collected.length >= (data.total || maxItems)
			) {
				hasMore = false;
			} else {
				offset += limit;
				await delay(minDelayMs);
			}
		} else {
			hasMore = false;
		}
	}

	return collected.map((item) => ({ item, status }));
}

/**
 * ── 主站 HTML 列表页回退 ────────────────────────────────────────────────
 * api.bgm.tv 的 /v0/users/* 子树曾整体 502（subject/calendar 等端点正常），
 * 导致收藏同步长期静默空转（keepLastValid 保留旧快照、CI 步骤仍显示成功）。
 * 此时改抓 bgm.tv 主站列表页（item id / 标题 / 封面 / 评分 / 收藏日期），
 * 条目详情仍由可用的 /v0/subjects/{id} 补全；进度（ep_status）HTML 不公开，视为 0。
 */

function unescapeHtmlText(value) {
	return String(value || "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.trim();
}

async function fetchHtmlText(url, timeoutMs = 15000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": BROWSER_USER_AGENT,
				Accept: "text/html,application/xhtml+xml",
			},
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** 解析一页收藏列表 HTML，返回类 API 形状的条目数组 */
function parseListPageItems(html) {
	const items = [];
	const itemRe = /<li id="item_(\d+)"[\s\S]*?<\/li>/g;
	let match = itemRe.exec(html);
	while (match !== null) {
		const subjectId = Number(match[1]);
		const block = match[0];
		const titleMatch = block.match(
			/<a href="\/subject\/\d+" class="l">([\s\S]*?)<\/a>\s*(?:<small class="grey">([\s\S]*?)<\/small>)?/,
		);
		const coverMatch = block.match(/<img src="([^"]+)" class="cover"/);
		const rateMatch = block.match(/starlight stars(\d+)/);
		const dateMatch = block.match(/<span class="tip_j">([\d-]+)<\/span>/);

		let cover = coverMatch ? coverMatch[1] : "";
		if (!cover || cover.includes("no_icon_subject")) cover = "";
		if (cover.startsWith("//")) cover = `https:${cover}`;

		items.push({
			subject_id: subjectId,
			rate: rateMatch ? Number(rateMatch[1]) : 0,
			updated_at: dateMatch ? dateMatch[1] : "",
			subject: {
				name_cn: unescapeHtmlText(titleMatch?.[1] || ""),
				name: unescapeHtmlText(titleMatch?.[2] || ""),
				...(cover ? { images: { medium: cover } } : {}),
			},
		});
		match = itemRe.exec(html);
	}
	return items;
}

/**
 * 抓取某个状态的主站列表页（自动翻页，每页 24 条，翻页到底或达到 maxItems 停止）。
 */
async function fetchCollectionTypeFromHtml(userId, type, status, options) {
	const segment = HTML_STATUS_SEGMENTS[type];
	if (!segment) return [];
	const maxItems = options.maxItems || 100;
	const minDelayMs = options.minDelayMs || 200;

	const collected = [];
	const seen = new Set();
	for (let page = 1; ; page++) {
		const url = `${BANGUMI_WEB_BASE}/anime/list/${encodeURIComponent(userId)}/${segment}?page=${page}`;
		const html = await fetchHtmlText(url);
		if (html == null) {
			console.warn(
				`   [Bangumi] HTML fallback request failed for "${status}" page ${page}`,
			);
			break;
		}
		const pageItems = parseListPageItems(html);
		if (pageItems.length === 0) break;
		for (const item of pageItems) {
			if (seen.has(item.subject_id)) continue;
			seen.add(item.subject_id);
			collected.push({ item, status });
			if (collected.length >= maxItems) return collected;
		}
		await delay(minDelayMs);
	}
	return collected;
}

/**
 * Bangumi 提供方数据抓取入口
 */
export async function fetchBangumiData(bangumiConfig) {
	const userId = bangumiConfig.userId?.trim();
	if (!userId) {
		throw new Error(
			"Bangumi userId is required in animeConfig.providers.bangumi.userId",
		);
	}

	const requestOptions = bangumiConfig.request || {};
	console.log(`[Bangumi] Starting sync for user: ${userId}...`);

	const allEntries = [];
	for (const { type, status } of STATUS_COLLECTIONS) {
		console.log(
			`[Bangumi] Fetching collection status "${status}" (type ${type})...`,
		);
		const entries = await fetchCollectionType(
			userId,
			type,
			status,
			requestOptions,
		);
		allEntries.push(...entries);
		console.log(
			`[Bangumi] Fetched ${entries.length} items for status "${status}".`,
		);
	}

	// API 全灭（如 /v0/users/* 整体 502）时回退主站 HTML 列表页，避免同步长期静默空转
	let usedHtmlFallback = false;
	if (allEntries.length === 0) {
		usedHtmlFallback = true;
		console.warn(
			"[Bangumi] API returned 0 items across all statuses; falling back to bgm.tv HTML list pages...",
		);
		for (const { type, status } of STATUS_COLLECTIONS) {
			const entries = await fetchCollectionTypeFromHtml(
				userId,
				type,
				status,
				requestOptions,
			);
			allEntries.push(...entries);
			console.log(
				`[Bangumi] HTML fallback fetched ${entries.length} items for status "${status}".`,
			);
		}
	}

	console.log(
		`[Bangumi] Total raw items collected: ${allEntries.length}. Fetching details with concurrency...`,
	);

	const rawAnimeItems = [];
	const CONCURRENCY = 6;
	const BATCH_DELAY = 100;

	for (let i = 0; i < allEntries.length; i += CONCURRENCY) {
		const batch = allEntries.slice(i, i + CONCURRENCY);
		const batchResults = await Promise.all(
			batch.map(async ({ item, status }) => {
				const subjectId = item.subject_id;
				const subject = item.subject || {};

				let detail = null;
				if (subjectId) {
					detail = await fetchSubjectDetail(subjectId);
				}

				const title =
					subject.name_cn ||
					subject.name ||
					detail?.name_cn ||
					detail?.name ||
					"";
				if (!title.trim()) return null;

				const rating =
					typeof item.rate === "number" && item.rate > 0
						? item.rate
						: typeof subject.score === "number"
							? subject.score
							: typeof detail?.rating?.score === "number"
								? detail.rating.score
								: 0;

				const watched = typeof item.ep_status === "number" ? item.ep_status : 0;
				const total =
					typeof subject.eps === "number" && subject.eps > 0
						? subject.eps
						: typeof detail?.eps === "number" && detail.eps > 0
							? detail.eps
							: typeof detail?.total_episodes === "number"
								? detail.total_episodes
								: 0;

				const cover =
					subject.images?.medium ||
					subject.images?.large ||
					subject.images?.common ||
					detail?.images?.medium ||
					detail?.images?.large ||
					"";

				const rawDate = subject.date || detail?.date || "";
				const year = rawDate ? String(rawDate).slice(0, 4) : "";
				// 放送开始日期（YYYY-MM-DD）直达展示层，供卡片显示具体放送日
				const period = rawDate
					? { start: String(rawDate).slice(0, 10) }
					: undefined;

				const description =
					detail?.summary ||
					subject.short_summary ||
					detail?.short_summary ||
					"";

				const studio = extractStudioFromInfobox(detail?.infobox);

				const rawTags = Array.isArray(subject.tags)
					? subject.tags
							.map((t) => (typeof t === "string" ? t : t?.name))
							.filter(Boolean)
					: Array.isArray(detail?.tags)
						? detail.tags
								.map((t) => (typeof t === "string" ? t : t?.name))
								.filter(Boolean)
						: [];

				const link = subjectId
					? `https://bgm.tv/subject/${subjectId}`
					: undefined;

				// 数据源侧「最近修改数据的时间」：收藏条目的 updated_at（HTML 回退时为 tip_j 收藏日期）。
				// 直达展示层作为番剧页列表的主排序键（最近更新过的条目排最前）。
				const updatedAtRaw =
					typeof item.updated_at === "string" ? item.updated_at.trim() : "";
				const updatedAt = updatedAtRaw
					? new Date(updatedAtRaw).toISOString()
					: undefined;

				return {
					title,
					status,
					rating,
					progress: { watched, total },
					cover: cover || undefined,
					link,
					description: description || undefined,
					year,
					...(period ? { period } : {}),
					...(updatedAt ? { updatedAt } : {}),
					studio,
					genres: rawTags,
					identity: {
						provider: "bangumi",
						subjectId: subjectId ? String(subjectId) : undefined,
					},
				};
			}),
		);

		for (const res of batchResults) {
			if (res) rawAnimeItems.push(res);
		}

		const processedCount = Math.min(i + CONCURRENCY, allEntries.length);
		if (processedCount % 30 === 0 || processedCount === allEntries.length) {
			console.log(
				`[Bangumi] Processed ${processedCount}/${allEntries.length} items...`,
			);
		}

		if (i + CONCURRENCY < allEntries.length) {
			await delay(BATCH_DELAY);
		}
	}

	return {
		provider: "bangumi",
		accountRef: userId,
		rawItems: rawAnimeItems,
		// HTML 回退抓不到观看进度（ep_status 不公开）；调用方应据此从旧快照保留 progress
		degraded: usedHtmlFallback,
	};
}
