import type {
	ApiEndpoint,
	ApiHealthStatus,
	ApiRequestMetrics,
	ApiRole,
	BannerConfig,
	BannerDevice,
	ImageFormat,
} from "./types";
import { bannerLogger } from "./logger";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_SWITCH_COOLDOWN_MS = 300;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_INTERVAL_MS = 5 * 60 * 1000;

class BannerApiManager {
	private primaryHealth: ApiHealthStatus = {
		endpoint: "",
		isHealthy: true,
		consecutiveFailures: 0,
		lastSuccessAt: 0,
		lastFailureAt: 0,
		avgResponseTime: 0,
	};

	private fallbackHealth: ApiHealthStatus = {
		endpoint: "",
		isHealthy: true,
		consecutiveFailures: 0,
		lastSuccessAt: 0,
		lastFailureAt: 0,
		avgResponseTime: 0,
	};

	private primaryMetrics: ApiRequestMetrics = {
		endpoint: "",
		successCount: 0,
		failureCount: 0,
		totalResponseTime: 0,
		avgResponseTime: 0,
		lastRequestAt: 0,
	};

	private fallbackMetrics: ApiRequestMetrics = {
		endpoint: "",
		successCount: 0,
		failureCount: 0,
		totalResponseTime: 0,
		avgResponseTime: 0,
		lastRequestAt: 0,
	};

	private config: BannerConfig;
	private currentApi: ApiRole = "primary";
	private switchCooldownUntil = 0;

	constructor(config?: Partial<BannerConfig>) {
		this.config = {
			primaryApi: "",
			fallbackApi: "",
			mobilePrimaryApi: "",
			mobileFallbackApi: "",
			timeoutMs: config?.timeoutMs || DEFAULT_TIMEOUT_MS,
			retryAttempts: config?.retryAttempts || DEFAULT_RETRY_ATTEMPTS,
			retryIntervalMs: config?.retryIntervalMs || DEFAULT_RETRY_INTERVAL_MS,
			cacheTtlHours: config?.cacheTtlHours || 24,
			maxPoolSize: config?.maxPoolSize || 18,
			poolCleanupHours: config?.poolCleanupHours || 72,
			scheduledUpdateHour: config?.scheduledUpdateHour || 2,
			supportedFormats: config?.supportedFormats || ["jpg", "jpeg", "png", "webp"],
			failureThreshold: config?.failureThreshold || DEFAULT_FAILURE_THRESHOLD,
			preloadThresholdSeconds: config?.preloadThresholdSeconds || 10,
			switchCooldownMs: config?.switchCooldownMs || DEFAULT_SWITCH_COOLDOWN_MS,
			...config,
		};
	}

	updateConfig(newConfig: Partial<BannerConfig>): void {
		this.config = { ...this.config, ...newConfig };
		bannerLogger.info("API manager config updated", newConfig);
	}

	getEndpoints(device: BannerDevice): { primary: ApiEndpoint; fallback: ApiEndpoint | null } {
		const primaryUrl = device === "desktop" ? this.config.primaryApi : this.config.mobilePrimaryApi;
		const fallbackUrl = device === "desktop" ? this.config.fallbackApi : this.config.mobileFallbackApi;

		if (!primaryUrl) {
			throw new Error(`Missing primary API URL for ${device}`);
		}

		const primary: ApiEndpoint = { url: primaryUrl, role: "primary", name: `${device}-primary` };
		const fallback: ApiEndpoint | null = fallbackUrl
			? { url: fallbackUrl, role: "fallback", name: `${device}-fallback` }
			: null;

		this.primaryHealth.endpoint = primaryUrl;
		if (fallback) {
			this.fallbackHealth.endpoint = fallbackUrl!;
		}

		return { primary, fallback };
	}

	async requestWithFallback<T>(
		device: BannerDevice,
		requestFn: (endpoint: ApiEndpoint) => Promise<T>,
	): Promise<{ data: T; usedFallback: boolean }> {
		const { primary, fallback } = this.getEndpoints(device);
		const startTime = performance.now();

		if (this.isInCooldown()) {
			bannerLogger.warn("API switch in cooldown, using current API", {
				currentApi: this.currentApi,
				cooldownRemainingMs: this.switchCooldownUntil - Date.now(),
			});
		}

		try {
			const data = await this.executeWithTimeout(primary, requestFn);
			this.recordSuccess(primary, performance.now() - startTime);
			return { data, usedFallback: false };
		} catch (primaryError) {
			bannerLogger.error("Primary API request failed", {
				endpoint: primary.url,
				error: primaryError instanceof Error ? primaryError.message : String(primaryError),
			});

			this.recordFailure(primary, performance.now() - startTime);

			if (!fallback) {
				throw primaryError;
			}

			if (this.shouldSwitchToFallback()) {
				this.switchToFallback(fallback.url, primary.url, {
					error: primaryError instanceof Error ? primaryError.message : String(primaryError),
				});
			}

			try {
				const fallbackData = await this.executeWithTimeout(fallback, requestFn);
				this.recordSuccess(fallback, performance.now() - startTime);
				return { data: fallbackData, usedFallback: true };
			} catch (fallbackError) {
				this.recordFailure(fallback, performance.now() - startTime);
				bannerLogger.error("Fallback API request also failed", {
					fallbackEndpoint: fallback.url,
					error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
				});
				throw fallbackError;
			}
		}
	}

	private async executeWithTimeout<T>(
		endpoint: ApiEndpoint,
		requestFn: (endpoint: ApiEndpoint) => Promise<T>,
	): Promise<T> {
		const timeoutMs = this.config.timeoutMs;

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Request timeout after ${timeoutMs}ms`));
			}, timeoutMs);

			const startTime = performance.now();

			requestFn(endpoint)
				.then((data) => {
					clearTimeout(timeoutId);
					const responseTime = performance.now() - startTime;
					bannerLogger.logApiRequest(endpoint.url, endpoint.role, true, responseTime);
					resolve(data);
				})
				.catch((error) => {
					clearTimeout(timeoutId);
					const responseTime = performance.now() - startTime;
					bannerLogger.logApiRequest(endpoint.url, endpoint.role, false, responseTime, error.message);
					reject(error);
				});
		});
	}

	private recordSuccess(endpoint: ApiEndpoint, responseTimeMs: number): void {
		if (endpoint.role === "primary") {
			this.primaryHealth.consecutiveFailures = 0;
			this.primaryHealth.lastSuccessAt = Date.now();
			this.primaryHealth.isHealthy = true;
			this.primaryMetrics.successCount++;
			this.updateAvgResponseTime(this.primaryMetrics, responseTimeMs);

			if (this.currentApi === "fallback" && this.primaryHealth.isHealthy) {
				this.checkPrimaryRecovery();
			}
		} else {
			this.fallbackHealth.consecutiveFailures = 0;
			this.fallbackHealth.lastSuccessAt = Date.now();
			this.fallbackHealth.isHealthy = true;
			this.fallbackMetrics.successCount++;
			this.updateAvgResponseTime(this.fallbackMetrics, responseTimeMs);
		}
	}

	private recordFailure(endpoint: ApiEndpoint, _responseTimeMs: number): void {
		if (endpoint.role === "primary") {
			this.primaryHealth.consecutiveFailures++;
			this.primaryHealth.lastFailureAt = Date.now();
			this.primaryMetrics.failureCount++;

			if (this.primaryHealth.consecutiveFailures >= this.config.failureThreshold) {
				this.primaryHealth.isHealthy = false;
				bannerLogger.warn("Primary API consecutive failures threshold reached", {
					failures: this.primaryHealth.consecutiveFailures,
					threshold: this.config.failureThreshold,
				});
			}
		} else {
			this.fallbackHealth.consecutiveFailures++;
			this.fallbackHealth.lastFailureAt = Date.now();
			this.fallbackMetrics.failureCount++;

			if (this.fallbackHealth.consecutiveFailures >= this.config.failureThreshold) {
				this.fallbackHealth.isHealthy = false;
			}
		}
	}

	private updateAvgResponseTime(metrics: ApiRequestMetrics, responseTimeMs: number): void {
		metrics.totalResponseTime += responseTimeMs;
		metrics.avgResponseTime = metrics.totalResponseTime / (metrics.successCount + metrics.failureCount);
		metrics.lastRequestAt = Date.now();
	}

	private isInCooldown(): boolean {
		return Date.now() < this.switchCooldownUntil;
	}

	private shouldSwitchToFallback(): boolean {
		if (this.isInCooldown()) {
			return false;
		}
		if (this.primaryHealth.consecutiveFailures >= this.config.failureThreshold) {
			return true;
		}
		return false;
	}

	private switchToFallback(fallbackUrl: string, primaryUrl: string, _reason: Record<string, unknown>): void {
		this.currentApi = "fallback";
		this.switchCooldownUntil = Date.now() + this.config.switchCooldownMs;

		bannerLogger.logApiSwitch(primaryUrl, fallbackUrl, "Primary API failed threshold reached", {
			errorCode: "threshold_exceeded",
		});
	}

	private checkPrimaryRecovery(): void {
		const recoveryTimeMs = this.config.retryIntervalMs;
		const timeSinceLastFailure = Date.now() - this.primaryHealth.lastFailureAt;

		if (timeSinceLastFailure > recoveryTimeMs && this.primaryHealth.isHealthy) {
			if (this.currentApi === "fallback") {
				bannerLogger.logApiSwitch(
					this.config.fallbackApi || "",
					this.config.primaryApi,
					"Primary API recovered",
				);
				this.currentApi = "primary";
			}
		}
	}

	getCurrentApi(): ApiRole {
		return this.currentApi;
	}

	getHealthStatus(_device: BannerDevice): { primary: ApiHealthStatus; fallback: ApiHealthStatus } {
		return {
			primary: { ...this.primaryHealth },
			fallback: { ...this.fallbackHealth },
		};
	}

	getMetrics(): { primary: ApiRequestMetrics; fallback: ApiRequestMetrics } {
		return {
			primary: { ...this.primaryMetrics },
			fallback: { ...this.fallbackMetrics },
		};
	}

	isPrimaryHealthy(): boolean {
		return this.primaryHealth.isHealthy;
	}

	isFallbackHealthy(): boolean {
		return this.fallbackHealth.isHealthy;
	}

	resetHealthStatus(): void {
		this.primaryHealth.consecutiveFailures = 0;
		this.primaryHealth.isHealthy = true;
		this.fallbackHealth.consecutiveFailures = 0;
		this.fallbackHealth.isHealthy = true;
		bannerLogger.info("API health status reset");
	}

	validateImageUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			const ext = parsed.pathname.split(".").pop()?.toLowerCase() as ImageFormat | undefined;
			return ext ? this.config.supportedFormats.includes(ext) : false;
		} catch {
			return false;
		}
	}

	validateResponseFormat(data: unknown): boolean {
		if (Array.isArray(data)) {
			return data.every((item) => typeof item === "string" && this.validateImageUrl(item));
		}
		if (typeof data === "object" && data !== null) {
			const values = Object.values(data).flat();
			return Array.isArray(values) && values.every((item) => typeof item === "string");
		}
		return false;
	}
}

export const bannerApiManager = new BannerApiManager();
