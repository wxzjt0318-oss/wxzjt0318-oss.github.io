import type { CacheEntry, CacheStats } from "./types";
import { bannerLogger } from "./logger";

const MAX_CACHE_SIZE_MB = 100;
const BYTES_PER_MB = 1024 * 1024;

class BannerCache {
	private memoryCache = new Map<string, CacheEntry<unknown>>();
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		size: 0,
		hitRate: 0,
	};

	private calculateMd5(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		const hashStr = Math.abs(hash).toString(16);
		return "0".repeat(8 - hashStr.length) + hashStr;
	}

	private generateCacheKey(url: string, ttlHours: number): string {
		const timestamp = Math.floor(Date.now() / (ttlHours * 60 * 60 * 1000));
		const hash = this.calculateMd5(url);
		return `banner-${timestamp}-${hash}`;
	}

	private estimateSize(data: unknown): number {
		try {
			return new Blob([JSON.stringify(data)]).size;
		} catch {
			return 0;
		}
	}

	private isExpired(entry: CacheEntry<unknown>): boolean {
		return Date.now() > entry.expiresAt;
	}

	private updateHitRate(): void {
		const total = this.stats.hits + this.stats.misses;
		this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
	}

	get<T>(key: string): T | null {
		const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

		if (!entry) {
			this.stats.misses++;
			this.updateHitRate();
			bannerLogger.logCacheOperation("miss", key);
			return null;
		}

		if (this.isExpired(entry)) {
			this.memoryCache.delete(key);
			this.stats.misses++;
			this.stats.size -= this.estimateSize(entry.data);
			this.updateHitRate();
			bannerLogger.logCacheOperation("miss", key, { reason: "expired" });
			return null;
		}

		this.stats.hits++;
		this.updateHitRate();
		bannerLogger.logCacheOperation("hit", key);
		return entry.data;
	}

	set<T>(key: string, data: T, ttlMs: number): void {
		const now = Date.now();
		const entry: CacheEntry<T> = {
			data,
			timestamp: now,
			expiresAt: now + ttlMs,
			key,
		};

		const size = this.estimateSize(data);
		if (this.stats.size + size > MAX_CACHE_SIZE_MB * BYTES_PER_MB) {
			this.evictExpired();
		}

		this.memoryCache.set(key, entry);
		this.stats.size += size;
		bannerLogger.logCacheOperation("set", key, { ttlMs, size });
	}

	async setImageCache(url: string, imageData: string, ttlHours = 24): Promise<void> {
		const key = this.generateCacheKey(url, ttlHours);
		const ttlMs = ttlHours * 60 * 60 * 1000;
		this.set(key, imageData, ttlMs);
	}

	async getImageCache(url: string, ttlHours = 24): Promise<string | null> {
		const key = this.generateCacheKey(url, ttlHours);
		return this.get<string>(key);
	}

	delete(key: string): boolean {
		const entry = this.memoryCache.get(key);
		if (entry) {
			this.stats.size -= this.estimateSize(entry.data);
		}
		const deleted = this.memoryCache.delete(key);
		if (deleted) {
			bannerLogger.logCacheOperation("delete", key);
		}
		return deleted;
	}

	evictExpired(): number {
		let evicted = 0;
		const now = Date.now();

		for (const [key, entry] of this.memoryCache.entries()) {
			if (now > entry.expiresAt) {
				this.memoryCache.delete(key);
				this.stats.size -= this.estimateSize(entry.data);
				evicted++;
				this.stats.evictions++;
			}
		}

		if (evicted > 0) {
			bannerLogger.logCacheOperation("evict", "expired", { count: evicted });
		}
		return evicted;
	}

	evictLRU(maxSize: number): number {
		let evicted = 0;
		const entries = Array.from(this.memoryCache.entries()).sort((a, b) => {
			const aTime = (a[1] as CacheEntry<unknown>).timestamp;
			const bTime = (b[1] as CacheEntry<unknown>).timestamp;
			return aTime - bTime;
		});

		let currentSize = this.stats.size;
		for (const [key, entry] of entries) {
			if (currentSize <= maxSize) break;
			const size = this.estimateSize(entry.data);
			this.memoryCache.delete(key);
			currentSize -= size;
			evicted++;
			this.stats.evictions++;
		}

		this.stats.size = currentSize;
		if (evicted > 0) {
			bannerLogger.logCacheOperation("evict", "lru", { count: evicted });
		}
		return evicted;
	}

	clear(): void {
		const count = this.memoryCache.size;
		this.memoryCache.clear();
		this.stats.size = 0;
		bannerLogger.logCacheOperation("clear", "all", { count });
	}

	cleanupOldImages(poolMaxAgeHours: number, maxImages: number, currentImages: { url: string; createdAt: number }[]): string[] {
		const cutoffTime = Date.now() - poolMaxAgeHours * 60 * 60 * 1000;
		const validImages = currentImages
			.filter((img) => img.createdAt > cutoffTime)
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, maxImages);

		const validUrls = validImages.map((img) => img.url);

		for (const [key] of this.memoryCache.entries()) {
			if (key.startsWith("banner-")) {
				const entry = this.memoryCache.get(key);
				if (entry && this.isExpired(entry)) {
					this.memoryCache.delete(key);
					this.stats.evictions++;
				}
			}
		}

		bannerLogger.info("Image pool cleanup completed", {
			beforeCount: currentImages.length,
			afterCount: validImages.length,
			maxAgeHours: poolMaxAgeHours,
			maxImages,
		});

		return validUrls;
	}

	getStats(): CacheStats {
		return { ...this.stats };
	}

	getCacheInfo(): { size: number; maxSize: number; entries: number; hitRate: string } {
		return {
			size: this.stats.size,
			maxSize: MAX_CACHE_SIZE_MB * BYTES_PER_MB,
			entries: this.memoryCache.size,
			hitRate: `${this.stats.hitRate.toFixed(2)}%`,
		};
	}

	resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			size: this.stats.size,
			hitRate: 0,
		};
	}
}

export const bannerCache = new BannerCache();
