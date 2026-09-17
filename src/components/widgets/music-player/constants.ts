/**
 * legacy 播放器常量。
 * 歌单来源（Meting API / 歌单 ID / 音量持久化）已全部交给上游音乐运行时
 * （src/config/musicConfig.ts + src/utils/music/），这里只保留 UI 层需要的常量。
 */

/** 运行时快照尚未就绪时的兜底音量（实际取值优先 musicConfig.defaultVolume） */
export const DEFAULT_VOLUME = 0.7;

/** 错误提示展示时长（毫秒） */
export const ERROR_DISPLAY_DURATION = 3000;

/** 快照未就绪时的占位曲目，避免子组件做空值分支 */
export const PLACEHOLDER_SONG: import("./types").Song = {
	id: "",
	title: "尚未加载",
	artist: "",
	cover: "/favicon/favicon.ico",
	source: "",
	duration: 0,
};
