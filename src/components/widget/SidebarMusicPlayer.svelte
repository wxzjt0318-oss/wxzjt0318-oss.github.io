<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy, onMount } from "svelte";

import { musicPlayerConfig } from "../../config";
import Key from "../../i18n/i18nKey";
import { i18n } from "../../i18n/translation";

const mode = musicPlayerConfig.mode ?? "meting";
const meting_api =
	musicPlayerConfig.meting_api ??
	"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
const meting_id = musicPlayerConfig.id ?? "14164869977";
const meting_server = musicPlayerConfig.server ?? "netease";
const meting_type = musicPlayerConfig.type ?? "playlist";

let isPlaying = false;
let showPlaylist = false;
let currentTime = 0;
let duration = 0;

const STORAGE_KEY_VOLUME = 'sidebar-music-player-volume';

let volume = 0.7;
let isMuted = false;
let isLoading = false;
let isShuffled = false;
let isRepeating = 0;
let errorMessage = "";
let showError = false;

let currentSong = {
	title: "Sample Song",
	artist: "Sample Artist",
	cover: "/favicon/favicon.ico",
	url: "",
	duration: 0,
};

type Song = {
	id: number;
	title: string;
	artist: string;
	cover: string;
	url: string;
	duration: number;
};

let playlist: Song[] = [];
let currentIndex = 0;
let audio: HTMLAudioElement;
let progressBar: HTMLElement;
let volumeBar: HTMLElement;

const localPlaylist = [
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

function loadVolumeSettings() {
	try {
		if (typeof localStorage !== 'undefined') {
			const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
			if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
				volume = parseFloat(savedVolume);
			}
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn('Failed to load volume settings from localStorage:', e);
	}
}

function saveVolumeSettings() {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.warn('Failed to save volume settings to localStorage:', e);
	}
}

async function fetchMetingPlaylist() {
	if (!meting_api || !meting_id) {return;}
	isLoading = true;
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
		playlist = list.map((song: any) => {
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
		if (playlist.length > 0) {
			loadSong(playlist[0]);
		}
		isLoading = false;
	} catch (e) {
		showErrorMessage(i18n(Key.musicPlayerErrorPlaylist));
		isLoading = false;
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

function togglePlaylist() {
	showPlaylist = !showPlaylist;
}

function toggleShuffle() {
    isShuffled = !isShuffled;
	if (isShuffled) {
        isRepeating = 0;
	}
}

function toggleRepeat() {
    isRepeating = (isRepeating + 1) % 3;
	if (isRepeating !== 0) {
        isShuffled = false;
	}
}

function previousSong() {
	if (playlist.length <= 1) {return;}
	const newIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
	playSong(newIndex);
}

function nextSong(autoPlay: boolean = true) {
	if (playlist.length <= 1) {return;}
	
	let newIndex: number;
	if (isShuffled) {
		do {
			newIndex = Math.floor(Math.random() * playlist.length);
		} while (newIndex === currentIndex && playlist.length > 1);
	} else {
		newIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0;
	}
	playSong(newIndex, autoPlay);
}

let willAutoPlay = false;

function playSong(index: number, autoPlay = true) {
	if (index < 0 || index >= playlist.length) {return;}
	
    willAutoPlay = autoPlay;
	currentIndex = index;
	loadSong(playlist[currentIndex]);
}

function getAssetPath(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) {return path;}
	if (path.startsWith("/")) {return path;}
	return `/${path}`;
}

function loadSong(song: typeof currentSong) {
	if (!song) {return;}
	if (song.url !== currentSong.url) {
		currentSong = { ...song };
		if (song.url) {
			isLoading = true;
		} else {
			isLoading = false;
		}
	}
}

let autoplayFailed = false;

function handleLoadSuccess() {
	isLoading = false;
	if (audio?.duration && audio.duration > 1) {
		duration = Math.floor(audio.duration);
		if (playlist[currentIndex]) {playlist[currentIndex].duration = duration;}
		currentSong.duration = duration;
	}

	if (willAutoPlay || isPlaying) {
        const playPromise = audio.play();
		if (playPromise !== undefined) {
            playPromise.catch((error) => {
                // eslint-disable-next-line no-console
                console.warn("自动播放被拦截，等待用户交互:", error);
                autoplayFailed = true;
				isPlaying = false;
            });
		}
    }
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

function handleLoadError(_event: Event) {
	if (!currentSong.url) {return;}
	isLoading = false;
	showErrorMessage(i18n(Key.musicPlayerErrorSong));
	
    const shouldContinue = isPlaying || willAutoPlay;
	if (playlist.length > 1) {
		setTimeout(() => nextSong(shouldContinue), 1000);
	} else {
		showErrorMessage(i18n(Key.musicPlayerErrorEmpty));
	}
}

function handleAudioEnded() {
	if (isRepeating === 1) {
		audio.currentTime = 0;
		audio.play().catch(() => {});
	} else if (
		isRepeating === 2 ||
		isShuffled
	) {
		nextSong(true);
	} else {
		isPlaying = false;
	}
}

function showErrorMessage(message: string) {
	errorMessage = message;
	showError = true;
	setTimeout(() => {
		showError = false;
	}, 3000);
}

function setProgress(event: MouseEvent) {
	if (!audio || !progressBar) {return;}
	const rect = progressBar.getBoundingClientRect();
	const percent = (event.clientX - rect.left) / rect.width;
	const newTime = percent * duration;
	audio.currentTime = newTime;
	currentTime = newTime;
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
	const percent = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
    );
	volume = percent;
}

function toggleMute() {
	isMuted = !isMuted;
}

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {return "0:00";}
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const interactionEvents = ['click', 'keydown', 'touchstart'];
onMount(() => {
    loadVolumeSettings(); 
    interactionEvents.forEach(event => {
        document.addEventListener(event, handleUserInteraction, { capture: true });
    });

	if (!musicPlayerConfig.enable) {
		return;
	}
	if (mode === "meting") {
		fetchMetingPlaylist();
	} else {
		playlist = [...localPlaylist];
		if (playlist.length > 0) {
			loadSong(playlist[0]);
		} else {
			showErrorMessage("本地播放列表为空");
		}
	}
});

onDestroy(() => {
    if (typeof document !== 'undefined') {
        interactionEvents.forEach(event => {
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
	on:play={() => isPlaying = true}
	on:pause={() => isPlaying = false}
	on:timeupdate={() => currentTime = audio.currentTime}
	on:ended={handleAudioEnded}
	on:error={handleLoadError}
	on:loadeddata={handleLoadSuccess}
	preload="auto"
></audio>

<svelte:window 
    on:pointermove={handleVolumeMove} 
    on:pointerup={stopVolumeDrag} 
/>

{#if musicPlayerConfig.enable}
<div class="sidebar-music-player">
    {#if showError}
    <div class="error-toast">
        <Icon icon="material-symbols:error" class="text-lg shrink-0" />
        <span class="text-sm flex-1">{errorMessage}</span>
    </div>
    {/if}

    <!-- 封面和歌曲信息 -->
    <div class="player-header">
        <div class="cover-wrapper" on:click={togglePlay} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); } }} role="button" tabindex="0" aria-label={isPlaying ? i18n(Key.musicPlayerPause) : i18n(Key.musicPlayerPlay)}>
            <img src={getAssetPath(currentSong.cover)} alt={i18n(Key.musicPlayerCover)} class="cover-image" class:spinning={isPlaying && !isLoading} class:animate-pulse={isLoading} />
            <div class="cover-overlay">
                {#if isLoading}
                    <Icon icon="eos-icons:loading" class="text-white text-xl" />
                {:else if isPlaying}
                    <Icon icon="material-symbols:pause" class="text-white text-xl" />
                {:else}
                    <Icon icon="material-symbols:play-arrow" class="text-white text-xl" />
                {/if}
            </div>
        </div>
        <div class="track-info">
            <div class="track-title">{currentSong.title}</div>
            <div class="track-artist">{currentSong.artist}</div>
            <div class="time-display">
                <span>{formatTime(currentTime)}</span>
                <span class="divider">/</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-wrapper">
        <div class="progress-bar" bind:this={progressBar} on:click={setProgress} role="slider" tabindex="0" aria-label={i18n(Key.musicPlayerProgress)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={duration > 0 ? (currentTime / duration * 100) : 0}>
            <div class="progress-fill" style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"></div>
        </div>
    </div>

    <!-- 控制按钮 -->
    <div class="controls-wrapper">
        <button class="control-btn mode-btn" class:active={isShuffled} on:click={toggleShuffle} disabled={playlist.length <= 1} aria-label="Shuffle">
            <Icon icon="material-symbols:shuffle" class="text-lg" />
        </button>
        <button class="control-btn" on:click={previousSong} disabled={playlist.length <= 1} aria-label="Previous">
            <Icon icon="material-symbols:skip-previous" class="text-xl" />
        </button>
        <button class="control-btn play-btn" class:opacity-50={isLoading} disabled={isLoading} on:click={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
            {#if isLoading}
                <Icon icon="eos-icons:loading" class="text-xl" />
            {:else if isPlaying}
                <Icon icon="material-symbols:pause" class="text-xl" />
            {:else}
                <Icon icon="material-symbols:play-arrow" class="text-xl" />
            {/if}
        </button>
        <button class="control-btn" on:click={() => nextSong()} disabled={playlist.length <= 1} aria-label="Next">
            <Icon icon="material-symbols:skip-next" class="text-xl" />
        </button>
        <button class="control-btn mode-btn" class:active={isRepeating > 0} on:click={toggleRepeat} aria-label="Repeat">
            {#if isRepeating === 1}
                <Icon icon="material-symbols:repeat-one" class="text-lg" />
            {:else}
                <Icon icon="material-symbols:repeat" class="text-lg" />
            {/if}
        </button>
    </div>

    <!-- 音量控制 -->
    <div class="volume-wrapper">
        <button class="volume-btn" on:click={toggleMute} aria-label="Toggle mute">
            {#if isMuted || volume === 0}
                <Icon icon="material-symbols:volume-off" class="text-lg" />
            {:else if volume < 0.5}
                <Icon icon="material-symbols:volume-down" class="text-lg" />
            {:else}
                <Icon icon="material-symbols:volume-up" class="text-lg" />
            {/if}
        </button>
        <div class="volume-slider" bind:this={volumeBar} on:pointerdown={startVolumeDrag} role="slider" tabindex="0" aria-label={i18n(Key.musicPlayerVolume)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={volume * 100}>
            <div class="volume-fill" style="width: {volume * 100}%"></div>
        </div>
        <button class="playlist-btn" class:active={showPlaylist} on:click={togglePlaylist} aria-label="Playlist">
            <Icon icon="material-symbols:queue-music" class="text-lg" />
        </button>
    </div>

    <!-- 播放列表 -->
    {#if showPlaylist}
    <div class="playlist-wrapper">
        <div class="playlist-header">
            <span class="playlist-title">{i18n(Key.musicPlayerPlaylist)}</span>
            <button class="close-btn" on:click={togglePlaylist} aria-label="Close playlist">
                <Icon icon="material-symbols:close" class="text-lg" />
            </button>
        </div>
        <div class="playlist-content">
            {#each playlist as song, index}
                <div class="playlist-item" class:active={index === currentIndex} on:click={() => playSong(index)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playSong(index); } }} role="button" tabindex="0" aria-label="播放 {song.title} - {song.artist}">
                    <div class="item-index">
                        {#if index === currentIndex && isPlaying}
                            <Icon icon="material-symbols:graphic-eq" class="text-[var(--primary)] animate-pulse" />
                        {:else if index === currentIndex}
                            <Icon icon="material-symbols:pause" class="text-[var(--primary)]" />
                        {:else}
                            <span>{index + 1}</span>
                        {/if}
                    </div>
                    <img src={getAssetPath(song.cover)} alt={song.title} class="item-cover" loading="lazy" />
                    <div class="item-info">
                        <div class="item-title">{song.title}</div>
                        <div class="item-artist">{song.artist}</div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
    {/if}
</div>

<style>
.sidebar-music-player {
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 1rem;
    box-shadow: var(--shadow);
    user-select: none;
    position: relative;
}

.error-toast {
    position: absolute;
    top: -3rem;
    left: 0;
    right: 0;
    background: #ef4444;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slide-up 0.3s ease-out;
    z-index: 10;
}

@keyframes slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.player-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
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

.cover-image {
    width: 100%;
    height: 100%;
    object-cover;
    transition: transform 0.3s;
}

.cover-image.spinning {
    animation: spin-continuous 3s linear infinite;
}

@keyframes spin-continuous {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.cover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
}

.cover-wrapper:hover .cover-overlay {
    opacity: 1;
}

.track-info {
    flex: 1;
    min-width: 0;
}

.track-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--content-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.track-artist {
    font-size: 0.75rem;
    color: var(--content-meta);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.time-display {
    font-size: 0.625rem;
    color: var(--content-meta);
    margin-top: 0.125rem;
}

.time-display .divider {
    margin: 0 0.25rem;
}

.progress-wrapper {
    margin-bottom: 0.75rem;
}

.progress-bar {
    width: 100%;
    height: 0.375rem;
    background: var(--btn-regular-bg);
    border-radius: 9999px;
    cursor: pointer;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: inherit;
    transition: width 100ms linear;
    min-width: 0;
}

.progress-bar:hover {
    transform: scaleY(1.2);
    transition: transform 0.2s ease;
}

.controls-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    padding-inline: 0.125rem;
}

.control-btn {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--content-main);
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: color 150ms ease, transform 150ms ease, background-color 150ms ease;
}

.control-btn:hover:not(:disabled) {
    color: var(--primary);
}

.control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.control-btn.play-btn {
    width: 3rem;
    height: 3rem;
    background: var(--btn-regular-bg);
    color: var(--primary);
    border-radius: 9999px;
}

.control-btn.play-btn:hover:not(:disabled) {
    transform: scale(1.05);
}

.control-btn.mode-btn.active {
    color: var(--primary);
    background: var(--btn-regular-bg);
}

.volume-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.volume-btn,
.playlist-btn {
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--content-meta);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: color 150ms ease;
}

.volume-btn:hover,
.playlist-btn:hover {
    color: var(--primary);
}

.playlist-btn.active {
    color: var(--primary);
}

.volume-slider {
    flex: 1;
    height: 0.25rem;
    background: var(--btn-regular-bg);
    border-radius: 9999px;
    cursor: pointer;
    touch: none;
}

.volume-fill {
    height: 100%;
    background: var(--primary);
    border-radius: inherit;
    transition: width 100ms linear;
}

.playlist-wrapper {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--card-bg);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    margin-top: 0.5rem;
    max-height: 15rem;
    overflow: hidden;
    z-index: 20;
    animation: slide-up 0.2s ease-out;
}

.playlist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--line-divider);
}

.playlist-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--content-text);
}

.close-btn {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--content-meta);
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: color 150ms ease;
}

.close-btn:hover {
    color: var(--primary);
}

.playlist-content {
    overflow-y: auto;
    max-height: 12rem;
}

.playlist-content::-webkit-scrollbar {
    width: 4px;
}

.playlist-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-bg);
    border-radius: 2px;
}

.playlist-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    cursor: pointer;
    transition: background-color 150ms ease;
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
    border-radius: 0.375rem;
    object-fit: cover;
    background: var(--btn-regular-bg);
}

.item-info {
    flex: 1;
    min-width: 0;
}

.item-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--content-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.playlist-item.active .item-title {
    color: var(--primary);
}

.item-artist {
    font-size: 0.6875rem;
    color: var(--content-meta);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 768px) {
    .sidebar-music-player {
        padding: 0.75rem;
    }
    
    .cover-wrapper {
        width: 2.5rem;
        height: 2.5rem;
    }
    
    .control-btn.play-btn {
        width: 2.5rem;
        height: 2.5rem;
    }
}

@media (hover: none) and (pointer: coarse) {
    .control-btn,
    .volume-btn,
    .playlist-btn {
        min-height: 44px;
        min-width: 44px;
    }
    
    .progress-bar,
    .volume-slider {
        height: 12px;
    }
}
</style>
{/if}
