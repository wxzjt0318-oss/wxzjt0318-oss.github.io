<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy,onMount } from "svelte";
import { slide } from "svelte/transition";

import { musicPlayerConfig } from "../../config";
import Key from "../../i18n/i18nKey";
import { i18n } from "../../i18n/translation";
import {
	formattedCurrentTime,
	formattedDuration,
	getStoreState,
	musicPlayerStore,
	progressPercent,
	type Song,
	volumePercent,
} from "../../stores/musicPlayerStore";

const mode = musicPlayerConfig.mode ?? "meting";
const meting_api =
	musicPlayerConfig.meting_api ??
	"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
const meting_id = musicPlayerConfig.id ?? "14164869977";
const meting_server = musicPlayerConfig.server ?? "netease";
const meting_type = musicPlayerConfig.type ?? "playlist";

let isExpanded = false;
let showPlaylist = false;
let audio: HTMLAudioElement;
let progressBar: HTMLElement;
let volumeBar: HTMLElement;

const STORAGE_KEY_VOLUME = "music-player-volume";

const localPlaylist: Song[] = [
	{
		id: 1,
		title: "ひとり上手",
		artist: "Kaya",
		cover: "assets/music/cover/hitori.jpg",
		url: "assets/music/url/hitori.mp3",
		duration: 240,
	},
	{
		id: 2,
		title: "眩耀夜行",
		artist: "スリーズブーケ",
		cover: "assets/music/cover/xryx.jpg",
		url: "assets/music/url/xryx.mp3",
		duration: 180,
	},
	{
		id: 3,
		title: "春雷の頃",
		artist: "22/7",
		cover: "assets/music/cover/cl.jpg",
		url: "assets/music/url/cl.mp3",
		duration: 200,
	},
];

let willAutoPlay = false;
let autoplayFailed = false;

$: state = getStoreState();
$: isPlaying = state.isPlaying;
$: isLoading = state.isLoading;
$: currentSong = state.currentSong;
$: currentTime = state.currentTime;
$: duration = state.duration;
$: volume = state.volume;
$: isMuted = state.isMuted;
$: isShuffled = state.isShuffled;
$: isRepeating = state.isRepeating;
$: playlist = state.playlist;
$: currentIndex = state.currentIndex;
$: showError = state.showError;
$: errorMessage = state.errorMessage;

function loadVolumeSettings() {
	try {
		if (typeof localStorage !== "undefined") {
			const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
			if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
				musicPlayerStore.setVolume(parseFloat(savedVolume));
			}
		}
	} catch (e) {
		console.warn("Failed to load volume settings:", e);
	}
}

function saveVolumeSettings() {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
		}
	} catch (e) {
		console.warn("Failed to save volume settings:", e);
	}
}

async function fetchMetingPlaylist() {
	if (!meting_api || !meting_id) {return;}
	musicPlayerStore.setLoading(true);
	const apiUrl = meting_api
		.replace(":server", meting_server)
		.replace(":type", meting_type)
		.replace(":id", meting_id)
		.replace(":auth", "")
		.replace(":r", Date.now().toString());
	try {
		const res = await fetch(apiUrl);
		if (!res.ok) {throw new Error("meting api error");}
		const list = await res.json();
		const playlist: Song[] = list.map((song: any) => {
			const title = song.name ?? song.title ?? i18n(Key.unknownSong);
			const artist = song.artist ?? song.author ?? i18n(Key.unknownArtist);
			let dur = song.duration ?? 0;
			if (dur > 10000) {dur = Math.floor(dur / 1000);}
			if (!Number.isFinite(dur) || dur <= 0) {dur = 0;}
			return {
				id: song.id,
				title,
				artist,
				cover: song.pic ?? "",
				url: song.url ?? "",
				duration: dur,
			};
		});
		musicPlayerStore.init(playlist);
		musicPlayerStore.setLoading(false);
	} catch (e) {
		musicPlayerStore.showError(i18n(Key.musicPlayerErrorPlaylist));
		musicPlayerStore.setLoading(false);
	}
}

function togglePlay() {
	if (!audio || !currentSong.url) {return;}
	if (isPlaying) {
		audio.pause();
	} else {
		audio.play().catch(() => {});
	}
}

function toggleExpanded() {
	isExpanded = !isExpanded;
	if (isExpanded) {showPlaylist = false;}
}

function togglePlaylist() {
	showPlaylist = !showPlaylist;
}

function previousSong() {
	musicPlayerStore.previousSong();
	willAutoPlay = true;
}

function nextSong() {
	musicPlayerStore.nextSong();
	willAutoPlay = true;
}

function playSong(index: number) {
	musicPlayerStore.playSong(index);
	willAutoPlay = true;
}

function getAssetPath(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) {return path;}
	if (path.startsWith("/")) {return path;}
	return `/${path}`;
}

function handleLoadSuccess() {
	musicPlayerStore.setLoading(false);
	if (audio?.duration && audio.duration > 1) {
		musicPlayerStore.setDuration(Math.floor(audio.duration));
	}
	if (willAutoPlay || isPlaying) {
		const playPromise = audio.play();
		if (playPromise !== undefined) {
			playPromise.catch((error) => {
				console.warn("自动播放被拦截:", error);
				autoplayFailed = true;
				musicPlayerStore.pause();
			});
		}
	}
}

function handleLoadError() {
	if (!currentSong.url) {return;}
	musicPlayerStore.setLoading(false);
	musicPlayerStore.showError(i18n(Key.musicPlayerErrorSong));
	const shouldContinue = isPlaying || willAutoPlay;
	if (playlist.length > 1) {
		setTimeout(() => {
			musicPlayerStore.nextSong();
			if (shouldContinue) {willAutoPlay = true;}
		}, 1000);
	} else {
		musicPlayerStore.showError(i18n(Key.musicPlayerErrorEmpty));
	}
}

function handleAudioEnded() {
	if (isRepeating === 1) {
		audio.currentTime = 0;
		audio.play().catch(() => {});
	} else if (isRepeating === 2 || isShuffled) {
		musicPlayerStore.nextSong();
		willAutoPlay = true;
	} else {
		musicPlayerStore.pause();
	}
}

function setProgress(event: MouseEvent) {
	if (!audio || !progressBar) {return;}
	const rect = progressBar.getBoundingClientRect();
	const percent = (event.clientX - rect.left) / rect.width;
	const newTime = percent * duration;
	audio.currentTime = newTime;
	musicPlayerStore.setCurrentTime(newTime);
}

let isVolumeDragging = false;
let isPointerDown = false;
let volumeBarRect: DOMRect | null = null;
let rafId: number | null = null;

function startVolumeDrag(event: PointerEvent) {
	if (!volumeBar) {return;}
	event.preventDefault();
	isPointerDown = true;
	volumeBar.setPointerCapture(event.pointerId);
	volumeBarRect = volumeBar.getBoundingClientRect();
	updateVolumeLogic(event.clientX);
}

function handleVolumeMove(event: PointerEvent) {
	if (!isPointerDown) {return;}
	event.preventDefault();
	isVolumeDragging = true;
	if (rafId) {return;}
	rafId = requestAnimationFrame(() => {
		updateVolumeLogic(event.clientX);
		rafId = null;
	});
}

function stopVolumeDrag(event: PointerEvent) {
	if (!isPointerDown) {return;}
	isPointerDown = false;
	isVolumeDragging = false;
	volumeBarRect = null;
	if (volumeBar) {
		volumeBar.releasePointerCapture(event.pointerId);
	}
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	saveVolumeSettings();
}

function updateVolumeLogic(clientX: number) {
	if (!audio || !volumeBar) {return;}
	const rect = volumeBarRect || volumeBar.getBoundingClientRect();
	const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
	musicPlayerStore.setVolume(percent);
}

function toggleMute() {
	musicPlayerStore.toggleMute();
}

function toggleShuffle() {
	musicPlayerStore.toggleShuffle();
}

function toggleRepeat() {
	musicPlayerStore.toggleRepeat();
}

function hideError() {
	musicPlayerStore.hideError();
}

function handleUserInteraction() {
	if (autoplayFailed && audio) {
		const playPromise = audio.play();
		if (playPromise !== undefined) {
			playPromise.then(() => {
				autoplayFailed = false;
			}).catch(() => {});
		}
	}
}

const interactionEvents = ["click", "keydown", "touchstart"];

onMount(() => {
	loadVolumeSettings();
	interactionEvents.forEach((event) => {
		document.addEventListener(event, handleUserInteraction, { capture: true });
	});

	if (!musicPlayerConfig.enable) {return;}
	if (mode === "meting") {
		fetchMetingPlaylist();
	} else {
		musicPlayerStore.init([...localPlaylist]);
	}
});

onDestroy(() => {
	if (typeof document !== "undefined") {
		interactionEvents.forEach((event) => {
			document.removeEventListener(event, handleUserInteraction, { capture: true });
		});
	}
});
</script>

<audio
	bind:this={audio}
	src={getAssetPath(currentSong.url)}
	bind:volume
	bind:muted={isMuted}
	on:play={() => musicPlayerStore.play()}
	on:pause={() => musicPlayerStore.pause()}
	on:timeupdate={() => audio && musicPlayerStore.setCurrentTime(audio.currentTime)}
	on:ended={handleAudioEnded}
	on:error={handleLoadError}
	on:loadeddata={handleLoadSuccess}
	preload="auto"
></audio>

<svelte:window on:pointermove={handleVolumeMove} on:pointerup={stopVolumeDrag} />

{#if musicPlayerConfig.enable}
<div class="sidebar-music-player">
	{#if showError}
		<div class="error-toast">
			<div class="error-content">
				<Icon icon="material-symbols:error" class="text-xl shrink-0" />
				<span class="text-sm flex-1">{errorMessage}</span>
				<button on:click={hideError} class="close-btn">
					<Icon icon="material-symbols:close" class="text-lg" />
				</button>
			</div>
		</div>
	{/if}

	<!-- 迷你播放器 -->
	<div class="mini-player card-base" class:expanded={isExpanded}>
		<div class="player-header">
			<div class="cover-wrapper" on:click={togglePlay} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); } }} role="button" tabindex="0" aria-label={isPlaying ? i18n(Key.musicPlayerPause) : i18n(Key.musicPlayerPlay)}>
				<img src={getAssetPath(currentSong.cover)} alt={i18n(Key.musicPlayerCover)} class="cover-img" class:spinning={isPlaying && !isLoading} class:animate-pulse={isLoading} />
				<div class="play-overlay">
					{#if isLoading}
						<Icon icon="eos-icons:loading" class="text-white text-lg" />
					{:else if isPlaying}
						<Icon icon="material-symbols:pause" class="text-white text-lg" />
					{:else}
						<Icon icon="material-symbols:play-arrow" class="text-white text-lg" />
					{/if}
				</div>
			</div>
			<div class="song-info" on:click={toggleExpanded} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }} role="button" tabindex="0" aria-label={i18n(Key.musicPlayerExpand)}>
				<div class="song-title">{currentSong.title}</div>
				<div class="song-artist">{currentSong.artist}</div>
			</div>
			<div class="header-actions">
				<button class="action-btn" on:click|stopPropagation={togglePlaylist} title={i18n(Key.musicPlayerPlaylist)}>
					<Icon icon="material-symbols:queue-music" class="text-lg" class:text-[var(--primary)]={showPlaylist} />
				</button>
				<button class="action-btn" on:click={toggleExpanded}>
					<Icon icon="material-symbols:expand-less" class="text-lg" class:rotate-180={isExpanded} />
				</button>
			</div>
		</div>

		<!-- 展开内容 -->
		{#if isExpanded}
			<div class="expanded-content" transition:slide={{ duration: 300 }}>
				<div class="progress-section">
					<div class="progress-bar" bind:this={progressBar} on:click={setProgress} role="slider" tabindex="0" aria-label={i18n(Key.musicPlayerProgress)}>
						<div class="progress-fill" style="width: {$progressPercent}%"></div>
					</div>
					<div class="time-display">
						<span>{$formattedCurrentTime}</span>
						<span>{$formattedDuration}</span>
					</div>
				</div>

				<div class="controls">
					<button class="control-btn" class:active={isShuffled} on:click={toggleShuffle} disabled={playlist.length <= 1}>
						<Icon icon="material-symbols:shuffle" class="text-lg" />
					</button>
					<button class="control-btn" on:click={previousSong} disabled={playlist.length <= 1}>
						<Icon icon="material-symbols:skip-previous" class="text-xl" />
					</button>
					<button class="play-btn" class:opacity-50={isLoading} disabled={isLoading} on:click={togglePlay}>
						{#if isLoading}
							<Icon icon="eos-icons:loading" class="text-xl" />
						{:else if isPlaying}
							<Icon icon="material-symbols:pause" class="text-xl" />
						{:else}
							<Icon icon="material-symbols:play-arrow" class="text-xl" />
						{/if}
					</button>
					<button class="control-btn" on:click={nextSong} disabled={playlist.length <= 1}>
						<Icon icon="material-symbols:skip-next" class="text-xl" />
					</button>
					<button class="control-btn" class:active={isRepeating > 0} on:click={toggleRepeat}>
						{#if isRepeating === 1}
							<Icon icon="material-symbols:repeat-one" class="text-lg" />
						{:else if isRepeating === 2}
							<Icon icon="material-symbols:repeat" class="text-lg" />
						{:else}
							<Icon icon="material-symbols:repeat" class="text-lg opacity-50" />
						{/if}
					</button>
				</div>

				<div class="volume-section">
					<button class="volume-btn" on:click={toggleMute}>
						{#if isMuted || volume === 0}
							<Icon icon="material-symbols:volume-off" class="text-lg" />
						{:else if volume < 0.5}
							<Icon icon="material-symbols:volume-down" class="text-lg" />
						{:else}
							<Icon icon="material-symbols:volume-up" class="text-lg" />
						{/if}
					</button>
					<div class="volume-bar" bind:this={volumeBar} on:pointerdown={startVolumeDrag} role="slider" tabindex="0" aria-label={i18n(Key.musicPlayerVolume)}>
						<div class="volume-fill" style="width: {$volumePercent}%"></div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- 播放列表 -->
	{#if showPlaylist}
		<div class="playlist-panel" transition:slide={{ duration: 300, axis: "y" }}>
			<div class="playlist-header">
				<h3>{i18n(Key.musicPlayerPlaylist)}</h3>
				<button class="close-btn" on:click={togglePlaylist}>
					<Icon icon="material-symbols:close" class="text-lg" />
				</button>
			</div>
			<div class="playlist-content">
				{#each playlist as song, index}
					<div class="playlist-item" class:active={index === currentIndex} on:click={() => playSong(index)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playSong(index); } }} role="button" tabindex="0">
						<div class="item-index">
							{#if index === currentIndex && isPlaying}
								<Icon icon="material-symbols:graphic-eq" class="text-[var(--primary)] animate-pulse" />
							{:else if index === currentIndex}
								<Icon icon="material-symbols:pause" class="text-[var(--primary)]" />
							{:else}
								<span>{index + 1}</span>
							{/if}
						</div>
						<div class="item-cover">
							<img src={getAssetPath(song.cover)} alt={song.title} loading="lazy" />
						</div>
						<div class="item-info">
							<div class="item-title" class:text-[var(--primary)]={index === currentIndex}>{song.title}</div>
							<div class="item-artist" class:text-[var(--primary)]={index === currentIndex}>{song.artist}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
.sidebar-music-player {
	width: 100%;
	user-select: none;
}

.error-toast {
	position: fixed;
	bottom: 5rem;
	right: 1rem;
	z-index: 60;
	max-width: 16rem;
}

.error-content {
	background: #ef4444;
	color: white;
	padding: 0.75rem 1rem;
	border-radius: 0.5rem;
	box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	gap: 0.75rem;
	animation: slide-up 0.3s ease-out;
}

.mini-player {
	background: var(--float-panel-bg);
	border-radius: 0.75rem;
	padding: 0.75rem;
	box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	transition: all 0.3s ease;
}

.player-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.cover-wrapper {
	position: relative;
	width: 3rem;
	height: 3rem;
	border-radius: 50%;
	overflow: hidden;
	cursor: pointer;
	flex-shrink: 0;
}

.cover-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.3s ease;
}

.cover-img.spinning {
	animation: spin-continuous 3s linear infinite;
}

.play-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.2);
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0;
	transition: opacity 0.2s ease;
}

.cover-wrapper:hover .play-overlay {
	opacity: 1;
}

.song-info {
	flex: 1;
	min-width: 0;
	cursor: pointer;
}

.song-title {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--content-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-artist {
	font-size: 0.75rem;
	color: var(--content-meta);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.header-actions {
	display: flex;
	gap: 0.25rem;
}

.action-btn {
	width: 2rem;
	height: 2rem;
	border-radius: 0.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--content-text);
	transition: all 0.2s ease;
}

.action-btn:hover {
	background: var(--btn-plain-bg-hover);
}

.expanded-content {
	margin-top: 0.75rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--line-divider);
}

.progress-section {
	margin-bottom: 0.75rem;
}

.progress-bar {
	height: 0.375rem;
	background: var(--btn-regular-bg);
	border-radius: 9999px;
	cursor: pointer;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: var(--primary);
	border-radius: 9999px;
	transition: width 0.1s ease;
}

.time-display {
	display: flex;
	justify-content: space-between;
	font-size: 0.625rem;
	color: var(--content-meta);
	margin-top: 0.25rem;
}

.controls {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	margin-bottom: 0.75rem;
}

.control-btn {
	width: 2.5rem;
	height: 2.5rem;
	border-radius: 0.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--content-text);
	transition: all 0.2s ease;
}

.control-btn:hover {
	background: var(--btn-plain-bg-hover);
}

.control-btn.active {
	background: var(--btn-regular-bg);
	color: var(--primary);
}

.control-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.play-btn {
	width: 3rem;
	height: 3rem;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--primary);
	border: none;
	cursor: pointer;
	color: white;
	transition: all 0.2s ease;
}

.play-btn:hover {
	transform: scale(1.05);
}

.play-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.volume-section {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.volume-btn {
	width: 2rem;
	height: 2rem;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--content-text);
}

.volume-bar {
	flex: 1;
	height: 0.375rem;
	background: var(--btn-regular-bg);
	border-radius: 9999px;
	cursor: pointer;
	touch-action: none;
}

.volume-fill {
	height: 100%;
	background: var(--primary);
	border-radius: 9999px;
	transition: width 0.1s ease;
}

.playlist-panel {
	margin-top: 0.75rem;
	background: var(--float-panel-bg);
	border-radius: 0.75rem;
	overflow: hidden;
	box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.playlist-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--line-divider);
}

.playlist-header h3 {
	font-size: 1rem;
	font-weight: 600;
	color: var(--content-text);
}

.close-btn {
	width: 2rem;
	height: 2rem;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--content-text);
	border-radius: 0.5rem;
}

.close-btn:hover {
	background: var(--btn-plain-bg-hover);
}

.playlist-content {
	max-height: 15rem;
	overflow-y: auto;
}

.playlist-item {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	cursor: pointer;
	transition: background 0.2s ease;
}

.playlist-item:hover {
	background: var(--btn-plain-bg-hover);
}

.playlist-item.active {
	background: var(--btn-plain-bg);
}

.item-index {
	width: 1.5rem;
	height: 1.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.75rem;
	color: var(--content-meta);
}

.item-cover {
	width: 2.5rem;
	height: 2.5rem;
	border-radius: 0.5rem;
	overflow: hidden;
	background: var(--btn-regular-bg);
	flex-shrink: 0;
}

.item-cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.item-info {
	flex: 1;
	min-width: 0;
}

.item-title {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--content-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.item-artist {
	font-size: 0.75rem;
	color: var(--content-meta);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

@keyframes spin-continuous {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
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

.animate-pulse {
	animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.5; }
}

@media (hover: none) and (pointer: coarse) {
	.action-btn,
	.control-btn,
	.play-btn,
	.volume-btn,
	.playlist-item {
		min-height: 44px;
	}
}
</style>
{/if}
