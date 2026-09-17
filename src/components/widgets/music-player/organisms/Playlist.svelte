<script lang="ts">
	import Icon from "@iconify/svelte";
	import { slide } from "svelte/transition";

	import PlaylistItem from "../atoms/PlaylistItem.svelte";
	import type { Song } from "../types";

	interface Props {
		playlist: readonly Song[];
		currentIndex: number;
		isPlaying: boolean;
		show: boolean;
		onClose: () => void;
		onPlaySong: (index: number) => void;
	}

	const {
		playlist,
		currentIndex,
		isPlaying,
		show,
		onClose,
		onPlaySong,
	}: Props = $props();
</script>

{#if show}
	<div
		class="playlist-panel bg-[var(--float-panel-bg)] fixed bottom-70 right-4 w-80 max-h-96 overflow-hidden z-50"
		transition:slide={{ duration: 300, axis: "y" }}
	>
		<div
			class="playlist-header flex items-center justify-between p-4 border-b border-[var(--line-divider)]"
		>
			<h3 class="text-lg font-semibold text-90">
				播放列表
			</h3>
			<button
				class="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]"
				onclick={onClose}
			>
				<Icon icon="material-symbols:close" class="text-lg" />
			</button>
		</div>
		<div class="playlist-content overflow-y-auto max-h-80 hide-scrollbar">
			{#each playlist as song, index}
				<PlaylistItem
					{song}
					{index}
					isCurrent={index === currentIndex}
					{isPlaying}
					onclick={() => onPlaySong(index)}
				/>
			{/each}
		</div>
	</div>
{/if}

<style>
	@media (max-width: 768px) {
		.playlist-panel {
			width: 280px !important;
			max-width: 280px !important;
			right: 0.5rem !important;
		}
	}

	@media (max-width: 480px) {
		.playlist-panel {
			width: 260px !important;
			max-width: 260px !important;
			right: 0.5rem !important;
		}
	}
</style>
