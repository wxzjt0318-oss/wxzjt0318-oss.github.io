<script lang="ts">
import Icon from "@iconify/svelte";
import { onDestroy,onMount } from "svelte";

import { musicPlayerConfig } from "../../config";
import Key from "../../i18n/i18nKey";
import { i18n } from "../../i18n/translation";
import {
	formatTime,
	musicPlayerStore,
	type Song,
} from "../../stores/musicPlayerStore";

$: isPlaying = $musicPlayerStore.isPlaying;
$: isLoading = $musicPlayerStore.isLoading;
$: currentTime = $musicPlayerStore.currentTime;
$: duration = $musicPlayerStore.duration;
$: volume = $musicPlayerStore.volume;
$: isMuted = $musicPlayerStore.isMuted;
$: isShuffled = $musicPlayerStore.isShuffled;
$: isRepeating = $musicPlayerStore.isRepeating;
$: currentSong = $musicPlayerStore.currentSong;
$: playlist = $musicPlayerStore.playlist;
$: currentIndex = $musicPlayerStore.currentIndex;
$: showError = $musicPlayerStore.showError;
$: errorMessage = $musicPlayerStore.errorMessage;

let showPlaylist = false;
let progressBar: HTMLElement;
let volumeBar: HTMLElement;
let isVolumeDragging = false;
let isPointerDown = false;
let volumeBarRect: DOMRect | null = null;
let rafId: number | null = null;

function togglePlay() {
	musicPlayerStore.togglePlay();
}

function previousSong() {
	musicPlayerStore.previousSong();
}

function nextSong() {
	musicPlayerStore.nextSong();
}

function toggleShuffle() {
	musicPlayerStore.toggleShuffle();
}

function toggleRepeat() {
	musicPlayerStore.toggleRepeat();
}

function toggleMute() {
	musicPlayerStore.toggleMute();
}

function togglePlaylist() {
	showPlaylist = !showPlaylist;
}

function playSong(index: number) {
	musicPlayerStore.playSong(index);
}

function setProgress(event: MouseEvent) {
	if (!progressBar) {return;}
	const rect = progressBar.getBoundingClientRect();
	const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
	musicPlayerStore.setProgress(percent);
}

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
}

function updateVolumeLogic(clientX: number) {
	if (!volumeBar) {return;}
	const rect = volumeBarRect || volumeBar.getBoundingClientRect();
	const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
	musicPlayerStore.setVolume(percent);
}

function hideError() {
	$musicPlayerStore.showError = false;
}

onMount(() => {
	if (musicPlayerConfig.enable && !$musicPlayerStore.isInitialized) {
		musicPlayerStore.init();
	}
});
</script>

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

<div class="sidebar-music-player card-base bg-[var(--card-bg)] rounded-xl p-3 shadow-sm">
    <div class="flex items-center gap-3 mb-3">
        <div class="cover-container relative w-10 h-10 rounded-full overflow-hidden shrink-0 cursor-pointer"
             on:click={togglePlay}
             role="button"
             tabindex="0"
             aria-label={isPlaying ? i18n(Key.musicPlayerPause) : i18n(Key.musicPlayerPlay)}>
            <img src={musicPlayerStore.getAssetPath(currentSong.cover)} 
                 alt={i18n(Key.musicPlayerCover)}
                 class="w-full h-full object-cover transition-transform duration-300"
                 class:spinning={isPlaying && !isLoading}
                 class:animate-pulse={isLoading} />
            <div class="absolute inset-0 bg-black/[20%] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                {#if isLoading}
                    <Icon icon="eos-icons:loading" class="text-white text-sm" />
                {:else if isPlaying}
                    <Icon icon="material-symbols:pause" class="text-white text-sm" />
                {:else}
                    <Icon icon="material-symbols:play-arrow" class="text-white text-sm" />
                {/if}
            </div>
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-90 truncate">{currentSong.title}</div>
            <div class="text-[10px] text-50 truncate">{currentSong.artist}</div>
        </div>
        <button class="btn-plain w-6 h-6 rounded flex items-center justify-center"
                class:text-[var(--primary)]={showPlaylist}
                on:click={togglePlaylist}
                title={i18n(Key.musicPlayerPlaylist)}>
            <Icon icon="material-symbols:queue-music" class="text-sm" />
        </button>
    </div>

    <div class="progress-section mb-2">
        <div class="progress-bar flex-1 h-1 bg-[var(--btn-regular-bg)] rounded-full cursor-pointer"
             bind:this={progressBar}
             on:click={setProgress}
             role="slider"
             tabindex="0"
             aria-label={i18n(Key.musicPlayerProgress)}>
            <div class="h-full bg-[var(--primary)] rounded-full transition-all duration-100"
                 style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"></div>
        </div>
        <div class="flex justify-between text-[10px] text-30 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
        </div>
    </div>

    <div class="controls flex items-center justify-center gap-1 mb-2">
        <button class="w-7 h-7 rounded flex items-center justify-center"
                class:btn-regular={isShuffled}
                class:btn-plain={!isShuffled}
                on:click={toggleShuffle}
                disabled={playlist.length <= 1}>
            <Icon icon="material-symbols:shuffle" class="text-sm" />
        </button>
        <button class="btn-plain w-7 h-7 rounded flex items-center justify-center" 
                on:click={previousSong}
                disabled={playlist.length <= 1}>
            <Icon icon="material-symbols:skip-previous" class="text-base" />
        </button>
        <button class="btn-regular w-8 h-8 rounded-full"
                class:opacity-50={isLoading}
                disabled={isLoading}
                on:click={togglePlay}>
            {#if isLoading}
                <Icon icon="eos-icons:loading" class="text-sm" />
            {:else if isPlaying}
                <Icon icon="material-symbols:pause" class="text-sm" />
            {:else}
                <Icon icon="material-symbols:play-arrow" class="text-sm" />
            {/if}
        </button>
        <button class="btn-plain w-7 h-7 rounded flex items-center justify-center" 
                on:click={() => nextSong()}
                disabled={playlist.length <= 1}>
            <Icon icon="material-symbols:skip-next" class="text-base" />
        </button>
        <button class="w-7 h-7 rounded flex items-center justify-center"
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

    <div class="volume-section flex items-center gap-2">
        <button class="btn-plain w-6 h-6 rounded flex items-center justify-center" on:click={toggleMute}>
            {#if isMuted || volume === 0}
                <Icon icon="material-symbols:volume-off" class="text-sm" />
            {:else if volume < 0.5}
                <Icon icon="material-symbols:volume-down" class="text-sm" />
            {:else}
                <Icon icon="material-symbols:volume-up" class="text-sm" />
            {/if}
        </button>
        <div class="flex-1 h-1 bg-[var(--btn-regular-bg)] rounded-full cursor-pointer touch-none"
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

    {#if showPlaylist}
        <div class="playlist-dropdown mt-3 border-t border-[var(--line-divider)] pt-3">
            <div class="max-h-40 overflow-y-auto custom-scrollbar">
                {#each playlist as song, index}
                    <div class="playlist-item flex items-center gap-2 p-2 hover:bg-[var(--btn-plain-bg-hover)] cursor-pointer transition-colors rounded"
                         class:bg-[var(--btn-plain-bg)]={index === currentIndex}
                         class:text-[var(--primary)]={index === currentIndex}
                         on:click={() => playSong(index)}
                         role="button"
                         tabindex="0">
                        <div class="w-4 h-4 flex items-center justify-center">
                            {#if index === currentIndex && isPlaying}
                                <Icon icon="material-symbols:graphic-eq" class="text-[var(--primary)] animate-pulse text-xs" />
                            {:else if index === currentIndex}
                                <Icon icon="material-symbols:pause" class="text-[var(--primary)] text-xs" />
                            {:else}
                                <span class="text-[10px] text-[var(--content-meta)]">{index + 1}</span>
                            {/if}
                        </div>
                        <div class="w-8 h-8 rounded overflow-hidden bg-[var(--btn-regular-bg)] shrink-0">
                            <img src={musicPlayerStore.getAssetPath(song.cover)} 
                                 alt={song.title} 
                                 loading="lazy" 
                                 class="w-full h-full object-cover" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-medium truncate"
                                 class:text-[var(--primary)]={index === currentIndex}>
                                {song.title}
                            </div>
                            <div class="text-[10px] text-[var(--content-meta)] truncate">
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
.sidebar-music-player {
    user-select: none;
}

.cover-container img {
    animation: spin-continuous 3s linear infinite;
    animation-play-state: paused;
}

.cover-container img.spinning {
    animation-play-state: running;
}

@keyframes spin-continuous {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.progress-section div:hover,
.volume-section > div:nth-child(2):hover {
    transform: scaleY(1.3);
    transition: transform 0.2s ease;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.8);
}

.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
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
</style>
{/if}
