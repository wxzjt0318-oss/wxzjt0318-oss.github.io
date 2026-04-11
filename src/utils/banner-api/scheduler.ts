import type { BannerConfig, BannerImage, BannerImagePool, BannerUpdateResult, ImageFormat } from "./types";
import { bannerLogger } from "./logger";
import { bannerApiManager } from "./api-manager";

const DEFAULT_CONFIG: Partial<BannerConfig> = {
	cacheTtlHours: 24,
	maxPoolSize: 18,
	poolCleanupHours: 72,
	scheduledUpdateHour: 2,
	retryAttempts: 3,
	retryIntervalMs: 5 * 60 * 1000,
};

class BannerScheduler {
	private poolDesktop: BannerImagePool = {
		images: [],
		updatedAt: 0,
		device: "desktop",
	};

	private poolMobile: BannerImagePool = {
		images: [],
		updatedAt: 0,
		device: "mobile",
	};

	private config: BannerConfig;
	private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
	private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
	private retryAttempts = 0;
	private isUpdating = false;

	constructor(config?: Partial<BannerConfig>) {
		this.config = {
			primaryApi: "",
			fallbackApi: "",
			mobilePrimaryApi: "",
			mobileFallbackApi: "",
			timeoutMs: 5000,
			retryAttempts: DEFAULT_CONFIG.retryAttempts || 3,
			retryIntervalMs: DEFAULT_CONFIG.retryIntervalMs || 5 * 60 * 1000,
			cacheTtlHours: config?.cacheTtlHours || DEFAULT_CONFIG.cacheTtlHours || 24,
			maxPoolSize: config?.maxPoolSize || DEFAULT_CONFIG.maxPoolSize || 18,
			poolCleanupHours: config?.poolCleanupHours || DEFAULT_CONFIG.poolCleanupHours || 72,
			scheduledUpdateHour: config?.scheduledUpdateHour || DEFAULT_CONFIG.scheduledUpdateHour || 2,
			supportedFormats: ["jpg", "jpeg", "png", "webp"],
			failureThreshold: 3,
			preloadThresholdSeconds: 10,
			switchCooldownMs: 300,
			...config,
		};

		bannerApiManager.updateConfig(this.config);
	}

	initialize(primaryApi: string, fallbackApi?: string, mobilePrimaryApi?: string, mobileFallbackApi?: string): void {
		this.config.primaryApi = primaryApi;
		this.config.fallbackApi = fallbackApi || "";
		this.config.mobilePrimaryApi = mobilePrimaryApi || primaryApi;
		this.config.mobileFallbackApi = mobileFallbackApi || fallbackApi || "";

		bannerApiManager.updateConfig(this.config);

		this.scheduleNextUpdate();
		this.scheduleNextCleanup();
	}

	updateConfig(newConfig: Partial<BannerConfig>): void {
		this.config = { ...this.config, ...newConfig };
		bannerApiManager.updateConfig(this.config);
	}

	private scheduleNextUpdate(): void {
		if (typeof window === "undefined") return;

		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(this.config.scheduledUpdateHour, 0, 0, 0);

		const msUntilUpdate = tomorrow.getTime() - now.getTime();

		if (this.scheduledTimer) {
			clearTimeout(this.scheduledTimer);
		}

		this.scheduledTimer = setTimeout(async () => {
			await this.performScheduledUpdate();
			this.scheduleNextUpdate();
		}, msUntilUpdate);

		bannerLogger.info("Scheduled update timer set", {
			nextUpdate: tomorrow.toISOString(),
			hoursUntilUpdate: (msUntilUpdate / (1000 * 60 * 60)).toFixed(2),
		});
	}

	private scheduleNextCleanup(): void {
		if (typeof window === "undefined") return;

		const cleanupIntervalMs = this.config.poolCleanupHours * 60 * 60 * 1000;

		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer);
		}

		this.cleanupTimer = setTimeout(() => {
			this.performCleanup();
			this.scheduleNextCleanup();
		}, cleanupIntervalMs);

		bannerLogger.info("Scheduled cleanup timer set", {
			intervalHours: this.config.poolCleanupHours,
		});
	}

	private async performScheduledUpdate(): Promise<void> {
		bannerLogger.info("Starting scheduled banner pool update");

		try {
			const result = await this.updatePool();
			if (result.success) {
				this.retryAttempts = 0;
				bannerLogger.info("Scheduled banner pool update completed", {
					imagesAdded: result.imagesAdded,
					imagesRemoved: result.imagesRemoved,
				});
			} else {
				await this.handleUpdateFailure();
			}
		} catch (error) {
			bannerLogger.error("Scheduled update failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			await this.handleUpdateFailure();
		}
	}

	private async handleUpdateFailure(): Promise<void> {
		if (this.retryAttempts < this.config.retryAttempts) {
			this.retryAttempts++;
			bannerLogger.warn("Scheduling retry for banner pool update", {
				attempt: this.retryAttempts,
				maxAttempts: this.config.retryAttempts,
				retryIntervalMs: this.config.retryIntervalMs,
			});

			setTimeout(async () => {
				try {
					const result = await this.updatePool();
					if (result.success) {
						this.retryAttempts = 0;
					} else {
						await this.handleUpdateFailure();
					}
				} catch {
					await this.handleUpdateFailure();
				}
			}, this.config.retryIntervalMs);
		} else {
			bannerLogger.error("Max retry attempts reached for banner pool update", {
				attempts: this.retryAttempts,
			});
			this.retryAttempts = 0;
		}
	}

	private async updatePool(): Promise<BannerUpdateResult> {
		if (this.isUpdating) {
			return { success: false, imagesAdded: 0, imagesRemoved: 0, error: "Update already in progress", timestamp: Date.now() };
		}

		this.isUpdating = true;
		const result: BannerUpdateResult = { success: false, imagesAdded: 0, imagesRemoved: 0, timestamp: Date.now() };

		try {
			const { data: desktopImages, usedFallback: desktopFallback } = await bannerApiManager.requestWithFallback(
				"desktop",
				async (endpoint) => {
					const response = await fetch(endpoint.url);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const text = await response.text();
					return this.parseApiResponse(text);
				},
			);

			const { data: mobileImages, usedFallback: mobileFallback } = await bannerApiManager.requestWithFallback(
				"mobile",
				async (endpoint) => {
					const response = await fetch(endpoint.url);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const text = await response.text();
					return this.parseApiResponse(text);
				},
			);

			const newDesktopImages = this.mergeNewImages(desktopImages, this.poolDesktop.images);
			const newMobileImages = this.mergeNewImages(mobileImages, this.poolMobile.images);

			const oldDesktopCount = this.poolDesktop.images.length;
			const oldMobileCount = this.poolMobile.images.length;

			this.poolDesktop.images = this.limitPoolSize([...this.poolDesktop.images, ...newDesktopImages]);
			this.poolMobile.images = this.limitPoolSize([...this.poolMobile.images, ...newMobileImages]);

			this.poolDesktop.updatedAt = Date.now();
			this.poolMobile.updatedAt = Date.now();

			result.imagesAdded = newDesktopImages.length + newMobileImages.length;
			result.imagesRemoved = (oldDesktopCount + oldMobileCount) - (this.poolDesktop.images.length + this.poolMobile.images.length);
			result.success = true;

			bannerLogger.info("Banner pool updated", {
				desktopImages: this.poolDesktop.images.length,
				mobileImages: this.poolMobile.images.length,
				usedDesktopFallback: desktopFallback,
				usedMobileFallback: mobileFallback,
			});

			return result;
		} catch (error) {
			result.error = error instanceof Error ? error.message : String(error);
			return result;
		} finally {
			this.isUpdating = false;
		}
	}

	private parseApiResponse(text: string): string[] {
		const raw = text.trim();

		if (raw.startsWith("[") || raw.startsWith("{")) {
			try {
				const parsed = JSON.parse(raw);
				const urls: string[] = [];
				this.collectUrls(parsed, urls);
				return [...new Set(urls)].filter((url) => bannerApiManager.validateImageUrl(url));
			} catch {
				return this.parsePlainTextResponse(raw);
			}
		}

		return this.parsePlainTextResponse(raw);
	}

	private parsePlainTextResponse(text: string): string[] {
		return text
			.split(/\r?\n|,/)
			.map((line) => line.trim())
			.filter((line) => bannerApiManager.validateImageUrl(line));
	}

	private collectUrls(value: unknown, collector: string[]): void {
		if (typeof value === "string" && bannerApiManager.validateImageUrl(value)) {
			collector.push(value);
			return;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				this.collectUrls(item, collector);
			}
			return;
		}

		if (value && typeof value === "object") {
			for (const nested of Object.values(value as Record<string, unknown>)) {
				this.collectUrls(nested, collector);
			}
		}
	}

	private mergeNewImages(newUrls: string[], existingImages: BannerImage[]): BannerImage[] {
		const existingUrls = new Set(existingImages.map((img) => img.url));
		const now = Date.now();

		return newUrls
			.filter((url) => !existingUrls.has(url))
			.map((url) => ({
				url,
				id: this.generateImageId(url),
				format: this.extractFormat(url),
				weight: 1,
				createdAt: now,
				shownCount: 0,
			}));
	}

	private generateImageId(url: string): string {
		const hash = url.split("").reduce((acc, char) => {
			const chr = char.charCodeAt(0);
			return ((acc << 5) - acc) + chr;
		}, 0);
		return `img_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
	}

	private extractFormat(url: string): ImageFormat {
		const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() as ImageFormat;
		if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
			return ext;
		}
		return "jpg";
	}

	private limitPoolSize(images: BannerImage[]): BannerImage[] {
		if (images.length <= this.config.maxPoolSize) {
			return images;
		}

		const sorted = images.sort((a, b) => {
			const aScore = a.shownCount * 0.3 + (Date.now() - a.createdAt) * 0.001;
			const bScore = b.shownCount * 0.3 + (Date.now() - b.createdAt) * 0.001;
			return aScore - bScore;
		});

		return sorted.slice(0, this.config.maxPoolSize);
	}

	private performCleanup(): void {
		const now = Date.now();
		const cutoffTime = now - this.config.poolCleanupHours * 60 * 60 * 1000;

		const beforeDesktop = this.poolDesktop.images.length;
		const beforeMobile = this.poolMobile.images.length;

		this.poolDesktop.images = this.poolDesktop.images.filter((img) => img.createdAt > cutoffTime || img.shownCount > 0);
		this.poolMobile.images = this.poolMobile.images.filter((img) => img.createdAt > cutoffTime || img.shownCount > 0);

		const cleanedDesktop = beforeDesktop - this.poolDesktop.images.length;
		const cleanedMobile = beforeMobile - this.poolMobile.images.length;

		bannerLogger.info("Banner pool cleanup completed", {
			cleanedDesktop,
			cleanedMobile,
			remainingDesktop: this.poolDesktop.images.length,
			remainingMobile: this.poolMobile.images.length,
		});
	}

	getPool(device: "desktop" | "mobile"): BannerImagePool {
		return device === "desktop" ? { ...this.poolDesktop, images: [...this.poolDesktop.images] } : { ...this.poolMobile, images: [...this.poolMobile.images] };
	}

	getNextUpdateTime(): { desktop: number; mobile: number } {
		return {
			desktop: this.poolDesktop.updatedAt + this.config.cacheTtlHours * 60 * 60 * 1000,
			mobile: this.poolMobile.updatedAt + this.config.cacheTtlHours * 60 * 60 * 1000,
		};
	}

	manualUpdate(): Promise<BannerUpdateResult> {
		return this.updatePool();
	}

	forceCleanup(): void {
		this.performCleanup();
	}

	stop(): void {
		if (this.scheduledTimer) {
			clearTimeout(this.scheduledTimer);
			this.scheduledTimer = null;
		}
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		bannerLogger.info("Banner scheduler stopped");
	}
}

export const bannerScheduler = new BannerScheduler();
