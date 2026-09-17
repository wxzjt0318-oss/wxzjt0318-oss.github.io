import type { MusicSnapshot, PlaybackMode } from "@/types/musicConfig";

import type { RepeatMode } from "../types";

/**
 * legacy 的歌单状态（Meting 拉取 / shuffle / repeat 计算）已由上游运行时接管。
 * 这里只保留 UI 层的模式映射与循环切换辅助函数。
 */

/** 模式循环顺序：列表循环 → 单曲循环 → 随机 */
export const PLAYBACK_MODE_CYCLE: PlaybackMode[] = [
	"sequence",
	"repeat-one",
	"shuffle",
];

export function nextPlaybackMode(current: PlaybackMode): PlaybackMode {
	const index = PLAYBACK_MODE_CYCLE.indexOf(current);
	return PLAYBACK_MODE_CYCLE[(index + 1) % PLAYBACK_MODE_CYCLE.length] ?? "sequence";
}

export function isShuffleMode(mode: PlaybackMode): boolean {
	return mode === "shuffle";
}

/** 随机按钮的高亮与单曲循环按钮的高亮互相独立（legacy 双按钮语义） */
export function repeatLevel(mode: PlaybackMode): RepeatMode {
	return mode === "repeat-one" ? 1 : 0;
}

export function canSkip(snapshot: MusicSnapshot | null): boolean {
	return (snapshot?.playlist.length ?? 0) > 1;
}
