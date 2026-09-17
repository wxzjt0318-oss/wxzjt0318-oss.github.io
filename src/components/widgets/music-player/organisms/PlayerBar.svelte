<script lang="ts">
	import Icon from "@iconify/svelte";

	import PlayerControls from "../molecules/PlayerControls.svelte";
	import ProgressControl from "../molecules/ProgressControl.svelte";
	import TrackDisplay from "../molecules/TrackDisplay.svelte";
	import VolumeControl from "../molecules/VolumeControl.svelte";
	import type { Song, RepeatMode } from "../types";

	interface Props {
		song: Song;
		currentTime: number;
		duration: number;
		isPlaying: boolean;
		isLoading: boolean;
		isShuffled: boolean;
		isRepeating: RepeatMode;
		showPlaylist: boolean;
		canSkip: boolean;
		volume: number;
		isMuted: boolean;
		isVolumeDragging: boolean;
		isHidden: boolean;
		volumeBarRef: (node: HTMLElement) => void;
		onPlayClick: () => void;
		onPrevClick: () => void;
		onNextClick: () => void;
		onShuffleClick: () => void;
		onRepeatClick: () => void;
		onProgressSeek: (time: number) => void;
		onVolumeButtonClick: () => void;
		onSliderPointerDown: (event: PointerEvent) => void;
		onSliderKeyDown: (event: KeyboardEvent) => void;
		onHideClick: () => void;
		onPlaylistClick: () => void;
		onCollapseClick: () => void;
	}

	const {
		song,
		currentTime,
		duration,
		isPlaying,
		isLoading,
		isShuffled,
		isRepeating,
		showPlaylist,
		canSkip,
		volume,
		isMuted,
		isVolumeDragging,
		isHidden,
		volumeBarRef,
		onPlayClick,
		onPrevClick,
		onNextClick,
		onShuffleClick,
		onRepeatClick,
		onProgressSeek,
		onVolumeButtonClick,
		onSliderPointerDown,
		onSliderKeyDown,
		onHideClick,
		onPlaylistClick,
		onCollapseClick,
	}: Props = $props();
</script>

<div
	class="expanded-player bg-[var(--card-bg)] shadow-xl rounded-2xl p-4 transition-all duration-500 ease-in-out absolute bottom-0 right-0 w-80"
	class:opacity-0={isHidden}
	class:scale-95={isHidden}
	class:pointer-events-none={isHidden}
>
	<TrackDisplay
		{song}
		{currentTime}
		{duration}
		{isPlaying}
		{isLoading}
		size="expanded"
		showControls
		{showPlaylist}
		{onHideClick}
		{onPlaylistClick}
	/>
	<ProgressControl
		{currentTime}
		{duration}
		{isPlaying}
		onSeek={onProgressSeek}
	/>
	<PlayerControls
		{isPlaying}
		{isLoading}
		{isShuffled}
		{isRepeating}
		{canSkip}
		{onPlayClick}
		{onPrevClick}
		{onNextClick}
		{onShuffleClick}
		{onRepeatClick}
	/>
	<VolumeControl
		{volume}
		{isMuted}
		{isVolumeDragging}
		{volumeBarRef}
		{onVolumeButtonClick}
		{onSliderPointerDown}
		{onSliderKeyDown}
		ariaLabel="音量"
	>
		<button
			class="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]"
			onclick={onCollapseClick}
			title="收起播放器"
		>
			<Icon icon="material-symbols:expand-more" class="text-lg" />
		</button>
	</VolumeControl>
</div>
