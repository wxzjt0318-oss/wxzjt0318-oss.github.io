import sharp from "sharp";

interface ImageOptimizationOptions {
	width?: number;
	height?: number;
	quality?: number;
	format: "webp" | "avif" | "jpeg";
}

const DESKTOP_WIDTH = 1920;
const DESKTOP_HEIGHT = 1080;
const MOBILE_WIDTH = 768;
const MOBILE_HEIGHT = 1024;
const QUALITY = 80;

async function optimizeImage(
	buffer: Buffer,
	options: ImageOptimizationOptions,
): Promise<{ data: Buffer; format: string; size: number }> {
	const { width, height, quality = QUALITY, format } = options;

	let sharpInstance = sharp(buffer, {
		animated: false,
		failOnError: false,
	});

	if (width || height) {
		sharpInstance = sharpInstance.resize(width, height, {
			fit: "cover",
			position: "center",
			withoutEnlargement: true,
		});
	}

	switch (format) {
		case "webp":
			sharpInstance = sharpInstance.webp({
				quality,
				effort: 4,
				smartSubsample: true,
			});
			break;
		case "avif":
			sharpInstance = sharpInstance.avif({
				quality,
				effort: 4,
				chromaSubsampling: "4:2:0",
			});
			break;
		case "jpeg":
			sharpInstance = sharpInstance.jpeg({
				quality,
				mozjpeg: true,
				chromaSubsampling: "4:2:0",
			});
			break;
	}

	const data = await sharpInstance.toBuffer();
	return {
		data,
		format: `image/${format}`,
		size: data.length,
	};
}

export async function GET({ request }: { request: Request }) {
	const url = new URL(request.url);
	const count = parseInt(url.searchParams.get("count") || "6", 10);
	const format = (url.searchParams.get("format") as "webp" | "avif" | "jpeg") || "webp";

	const limitedCount = Math.min(Math.max(count, 1), 10);

	async function fetchAndOptimizeImage(
		imageUrl: string,
		isMobile: boolean,
	): Promise<{ base64: string | null; originalSize: number; optimizedSize: number; format: string }> {
		try {
			const response = await fetch(imageUrl, {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
					"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
					Referer: "https://www.dmoe.cc/",
				},
			});

			if (!response.ok) {
				console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
				return { base64: null, originalSize: 0, optimizedSize: 0, format: "" };
			}

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const originalSize = buffer.length;

			const optimizationOptions: ImageOptimizationOptions = {
				width: isMobile ? MOBILE_WIDTH : DESKTOP_WIDTH,
				height: isMobile ? MOBILE_HEIGHT : DESKTOP_HEIGHT,
				quality: QUALITY,
				format,
			};

			const optimized = await optimizeImage(buffer, optimizationOptions);

			const base64 = optimized.data.toString("base64");
			const dataUrl = `data:${optimized.format};base64,${base64}`;

			return {
				base64: dataUrl,
				originalSize,
				optimizedSize: optimized.size,
				format: optimized.format,
			};
		} catch (error) {
			console.error(`Error fetching/optimizing image ${imageUrl}:`, error);
			return { base64: null, originalSize: 0, optimizedSize: 0, format: "" };
		}
	}

	const desktopImages: string[] = [];
	const mobileImages: string[] = [];
	const stats: { originalTotal: number; optimizedTotal: number; compressionRatio: number } = {
		originalTotal: 0,
		optimizedTotal: 0,
		compressionRatio: 0,
	};

	const timestamp = Date.now();

	const desktopPromises: Promise<void>[] = [];
	const mobilePromises: Promise<void>[] = [];

	for (let i = 0; i < limitedCount; i++) {
		const desktopUrl = `https://www.dmoe.cc/random.php?t=${timestamp}_${i}`;
		const mobileUrl = `https://www.dmoe.cc/random.php?t=m${timestamp}_${i}`;

		desktopPromises.push(
			fetchAndOptimizeImage(desktopUrl, false).then((result) => {
				if (result.base64) {
					desktopImages[i] = result.base64;
					stats.originalTotal += result.originalSize;
					stats.optimizedTotal += result.optimizedSize;
				} else {
					desktopImages[i] = desktopUrl;
				}
			}),
		);

		mobilePromises.push(
			fetchAndOptimizeImage(mobileUrl, true).then((result) => {
				if (result.base64) {
					mobileImages[i] = result.base64;
					stats.originalTotal += result.originalSize;
					stats.optimizedTotal += result.optimizedSize;
				} else {
					mobileImages[i] = mobileUrl;
				}
			}),
		);
	}

	await Promise.all([...desktopPromises, ...mobilePromises]);

	if (stats.originalTotal > 0) {
		stats.compressionRatio = Math.round((1 - stats.optimizedTotal / stats.originalTotal) * 100);
	}

	return new Response(
		JSON.stringify({
			desktop: desktopImages,
			mobile: mobileImages,
			timestamp,
			count: limitedCount,
			format,
			stats: {
				originalSizeKB: Math.round(stats.originalTotal / 1024),
				optimizedSizeKB: Math.round(stats.optimizedTotal / 1024),
				compressionRatio: `${stats.compressionRatio}%`,
			},
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
				"Pragma": "no-cache",
				"Expires": "0",
				"Access-Control-Allow-Origin": "*",
			},
		},
	);
}
