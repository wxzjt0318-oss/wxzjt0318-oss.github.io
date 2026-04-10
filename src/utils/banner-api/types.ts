export type ImageFormat = "jpg" | "jpeg" | "png" | "webp";

export type ApiRole = "primary" | "fallback";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type BannerDevice = "desktop" | "mobile";

export interface BannerImage {
	url: string;
	id: string;
	format: ImageFormat;
	weight: number;
	createdAt: number;
	lastShownAt?: number;
	shownCount: number;
}

export interface BannerImagePool {
	images: BannerImage[];
	updatedAt: number;
	device: BannerDevice;
}

export interface ApiEndpoint {
	url: string;
	role: ApiRole;
	name: string;
}

export interface ApiHealthStatus {
	endpoint: string;
	isHealthy: boolean;
 consecutiveFailures: number;
	lastSuccessAt: number;
	lastFailureAt: number;
	avgResponseTime: number;
}

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
	key: string;
}

export interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
	size: number;
	hitRate: number;
}

export interface ApiRequestMetrics {
	endpoint: string;
	successCount: number;
	failureCount: number;
	totalResponseTime: number;
	avgResponseTime: number;
	lastRequestAt: number;
}

export interface BannerConfig {
	primaryApi: string;
	fallbackApi?: string;
	mobilePrimaryApi?: string;
	mobileFallbackApi?: string;
	timeoutMs: number;
	retryAttempts: number;
	retryIntervalMs: number;
	cacheTtlHours: number;
	maxPoolSize: number;
	poolCleanupHours: number;
	scheduledUpdateHour: number;
	supportedFormats: ImageFormat[];
	failureThreshold: number;
	preloadThresholdSeconds: number;
	switchCooldownMs: number;
}

export interface BannerUpdateResult {
	success: boolean;
	imagesAdded: number;
	imagesRemoved: number;
	error?: string;
	timestamp: number;
}

export interface WeightedRandomResult {
	image: BannerImage;
	weight: number;
	randomValue: number;
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	module: string;
	message: string;
	details?: Record<string, unknown>;
	responseTimeMs?: number;
}

export interface BannerState {
	currentApi: ApiRole;
	lastSwitchAt: number;
	consecutiveFailures: number;
	primaryHealthy: boolean;
	fallbackHealthy: boolean;
	poolDesktop: BannerImagePool;
	poolMobile: BannerImagePool;
}

export interface DisplayStats {
	imageId: string;
	url: string;
	shownCount: number;
	lastShownAt: number;
	displayPercentage: number;
}

export interface DailyReport {
	date: string;
	totalDisplays: number;
	imageStats: DisplayStats[];
	topPerformingImage?: string;
	lowestPerformingImage?: string;
}
