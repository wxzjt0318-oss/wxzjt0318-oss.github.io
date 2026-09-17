/**
 * 音量控件辅助函数。
 * 音量数值与持久化（localStorage）已由上游运行时负责（setVolume / MUSIC_VOLUME_STORAGE_KEY），
 * 这里只保留滑杆的键盘交互与拖拽状态结构。
 */

export interface VolumeDragState {
	isVolumeDragging: boolean;
	isPointerDown: boolean;
	volumeBarRect: DOMRect | null;
	rafId: number | null;
}

export function createVolumeDragState(): VolumeDragState {
	return {
		isVolumeDragging: false,
		isPointerDown: false,
		volumeBarRect: null,
		rafId: null,
	};
}

/** 滑杆聚焦时的 Enter 键切换静音（Space 不触发，与 legacy 行为一致） */
export function handleVolumeKeyDown(
	event: KeyboardEvent,
	onToggleMute: () => void,
) {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		if (event.key === "Enter") {
			onToggleMute();
		}
	}
}
