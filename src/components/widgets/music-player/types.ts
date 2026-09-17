import type { TrackDescriptor } from "@/types/musicConfig";

/**
 * 曲目描述直接复用上游音乐运行时的 TrackDescriptor：
 * 悬浮播放器与上游侧栏共享同一个 runtime 单例与数据结构，
 * Meting 拉取结果（readonly id/title/source/cover…）原样下发，无需二次转换。
 */
export type Song = TrackDescriptor;

/**
 * legacy 三档循环模式的兼容表示（0=不循环 1=单曲循环 2=列表循环）。
 * 由运行时的 PlaybackMode 派生（见 hooks/usePlaylist.ts），仅供旧 UI 组件使用。
 */
export type RepeatMode = 0 | 1 | 2;
