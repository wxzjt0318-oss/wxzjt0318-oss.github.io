export function buildMetingUrl(apiTemplate, { server, type, id, auth = "", r }) {
	if (!apiTemplate) return "";
	const ts = r ?? Date.now().toString();
	return apiTemplate
		.replace(":server", server ?? "")
		.replace(":type", type ?? "")
		.replace(":id", id ?? "")
		.replace(":auth", auth ?? "")
		.replace(":r", ts);
}

export async function fetchWithTimeout(url, timeoutMs, fetchImpl = fetch) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetchImpl(url, { signal: controller.signal });
		clearTimeout(timeoutId);
		return res;
	} catch (err) {
		clearTimeout(timeoutId);
		throw err;
	}
}

export async function fetchJsonWithRetry(
	url,
	{ timeoutMs = 5000, maxRetries = 3, retryDelayMs = 1000, fetchImpl = fetch } = {}
) {
	let lastError;
	for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
		try {
			const res = await fetchWithTimeout(url, timeoutMs, fetchImpl);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			return await res.json();
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
			}
		}
	}
	throw lastError ?? new Error("Request failed");
}

export function normalizeMetingList(raw, { unknownSong = "Unknown", unknownArtist = "Unknown" } = {}) {
	const list = Array.isArray(raw)
		? raw
		: Array.isArray(raw?.data)
			? raw.data
			: Array.isArray(raw?.result)
				? raw.result
				: [];
	return list.map((song) => {
		let title = song?.name ?? song?.title ?? unknownSong;
		let artist = song?.artist ?? song?.author ?? unknownArtist;
		let dur = song?.duration ?? 0;
		if (dur > 10000) dur = Math.floor(dur / 1000);
		if (!Number.isFinite(dur) || dur <= 0) dur = 0;
		return {
			id: song?.id ?? 0,
			title,
			artist,
			cover: song?.pic ?? song?.cover ?? "",
			url: song?.url ?? "",
			duration: dur,
		};
	});
}

export async function fetchMetingList({
	apiTemplate,
	server,
	type,
	id,
	timeoutMs,
	maxRetries,
	retryDelayMs,
	fetchImpl,
	unknownSong,
	unknownArtist,
}) {
	const url = buildMetingUrl(apiTemplate, { server, type, id });
	const data = await fetchJsonWithRetry(url, {
		timeoutMs,
		maxRetries,
		retryDelayMs,
		fetchImpl,
	});
	return normalizeMetingList(data, { unknownSong, unknownArtist });
}

export async function fetchMetingListWithFailover({
	primaryApi,
	backupApi,
	server,
	type,
	id,
	timeoutMs,
	maxRetries,
	retryDelayMs,
	fetchImpl,
	unknownSong,
	unknownArtist,
}) {
	let primaryError;
	try {
		const primaryList = await fetchMetingList({
			apiTemplate: primaryApi,
			server,
			type,
			id,
			timeoutMs,
			maxRetries,
			retryDelayMs,
			fetchImpl,
			unknownSong,
			unknownArtist,
		});
		if (primaryList.length > 0) {
			return { list: primaryList, usedBackup: false };
		}
		primaryError = new Error("Empty primary list");
	} catch (err) {
		primaryError = err;
	}

	if (!backupApi) {
		throw primaryError ?? new Error("Primary API failed");
	}

	const backupList = await fetchMetingList({
		apiTemplate: backupApi,
		server,
		type,
		id,
		timeoutMs,
		maxRetries,
		retryDelayMs,
		fetchImpl,
		unknownSong,
		unknownArtist,
	});
	if (backupList.length === 0) {
		throw new Error("Empty backup list");
	}
	return { list: backupList, usedBackup: true, primaryError };
}
