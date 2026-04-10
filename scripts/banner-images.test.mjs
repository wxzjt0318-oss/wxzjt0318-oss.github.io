import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { siteConfig } from "../src/config";
import { fetchBannerImages } from "../src/utils/banner-images";

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
});
