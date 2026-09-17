import { musicConfig, resolveMusicOptions } from "@/config/musicConfig";
import type { MusicRuntime, MusicSnapshot } from "@/types/musicConfig";
import { getMusicRuntime, MUSIC_VOLUME_STORAGE_KEY } from "@utils/music";

export type { MusicRuntime, MusicSnapshot };

/**
 * legacy 的 useAudioPlayer 自管理 <audio> 元素与 Meting 拉取；
 * 迁移后改为桥接上游音乐运行时（src/utils/music/music-runtime.ts）：
 * - getMusicRuntime(options) 返回跨组件共享的单例（与上游侧栏播放器共用）；
 * - 音量持久化、Meting 拉取、播放/ seek / 模式切换全部由运行时负责。
 */
export const musicOptions = resolveMusicOptions(musicConfig);

/** legacy 播放器的音量持久化键（fork-snapshot 4be61c3 用户的既有设置） */
export const LEGACY_VOLUME_STORAGE_KEY = "music-player-volume";

/**
 * 保留 legacy 用户的音量设置：上游运行时键尚未写入而 legacy 键存在时迁移一次，
 * 之后统一由运行时按 MUSIC_VOLUME_STORAGE_KEY 读写。
 * legacy 未持久化播放模式，交互兼容由 usePlaylist.ts 的 PlaybackMode 映射保证。
 */
function migrateLegacyVolumeSetting(): void {
	if (typeof window === "undefined") return;
	try {
		const storage = window.localStorage;
		if (storage.getItem(MUSIC_VOLUME_STORAGE_KEY) != null) return;
		const legacy = storage.getItem(LEGACY_VOLUME_STORAGE_KEY);
		if (legacy != null && Number.isFinite(Number(legacy))) {
			storage.setItem(MUSIC_VOLUME_STORAGE_KEY, legacy);
		}
	} catch {
		// localStorage 不可用时静默跳过，播放功能不受影响
	}
}
migrateLegacyVolumeSetting();

export interface MusicPlayerController {
	runtime: MusicRuntime;
	subscribe(listener: (snapshot: MusicSnapshot) => void): () => void;
}

/** 音乐功能禁用（musicConfig.enable=false 或 Meting 未配置）时返回 null，调用方不渲染任何 UI。 */
export function createMusicPlayerController(): MusicPlayerController | null {
	if (!musicOptions) {
		return null;
	}
	const runtime = getMusicRuntime(musicOptions);
	return {
		runtime,
		subscribe: (listener) => runtime.subscribe(listener),
	};
}
