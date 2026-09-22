<script lang="ts">
/**
 * 进度控制（M3 波浪进度条方案，与上游侧栏 MusicSidebarClient 同款）：
 * - ProgressIndicator（linear + wavy）负责可视层，播放时振幅 1、暂停时归零；
 * - 叠加透明 <input type="range"> 负责拖拽交互，拖动中显示预览时间（dragTime），
 *   松手后回调 onSeek → runtime.seek()。
 * legacy 自绘的 ProgressBar（div 百分比宽度）已删除。
 */
import ProgressIndicator from "@components/atoms/feedback/ProgressIndicator.svelte";

import { formatTime } from "../hooks/useKeyboardShortcuts";

interface Props {
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	onSeek: (time: number) => void;
}

const { currentTime, duration, isPlaying, onSeek }: Props = $props();

let draggingSeek = $state(false);
let dragTime = $state<number | null>(null);

const currentEffectiveTime = $derived(
	draggingSeek && dragTime !== null ? dragTime : currentTime,
);
const progressMax = $derived(duration > 0 ? duration : 1);
const progressRatio = $derived(
	duration > 0 ? Math.min(Math.max(currentEffectiveTime / duration, 0), 1) : 0,
);
const progressDisabled = $derived(duration <= 0);
const progressLabel = $derived(
	`播放进度 ${formatTime(currentEffectiveTime)} / ${formatTime(duration)}`,
);

function onProgressPointerDown(): void {
	draggingSeek = true;
}

function onProgressInput(event: Event): void {
	const val = Number((event.currentTarget as HTMLInputElement).value);
	dragTime = Number.isFinite(val) ? Math.max(0, val) : null;
}

function onProgressChange(event: Event): void {
	const val = Number((event.currentTarget as HTMLInputElement).value);
	draggingSeek = false;
	dragTime = null;
	if (Number.isFinite(val)) {
		onSeek(Math.max(0, val));
	}
}

function onProgressPointerUp(event: PointerEvent): void {
	draggingSeek = false;
	const input = event.currentTarget as HTMLInputElement;
	const val = Number(input.value);
	dragTime = null;
	if (Number.isFinite(val)) {
		onSeek(Math.max(0, val));
	}
}
</script>

<div class="mp-progress">
	<div class="mp-progress__control">
		<ProgressIndicator
			variant="linear"
			wavy
			progress={progressRatio}
			amplitude={isPlaying ? 1 : 0}
			showStop={false}
			showThumb
			label={progressLabel}
			ariaHidden
			class="mp-progress__visual"
		/>
		<input
			type="range"
			min="0"
			max={progressMax}
			step="0.1"
			value={Math.min(currentEffectiveTime, progressMax)}
			disabled={progressDisabled}
			aria-label={progressLabel}
			onpointerdown={onProgressPointerDown}
			onpointerup={onProgressPointerUp}
			oninput={onProgressInput}
			onchange={onProgressChange}
		/>
	</div>
</div>

<style>
	/* 样式自上游 src/components/organisms/music/musicSidebarStyles.ts 移植，
	   类名加 mp- 前缀避免与上游 .music-player__progress-* 冲突 */
	.mp-progress {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.mp-progress__control {
		position: relative;
		width: 100%;
		height: 1.25rem;
		display: flex;
		align-items: center;
		touch-action: pan-y;
	}

	.mp-progress__control :global(.m3-progress) {
		position: relative;
		z-index: 0;
		width: 100%;
		max-width: none;
		pointer-events: none;
	}

	.mp-progress__control :global(.m3-progress--wavy) {
		height: 10px;
		overflow: visible;
	}

	.mp-progress__control input {
		appearance: none;
		-webkit-appearance: none;
		position: absolute;
		inset: -0.625rem 0;
		z-index: 2;
		width: 100%;
		height: calc(100% + 1.25rem);
		margin: 0;
		padding: 0;
		border: none;
		background: transparent !important;
		opacity: 0;
		cursor: pointer;
		accent-color: transparent;
	}

	.mp-progress__control input::-webkit-slider-runnable-track {
		appearance: none;
		-webkit-appearance: none;
		background: transparent !important;
		border: none;
		height: 100%;
	}

	.mp-progress__control input::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		opacity: 0;
		width: 1.25rem;
		height: 1.25rem;
		background: transparent !important;
		border: none;
		box-shadow: none;
	}

	.mp-progress__control input::-moz-range-track {
		background: transparent !important;
		border: none;
		height: 100%;
	}

	.mp-progress__control input::-moz-range-thumb {
		opacity: 0;
		width: 1.25rem;
		height: 1.25rem;
		background: transparent !important;
		border: none;
		box-shadow: none;
	}

	.mp-progress__control input:disabled {
		cursor: default;
	}

	.mp-progress__control input:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--shape-corner-s);
	}

	@media (pointer: coarse) {
		/* 触屏上收窄进度条占位高度，避免卡片上下留白过大 */
		.mp-progress__control {
			height: 2rem;
		}

		.mp-progress__control input {
			inset: 0;
		}
	}
</style>
