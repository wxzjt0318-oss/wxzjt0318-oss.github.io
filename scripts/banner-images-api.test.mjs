import { describe, expect, it, vi } from "vitest";

import { GET } from "../src/pages/api/banner-images.json";
import * as bannerImagesModule from "../src/utils/banner-images";

describe("banner-images api route", () => {
	it("returns banner images from shared fallback-aware fetcher", async () => {
		vi.spyOn(bannerImagesModule, "fetchBannerImages").mockResolvedValue({
			desktop: ["https://img.example.com/d1.webp", "https://img.example.com/d2.webp"],
			mobile: ["https://img.example.com/m1.webp", "https://img.example.com/m2.webp"],
		});

		const response = await GET({
			request: new Request("https://example.com/api/banner-images.json?count=2"),
		});
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.count).toBe(2);
		expect(data.desktop).toEqual([
			"https://img.example.com/d1.webp",
			"https://img.example.com/d2.webp",
		]);
		expect(data.mobile).toEqual([
			"https://img.example.com/m1.webp",
			"https://img.example.com/m2.webp",
		]);
	});
});
