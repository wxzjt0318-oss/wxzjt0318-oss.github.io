export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);

	const limitedCount = Math.min(Math.max(count, 1), 10);

	const timestamp = Date.now();
	const desktopImages: string[] = [];
	const mobileImages: string[] = [];

	for (let i = 0; i < limitedCount; i++) {
		const desktopUrl = await fetchActualImageUrl(`https://www.dmoe.cc/random.php?t=${timestamp}_d${i}`);
		const mobileUrl = await fetchActualImageUrl(`https://www.dmoe.cc/random.php?t=${timestamp}_m${i}`);
		
		desktopImages.push(desktopUrl);
		mobileImages.push(mobileUrl);
	}

	return new Response(
		JSON.stringify({
			desktop: desktopImages,
			mobile: mobileImages,
			timestamp,
			count: limitedCount,
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store, no-cache, must-revalidate",
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}

async function fetchActualImageUrl(redirectUrl: string): Promise<string> {
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
			return response.url;
		}
		return redirectUrl;
	} catch (error) {
		return redirectUrl;
	}
}
