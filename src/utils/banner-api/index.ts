import type { BannerConfig, BannerDevice, BannerImagePool, BannerUpdateResult, WeightedRandomResult } from "./types";
import { bannerLogger } from "./logger";
import { bannerCache } from "./cache";
import { bannerApiManager } from "./api-manager";
import { weightedRandomSelector } from "./weighted-random";
import { bannerScheduler } from "./scheduler";

class BannerApiService {
	private initialized = false;
	private preloadTimer: ReturnType<typeof setTimeout> | null = null;
	private currentSelection: { desktop: WeightedRandomResult | null; mobile: WeightedRandomResult | null } = {
		desktop: null,
		mobile: null,
	};

	initialize(config: BannerConfig): void {
		if (this.initialized) {
			bannerLogger.warn("BannerApiService already initialized, updating config instead");
			this.updateConfig(config);
			return;
		}

		bannerScheduler.initialize(
			config.primaryApi,
			config.fallbackApi,
			config.mobilePrimaryApi,
			config.mobileFallbackApi,
		);

		this.initialized = true;
		bannerLogger.info("BannerApiService initialized", {
			primaryApi: config.primaryApi,
			fallbackApi: config.fallbackApi,
		});
	}

	updateConfig(config: Partial<BannerConfig>): void {
		bannerScheduler.updateConfig(config);
		bannerLogger.info("BannerApiService config updated");
	}

	async fetchBannerPool(device: BannerDevice): Promise<BannerImagePool> {
		const pool = bannerScheduler.getPool(device);

		if (pool.images.length === 0) {
			bannerLogger.warn("Banner pool is empty, attempting manual update");
			const result = await bannerScheduler.manualUpdate();
			if (!result.success) {
				throw new Error(`Failed to fetch banner pool: ${result.error}`);
			}
			return bannerScheduler.getPool(device);
		}

		return pool;
	}

	selectRandomBanner(device: BannerDevice): WeightedRandomResult {
		const pool = this.fetchBannerPoolSync(device);

		if (pool.images.length === 0) {
			throw new Error("No banners available");
		}

		const result = weightedRandomSelector.select(pool);
		this.currentSelection[device] = result;

		this.schedulePreload(device, result);

		return result;
	}

	private fetchBannerPoolSync(device: BannerDevice): BannerImagePool {
		return bannerScheduler.getPool(device);
	}

	private schedulePreload(device: BannerDevice, current: WeightedRandomResult): void {
		if (this.preloadTimer) {
			clearTimeout(this.preloadTimer);
		}

		const preloadDelay = (30 - 10) * 1000;

		this.preloadTimer = setTimeout(() => {
			this.preloadNext(device, current);
		}, preloadDelay);
	}

	private async preloadNext(device: BannerDevice, current: WeightedRandomResult): Promise<void> {
		try {
			const pool = this.fetchBannerPoolSync(device);
			const filtered = pool.images.filter((img) => img.url !== current.image.url);

			if (filtered.length === 0) return;

			const nextSelection = weightedRandomSelector.select({ ...pool, images: filtered });

			const img = new Image();
			img.src = nextSelection.image.url;

			bannerLogger.info("Preloaded next banner image", {
				url: nextSelection.image.url,
				device,
			});
		} catch (error) {
			bannerLogger.error("Failed to preload next banner", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	async updateBannerPool(): Promise<BannerUpdateResult> {
		return bannerScheduler.manualUpdate();
	}

	getCurrentBanner(device: BannerDevice): BannerImagePool["images"][0] | null {
		return this.currentSelection[device]?.image || null;
	}

	getHealthStatus(): { primary: boolean; fallback: boolean; currentApi: string } {
		return {
			primary: bannerApiManager.isPrimaryHealthy(),
			fallback: bannerApiManager.isFallbackHealthy(),
			currentApi: bannerApiManager.getCurrentApi(),
		};
	}

	getCacheStats(): { size: string; entries: number; hitRate: string } {
		return bannerCache.getCacheInfo();
	}

	getDisplayReport(): ReturnType<typeof weightedRandomSelector.getDailyReport> {
		return weightedRandomSelector.getDailyReport();
	}

	updateImageWeights(weights: Record<string, number>, device?: BannerDevice): void {
		if (device) {
			const pool = this.fetchBannerPoolSync(device);
			weightedRandomSelector.updateWeights(pool.images, weights);
		} else {
			const desktopPool = this.fetchBannerPoolSync("desktop");
			const mobilePool = this.fetchBannerPoolSync("mobile");
			weightedRandomSelector.updateWeights([...desktopPool.images, ...mobilePool.images], weights);
		}
	}

	forceCleanup(): void {
		bannerScheduler.forceCleanup();
	}

	resetStats(): void {
		bannerCache.resetStats();
		weightedRandomSelector.resetHistory();
		bannerLogger.info("Banner service stats reset");
	}

	stop(): void {
		if (this.preloadTimer) {
			clearTimeout(this.preloadTimer);
		}
		bannerScheduler.stop();
		this.initialized = false;
		bannerLogger.info("BannerApiService stopped");
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}

export const bannerApiService = new BannerApiService();
export { bannerLogger, bannerCache, bannerApiManager, weightedRandomSelector, bannerScheduler };
export type { BannerConfig, BannerDevice, BannerImagePool, BannerUpdateResult, WeightedRandomResult } from "./types";
