import { existsSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.skip(
	!process.env.PUBLIC_SERIA_ASSET_KEY && !existsSync(".env.local"),
	"Protected model requires its deployment key",
);
test.use({ viewport: { width: 1440, height: 1000 } });
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const original = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			return original.call(this).then(() => {
				if (this.src.startsWith("blob:"))
					document.documentElement.dataset.seriaAudioPlayed = "true";
			});
		};
	});
	// Use an authentic, locally cached official Core to make this test independent of CDN uptime.
	if (process.env.SERIA_TEST_CORE) {
		const core = readFileSync(process.env.SERIA_TEST_CORE);
		await page.route(
			"https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
			(route) =>
				route.fulfill({ contentType: "application/javascript", body: core }),
		);
	}
});

test("protected model renders, rejects blank clicks, speaks and survives navigation", async ({
	page,
}) => {
	test.setTimeout(120_000);
	page.on("console", (message) => {
		if (message.type() === "error" || message.text().includes("Seria"))
			console.log(message.text());
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const widget = page.locator(".seria-widget");
	await expect(widget).toHaveAttribute("data-seria-state", "ready", {
		timeout: 75_000,
	});
	const canvas = page.locator("#seria-canvas");
	await expect(canvas).toHaveAttribute("data-seria-ready", "true");
	const box = (await canvas.boundingBox())!;
	await page.mouse.click(box.x + 2, box.y + 2);
	await expect(widget.getByRole("status")).toHaveCount(0);
	await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.2);
	await expect(widget.getByRole("status")).toBeVisible();
	await widget.getByRole("button", { name: "播放自我介绍" }).click();
	await expect(widget.getByRole("status")).toHaveText(
		"我的名字叫瑟莉亚·库列尔",
	);
	const bubble = await widget.getByRole("status").boundingBox();
	if (!bubble) throw new Error("Introduction bubble must be visible");
	expect(bubble.y + bubble.height).toBeLessThanOrEqual(box.y - 8);
	await expect(page.locator("html")).toHaveAttribute(
		"data-seria-audio-played",
		"true",
	);
	await page.screenshot({ path: "test-results/seria-blog.png" });
	await widget.getByRole("button", { name: "隐藏看板娘" }).click();
	await expect(canvas).not.toBeVisible();
	await widget.getByRole("button", { name: "显示看板娘" }).click();
	await expect(canvas).toBeVisible();
	const accessibility = await new AxeBuilder({ page })
		.include(".seria-widget")
		.analyze();
	expect(accessibility.violations.map((violation) => violation.id)).toEqual([]);
	// Keep the same persistent-shell canvas across Swup content replacement.
	await page.waitForFunction(() => Boolean(window.swup?.hooks));
	await canvas.evaluate((el) => {
		el.dataset.testIdentity = "persistent";
	});
	const link = page.locator('a[href="/archive/"]').first();
	await link.click();
	await expect(page).toHaveURL(/\/archive\/?$/);
	await expect(canvas).toHaveAttribute("data-test-identity", "persistent");
	await expect(canvas).toHaveCount(1);
});

test("mobile-hidden model sends no model or Core requests", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const requests: string[] = [];
	page.on("request", (request) => {
		if (/seria-.*\.bin|live2dcubismcore/.test(request.url()))
			requests.push(request.url());
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	// A hidden client:visible island intentionally stays unhydrated on mobile.
	await page.waitForFunction(() => Boolean(customElements.get("astro-island")));
	await expect(page.locator(".seria-widget")).not.toBeVisible();
	expect(requests).toEqual([]);
});
