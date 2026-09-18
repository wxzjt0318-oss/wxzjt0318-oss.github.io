<script lang="ts">
	import Icon from "@iconify/svelte";
	import { slide } from "svelte/transition";

	import CoverImage from "./atoms/CoverImage.svelte";
	import PlaylistItem from "./atoms/PlaylistItem.svelte";
	import NextButton from "./atoms/NextButton.svelte";
	import PlayButton from "./atoms/PlayButton.svelte";
	import PrevButton from "./atoms/PrevButton.svelte";
	import VolumeButton from "./atoms/VolumeButton.svelte";
	import VolumeSlider from "./atoms/VolumeSlider.svelte";
	import ProgressControl from "./molecules/ProgressControl.svelte";
	import { formatTime } from "./hooks/useKeyboardShortcuts";
	import { isShuffleMode, repeatLevel } from "./hooks/usePlaylist";
	import type { Song } from "./types";
	import type { PlaybackMode } from "@/types/musicConfig";

	interface Props {
		song: Song;
		playlist: readonly Song[];
		currentIndex: number;
		currentTime: number;
		duration: number;
		isPlaying: boolean;
		isLoading: boolean;
		volume: number;
		isMuted: boolean;
		isVolumeDragging: boolean;
		volumeBarRef: (node: HTMLElement) => void;
		mode: PlaybackMode;
		onTogglePlay: () => void;
		onPrev: () => void;
		onNext: () => void;
		onCycleMode: () => void;
		onSeek: (time: number) => void;
		onToggleMute: () => void;
		onPlaySong: (index: number) => void;
		onVolumeInput: (event: Event) => void;
		onVolumeKeyDown: (event: KeyboardEvent) => void;
	}

	const {
		song,
		playlist,
		currentIndex,
		currentTime,
		duration,
		isPlaying,
		isLoading,
		volume,
		isMuted,
		isVolumeDragging,
		volumeBarRef,
		mode,
		onTogglePlay,
		onPrev,
		onNext,
		onCycleMode,
		onSeek,
		onToggleMute,
		onPlaySong,
		onVolumeInput,
		onVolumeKeyDown,
	}: Props = $props();

	// legacy 依赖 widgets/music-sidebar 的 Sidebar* 子组件（上游已移除），
	// 改为直接组合本目录内的原子/分子组件，结构与原 FAB 面板一致。
	let showPlaylist = $state(false);

	const modeIcon = $derived(
		isShuffleMode(mode)
			? "material-symbols:shuffle-rounded"
			: repeatLevel(mode) === 1
				? "material-symbols:repeat-one-rounded"
				: "material-symbols:repeat-rounded",
	);
	const modeActive = $derived(isShuffleMode(mode) || repeatLevel(mode) > 0);

	function togglePlaylistView() {
		showPlaylist = !showPlaylist;
	}
</script>

<div
	class="fab-music-panel bg-[var(--float-panel-bg)] shadow-xl rounded-2xl p-4 w-[20rem] max-w-[80vw]"
>
	<div class="fab-music-header">
		<CoverImage
			cover={song.cover ?? ""}
			{isPlaying}
			{isLoading}
			size="expanded"
		/>
		<div class="fab-music-info">
			<div class="title-row">
				<span class="title-text truncate">{song.title}</span>
			</div>
			<div class="artist-row">
				<span class="artist-text truncate">{song.artist}</span>
			</div>
			<div class="meta-row">
				<div class="time-label" aria-live="polite">
					<span>{formatTime(currentTime)}</span>
					<span class="divider">/</span>
					<span>{formatTime(duration)}</span>
				</div>

				<div class="volume-wrap">
					<VolumeButton
						{volume}
						{isMuted}
						onclick={onToggleMute}
					/>
					<VolumeSlider
						volume={isMuted ? 0 : volume}
						{isVolumeDragging}
						{volumeBarRef}
						oninput={onVolumeInput}
						onkeydown={onVolumeKeyDown}
						ariaLabel="音量"
					/>
				</div>
			</div>
		</div>
	</div>

	<ProgressControl {currentTime} {duration} {isPlaying} onSeek={onSeek} />

	<div class="controls-row">
		<button
			class="icon-btn"
			class:active-mode={modeActive}
			onclick={onCycleMode}
			aria-label="播放模式"
		>
			<Icon icon={modeIcon} class="text-xl" />
		</button>
		<PrevButton onclick={onPrev} disabled={false} />
		<PlayButton {isPlaying} {isLoading} onclick={onTogglePlay} />
		<NextButton onclick={onNext} disabled={false} />
		<button
			class="icon-btn list-btn"
			onclick={togglePlaylistView}
			aria-label="播放列表"
		>
			<Icon icon="material-symbols:queue-music-rounded" />
		</button>
	</div>

	{#if showPlaylist}
		<div
			class="fab-playlist"
			role="listbox"
			aria-label="播放列表"
			transition:slide={{ duration: 250, axis: "y" }}
		>
			{#each playlist as item, index (item.id)}
				<PlaylistItem
					song={item}
					{index}
					isCurrent={index === currentIndex}
					{isPlaying}
					onclick={() => onPlaySong(index)}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.fab-music-panel {
		border-radius: 1.25rem;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid color-mix(in srgb, var(--line-color) 65%, transparent);
		box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
	}

	:global(.dark) .fab-music-panel {
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
	}

	.fab-music-header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-bottom: 0.75rem;
	}

	/* —— 曲目信息列（原 SidebarTrackInfo 结构，变量换成上游 M3 token） —— */
	.fab-music-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		overflow: hidden;
	}

	.title-row {
		margin-bottom: 0.06rem;
	}

	.title-text {
		font-weight: 600;
		color: var(--on-surface);
		line-height: 1.1;
	}

	.artist-text {
		font-size: 0.75rem;
		color: var(--on-surface-variant);
		display: block;
	}

	.artist-row {
		margin-bottom: 0.36rem;
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		justify-content: space-between;
	}

	.time-label {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 10px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--on-surface-variant);
		white-space: nowrap;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.divider {
		opacity: 0.6;
	}

	.volume-wrap {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1 1 auto;
		min-width: 0;
		justify-content: flex-end;
		margin-left: auto;
	}

	/* —— 控制行（原 SidebarControls 结构） —— */
	.controls-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		margin-top: 0.75rem;
		padding-inline: 0.125rem;
		flex-wrap: nowrap;
	}

	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--on-surface);
		transition:
			color 150ms ease,
			transform 150ms ease;
		flex: 0 0 auto;
	}

	.icon-btn:hover {
		color: var(--primary);
	}

	.mode-btn,
	.list-btn {
		color: var(--on-surface-variant);
	}

	.active-mode {
		color: var(--primary);
	}

	.controls-row :global(button) {
		flex-shrink: 0;
	}

	/* —— 内嵌播放列表（原 SidebarPlaylist 结构） —— */
	.fab-playlist {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid
			color-mix(in srgb, var(--on-surface-variant) 12%, transparent 88%);
		max-height: 12rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.fab-playlist::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 640px) {
		.fab-music-panel {
			padding: 0.9rem 0.85rem 0.9rem 0.9rem;
			border-radius: 1rem;
		}

		/* 窄屏收紧纵向节奏：曲目信息 → 进度 → 控件三段更紧凑 */
		.fab-music-header {
			gap: 0.7rem;
			margin-bottom: 0.5rem;
		}

		.controls-row {
			margin-top: 0.5rem;
		}
	}

	@media (max-width: 520px) {
		.artist-row {
			margin-bottom: 0.28rem;
		}

		.meta-row {
			gap: 0.4rem;
		}

		.time-label {
			font-size: 9px;
		}

		.volume-wrap {
			gap: 0.25rem;
		}

		.icon-btn {
			width: 1.9rem;
			height: 1.9rem;
			flex: 0 0 1.9rem;
		}
	}
</style>
