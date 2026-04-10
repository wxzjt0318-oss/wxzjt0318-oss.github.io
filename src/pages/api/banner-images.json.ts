import { fetchBannerImages } from "../../utils/banner-images";

export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);
	const limitedCount = Math.min(Math.max(count, 1), 10);
	const images = await fetchBannerImages(limitedCount);

	return new Response(
		JSON.stringify({
			desktop: images.desktop,
			mobile: images.mobile,
			timestamp: Date.now(),
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
