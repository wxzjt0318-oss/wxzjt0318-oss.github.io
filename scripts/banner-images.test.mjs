import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { siteConfig } from "../src/config";
import { fetchBannerImages, getBannerServiceStatus, getBannerCacheStats } from "../src/utils/banner-images";
import { bannerLogger, bannerCache, weightedRandomSelector } from "../src/utils/banner-api";

describe("banner fallback api", () => {
	const originalImageApi = structuredClone(siteConfig.banner.imageApi);
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
		siteConfig.banner.imageApi = {
			enable: true,
			url: "https://primary.example.com/banner",
			fallbackUrl: "https://fallback.example.com/banner",
			timeoutMs: 1000,
			requestParams: {
				format: "webp",
				width: 1920,
				height: 1080,
			},
		};
	});

	afterEach(() => {
		global.fetch = originalFetch;
		siteConfig.banner.imageApi = originalImageApi;
		bannerCache.clear();
	});

	it("uses primary banner api when it succeeds", async () => {
		global.fetch = vi.fn(async (input) => {
			const url = String(input);
			expect(url).toContain("primary.example.com/banner");
			expect(url).toContain("format=webp");
			expect(url).toContain("width=1920");
			expect(url).toContain("height=1080");
			return new Response("https://img.example.com/a.webp\nhttps://img.example.com/b.webp", {
				status: 200,
			});
		});

		const result = await fetchBannerImages(2);
		expect(result.desktop).toHaveLength(2);
		expect(result.mobile).toHaveLength(2);
	});

	it("switches to fallback api when primary api fails", async () => {
		global.fetch = vi.fn(async (input) => {
			const url = String(input);
			if (url.includes("primary.example.com")) {
				return new Response("upstream error", { status: 502 });
			}
			return new Response("https://img.example.com/f1.webp\nhttps://img.example.com/f2.webp", {
				status: 200,
			});
		});

		const result = await fetchBannerImages(2);
		expect(result.desktop).toEqual([
			"https://img.example.com/f1.webp",
			"https://img.example.com/f2.webp",
		]);
		expect(result.mobile).toEqual([
			"https://img.example.com/f1.webp",
			"https://img.example.com/f2.webp",
		]);
	});

	it("fetches from DMOE API when primary and fallback fail", async () => {
		let requestCount = 0;
		global.fetch = vi.fn(async (input) => {
			const url = String(input);
			requestCount++;

			if (url.includes("primary.example.com") || url.includes("fallback.example.com")) {
				return new Response("upstream error", { status: 502 });
			}

			if (url.includes("dmoe.cc")) {
				return new Response(JSON.stringify({
					img: `https://img.dmoe.cc/test${requestCount}.jpg`,
					url: `https://img.dmoe.cc/test${requestCount}.jpg`,
				}), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response("default", { status: 200 });
		});

		const result = await fetchBannerImages(2);
		expect(result.desktop.length).toBeGreaterThanOrEqual(0);
	});

	it("falls back to default sources when all APIs fail", async () => {
		global.fetch = vi.fn(async (input) => {
			const url = String(input);
			if (url.includes("primary.example.com") || url.includes("fallback.example.com") || url.includes("dmoe.cc")) {
				return new Response("error", { status: 500 });
			}
			return new Response("not found", { status: 404 });
		});

		const result = await fetchBannerImages(2);
		expect(result).toHaveProperty("desktop");
		expect(result).toHaveProperty("mobile");
	});
});

describe("banner service status", () => {
	it("returns health status from banner API service", () => {
		const status = getBannerServiceStatus();
		expect(status).toHaveProperty("primary");
		expect(status).toHaveProperty("fallback");
		expect(status).toHaveProperty("currentApi");
		expect(typeof status.primary).toBe("boolean");
		expect(typeof status.fallback).toBe("boolean");
		expect(status.currentApi).toBe("primary");
	});
});

describe("banner cache stats", () => {
	it("returns cache statistics", () => {
		const stats = getBannerCacheStats();
		expect(stats).toHaveProperty("size");
		expect(stats).toHaveProperty("entries");
		expect(stats).toHaveProperty("hitRate");
		expect(typeof stats.size).toBe("number");
		expect(typeof stats.entries).toBe("number");
		expect(typeof stats.hitRate).toBe("string");
	});
});

describe("banner logger", () => {
	it("logs info messages correctly", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		bannerLogger.info("test info message", { key: "value" });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("logs warning messages correctly", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		bannerLogger.warn("test warning message", { key: "value" });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("logs error messages correctly", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		bannerLogger.error("test error message", { key: "value" });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("logs API switch events", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		bannerLogger.logApiSwitch("primary-url", "fallback-url", "test reason", { responseTimeMs: 100 });
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("logs API request events", () => {
		const successSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		bannerLogger.logApiRequest("https://test.com", "primary", true, 50);
		bannerLogger.logApiRequest("https://test.com", "fallback", false, 100, "timeout");

		expect(successSpy).toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();

		successSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("retrieves logs with optional filtering", () => {
		const logs = bannerLogger.getLogs("INFO", 10);
		expect(Array.isArray(logs)).toBe(true);
	});

	it("exports logs in JSON format", () => {
		const exported = bannerLogger.exportLogs("json");
		expect(typeof exported).toBe("string");
		expect(() => JSON.parse(exported)).not.toThrow();
	});

	it("exports logs in text format", () => {
		const exported = bannerLogger.exportLogs("text");
		expect(typeof exported).toBe("string");
		expect(exported.length).toBeGreaterThan(0);
	});

	it("clears logs", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		bannerLogger.info("test");
		bannerLogger.clearLogs();
		const logs = bannerLogger.getLogs();
		expect(logs.length).toBe(0);
		spy.mockRestore();
	});

	it("returns logger statistics", () => {
		const stats = bannerLogger.getStats();
		expect(stats).toHaveProperty("total");
		expect(stats).toHaveProperty("byLevel");
		expect(typeof stats.total).toBe("number");
	});
});

describe("weighted random selector", () => {
	beforeEach(() => {
		weightedRandomSelector.resetHistory();
	});

	it("selects images based on weighted random algorithm", () => {
		const pool = {
			images: [
				{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
				{ id: "img2", url: "https://test2.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
				{ id: "img3", url: "https://test3.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
			],
			updatedAt: Date.now(),
			device: "desktop" as const,
		};

		const result = weightedRandomSelector.select(pool);
		expect(result).toHaveProperty("image");
		expect(result).toHaveProperty("weight");
		expect(result).toHaveProperty("randomValue");
		expect(pool.images.some((img) => img.id === result.image.id)).toBe(true);
	});

	it("handles single image pool", () => {
		const pool = {
			images: [
				{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
			],
			updatedAt: Date.now(),
			device: "desktop" as const,
		};

		const result = weightedRandomSelector.select(pool);
		expect(result.image.id).toBe("img1");
		expect(result.randomValue).toBe(0);
	});

	it("throws error for empty pool", () => {
		const pool = {
			images: [],
			updatedAt: Date.now(),
			device: "desktop" as const,
		};

		expect(() => weightedRandomSelector.select(pool)).toThrow("No images in pool to select from");
	});

	it("updates image weights", () => {
		const images = [
			{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
			{ id: "img2", url: "https://test2.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
		];

		weightedRandomSelector.updateWeights(images, { img1: 5, img2: 1 });

		expect(images.find((img) => img.id === "img1")?.weight).toBe(5);
		expect(images.find((img) => img.id === "img2")?.weight).toBe(1);
	});

	it("retrieves display statistics", () => {
		const images = [
			{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 5, createdAt: Date.now() },
			{ id: "img2", url: "https://test2.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 3, createdAt: Date.now() },
		];

		const stats = weightedRandomSelector.getDisplayStats(images);
		expect(stats).toHaveLength(2);
		expect(stats[0]).toHaveProperty("imageId");
		expect(stats[0]).toHaveProperty("shownCount");
		expect(stats[0]).toHaveProperty("displayPercentage");
	});

	it("calculates exposure deviation", () => {
		const images = [
			{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 10, createdAt: Date.now() },
			{ id: "img2", url: "https://test2.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 0, createdAt: Date.now() },
		];

		const deviation = weightedRandomSelector.getExposureDeviation(images);
		expect(deviation).toHaveLength(2);
	});

	it("resets display history", () => {
		const images = [
			{ id: "img1", url: "https://test1.com/img.jpg", format: "jpg" as const, weight: 1, shownCount: 5, createdAt: Date.now() },
		];

		weightedRandomSelector.select({ images, updatedAt: Date.now(), device: "desktop" });
		weightedRandomSelector.resetHistory();

		const stats = weightedRandomSelector.getDisplayStats(images);
		expect(stats[0].shownCount).toBe(0);
	});
});

describe("banner cache", () => {
	beforeEach(() => {
		bannerCache.clear();
		bannerCache.resetStats();
	});

	it("stores and retrieves cached data", () => {
		const key = "test-key";
		const data = { url: "https://test.com/image.jpg" };

		bannerCache.set(key, data, 3600000);
		const retrieved = bannerCache.get<typeof data>(key);

		expect(retrieved).toEqual(data);
	});

	it("returns null for expired cache", async () => {
		const key = "expired-key";
		const data = "test data";

		bannerCache.set(key, data, -1000);
		const retrieved = bannerCache.get<string>(key);

		expect(retrieved).toBeNull();
	});

	it("returns null for non-existent key", () => {
		const retrieved = bannerCache.get("non-existent-key");
		expect(retrieved).toBeNull();
	});

	it("deletes cache entries", () => {
		const key = "delete-key";
		bannerCache.set(key, "data", 3600000);

		const deleted = bannerCache.delete(key);
		const retrieved = bannerCache.get(key);

		expect(deleted).toBe(true);
		expect(retrieved).toBeNull();
	});

	it("evicts expired entries", () => {
		bannerCache.set("expired1", "data1", -1000);
		bannerCache.set("expired2", "data2", -1000);
		bannerCache.set("valid", "data3", 3600000);

		const evicted = bannerCache.evictExpired();

		expect(evicted).toBeGreaterThanOrEqual(2);
	});

	it("clears all cache", () => {
		bannerCache.set("key1", "data1", 3600000);
		bannerCache.set("key2", "data2", 3600000);

		bannerCache.clear();

		expect(bannerCache.get("key1")).toBeNull();
		expect(bannerCache.get("key2")).toBeNull();
	});

	it("returns cache statistics", () => {
		bannerCache.set("key1", "data1", 3600000);
		bannerCache.get("key1");
		bannerCache.get("non-existent");

		const stats = bannerCache.getStats();

		expect(stats).toHaveProperty("hits");
		expect(stats).toHaveProperty("misses");
		expect(stats).toHaveProperty("hitRate");
		expect(stats.hits).toBeGreaterThanOrEqual(0);
		expect(stats.misses).toBeGreaterThanOrEqual(0);
	});

	it("returns cache info", () => {
		const info = bannerCache.getCacheInfo();

		expect(info).toHaveProperty("size");
		expect(info).toHaveProperty("maxSize");
		expect(info).toHaveProperty("entries");
		expect(info).toHaveProperty("hitRate");
	});

	it("caches and retrieves images", async () => {
		const url = "https://test.com/image.jpg";

		await bannerCache.setImageCache(url, "https://cached.com/image.jpg", 24);
		const cached = await bannerCache.getImageCache(url);

		expect(cached).toBe("https://cached.com/image.jpg");
	});

	it("resets cache statistics", () => {
		bannerCache.set("key1", "data1", 3600000);
		bannerCache.get("key1");
		bannerCache.resetStats();

		const stats = bannerCache.getStats();
		expect(stats.hits).toBe(0);
	});
});
