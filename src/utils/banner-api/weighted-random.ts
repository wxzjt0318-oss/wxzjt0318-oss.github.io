import type { BannerImage, BannerImagePool, DisplayStats, WeightedRandomResult } from "./types";
import { bannerLogger } from "./logger";

const DEVIATION_THRESHOLD_PERCENT = 5;

class WeightedRandomSelector {
	private displayHistory: Map<string, { shownCount: number; lastShownAt: number }> = new Map();
	private dailyStats: { date: string; total: number; imageStats: Map<string, number> } = {
		date: new Date().toISOString().split("T")[0],
		total: 0,
		imageStats: new Map(),
	};

	constructor() {
		this.startDailyReset();
	}

	private startDailyReset(): void {
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		const msUntilMidnight = tomorrow.getTime() - now.getTime();

		setTimeout(() => {
			this.resetDailyStats();
			this.startDailyReset();
		}, msUntilMidnight);
	}

	private resetDailyStats(): void {
		this.dailyStats = {
			date: new Date().toISOString().split("T")[0],
			total: 0,
			imageStats: new Map(),
		};
		bannerLogger.info("Daily display statistics reset");
	}

	private ensureDailyReset(): void {
		const today = new Date().toISOString().split("T")[0];
		if (this.dailyStats.date !== today) {
			this.resetDailyStats();
		}
	}

	private calculateEffectiveWeight(image: BannerImage, allImages: BannerImage[]): number {
		const history = this.displayHistory.get(image.id);
		const shownCount = history?.shownCount || image.shownCount || 0;

		const baseWeight = image.weight || 1;

		const totalShown = allImages.reduce(
			(sum, img) => sum + (this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0),
			0,
		);

		const avgShown = totalShown / allImages.length;
		const shownDeviation = avgShown > 0 ? (shownCount - avgShown) / avgShown : 0;

		const timeSinceLastShown = history?.lastShownAt
			? Date.now() - history.lastShownAt
			: Date.now() - image.createdAt;

		const timeBonus = Math.min(timeSinceLastShown / (24 * 60 * 60 * 1000), 1) * 0.5;

		const exposurePenalty = shownDeviation > 0 ? Math.min(shownDeviation, 1) * 0.5 : 0;

		let effectiveWeight = baseWeight + timeBonus - exposurePenalty;

		if (history?.lastShownAt === undefined) {
			effectiveWeight += 0.3;
		}

		return Math.max(0.1, effectiveWeight);
	}

	select(pool: BannerImagePool): WeightedRandomResult {
		this.ensureDailyReset();

		if (pool.images.length === 0) {
			throw new Error("No images in pool to select from");
		}

		if (pool.images.length === 1) {
			const image = pool.images[0];
			this.recordSelection(image);
			return {
				image,
				weight: image.weight,
				randomValue: 0,
			};
		}

		const startTime = performance.now();

		const effectiveWeights = pool.images.map((img) => this.calculateEffectiveWeight(img, pool.images));

		const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);

		let randomValue = Math.random() * totalWeight;

		let selectedImage = pool.images[0];
		let cumulativeWeight = 0;

		for (let i = 0; i < pool.images.length; i++) {
			cumulativeWeight += effectiveWeights[i];
			if (randomValue <= cumulativeWeight) {
				selectedImage = pool.images[i];
				break;
			}
		}

		this.recordSelection(selectedImage);

		const responseTimeMs = performance.now() - startTime;

		bannerLogger.logWeightedRandom(
			selectedImage.url,
			selectedImage.weight,
			effectiveWeights,
			responseTimeMs,
		);

		this.checkDeviation(pool.images);

		return {
			image: selectedImage,
			weight: selectedImage.weight,
			randomValue,
		};
	}

	private recordSelection(image: BannerImage): void {
		const current = this.displayHistory.get(image.id) || {
			shownCount: image.shownCount || 0,
			lastShownAt: image.lastShownAt || Date.now(),
		};

		current.shownCount++;
		current.lastShownAt = Date.now();
		this.displayHistory.set(image.id, current);

		this.dailyStats.total++;
		const currentDayCount = this.dailyStats.imageStats.get(image.id) || 0;
		this.dailyStats.imageStats.set(image.id, currentDayCount + 1);

		image.shownCount = current.shownCount;
		image.lastShownAt = current.lastShownAt;
	}

	private checkDeviation(images: BannerImage[]): void {
		if (images.length < 2) return;

		const total = images.reduce((sum, img) => {
			const shown = this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0;
			return sum + shown;
		}, 0);

		if (total === 0) return;

		const expected = total / images.length;

		for (const img of images) {
			const shown = this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0;
			const deviation = Math.abs(shown - expected) / expected * 100;

			if (deviation > DEVIATION_THRESHOLD_PERCENT * 2) {
				bannerLogger.warn("Image exposure deviation detected", {
					imageId: img.id,
					url: img.url,
					expectedPercentage: 100 / images.length,
					actualPercentage: (shown / total) * 100,
					deviation: deviation.toFixed(2),
				});
			}
		}
	}

	getDisplayStats(images: BannerImage[]): DisplayStats[] {
		const total = images.reduce((sum, img) => sum + (this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0), 0);

		return images.map((img) => {
			const shown = this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0;
			return {
				imageId: img.id,
				url: img.url,
				shownCount: shown,
				lastShownAt: this.displayHistory.get(img.id)?.lastShownAt || img.lastShownAt || 0,
				displayPercentage: total > 0 ? (shown / total) * 100 : 0,
			};
		});
	}

	getDailyReport(): { date: string; totalDisplays: number; imageStats: DisplayStats[] } {
		this.ensureDailyReset();

		const allImages = Array.from(this.displayHistory.keys());
		const displayStats = this.getDisplayStats(
			allImages.map((id) => ({ id, url: "", weight: 1, format: "jpg" as const, shownCount: 0, createdAt: Date.now() })),
		);

		return {
			date: this.dailyStats.date,
			totalDisplays: this.dailyStats.total,
			imageStats: displayStats.filter((s) => s.shownCount > 0),
		};
	}

	updateWeights(images: BannerImage[], newWeights: Record<string, number>): void {
		for (const img of images) {
			if (newWeights[img.id] !== undefined) {
				img.weight = newWeights[img.id];
			}
		}
		bannerLogger.info("Banner image weights updated", { updatedCount: Object.keys(newWeights).length });
	}

	getExposureDeviation(images: BannerImage[]): { imageId: string; deviation: number }[] {
		const results: { imageId: string; deviation: number }[] = [];
		const total = images.reduce((sum, img) => sum + (this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0), 0);

		if (total === 0) return results;

		const expected = 100 / images.length;

		for (const img of images) {
			const shown = this.displayHistory.get(img.id)?.shownCount || img.shownCount || 0;
			const actual = (shown / total) * 100;
			const deviation = actual - expected;
			results.push({ imageId: img.id, deviation });
		}

		return results;
	}

	resetHistory(): void {
		this.displayHistory.clear();
		this.resetDailyStats();
		bannerLogger.info("Display history reset");
	}

	restoreHistory(history: Record<string, { shownCount: number; lastShownAt: number }>): void {
		for (const [id, data] of Object.entries(history)) {
			this.displayHistory.set(id, data);
		}
		bannerLogger.info("Display history restored", { imageCount: Object.keys(history).length });
	}
}

export const weightedRandomSelector = new WeightedRandomSelector();
