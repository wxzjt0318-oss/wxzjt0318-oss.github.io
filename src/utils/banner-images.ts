import { siteConfig } from "../config";

const IMAGE_CACHE_TTL = 3600000;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_IMAGE_COUNT = 6;
const imageCache: Map<string, { url: string; timestamp: number }> = new Map();

type BannerImageApiConfig = NonNullable<NonNullable<typeof siteConfig.banner.imageApi>>;

type BannerApiEndpoints = {
	primaryUrl: string;
	fallbackUrl?: string;
};

type BannerDevice = "desktop" | "mobile";

type BannerImageResult = {
	desktop: string[];
	mobile: string[];
};

function logBannerEvent(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
	const payload = extra ? ` ${JSON.stringify(extra)}` : "";
	console[level](`[banner-images] ${message}${payload}`);
}

function buildApiUrl(baseUrl: string, count: number, device: BannerDevice, index: number) {
	const url = new URL(baseUrl);
	const params = siteConfig.banner.imageApi?.requestParams || {};
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}
	url.searchParams.set("count", String(count));
	url.searchParams.set("device", device);
	url.searchParams.set("index", String(index));
	return url.toString();
}

function isLikelyImageUrl(value: unknown): value is string {
	if (typeof value !== "string") {
		return false;
	}
	const url = value.trim();
	if (!url) {
		return false;
	}
	return /^https?:\/\//i.test(url) || url.startsWith("/");
}

function collectUrlsFromJson(value: unknown, collector: string[]) {
	if (isLikelyImageUrl(value)) {
		collector.push(value.trim());
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			collectUrlsFromJson(item, collector);
		}
		return;
	}
	if (value && typeof value === "object") {
		for (const nested of Object.values(value)) {
			collectUrlsFromJson(nested, collector);
		}
	}
}

function dedupeUrls(urls: string[]) {
	return Array.from(new Set(urls.filter(Boolean)));
}

function parseImageApiResponse(text: string): string[] {
	const raw = String(text || "").trim();
	if (!raw) {
		return [];
	}

	if (raw.startsWith("[") || raw.startsWith("{")) {
		try {
			const parsed = JSON.parse(raw);
			const urls: string[] = [];
			collectUrlsFromJson(parsed, urls);
			return dedupeUrls(urls);
		} catch {
			// fall through to plain text parsing
		}
	}

	return dedupeUrls(
		raw
			.split(/\r?\n|,/)
			.map((line) => line.trim())
			.filter(isLikelyImageUrl),
	);
}

async function requestBannerApi(baseUrl: string, count: number, device: BannerDevice, apiRole: "primary" | "fallback") {
	const timeoutMs = siteConfig.banner.imageApi?.timeoutMs || DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const requestUrl = buildApiUrl(baseUrl, count, device, 0);
		const response = await fetch(requestUrl, {
			method: "GET",
			signal: controller.signal,
			headers: { accept: "text/plain, application/json;q=0.9, */*;q=0.8" },
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const text = await response.text();
		const urls = parseImageApiResponse(text);
		if (urls.length === 0) {
			throw new Error("empty or invalid response");
		}
		logBannerEvent("info", `${apiRole} banner API request succeeded`, {
			device,
			count: urls.length,
			baseUrl,
			format: text.trim().startsWith("{") || text.trim().startsWith("[") ? "json" : "text",
		});
		return urls.slice(0, count);
	} catch (error) {
		logBannerEvent(apiRole === "primary" ? "warn" : "error", `${apiRole} banner API request failed`, {
			device,
			baseUrl,
			reason: error instanceof Error ? error.message : String(error),
		});
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

function getApiEndpoints(config: BannerImageApiConfig, device: BannerDevice): BannerApiEndpoints {
	const primaryUrl = device === "desktop"
		? config.desktopUrl || config.url
		: config.mobileUrl || config.url;
	const fallbackUrl = device === "desktop"
		? config.fallbackDesktopUrl || config.fallbackUrl
		: config.fallbackMobileUrl || config.fallbackUrl;

	if (!primaryUrl) {
		throw new Error(`missing ${device} banner API url`);
	}

	return { primaryUrl, fallbackUrl };
}

async function fetchBannerImagesFromApi(config: BannerImageApiConfig, count: number) {
	const fetchWithFallback = async (device: BannerDevice) => {
		const endpoints = getApiEndpoints(config, device);
		try {
			return await requestBannerApi(endpoints.primaryUrl, count, device, "primary");
		} catch (primaryError) {
			if (!endpoints.fallbackUrl) {
				throw primaryError;
			}
			logBannerEvent("warn", "switching to fallback banner API", {
				device,
				primaryUrl: endpoints.primaryUrl,
				fallbackUrl: endpoints.fallbackUrl,
			});
			return await requestBannerApi(endpoints.fallbackUrl, count, device, "fallback");
		}
	};

	const [desktop, mobile] = await Promise.all([
		fetchWithFallback("desktop"),
		fetchWithFallback("mobile"),
	]);
	return { desktop, mobile };
}

async function resolveImageResponse(url: string, method: "HEAD" | "GET") {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			method,
			redirect: "follow",
			signal: controller.signal,
		});
		const contentType = response.headers.get("content-type") || "";
		const isImage = contentType.startsWith("image/");
		if (method === "GET") {
			await response.body?.cancel();
		}
		if (!response.ok || !isImage) {
			throw new Error(
				`HTTP ${response.status}${contentType ? ` (${contentType})` : ""}`,
			);
		}
		return response.url;
	} finally {
		clearTimeout(timeoutId);
	}
}

function getConfiguredBannerSources(count: number): BannerImageResult {
	const bannerSrc = siteConfig.banner.src;
	const normalize = (value: string | string[] | undefined, fallback: string[] = []) => {
		const list = Array.isArray(value) ? value : value ? [value] : fallback;
		return list.filter(Boolean).slice(0, count);
	};

	if (typeof bannerSrc === "string") {
		const list = normalize(bannerSrc);
		return { desktop: list, mobile: list };
	}

	if (Array.isArray(bannerSrc)) {
		const list = normalize(bannerSrc);
		return { desktop: list, mobile: list };
	}

	const desktop = normalize(bannerSrc.desktop);
	const mobile = normalize(bannerSrc.mobile, desktop);
	return {
		desktop,
		mobile: mobile.length > 0 ? mobile : desktop,
	};
}

function fillMissingImages(urls: string[], fallbackPool: string[], count: number) {
	const result = dedupeUrls(urls).slice(0, count);
	if (result.length >= count) {
		return result;
	}
	for (const item of fallbackPool) {
		if (result.length >= count) {
			break;
		}
		if (!result.includes(item)) {
			result.push(item);
		}
	}
	return result.slice(0, count);
}

export async function fetchActualImageUrl(redirectUrl: string): Promise<string | null> {
	if (!redirectUrl) {
		return null;
	}
	if (redirectUrl.startsWith("/")) {
		return redirectUrl;
	}

	const cached = imageCache.get(redirectUrl);
	if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
		return cached.url;
	}

	try {
		const actualUrl = await resolveImageResponse(redirectUrl, "HEAD");
		imageCache.set(redirectUrl, { url: actualUrl, timestamp: Date.now() });
		return actualUrl;
	} catch (headError) {
		try {
			const actualUrl = await resolveImageResponse(redirectUrl, "GET");
			imageCache.set(redirectUrl, { url: actualUrl, timestamp: Date.now() });
			return actualUrl;
		} catch (getError) {
			logBannerEvent("warn", "banner image probe failed", {
				redirectUrl,
				headReason: headError instanceof Error ? headError.message : String(headError),
				getReason: getError instanceof Error ? getError.message : String(getError),
			});
			return null;
		}
	}
}

async function fetchBannerImagesFromDefaultSource(count: number): Promise<BannerImageResult> {
	const configuredSources = getConfiguredBannerSources(count);
	const desktopPromises = configuredSources.desktop.map((url) => fetchActualImageUrl(url));
	const mobilePromises = configuredSources.mobile.map((url) => fetchActualImageUrl(url));

	const [desktopResults, mobileResults] = await Promise.all([
		Promise.all(desktopPromises),
		Promise.all(mobilePromises),
	]);

	const validDesktop = desktopResults.filter((item): item is string => Boolean(item));
	const validMobile = mobileResults.filter((item): item is string => Boolean(item));

	if (validDesktop.length < configuredSources.desktop.length || validMobile.length < configuredSources.mobile.length) {
		logBannerEvent("warn", "configured banner sources returned insufficient valid images, filling with configured fallback entries", {
			desktopValid: validDesktop.length,
			mobileValid: validMobile.length,
			requiredDesktop: configuredSources.desktop.length,
			requiredMobile: configuredSources.mobile.length,
		});
	}

	return {
		desktop: fillMissingImages(validDesktop, configuredSources.desktop, count),
		mobile: fillMissingImages(validMobile, configuredSources.mobile, count),
	};
}

export async function fetchBannerImages(count: number = DEFAULT_IMAGE_COUNT): Promise<BannerImageResult> {
	const imageApi = siteConfig.banner.imageApi;
	if (imageApi?.enable && imageApi.url) {
		try {
			return await fetchBannerImagesFromApi(imageApi, count);
		} catch (error) {
			logBannerEvent("warn", "all banner image API sources failed, falling back to built-in source", {
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return await fetchBannerImagesFromDefaultSource(count);
}
