<script lang="ts">
import Icon from "@iconify/svelte";

interface Props {
	isPlaying: boolean;
	isLoading: boolean;
	onclick: () => void;
}

const { isPlaying, isLoading, onclick }: Props = $props();
</script>

<button
	class="play-button"
	class:opacity-50={isLoading}
	disabled={isLoading}
	{onclick}
>
	{#if isLoading}
		<Icon icon="material-symbols:progress-activity" class="play-button__spin" />
	{:else if isPlaying}
		<Icon icon="material-symbols:pause" />
	{:else}
		<Icon icon="material-symbols:play-arrow" />
	{/if}
</button>

<style>
	/* 播放键是播放器的主操作：实心 primary 容器 + 更大直径，
	   与侧栏播放器的 filled 播放键保持同一视觉层级（hierarchy）。 */
	.play-button {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 3.5rem;
		height: 3.5rem;
		padding: 0;
		border: none;
		border-radius: var(--shape-corner-full);
		background: var(--primary);
		color: var(--on-primary);
		cursor: pointer;
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-short) var(--m3e-easing-standard);
	}

	.play-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 88%, var(--on-primary));
	}

	.play-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.play-button:disabled {
		cursor: default;
	}

	.play-button > :global(svg) {
		width: 1.75rem;
		height: 1.75rem;
	}

	/* 加载态：图标在组件内部渲染，样式需走 :global 才能命中 */
	.play-button :global(.play-button__spin) {
		animation: play-button-spin 1.1s linear infinite;
	}

	@keyframes play-button-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.play-button :global(.play-button__spin) {
			animation: none;
		}
	}

	@media (max-width: 520px) {
		.play-button {
			width: 3.25rem;
			height: 3.25rem;
		}

		.play-button > :global(svg) {
			width: 1.625rem;
			height: 1.625rem;
		}
	}
</style>
