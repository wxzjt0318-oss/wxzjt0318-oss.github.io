<script lang="ts">
	import Icon from "@iconify/svelte";
	import { onDestroy, onMount } from "svelte";

	import type { MusicPlayerState } from "@/stores/musicPlayerStore";
	import { musicPlayerStore } from "@/stores/musicPlayerStore";

	let state = $state<MusicPlayerState>(musicPlayerStore.getState());
	let unsubscribe: (() => void) | undefined;

	function toggleControlCenter() {
		musicPlayerStore.toggleExpanded();
	}

	const currentSongTitle = $derived(state.currentSong?.title || "音乐控制中心");
	const ariaLabel = $derived(
		state.isExpanded
			? `收起音乐控制中心：${currentSongTitle}`
			: `打开音乐控制中心：${currentSongTitle}`
	);
	const statusIcon = $derived(
		state.isLoading
			? "svg-spinners:90-ring-with-bg"
			: "material-symbols:music-note-rounded"
	);

	onMount(() => {
		unsubscribe = musicPlayerStore.subscribe((nextState) => {
			state = nextState;
		});
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>

<button
	type="button"
	class:active={state.isExpanded}
	class:playing={state.isPlaying}
	class:loading={state.isLoading}
	class="music-fab btn-card"
	aria-label={ariaLabel}
	title={ariaLabel}
	onclick={toggleControlCenter}
>
	<span class="music-fab__icon" aria-hidden="true">
		<Icon icon={statusIcon} />
	</span>

	{#if state.isPlaying}
		<span class="music-fab__dot" aria-hidden="true"></span>
	{/if}
</button>

<style>
	.music-fab {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--fab-button-size, 3rem);
		height: var(--fab-button-size, 3rem);
		min-width: 0;
		min-height: 0;
		padding: 0.25rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 1rem !important;
		cursor: pointer;
		color: var(--primary);
		pointer-events: auto;
		transition:
			transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.3s ease,
			background 0.3s ease;
	}

	.music-fab:hover {
		box-shadow: var(--shadow-button);
	}

	.music-fab:active {
		transform: scale(0.94);
	}

	.music-fab.active {
		background: var(--btn-card-bg-active);
	}

	.music-fab__icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		line-height: 1;
	}

	.music-fab__dot {
		position: absolute;
		right: 0.38rem;
		bottom: 0.38rem;
		z-index: 2;
		width: 0.5rem;
		height: 0.5rem;
		background: #22c55e;
		border-radius: 50%;
		animation: pulse-dot 1.5s ease-in-out infinite;
	}

	.music-fab__dot::after {
		content: "";
		position: absolute;
		inset: -0.25rem;
		background: #22c55e;
		border-radius: 50%;
		opacity: 0;
		animation: pulse-ring 1.5s ease-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.15);
		}
	}

	@keyframes pulse-ring {
		0% {
			opacity: 0.6;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(2);
		}
	}

	:global(.dark) .music-fab {
		border-color: rgba(255, 255, 255, 0.15);
	}

	@media (max-width: 768px) {
		.music-fab {
			width: var(--fab-button-size, 2.75rem);
			height: var(--fab-button-size, 2.75rem);
		}

		.music-fab__icon {
			font-size: 1.25rem;
		}

		.music-fab__dot {
			width: 0.4rem;
			height: 0.4rem;
			right: 0.3rem;
			bottom: 0.3rem;
		}
	}
</style>
