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
let isExpanded = false;
let showPlaylist = false;
let currentTime = 0;
let duration = 0;

const STORAGE_KEY_VOLUME = 'music-player-volume';

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

function toggleExpanded() {
	isExpanded = !isExpanded;
	if (isExpanded) {
		showPlaylist = false;
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

function handleLoadStart() {}

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

function hideError() {
	showError = false;
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
	on:loadstart={handleLoadStart}
	preload="auto"
></audio>

<svelte:window 
    on:pointermove={handleVolumeMove} 
    on:pointerup={stopVolumeDrag} 
/>

{#if musicPlayerConfig.enable}
{#if showError}
<div class="fixed bottom-20 right-4 z-60 max-w-sm">
    <div class="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up">
        <Icon icon="material-symbols:error" class="text-xl shrink-0" />
        <span class="text-sm flex-1">{errorMessage}</span>
        <button on:click={hideError} class="text-white/[80%] hover:text-white transition-colors">
            <Icon icon="material-symbols:close" class="text-lg" />
        </button>
    </div>
</div>
{/if}

<div class="sidebar-music-player-wrapper">
    <!-- 迷你播放器 -->
    <div class="mini-player card-base bg-[var(--float-panel-bg)] shadow-lg rounded-xl p-2.5 transition-all duration-300"
         class:hidden={isExpanded}>
        <div class="flex items-center gap-2">
            <div class="cover-container relative w-10 h-10 rounded-full overflow-hidden cursor-pointer shrink-0"
                 on:click={togglePlay}
                 role="button"
                 tabindex="0"
                 aria-label={isPlaying ? i18n(Key.musicPlayerPause) : i18n(Key.musicPlayerPlay)}>
                <img src={getAssetPath(currentSong.cover)} alt={i18n(Key.musicPlayerCover)}
                     class="w-full h-full object-cover transition-transform duration-300"
                     class:spinning={isPlaying && !isLoading}
                     class:animate-pulse={isLoading} />
                <div class="absolute inset-0 bg-black/[20%] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    {#if isLoading}
                        <Icon icon="eos-icons:loading" class="text-white text-lg" />
                    {:else if isPlaying}
                        <Icon icon="material-symbols:pause" class="text-white text-lg" />
                    {:else}
                        <Icon icon="material-symbols:play-arrow" class="text-white text-lg" />
                    {/if}
                </div>
            </div>
            <div class="flex-1 min-w-0 cursor-pointer"
                 on:click={toggleExpanded}
                 role="button"
                 tabindex="0"
                 aria-label={i18n(Key.musicPlayerExpand)}>
                <div class="text-xs font-medium text-90 truncate">{currentSong.title}</div>
                <div class="text-xs text-50 truncate">{currentSong.artist}</div>
            </div>
            <button class="btn-plain w-7 h-7 rounded-lg flex items-center justify-center"
                    on:click|stopPropagation={toggleExpanded}>
                <Icon icon="material-symbols:expand-less" class="text-base" />
            </button>
        </div>
    </div>

    <!-- 展开状态的播放器 -->
    <div class="expanded-player card-base bg-[var(--float-panel-bg)] shadow-lg rounded-xl p-3 transition-all duration-300"
         class:hidden={!isExpanded}>
        <div class="flex items-center gap-3 mb-3">
            <div class="cover-container relative w-12 h-12 rounded-full overflow-hidden shrink-0">
                <img src={getAssetPath(currentSong.cover)} alt={i18n(Key.musicPlayerCover)}
                     class="w-full h-full object-cover transition-transform duration-300"
                     class:spinning={isPlaying && !isLoading}
                     class:animate-pulse={isLoading} />
            </div>
            <div class="flex-1 min-w-0">
                <div class="song-title text-sm font-bold text-90 truncate mb-0.5">{currentSong.title}</div>
                <div class="song-artist text-xs text-50 truncate">{currentSong.artist}</div>
                <div class="text-xs text-30 mt-0.5">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>
            <div class="flex items-center gap-0.5">
                <button class="btn-plain w-7 h-7 rounded-lg flex items-center justify-center"
                        class:text-[var(--primary)]={showPlaylist}
                        on:click={togglePlaylist}
                        title={i18n(Key.musicPlayerPlaylist)}>
                    <Icon icon="material-symbols:queue-music" class="text-base" />
                </button>
                <button class="btn-plain w-7 h-7 rounded-lg flex items-center justify-center"
                        on:click={toggleExpanded}
                        title={i18n(Key.musicPlayerCollapse)}>
                    <Icon icon="material-symbols:expand-more" class="text-base" />
                </button>
            </div>
        </div>
        
        <div class="progress-section mb-3">
            <div class="progress-bar flex-1 h-1.5 bg-[var(--btn-regular-bg)] rounded-full cursor-pointer"
                 bind:this={progressBar}
                 on:click={setProgress}
                 role="slider"
                 tabindex="0"
                 aria-label={i18n(Key.musicPlayerProgress)}>
                <div class="h-full bg-[var(--primary)] rounded-full transition-all duration-100"
                     style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"></div>
            </div>
        </div>
        
        <div class="controls flex items-center justify-center gap-1 mb-3">
            <button class="w-8 h-8 rounded-lg"
                    class:btn-regular={isShuffled}
                    class:btn-plain={!isShuffled}
                    on:click={toggleShuffle}
                    disabled={playlist.length <= 1}>
                <Icon icon="material-symbols:shuffle" class="text-sm" />
            </button>
            <button class="btn-plain w-8 h-8 rounded-lg" on:click={previousSong}
                    disabled={playlist.length <= 1}>
                <Icon icon="material-symbols:skip-previous" class="text-base" />
            </button>
            <button class="btn-regular w-10 h-10 rounded-full"
                    class:opacity-50={isLoading}
                    disabled={isLoading}
                    on:click={togglePlay}>
                {#if isLoading}
                    <Icon icon="eos-icons:loading" class="text-base" />
                {:else if isPlaying}
                    <Icon icon="material-symbols:pause" class="text-base" />
                {:else}
                    <Icon icon="material-symbols:play-arrow" class="text-base" />
                {/if}
            </button>
            <button class="btn-plain w-8 h-8 rounded-lg" on:click={() => nextSong()}
                    disabled={playlist.length <= 1}>
                <Icon icon="material-symbols:skip-next" class="text-base" />
            </button>
            <button class="w-8 h-8 rounded-lg"
                    class:btn-regular={isRepeating > 0}
                    class:btn-plain={isRepeating === 0}
                    on:click={toggleRepeat}>
                {#if isRepeating === 1}
                    <Icon icon="material-symbols:repeat-one" class="text-sm" />
                {:else if isRepeating === 2}
                    <Icon icon="material-symbols:repeat" class="text-sm" />
                {:else}
                    <Icon icon="material-symbols:repeat" class="text-sm opacity-50" />
                {/if}
            </button>
        </div>
        
        <div class="bottom-controls flex items-center gap-2">
            <button class="btn-plain w-7 h-7 rounded-lg" on:click={toggleMute}>
                {#if isMuted || volume === 0}
                    <Icon icon="material-symbols:volume-off" class="text-sm" />
                {:else if volume < 0.5}
                    <Icon icon="material-symbols:volume-down" class="text-sm" />
                {:else}
                    <Icon icon="material-symbols:volume-up" class="text-sm" />
                {/if}
            </button>
            <div class="flex-1 h-1.5 bg-[var(--btn-regular-bg)] rounded-full cursor-pointer touch-none"
                 bind:this={volumeBar}
                 on:pointerdown={startVolumeDrag}
                 role="slider"
                 tabindex="0"
                 aria-label={i18n(Key.musicPlayerVolume)}>
                <div class="h-full bg-[var(--primary)] rounded-full transition-all"
                     class:duration-100={!isVolumeDragging}
                     class:duration-0={isVolumeDragging}
                     style="width: {volume * 100}%"></div>
            </div>
        </div>
    </div>

    <!-- 播放列表 -->
    {#if showPlaylist}
        <div class="playlist-panel mt-2 max-h-48 overflow-hidden rounded-lg">
            <div class="playlist-header flex items-center justify-between p-2 border-b border-[var(--line-divider)]">
                <h3 class="text-xs font-semibold text-90">{i18n(Key.musicPlayerPlaylist)}</h3>
                <button class="btn-plain w-6 h-6 rounded-lg" on:click={togglePlaylist}>
                    <Icon icon="material-symbols:close" class="text-sm" />
                </button>
            </div>
            <div class="playlist-content overflow-y-auto max-h-40 hide-scrollbar">
                {#each playlist as song, index}
                    <div class="playlist-item flex items-center gap-2 p-2 hover:bg-[var(--btn-plain-bg-hover)] cursor-pointer transition-colors"
                         class:bg-[var(--btn-plain-bg)]={index === currentIndex}
                         class:text-[var(--primary)]={index === currentIndex}
                         on:click={() => playSong(index)}
                         role="button"
                         tabindex="0"
                         aria-label="播放 {song.title} - {song.artist}">
                        <div class="w-5 h-5 flex items-center justify-center">
                            {#if index === currentIndex && isPlaying}
                                <Icon icon="material-symbols:graphic-eq" class="text-[var(--primary)] animate-pulse text-xs" />
                            {:else if index === currentIndex}
                                <Icon icon="material-symbols:pause" class="text-[var(--primary)] text-xs" />
                            {:else}
                                <span class="text-xs text-[var(--content-meta)]">{index + 1}</span>
                            {/if}
                        </div>
                        <div class="w-8 h-8 rounded overflow-hidden bg-[var(--btn-regular-bg)] shrink-0">
                            <img src={getAssetPath(song.cover)} alt={song.title} loading="lazy" class="w-full h-full object-cover" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-medium truncate" class:text-[var(--primary)]={index === currentIndex} class:text-[var(--content-text)]={index !== currentIndex}>
                                {song.title}
                            </div>
                            <div class="text-xs text-[var(--content-meta)] truncate" class:text-[var(--primary)]={index === currentIndex}>
                                {song.artist}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
.sidebar-music-player-wrapper {
    width: 100%;
    user-select: none;
}

.mini-player {
    width: 100%;
}

.expanded-player {
    width: 100%;
}

.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

.progress-section div:hover,
.bottom-controls > div:hover {
    transform: scaleY(1.2);
    transition: transform 0.2s ease;
}

.playlist-panel {
    background: var(--float-panel-bg);
    border: 1px solid var(--line-divider);
}

.hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.hide-scrollbar::-webkit-scrollbar {
    display: none;
}

@keyframes spin-continuous {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.cover-container img {
    animation: spin-continuous 3s linear infinite;
    animation-play-state: paused;
}

.cover-container img.spinning {
    animation-play-state: running;
}

button.bg-\[var\(--primary\)\] {
    box-shadow: 0 0 0 2px var(--primary);
    border: none;
}

.hidden {
    display: none;
}
</style>
{/if}
