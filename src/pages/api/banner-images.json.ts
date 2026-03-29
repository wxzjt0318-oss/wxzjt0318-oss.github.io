export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);

	const limitedCount = Math.min(Math.max(count, 1), 10);

	async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
		try {
			const response = await fetch(imageUrl, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					"Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
					"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
					"Referer": "https://www.dmoe.cc/",
				},
			});

			if (!response.ok) {
				console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
				return null;
			}

			const contentType = response.headers.get("content-type") || "image/jpeg";
			const arrayBuffer = await response.arrayBuffer();
			const base64 = Buffer.from(arrayBuffer).toString("base64");
			
			return `data:${contentType};base64,${base64}`;
		} catch (error) {
			console.error(`Error fetching image ${imageUrl}:`, error);
			return null;
		}
	}

	const desktopImages: string[] = [];
	const mobileImages: string[] = [];
	const timestamp = Date.now();

	const desktopPromises: Promise<void>[] = [];
	const mobilePromises: Promise<void>[] = [];

	for (let i = 0; i < limitedCount; i++) {
		const desktopUrl = `https://www.dmoe.cc/random.php?t=${timestamp}_${i}`;
		const mobileUrl = `https://www.dmoe.cc/random.php?t=m${timestamp}_${i}`;

		desktopPromises.push(
			fetchImageAsBase64(desktopUrl).then((base64) => {
				if (base64) {
					desktopImages[i] = base64;
				} else {
					desktopImages[i] = desktopUrl;
				}
			})
		);

		mobilePromises.push(
			fetchImageAsBase64(mobileUrl).then((base64) => {
				if (base64) {
					mobileImages[i] = base64;
				} else {
					mobileImages[i] = mobileUrl;
				}
			})
		);
	}

	await Promise.all([...desktopPromises, ...mobilePromises]);

	return new Response(
		JSON.stringify({
			desktop: desktopImages,
			mobile: mobileImages,
			timestamp,
			count: limitedCount,
			format: "base64",
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
