<script lang="ts">
	import Icon from "@iconify/svelte";
	import { onDestroy, onMount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import type { Action } from "svelte/action";

	import { resolveMusicOptions } from "@/config/musicConfig";
	import type { MusicSnapshot } from "@/types/musicConfig";

	import CoverImage from "./atoms/CoverImage.svelte";
	import FabMusicPanel from "./FabMusicPanel.svelte";
	import MiniPlayer from "./organisms/MiniPlayer.svelte";
	import PlayerBar from "./organisms/PlayerBar.svelte";
	import Playlist from "./organisms/Playlist.svelte";
	import { DEFAULT_VOLUME, PLACEHOLDER_SONG } from "./constants";
	import {
		createMusicPlayerController,
		musicOptions,
		type MusicPlayerController,
	} from "./hooks/useAudioPlayer";
	import { canSkip, nextPlaybackMode } from "./hooks/usePlaylist";
	import {
		createPlayerUIState,
		hideErrorUI,
		showErrorMessageUI,
		toggleExpandedUI,
		toggleHiddenUI,
		togglePlaylistUI,
		type PlayerUIState,
	} from "./hooks/usePlayerState";
	import { handleVolumeKeyDown } from "./hooks/useVolumeControl";
	import type { Song } from "./types";

	/**
	 * legacy 通过 musicPlayerStore（自管理 <audio> + Meting 拉取）驱动；
	 * 迁移后改为上游音乐运行时（src/utils/music/music-runtime.ts）共享单例，
	 * 配置单一真源为 @/config/musicConfig（enable 作为总开关，禁用时不渲染任何 DOM）。
	 * legacy musicPlayerConfig 的 UI 开关改为组件内常量：悬浮球显示、FAB 入口模式。
	 */
	const showFloatingPlayer = true;
	const useFabEntry = true; // legacy floatingEntryMode: "fab"
	const shouldRenderFloatingUi = showFloatingPlayer && Boolean(musicOptions);

	let controller = $state<MusicPlayerController | null>(null);
	let snapshot = $state<MusicSnapshot | null>(null);
	let unsubscribe: (() => void) | undefined;
	const ui: PlayerUIState = $state(createPlayerUIState());

	let isVolumeDragging = $state(false);
	let errorDismissed = $state(false);
	// 保留 legacy 占位 action：VolumeSlider 通过 use: 引用滑杆节点
	const volumeBarRef: Action<HTMLElement, undefined> = () => {};

	const playing = $derived(snapshot?.status === "playing");
	const loading = $derived(snapshot?.status === "loading");
	const currentSong: Song = $derived(snapshot?.currentTrack ?? PLACEHOLDER_SONG);
	const playlist = $derived(snapshot?.playlist ?? []);
	const currentIndex = $derived(snapshot?.currentIndex ?? 0);
	const currentTime = $derived(snapshot?.currentTime ?? 0);
	const duration = $derived(snapshot?.duration ?? 0);
	const volume = $derived(
		snapshot?.volume ?? (musicOptions?.defaultVolume ?? DEFAULT_VOLUME),
	);
	const muted = $derived(snapshot?.muted ?? false);
	const mode = $derived(
		snapshot?.mode ?? musicOptions?.defaultMode ?? "sequence",
	);
	const isShuffled = $derived(mode === "shuffle");
	const isRepeating = $derived(mode === "repeat-one" ? 1 : 0);
	const canSkipNow = $derived(canSkip(snapshot));

	const errorText = $derived.by(() => {
		if (!snapshot || snapshot.status !== "error" || !snapshot.error) {
			return "";
		}
		switch (snapshot.error) {
			case "empty-playlist":
				return "播放列表为空";
			case "source-unavailable":
				return "音乐源暂不可用，请稍后再试";
			case "autoplay-blocked":
				return "浏览器阻止了自动播放，请手动点击播放";
			case "invalid-track":
				return "该曲目不可用，已尝试切换下一首";
			default:
				return "播放出错";
		}
	});

	$effect(() => {
		// 错误文案变化时重新展示提示（3 秒后自动隐藏，与 legacy 行为一致）
		if (errorText) {
			errorDismissed = false;
			showErrorMessageUI(ui, errorText);
		}
	});

	function togglePlay() {
		void controller?.runtime.toggle();
	}

	function prev() {
		void controller?.runtime.previous();
	}

	function next() {
		void controller?.runtime.next();
	}

	function toggleShuffle() {
		controller?.runtime.setMode(isShuffled ? "sequence" : "shuffle");
	}

	function toggleRepeat() {
		controller?.runtime.setMode(
			isRepeating === 1 ? "sequence" : "repeat-one",
		);
	}

	function cycleMode() {
		controller?.runtime.setMode(nextPlaybackMode(mode));
	}

	function playIndex(index: number) {
		void controller?.runtime.select(index);
	}

	function seek(time: number) {
		controller?.runtime.seek(time);
	}

	function toggleMute() {
		controller?.runtime.setMuted(!muted);
	}

	function handleVolumeButtonClick() {
		toggleMute();
	}

	function startVolumeDrag(event: PointerEvent) {
		const slider = event.currentTarget as HTMLElement | null;
		if (!slider) {
			return;
		}

		const updateVolume = (clientX: number) => {
			const rect = slider.getBoundingClientRect();
			if (rect.width <= 0) {
				return;
			}
			const percent = Math.max(
				0,
				Math.min(1, (clientX - rect.left) / rect.width),
			);
			controller?.runtime.setVolume(percent);
		};

		updateVolume(event.clientX);

		const pointerId = event.pointerId;
		slider.setPointerCapture(pointerId);

		const handleMove = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== pointerId) {
				return;
			}
			isVolumeDragging = true;
			updateVolume(moveEvent.clientX);
		};

		const cleanup = () => {
			slider.removeEventListener("pointermove", handleMove);
			slider.removeEventListener("pointerup", handleUp);
			slider.removeEventListener("pointercancel", handleCancel);
			if (slider.hasPointerCapture(pointerId)) {
				slider.releasePointerCapture(pointerId);
			}
		};

		const handleUp = (upEvent: PointerEvent) => {
			if (upEvent.pointerId !== pointerId) {
				return;
			}
			updateVolume(upEvent.clientX);
			isVolumeDragging = false;
			cleanup();
		};

		const handleCancel = (cancelEvent: PointerEvent) => {
			if (cancelEvent.pointerId !== pointerId) {
				return;
			}
			isVolumeDragging = false;
			cleanup();
		};

		slider.addEventListener("pointermove", handleMove);
		slider.addEventListener("pointerup", handleUp);
		slider.addEventListener("pointercancel", handleCancel);
	}

	function handleSliderKeyDown(event: KeyboardEvent) {
		handleVolumeKeyDown(event, toggleMute);
	}

	function handleWindowKeyDown(event: KeyboardEvent) {
		// 全局键盘快捷键（legacy 行为）：方向键调音量、M 切换静音；
		// 输入控件聚焦时不劫持按键
		const target = event.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable)
		) {
			return;
		}
		if (!controller || !snapshot) {
			return;
		}
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			controller.runtime.setVolume(Math.max(0, snapshot.volume - 0.05));
			return;
		}
		if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			controller.runtime.setVolume(Math.min(1, snapshot.volume + 0.05));
			return;
		}
		if (event.key === "m" || event.key === "M") {
			event.preventDefault();
			toggleMute();
			return;
		}
		handleVolumeKeyDown(event, toggleMute);
	}

	function togglePlaylist() {
		togglePlaylistUI(ui);
		// 展开播放列表时按需拉取 Meting 歌单（与上游侧栏行为一致）
		if (ui.showPlaylist) {
			void controller?.runtime.initialize();
		}
	}

	function toggleExpanded() {
		toggleExpandedUI(ui);
	}

	function toggleHidden() {
		toggleHiddenUI(ui);
	}

	function hideError() {
		hideErrorUI(ui);
		errorDismissed = true;
	}

	onMount(() => {
		if (!musicOptions) {
			return;
		}
		const created = createMusicPlayerController();
		if (!created) {
			return;
		}
		controller = created;
		unsubscribe = created.subscribe((nextState) => {
			snapshot = nextState;
		});
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

{#if shouldRenderFloatingUi}
	{#if ui.showError && errorText && !errorDismissed}
		<div class="fixed bottom-20 right-4 z-[60] max-w-sm">
			<div
				class="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up"
			>
				<Icon
					icon="material-symbols:error"
					class="text-xl flex-shrink-0"
				/>
				<span class="text-sm flex-1">{ui.errorMessage}</span>
				<button
					onclick={hideError}
					class="text-white/80 hover:text-white transition-colors"
				>
					<Icon icon="material-symbols:close" class="text-lg" />
				</button>
			</div>
		</div>
	{/if}

	{#if useFabEntry}
		{#if ui.isExpanded}
			<div class="music-player-fab-anchor fixed z-[55]">
				<div
					class="music-player-fab-shell"
					transition:fly={{
						y: 16,
						duration: 280,
						opacity: 0.12,
						easing: cubicOut,
					}}
				>
					<FabMusicPanel
						song={currentSong}
						{playlist}
						{currentIndex}
						{currentTime}
						{duration}
						{isPlaying}
						{isLoading}
						{volume}
						{muted}
						{isVolumeDragging}
						{volumeBarRef}
						{mode}
						onTogglePlay={togglePlay}
						onPrev={prev}
						onNext={next}
						onCycleMode={cycleMode}
						onSeek={seek}
						onToggleMute={toggleMute}
						onPlaySong={playIndex}
						onVolumePointerDown={startVolumeDrag}
						onVolumeKeyDown={handleSliderKeyDown}
					/>
				</div>
			</div>
		{/if}
	{:else}
		<div
			class="music-player fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out"
			class:expanded={ui.isExpanded}
			class:hidden-mode={ui.isHidden}
		>
			<div
				class="orb-player-container {ui.isHidden
					? 'orb-enter pointer-events-auto'
					: 'orb-leave pointer-events-none'}"
			>
				<CoverImage
					cover={currentSong.cover ?? ""}
					isPlaying={playing}
					isLoading={loading}
					size="orb"
					onclick={toggleHidden}
				/>
			</div>

			<MiniPlayer
				song={currentSong}
				{currentTime}
				{duration}
				isPlaying={playing}
				isLoading={loading}
				isHidden={ui.isExpanded || ui.isHidden}
				onCoverClick={togglePlay}
				onInfoClick={toggleExpanded}
				onHideClick={toggleHidden}
				onExpandClick={toggleExpanded}
			/>

			<PlayerBar
				song={currentSong}
				{currentTime}
				{duration}
				isPlaying={playing}
				isLoading={loading}
				{isShuffled}
				{isRepeating}
				showPlaylist={ui.showPlaylist}
				canSkip={canSkipNow}
				{volume}
				{muted}
				{isVolumeDragging}
				isHidden={!ui.isExpanded}
				{volumeBarRef}
				onPlayClick={togglePlay}
				onPrevClick={prev}
				onNextClick={() => next()}
				onShuffleClick={toggleShuffle}
				onRepeatClick={toggleRepeat}
				onProgressSeek={seek}
				onVolumeButtonClick={handleVolumeButtonClick}
				onSliderPointerDown={startVolumeDrag}
				onSliderKeyDown={handleSliderKeyDown}
				onHideClick={toggleHidden}
				onPlaylistClick={togglePlaylist}
				onCollapseClick={toggleExpanded}
			/>

			<Playlist
				{playlist}
				{currentIndex}
				isPlaying={playing}
				show={ui.showPlaylist}
				onClose={togglePlaylist}
				onPlaySong={playIndex}
			/>
		</div>
	{/if}

	<style>
		.music-player-fab-anchor {
			right: var(--fab-group-right, 1.5rem);
			bottom: calc(
				var(--fab-group-bottom, 10rem) +
					(
						var(--fab-button-size, 3rem) *
							var(--fab-visible-count, 1)
					) +
					(
						var(--fab-group-gap, 0.5rem) *
							(var(--fab-visible-count, 1) - 1)
					)
			);
			width: 0;
			height: 0;
			pointer-events: none;
		}

		.music-player-fab-shell {
			position: absolute;
			right: 0;
			bottom: 0.75rem;
			transform-origin: bottom right;
			pointer-events: auto;
			will-change: transform, opacity;
		}

		.orb-player-container {
			position: absolute;
			bottom: 0;
			right: 0;
		}

		.orb-enter {
			animation: orbElasticIn 460ms cubic-bezier(0.22, 1.25, 0.36, 1)
				forwards;
		}

		.orb-leave {
			animation: orbElasticOut 360ms cubic-bezier(0.4, 0, 1, 1) forwards;
		}

		@keyframes orbElasticIn {
			0% {
				opacity: 0;
				transform: translateX(0) scale(0.55);
			}
			70% {
				opacity: 1;
				transform: translateX(0) scale(1.12);
			}
			100% {
				opacity: 1;
				transform: translateX(0) scale(1);
			}
		}

		@keyframes orbElasticOut {
			0% {
				opacity: 1;
				transform: translateX(0) scale(1);
			}
			100% {
				opacity: 0;
				transform: translateX(0) scale(0.6);
			}
		}

		.music-player.hidden-mode {
			width: 3rem;
			height: 3rem;
		}

		.music-player {
			width: 20rem;
			max-width: 20rem;
			min-width: 20rem;
			user-select: none;
		}

		:global(.mini-player) {
			position: absolute;
			bottom: 0;
			right: 0;
		}

		:global(.expanded-player) {
			position: absolute;
			bottom: 0;
			right: 0;
		}

		:global(.orb-player) {
			position: relative;
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
		}

		:global(.orb-player::before) {
			content: "";
			position: absolute;
			inset: -0.125rem;
			background: linear-gradient(
				45deg,
				var(--primary),
				transparent,
				var(--primary)
			);
			border-radius: 50%;
			z-index: -1;
			opacity: 0;
			transition: opacity 0.3s ease;
		}

		:global(.orb-player:hover::before) {
			opacity: 0.3;
			animation: rotate 2s linear infinite;
		}

		:global(.orb-player .animate-pulse) {
			animation: musicWave 1.5s ease-in-out infinite;
		}

		@keyframes rotate {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}

		@keyframes musicWave {
			0%,
			100% {
				transform: scaleY(0.5);
			}
			50% {
				transform: scaleY(1);
			}
		}

		:global(.animate-pulse) {
			animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
		}

		@keyframes pulse {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.5;
			}
		}

		:global(.progress-section div:hover),
		:global(.bottom-controls > div:hover) {
			transform: scaleY(1.2);
			transition: transform 0.2s ease;
		}

		@media (max-width: 768px) {
			.music-player-fab-anchor {
				right: var(--fab-group-right, 0.75rem) !important;
				bottom: calc(
					var(--fab-group-bottom, 5rem) +
						(
							var(--fab-button-size, 2.75rem) *
								var(--fab-visible-count, 1)
						) +
						(
							var(--fab-group-gap, 0.5rem) *
								(var(--fab-visible-count, 1) - 1)
						)
				) !important;
			}

			.music-player-fab-shell {
				right: 0 !important;
				bottom: 0.75rem !important;
			}

			.music-player {
				width: 280px !important;
				min-width: 280px !important;
				max-width: 280px !important;
				bottom: 0.5rem !important;
				right: 0.5rem !important;
			}
			:global(.mini-player) {
				width: 280px !important;
			}
			:global(.expanded-player) {
				width: 280px !important;
				max-width: 280px !important;
			}
			.music-player.expanded {
				width: 280px !important;
				min-width: 280px !important;
				max-width: 280px !important;
				right: 0.5rem !important;
			}
			:global(.playlist-panel) {
				width: 280px !important;
				right: 0.5rem !important;
				max-width: 280px !important;
			}
			:global(.controls) {
				gap: 8px;
			}
			:global(.controls button) {
				width: 36px;
				height: 36px;
			}
			:global(.controls button:nth-child(3)) {
				width: 44px;
				height: 44px;
			}
		}

		@media (max-width: 480px) {
			.music-player-fab-anchor {
				right: var(--fab-group-right, 0.5rem) !important;
				bottom: calc(
					var(--fab-group-bottom, 4.5rem) +
						(
							var(--fab-button-size, 2.5rem) *
								var(--fab-visible-count, 1)
						) +
						(
							var(--fab-group-gap, 0.5rem) *
								(var(--fab-visible-count, 1) - 1)
						)
				) !important;
			}

			.music-player-fab-shell {
				right: 0 !important;
				bottom: 0.75rem !important;
			}

			.music-player {
				width: 260px !important;
				min-width: 260px !important;
				max-width: 260px !important;
			}
			:global(.expanded-player) {
				width: 260px !important;
				max-width: 260px !important;
			}
			:global(.playlist-panel) {
				width: 260px !important;
				max-width: 260px !important;
				right: 0.5rem !important;
			}
			:global(.song-title) {
				font-size: 14px;
			}
			:global(.song-artist) {
				font-size: 12px;
			}
			:global(.controls) {
				gap: 6px;
				margin-bottom: 12px;
			}
			:global(.controls button) {
				width: 32px;
				height: 32px;
			}
			:global(.controls button:nth-child(3)) {
				width: 40px;
				height: 40px;
			}
			:global(.playlist-item) {
				padding: 8px 12px;
			}
			:global(.playlist-item .w-10) {
				width: 32px;
				height: 32px;
			}
		}

		@keyframes slide-up {
			from {
				transform: translateY(100%);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}

		.animate-slide-up {
			animation: slide-up 0.3s ease-out;
		}

		@media (hover: none) and (pointer: coarse) {
			:global(.music-player button),
			:global(.playlist-item) {
				min-height: 44px;
			}
			:global(.progress-section > div),
			:global(.bottom-controls > div:nth-child(2)) {
				height: 12px;
			}
		}

		@keyframes spin-continuous {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}

		:global(.cover-container img) {
			animation: spin-continuous 3s linear infinite;
			animation-play-state: paused;
		}

		:global(.cover-container img.spinning) {
			animation-play-state: running;
		}

		:global(button.bg-\\[var\\(--primary\\)\\]) {
			box-shadow: 0 0 0 2px var(--primary);
			border: none;
		}
	</style>
{/if}
