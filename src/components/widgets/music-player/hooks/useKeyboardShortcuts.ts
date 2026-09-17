/**
 * 播放器 UI 通用工具函数。
 * legacy 的 registerInteractionHandler（自动播放解锁）已由上游运行时的
 * autoplay-blocked 错误状态接管，不再需要。
 */

export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return "0:00";
	}
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getAssetPath(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	if (path.startsWith("/")) {
		return path;
	}
	return `/${path}`;
}
