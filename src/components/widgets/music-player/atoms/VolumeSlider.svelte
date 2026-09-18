<script lang="ts">
	import type { Action } from "svelte/action";

	interface Props {
		volume: number;
		isVolumeDragging: boolean;
		volumeBarRef: Action<HTMLElement, undefined>;
		oninput: (event: Event) => void;
		onkeydown: (event: KeyboardEvent) => void;
		ariaLabel: string;
	}

	const {
		volume,
		isVolumeDragging,
		volumeBarRef,
		oninput,
		onkeydown,
		ariaLabel,
	}: Props = $props();

	const percent = $derived(Math.round(Math.max(0, Math.min(1, volume)) * 100));
</script>

<!--
	自绘轨道 + 透明原生 range 覆盖层（与侧栏 MusicSidebarClient 同一套做法）：
	原生控件自带鼠标点击 / 拖动、触摸与键盘（方向键）支持，不依赖 Pointer Capture，
	避免自定义指针逻辑在部分浏览器/嵌入视口下拖不动的问题。
-->
<div
	class="relative shrink-0 basis-[5.5rem] grow max-w-[7rem] min-w-[4.5rem] h-5 cursor-pointer"
	use:volumeBarRef
>
	<span
		class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full overflow-hidden bg-[var(--outline-variant)]"
		aria-hidden="true"
	>
		<span
			class="block h-full rounded-full bg-[var(--primary)] transition-all"
			class:duration-100={!isVolumeDragging}
			class:duration-0={isVolumeDragging}
			style={`width: ${percent}%`}
		></span>
	</span>
	<input
		type="range"
		min="0"
		max="1"
		step="0.01"
		value={volume}
		class="m3-volume-input absolute inset-0 w-full h-full m-0 p-0 appearance-none bg-transparent opacity-0 cursor-pointer disabled:cursor-default"
		aria-label={ariaLabel}
		{oninput}
		{onkeydown}
	/>
</div>

<style>
	.m3-volume-input {
		-webkit-appearance: none;
		touch-action: none;
	}

	.m3-volume-input::-webkit-slider-runnable-track {
		height: 100%;
		background: transparent;
		border: none;
	}

	.m3-volume-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 1.25rem;
		height: 1.25rem;
		background: transparent;
		border: none;
		box-shadow: none;
	}

	.m3-volume-input::-moz-range-track {
		height: 100%;
		background: transparent;
		border: none;
	}

	.m3-volume-input::-moz-range-thumb {
		width: 1.25rem;
		height: 1.25rem;
		background: transparent;
		border: none;
		box-shadow: none;
	}

	.m3-volume-input:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--shape-corner-s);
	}
</style>
