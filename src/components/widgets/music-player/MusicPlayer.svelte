<script lang="ts">
	import Icon from "@iconify/svelte";
	import { onDestroy, onMount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import type { Action } from "svelte/action";

	import { resolveMusicOptions } from "@/config/musicConfig";
	import type { MusicSnapshot } from "@/types/musicConfig";
	import I18nKey from "@i18n/i18nKey";
	import { i18n } from "@i18n/translation";

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

	// FAB 音乐球几何：实测持久外壳 #floating-controls 的位置并与底部对齐。
	// fab-system.md §1.4 规定音乐不进 FAB 控制流，故作为独立悬浮元素挂靠其上方；
	// 容器在 Swup 持久壳层内跨导航存活，观察者一次绑定即可。
	let fabRight = $state(24);
	let fabBottom = $state(160);

	function measureFabAnchor() {
		const group = document.getElementById("floating-controls");
		if (!group) {
			return;
		}
		const rect = group.getBoundingClientRect();
		// 容器被整组折叠（display:none）时 rect 归零，保留上次测量结果
		if (rect.width === 0 && rect.height === 0) {
			return;
		}
		fabRight = Math.max(0, window.innerWidth - rect.right);
		fabBottom = window.innerHeight - rect.top;
	}

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
				return i18n(I18nKey.musicErrorEmptyPlaylist);
			case "source-unavailable":
				return i18n(I18nKey.musicErrorSourceUnavailable);
			case "autoplay-blocked":
				return i18n(I18nKey.musicErrorAutoplayBlocked);
			case "invalid-track":
				return i18n(I18nKey.musicErrorInvalidTrack);
			default:
				return "";
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
			// 拖动音量即视为恢复播放声音，避免静音态下调节音量无任何反馈
			if (percent > 0 && muted) {
				controller?.runtime.setMuted(false);
			}
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

	/** FAB 面板音量：原生 range 的 input 事件（鼠标/触摸/键盘统一） */
	function handleVolumeInput(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) {
			return;
		}
		controller?.runtime.setVolume(value);
		// 拖动音量即视为恢复播放声音，避免静音态下调节音量无任何反馈
		if (value > 0 && muted) {
			controller?.runtime.setMuted(false);
		}
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

	// FAB 入口模式：悬浮球点击展开/收起迷你面板；首次展开时按需拉取歌单
	function onFabToggle() {
		toggleExpandedUI(ui);
		if (ui.isExpanded) {
			void controller?.runtime.initialize();
		}
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

	// 悬浮球对位：跟随 FAB 组尺寸/折叠态/视口变化重新实测
	onMount(() => {
		if (!shouldRenderFloatingUi) {
			return;
		}
		measureFabAnchor();
		const group = document.getElementById("floating-controls");
		if (!group) {
			return;
		}
		const resizeObserver = new ResizeObserver(measureFabAnchor);
		resizeObserver.observe(group);
		const classObserver = new MutationObserver(measureFabAnchor);
		classObserver.observe(group, {
			attributes: true,
			attributeFilter: ["class"],
		});
		window.addEventListener("resize", measureFabAnchor);
		return () => {
			resizeObserver.disconnect();
			classObserver.disconnect();
			window.removeEventListener("resize", measureFabAnchor);
		};
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
		<div
			class="music-fab-anchor"
			style={`--music-fab-right: ${fabRight}px; --music-fab-bottom: ${fabBottom}px;`}
		>
			<div class="music-fab-shell">
				{#if ui.isExpanded}
					<div
						class="music-fab-panel"
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
							isPlaying={playing}
							isLoading={loading}
							{volume}
							isMuted={muted}
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
							onVolumeInput={handleVolumeInput}
							onVolumeKeyDown={handleSliderKeyDown}
						/>
					</div>
				{/if}
				<button
					type="button"
					class="music-fab-ball"
					class:active={ui.isExpanded}
					class:playing
					class:loading
					aria-expanded={ui.isExpanded}
					aria-label={ui.isExpanded
						? i18n(I18nKey.musicClosePlayer)
						: i18n(I18nKey.musicOpenPlayer)}
					onclick={onFabToggle}
				>
					<Icon
						icon="material-symbols:music-note-rounded"
						aria-hidden="true"
					/>
					{#if playing}
						<span class="music-fab-dot" aria-hidden="true"></span>
					{/if}
				</button>
			</div>
		</div>
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
		/* —— FAB 音乐球：独立悬浮元素，与 #floating-controls 实测几何对齐 —— */
	.music-fab-anchor {
		position: fixed;
		right: var(--music-fab-right, 1.5rem);
		bottom: var(--music-fab-bottom, 10rem);
		z-index: 45;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.music-fab-shell {
		position: absolute;
		right: 0;
		bottom: 0.75rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.75rem;
		transform-origin: bottom right;
		pointer-events: auto;
		will-change: transform, opacity;
	}

	.music-fab-ball {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		padding: 0;
		border: 1px solid var(--outline-variant);
		border-radius: var(--shape-corner-l);
		background: var(--card-bg);
		color: var(--primary);
		cursor: pointer;
		box-shadow: var(--m3e-elevation-1);
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			color var(--m3e-duration-short) var(--m3e-easing-standard),
			box-shadow var(--m3e-duration-short) var(--m3e-easing-standard);
	}

	.music-fab-ball:hover {
		box-shadow: var(--m3e-elevation-3);
	}

	.music-fab-ball.active {
		background: var(--primary-container);
		border-color: transparent;
		color: var(--on-primary-container);
	}

	.music-fab-ball.loading {
		animation: music-fab-breathe 1.4s ease-in-out infinite;
	}

	.music-fab-ball > :global(svg) {
		width: 1.5rem;
		height: 1.5rem;
	}

	.music-fab-dot {
		position: absolute;
		top: 0.3125rem;
		right: 0.3125rem;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: var(--shape-corner-full);
		background: var(--tertiary);
		animation: music-fab-pulse 1.6s ease-in-out infinite;
	}

	@keyframes music-fab-breathe {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@keyframes music-fab-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.music-fab-ball.loading,
		.music-fab-dot {
			animation: none;
		}
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
			.music-fab-ball {
				width: 2.75rem;
				height: 2.75rem;
			}

			.music-fab-ball > :global(svg) {
				width: 1.375rem;
				height: 1.375rem;
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
