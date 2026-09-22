<script lang="ts">
import Icon from "@iconify/svelte";

import CoverImage from "../atoms/CoverImage.svelte";
import TrackInfo from "../atoms/TrackInfo.svelte";
import type { Song } from "../types";

interface Props {
	song: Song;
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	isLoading: boolean;
	size?: "mini" | "expanded";
	showControls?: boolean;
	showPlaylist?: boolean;
	onCoverClick?: () => void;
	onInfoClick?: () => void;
	onHideClick?: () => void;
	onExpandClick?: () => void;
	onPlaylistClick?: () => void;
}

const {
	song,
	currentTime,
	duration,
	isPlaying,
	isLoading,
	size = "mini",
	showControls = false,
	showPlaylist = false,
	onCoverClick,
	onInfoClick,
	onHideClick,
	onExpandClick,
	onPlaylistClick,
}: Props = $props();

// legacy 的 btn-plain 主题类在上游不存在，改用等价的表面容器 hover 变量
const iconButtonClass =
	"w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]";
</script>

<div
	class={size === "mini"
		? "flex items-center gap-3 mb-0"
		: "flex items-center gap-4 mb-4"}
>
	{#if size === "mini"}
		<CoverImage
			cover={song.cover ?? ""}
			{isPlaying}
			{isLoading}
			size="mini"
			interactive
			onclick={onCoverClick}
		/>
		<div
			class="flex-1 min-w-0 cursor-pointer"
			onclick={onInfoClick}
			onkeydown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onInfoClick?.();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="展开播放器"
		>
			<TrackInfo {song} {currentTime} {duration} size="mini" />
		</div>
		<div class="flex items-center gap-1">
			<button
				class={iconButtonClass}
				onclick={(e) => {
					e.stopPropagation();
					onHideClick?.();
				}}
				title="隐藏播放器"
			>
				<Icon icon="material-symbols:visibility-off" class="text-lg" />
			</button>
			<button
				class={iconButtonClass}
				onclick={(e) => {
					e.stopPropagation();
					onExpandClick?.();
				}}
			>
				<Icon icon="material-symbols:expand-less" class="text-lg" />
			</button>
		</div>
	{:else}
		<CoverImage
			cover={song.cover ?? ""}
			{isPlaying}
			{isLoading}
			size="expanded"
		/>
		<TrackInfo {song} {currentTime} {duration} showTime size="expanded" />
		{#if showControls}
			<div class="flex items-center gap-1">
				<button
					class={iconButtonClass}
					onclick={onHideClick}
					title="隐藏播放器"
				>
					<Icon
						icon="material-symbols:visibility-off"
						class="text-lg"
					/>
				</button>
				<button
					class={iconButtonClass}
					class:text-[var(--primary)]={showPlaylist}
					onclick={onPlaylistClick}
					title="播放列表"
				>
					<Icon icon="material-symbols:queue-music" class="text-lg" />
				</button>
			</div>
		{/if}
	{/if}
</div>
