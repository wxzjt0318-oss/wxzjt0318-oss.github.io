import type {
	MetingMusicConfig,
	TrackDescriptor,
} from "../../types/musicConfig.ts";

export const DEFAULT_METING_API =
	"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export interface RawMetingSong {
	id?: number | string;
	name?: string;
	title?: string;
	artist?: string;
	author?: string;
	duration?: number | string;
	pic?: string;
	url?: string;
	lrc?: string;
}

/**
 * 根据 Meting 配置按顺序组装所有候选请求 URL（`api` 可为单个模板或模板数组）。
 * 若 ID 为空则返回空数组。
 */
export function buildMetingUrls(config: MetingMusicConfig): string[] {
	const id = config.id?.trim();
	if (!id) return [];

	const templates = (
		typeof config.api === "string" ? [config.api] : (config.api ?? [])
	)
		.map((api) => api.trim())
		.filter(Boolean);
	if (templates.length === 0) templates.push(DEFAULT_METING_API);

	const server = config.server?.trim() || DEFAULT_METING_SERVER;
	const type = config.type?.trim() || DEFAULT_METING_TYPE;
	const random = Date.now().toString();

	return [...new Set(templates)].map((api) =>
		api
			.replace(":server", encodeURIComponent(server))
			.replace(":type", encodeURIComponent(type))
			.replace(":id", encodeURIComponent(id))
			.replace(":auth", "")
			.replace(":r", random),
	);
}

/**
 * 根据 Meting 配置组装首选请求 URL。若 ID 为空则返回 null。
 */
export function buildMetingUrl(config: MetingMusicConfig): string | null {
	return buildMetingUrls(config)[0] ?? null;
}

/**
 * 将 Meting API 单曲响应清洗并转换为标准的 TrackDescriptor。
 */
export function parseMetingSong(
	song: RawMetingSong,
	index: number,
	server: string = DEFAULT_METING_SERVER,
): TrackDescriptor | null {
	if (!song || typeof song !== "object") return null;

	const title = (song.name ?? song.title ?? "").trim();
	const source = (song.url ?? "").trim();
	if (!title || !source) return null;

	const id =
		song.id !== undefined && song.id !== null && String(song.id).trim() !== ""
			? `meting-${server}-${String(song.id).trim()}`
			: `meting-${server}-${index}-${Math.random().toString(36).slice(2, 8)}`;

	const artist = (song.artist ?? song.author ?? "").trim() || undefined;
	const cover = (song.pic ?? "").trim() || undefined;

	let duration: number | undefined;
	if (typeof song.duration === "number" && Number.isFinite(song.duration)) {
		duration =
			song.duration > 10000
				? Math.floor(song.duration / 1000)
				: Math.floor(song.duration);
	} else if (typeof song.duration === "string") {
		const parsed = Number.parseInt(song.duration, 10);
		if (Number.isFinite(parsed) && parsed > 0) {
			duration = parsed > 10000 ? Math.floor(parsed / 1000) : parsed;
		}
	}
	if (duration !== undefined && duration <= 0) {
		duration = undefined;
	}

	return Object.freeze({
		id,
		title,
		source,
		artist,
		cover,
		duration,
	});
}

/** 单个 Meting 源的请求超时（毫秒），超时后切换到下一个源。 */
export const METING_SOURCE_TIMEOUT_MS = 6_000;

/**
 * 从 Meting API 异步获取并解析曲目列表。
 * 配置了多个 API 时按顺序尝试，直到某个源返回非空歌单；
 * 所有源都出错时抛出最后一个错误，至少一个源正常但歌单为空时返回空数组。
 */
export async function fetchMetingTracks(
	config: MetingMusicConfig,
	customFetch: typeof fetch = fetch,
): Promise<readonly TrackDescriptor[]> {
	const urls = buildMetingUrls(config);
	let lastError: unknown = null;
	let anySucceeded = false;

	for (const url of urls) {
		try {
			const tracks = await fetchMetingTracksFrom(url, config, customFetch);
			if (tracks.length > 0) return tracks;
			anySucceeded = true;
		} catch (error) {
			lastError = error;
		}
	}

	if (!anySucceeded && lastError) throw lastError;
	return [];
}

async function fetchMetingTracksFrom(
	url: string,
	config: MetingMusicConfig,
	customFetch: typeof fetch,
): Promise<readonly TrackDescriptor[]> {
	const controller =
		typeof AbortController === "function" ? new AbortController() : null;
	const timeoutId = controller
		? setTimeout(() => controller.abort(), METING_SOURCE_TIMEOUT_MS)
		: null;

	try {
		const response = await customFetch(
			url,
			controller ? { signal: controller.signal } : undefined,
		);
		if (!response.ok) {
			throw new Error(`Meting API HTTP ${response.status}`);
		}
		return parseMetingResponse(await response.json(), config);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function parseMetingResponse(
	payload: unknown,
	config: MetingMusicConfig,
): readonly TrackDescriptor[] {
	if (!Array.isArray(payload)) return [];
	const data = payload as RawMetingSong[];

	const server = config.server || DEFAULT_METING_SERVER;
	const tracks: TrackDescriptor[] = [];
	const seenIds = new Set<string>();

	for (let i = 0; i < data.length; i++) {
		const track = parseMetingSong(data[i], i, server);
		if (track && !seenIds.has(track.id)) {
			seenIds.add(track.id);
			tracks.push(track);
		}
	}

	return Object.freeze(tracks);
}
