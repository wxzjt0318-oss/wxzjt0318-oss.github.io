export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);

	const limitedCount = Math.min(Math.max(count, 1), 10);

	const timestamp = Date.now();
	const desktopImages: string[] = [];
	const mobileImages: string[] = [];

	for (let i = 0; i < limitedCount; i++) {
		desktopImages.push(`https://www.dmoe.cc/random.php?t=${timestamp}_${i}`);
		mobileImages.push(`https://www.dmoe.cc/random.php?t=m${timestamp}_${i}`);
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
