export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);
	const type = url.searchParams.get("type") || "desktop";

	const limitedCount = Math.min(Math.max(count, 1), 10);

	const timestamp = Date.now();
	const images: string[] = [];

	for (let i = 0; i < limitedCount; i++) {
		if (type === "mobile") {
			images.push(`https://www.dmoe.cc/random.php?t=m${timestamp}_${i}`);
		} else {
			images.push(`https://www.dmoe.cc/random.php?t=${timestamp}_${i}`);
		}
	}

	return new Response(JSON.stringify({ images, timestamp, type, count: limitedCount }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store, no-cache, must-revalidate",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
