export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);

	const limitedCount = Math.min(Math.max(count, 1), 10);

	const timestamp = Date.now();
	const desktopImages = Array.from(
		{ length: limitedCount },
		(_, i) => `https://www.dmoe.cc/random.php?t=${timestamp}_d${i}`,
	);
	const mobileImages = Array.from(
		{ length: limitedCount },
		(_, i) => `https://www.dmoe.cc/random.php?t=${timestamp}_m${i}`,
	);

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

