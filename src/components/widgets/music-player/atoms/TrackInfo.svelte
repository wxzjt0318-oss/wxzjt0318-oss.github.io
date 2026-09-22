<script lang="ts">
import { formatTime } from "../hooks/useKeyboardShortcuts";
import type { Song } from "../types";

interface Props {
	song: Song;
	currentTime: number;
	duration: number;
	showTime?: boolean;
	size?: "mini" | "expanded";
}

const {
	song,
	currentTime,
	duration,
	showTime = false,
	size = "mini",
}: Props = $props();
</script>

{#if size === "mini"}
	<div class="flex-1 min-w-0">
		<div class="text-sm font-medium text-90 truncate">{song.title}</div>
		<div class="text-xs text-50 truncate">{song.artist}</div>
	</div>
{:else}
	<div class="flex-1 min-w-0">
		<div class="song-title text-lg font-bold text-90 truncate mb-1">
			{song.title}
		</div>
		<div class="song-artist text-sm text-50 truncate">{song.artist}</div>
		{#if showTime}
			<div class="text-xs text-30 mt-1">
				{formatTime(currentTime)} / {formatTime(duration)}
			</div>
		{/if}
	</div>
{/if}
