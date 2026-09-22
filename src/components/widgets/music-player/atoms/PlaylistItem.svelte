<script lang="ts">
import Icon from "@iconify/svelte";
import { getAssetPath } from "../hooks/useKeyboardShortcuts";
import type { Song } from "../types";

interface Props {
	song: Song;
	index: number;
	isCurrent: boolean;
	isPlaying: boolean;
	onclick: () => void;
}

const { song, index, isCurrent, isPlaying, onclick }: Props = $props();
</script>

<div
	class="playlist-item flex items-center gap-3 p-3 hover:bg-[var(--btn-plain-bg-hover)] cursor-pointer transition-colors"
	class:bg-[var(--secondary-container)]={isCurrent}
	class:text-[var(--primary)]={isCurrent}
	{onclick}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onclick();
		}
	}}
	role="button"
	tabindex="0"
	aria-label="播放 {song.title}{song.artist ? ` - ${song.artist}` : ''}"
>
	<div class="w-6 h-6 flex items-center justify-center">
		{#if isCurrent && isPlaying}
			<Icon
				icon="material-symbols:graphic-eq"
				class="text-[var(--primary)] animate-pulse"
			/>
		{:else if isCurrent}
			<Icon icon="material-symbols:pause" class="text-[var(--primary)]" />
		{:else}
			<span class="text-sm text-50">{index + 1}</span>
		{/if}
	</div>
	<div
		class="w-10 h-10 rounded-lg overflow-hidden bg-[var(--btn-regular-bg)] flex-shrink-0"
	>
		{#if song.cover}
			<img
				src={getAssetPath(song.cover)}
				alt={song.title}
				loading="lazy"
				class="w-full h-full object-cover"
			/>
		{:else}
			<Icon
				icon="material-symbols:music-note"
				class="w-full h-full p-2 text-[var(--on-surface-variant)]"
			/>
		{/if}
	</div>
	<div class="flex-1 min-w-0">
		<div
			class="font-medium truncate"
			class:text-[var(--primary)]={isCurrent}
			class:text-90={!isCurrent}
		>
			{song.title}
		</div>
		<div
			class="text-sm text-50 truncate"
			class:text-[var(--primary)]={isCurrent}
		>
			{song.artist}
		</div>
	</div>
</div>
