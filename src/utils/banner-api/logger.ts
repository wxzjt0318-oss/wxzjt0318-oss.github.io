import type { LogEntry, LogLevel } from "./types";

const LOG_MODULE = "BannerApi";

const LOG_LEVELS: Record<LogLevel, number> = {
	INFO: 0,
	WARN: 1,
	ERROR: 2,
};

class BannerLogger {
	private logs: LogEntry[] = [];
	private maxLogs = 30 * 24 * 60;
	private currentDate = this.getDateString(new Date());

	constructor() {
		if (typeof window === "undefined") {
			this.startDailyRotation();
		}
	}

	private getDateString(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	private shouldRotate(): boolean {
		const today = this.getDateString(new Date());
		if (today !== this.currentDate) {
			this.currentDate = today;
			return true;
		}
		return false;
	}

	private startDailyRotation(): void {
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		const msUntilMidnight = tomorrow.getTime() - now.getTime();

		setTimeout(() => {
			this.rotate();
			this.startDailyRotation();
		}, msUntilMidnight);
	}

	private rotate(): void {
		const today = this.getDateString(new Date());
		this.logs = this.logs.filter((log) => log.timestamp.startsWith(today));
	}

	private createLogEntry(
		level: LogLevel,
		message: string,
		details?: Record<string, unknown>,
		responseTimeMs?: number,
	): LogEntry {
		return {
			timestamp: new Date().toISOString(),
			level,
			module: LOG_MODULE,
			message,
			details,
			responseTimeMs,
		};
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS.INFO;
	}

	private log(level: LogLevel, message: string, details?: Record<string, unknown>, responseTimeMs?: number): void {
		if (!this.shouldLog(level)) {
			return;
		}

		if (this.shouldRotate()) {
			this.rotate();
		}

		const entry = this.createLogEntry(level, message, details, responseTimeMs);
		this.logs.push(entry);

		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		const consoleMsg = `[${LOG_MODULE}] ${message}`;
		switch (level) {
			case "INFO":
				console.log(consoleMsg, details || "");
				break;
			case "WARN":
				console.warn(consoleMsg, details || "");
				break;
			case "ERROR":
				console.error(consoleMsg, details || "");
				break;
		}
	}

	info(message: string, details?: Record<string, unknown>): void {
		this.log("INFO", message, details);
	}

	warn(message: string, details?: Record<string, unknown>): void {
		this.log("WARN", message, details);
	}

	error(message: string, details?: Record<string, unknown>): void {
		this.log("ERROR", message, details);
	}

	logApiSwitch(
		fromApi: string,
		toApi: string,
		reason: string,
		metrics?: { responseTimeMs?: number; errorCode?: string },
	): void {
		this.info("API switched", {
			fromApi,
			toApi,
			reason,
			...metrics,
		});
	}

	logApiRequest(
		endpoint: string,
		role: "primary" | "fallback",
		success: boolean,
		responseTimeMs: number,
		error?: string,
	): void {
		const level: LogLevel = success ? "INFO" : "ERROR";
		this.log(level, `API request ${success ? "succeeded" : "failed"}`, {
			endpoint,
			role,
			success,
			responseTimeMs,
			error,
		}, responseTimeMs);
	}

	logCacheOperation(operation: "hit" | "miss" | "evict" | "clear" | "set" | "delete", key: string, details?: Record<string, unknown>): void {
		this.info(`Cache ${operation}`, { key, ...details });
	}

	logWeightedRandom(selectedUrl: string, weight: number, allWeights: number[], responseTimeMs?: number): void {
		this.info("Weighted random selection", {
			selectedUrl,
			weight,
			allWeights,
			weightDeviation: this.calculateWeightDeviation(allWeights),
			responseTimeMs,
		});
	}

	private calculateWeightDeviation(weights: number[]): number {
		if (weights.length === 0) return 0;
		const sum = weights.reduce((a, b) => a + b, 0);
		const expected = sum / weights.length;
		const maxDeviation = Math.max(...weights.map((w) => Math.abs(w - expected)));
		return (maxDeviation / expected) * 100;
	}

	getLogs(level?: LogLevel, limit = 100): LogEntry[] {
		let filtered = this.logs;
		if (level) {
			filtered = filtered.filter((log) => log.level === level);
		}
		return filtered.slice(-limit);
	}

	getLogsByDate(date: string): LogEntry[] {
		return this.logs.filter((log) => log.timestamp.startsWith(date));
	}

	exportLogs(format: "json" | "text" = "json"): string {
		if (format === "json") {
			return JSON.stringify(this.logs, null, 2);
		}
		return this.logs
			.map(
				(log) =>
					`${log.timestamp} [${log.level}] [${log.module}] ${log.message}${log.details ? ` ${JSON.stringify(log.details)}` : ""}`,
			)
			.join("\n");
	}

	clearLogs(): void {
		this.logs = [];
		this.info("Logs cleared");
	}

	getStats(): { total: number; byLevel: Record<LogLevel, number> } {
		const byLevel: Record<LogLevel, number> = { INFO: 0, WARN: 0, ERROR: 0 };
		for (const log of this.logs) {
			byLevel[log.level]++;
		}
		return { total: this.logs.length, byLevel };
	}
}

export const bannerLogger = new BannerLogger();
