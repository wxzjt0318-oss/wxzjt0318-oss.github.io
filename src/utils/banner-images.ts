const IMAGE_CACHE_TTL = 3600000;
const imageCache: Map<string, { url: string; timestamp: number }> = new Map();

export async function fetchActualImageUrl(redirectUrl: string): Promise<string> {
	const cached = imageCache.get(redirectUrl);
	if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_TTL) {
		return cached.url;
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(redirectUrl, {
			method: 'HEAD',
			redirect: 'follow',
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (response.ok) {
			const actualUrl = response.url;
			imageCache.set(redirectUrl, { url: actualUrl, timestamp: Date.now() });
			return actualUrl;
		}
		return redirectUrl;
	} catch (error) {
		return redirectUrl;
	}
}

export async function fetchBannerImages(count: number = 6): Promise<{
	desktop: string[];
	mobile: string[];
}> {
	const timestamp = Date.now();

	const desktopPromises: Promise<string>[] = [];
	const mobilePromises: Promise<string>[] = [];

	for (let i = 0; i < count; i++) {
		desktopPromises.push(fetchActualImageUrl(`https://www.dmoe.cc/random.php?t=${timestamp}_d${i}`));
		mobilePromises.push(fetchActualImageUrl(`https://www.dmoe.cc/random.php?t=${timestamp}_m${i}`));
	}

	const [desktopResults, mobileResults] = await Promise.all([
		Promise.all(desktopPromises),
		Promise.all(mobilePromises),
	]);

	return {
		desktop: desktopResults,
		mobile: mobileResults,
	};
}
