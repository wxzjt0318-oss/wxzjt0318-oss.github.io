import type { Readable } from "svelte/store";
import { derived, get,writable } from "svelte/store";

import { musicPlayerConfig } from "../config";
import Key from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";

export type Song = {
	id: number;
	title: string;
	artist: string;
	cover: string;
	url: string;
	duration: number;
};

export type RepeatMode = 0 | 1 | 2;

export type MusicPlayerState = {
	isPlaying: boolean;
	isLoading: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	isShuffled: boolean;
	isRepeating: RepeatMode;
	currentSong: Song;
	playlist: Song[];
	currentIndex: number;
	errorMessage: string;
	showError: boolean;
	isInitialized: boolean;
};

const STORAGE_KEY_VOLUME = "music-player-volume";

const defaultSong: Song = {
	id: 0,
	title: "Sample Song",
	artist: "Sample Artist",
	cover: "/favicon/favicon.ico",
	url: "",
	duration: 0,
};

const initialState: MusicPlayerState = {
	isPlaying: false,
	isLoading: false,
	currentTime: 0,
	duration: 0,
	volume: 0.7,
	isMuted: false,
	isShuffled: false,
	isRepeating: 0,
	currentSong: defaultSong,
	playlist: [],
	currentIndex: 0,
	errorMessage: "",
	showError: false,
	isInitialized: false,
};

function createMusicPlayerStore() {
	const { subscribe, set, update } = writable<MusicPlayerState>(initialState);

	let audio: HTMLAudioElement | null = null;
	let willAutoPlay = false;
	let autoplayFailed = false;

	const mode = musicPlayerConfig.mode ?? "meting";
	const meting_api =
		musicPlayerConfig.meting_api ??
		"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
	const meting_id = musicPlayerConfig.id ?? "14164869977";
	const meting_server = musicPlayerConfig.server ?? "netease";
	const meting_type = musicPlayerConfig.type ?? "playlist";

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

	function loadVolumeSettings() {
		try {
			if (typeof localStorage !== "undefined") {
				const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
				if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
					update((s) => ({ ...s, volume: parseFloat(savedVolume) }));
				}
			}
		} catch (e) {
			console.warn("Failed to load volume settings from localStorage:", e);
		}
	}

	function saveVolumeSettings(volume: number) {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
			}
		} catch (e) {
			console.warn("Failed to save volume settings to localStorage:", e);
		}
	}

	function getAssetPath(path: string): string {
		if (path.startsWith("http://") || path.startsWith("https://")) {return path;}
		if (path.startsWith("/")) {return path;}
		return `/${path}`;
	}

	function showErrorMessage(message: string) {
		update((s) => ({ ...s, errorMessage: message, showError: true }));
		setTimeout(() => {
			update((s) => ({ ...s, showError: false }));
		}, 3000);
	}

	async function fetchMetingPlaylist() {
		if (!meting_api || !meting_id) {return;}
		update((s) => ({ ...s, isLoading: true }));
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
			update((s) => ({ ...s, playlist, isLoading: false }));
			if (playlist.length > 0) {
				loadSong(playlist[0]);
			}
		} catch (e) {
			showErrorMessage(i18n(Key.musicPlayerErrorPlaylist));
			update((s) => ({ ...s, isLoading: false }));
		}
	}

	function loadSong(song: Song) {
		update((s) => {
			if (song.url !== s.currentSong.url) {
				if (audio && song.url) {
					audio.src = getAssetPath(song.url);
					audio.load();
				}
				return {
					...s,
					currentSong: { ...song },
					isLoading: !!song.url,
					currentTime: 0,
					duration: song.duration || 0,
				};
			}
			return s;
		});
	}

	function playSong(index: number, autoPlay = true) {
		update((s) => {
			if (index < 0 || index >= s.playlist.length) {return s;}
			willAutoPlay = autoPlay;
			const song = s.playlist[index];
			loadSong(song);
			return { ...s, currentIndex: index };
		});
	}

	function togglePlay() {
		const state = get({ subscribe });
		if (!audio || !state.currentSong.url) {return;}
		if (state.isPlaying) {
			audio.pause();
		} else {
			audio.play().catch(() => {});
		}
	}

	function previousSong() {
		const state = get({ subscribe });
		if (state.playlist.length <= 1) {return;}
		const newIndex =
			state.currentIndex > 0
				? state.currentIndex - 1
				: state.playlist.length - 1;
		playSong(newIndex);
	}

	function nextSong(autoPlay: boolean = true) {
		const state = get({ subscribe });
		if (state.playlist.length <= 1) {return;}

		let newIndex: number;
		if (state.isShuffled) {
			do {
				newIndex = Math.floor(Math.random() * state.playlist.length);
			} while (newIndex === state.currentIndex && state.playlist.length > 1);
		} else {
			newIndex =
				state.currentIndex < state.playlist.length - 1
					? state.currentIndex + 1
					: 0;
		}
		playSong(newIndex, autoPlay);
	}

	function toggleShuffle() {
		update((s) => {
			const newShuffled = !s.isShuffled;
			return { ...s, isShuffled: newShuffled, isRepeating: newShuffled ? 0 : s.isRepeating };
		});
	}

	function toggleRepeat() {
		update((s) => {
			const newRepeating = ((s.isRepeating + 1) % 3) as RepeatMode;
			return { ...s, isRepeating: newRepeating, isShuffled: newRepeating !== 0 ? false : s.isShuffled };
		});
	}

	function toggleMute() {
		update((s) => ({ ...s, isMuted: !s.isMuted }));
	}

	function setVolume(newVolume: number) {
		update((s) => ({ ...s, volume: newVolume }));
		saveVolumeSettings(newVolume);
	}

	function setProgress(percent: number) {
		if (!audio) {return;}
		const state = get({ subscribe });
		const newTime = percent * state.duration;
		audio.currentTime = newTime;
		update((s) => ({ ...s, currentTime: newTime }));
	}

	function handleLoadSuccess() {
		update((s) => ({ ...s, isLoading: false }));
		if (audio?.duration && audio.duration > 1) {
			const dur = Math.floor(audio.duration);
			update((s) => {
				const newPlaylist = [...s.playlist];
				if (newPlaylist[s.currentIndex]) {
					newPlaylist[s.currentIndex] = {
						...newPlaylist[s.currentIndex],
						duration: dur,
					};
				}
				return {
					...s,
					duration: dur,
					currentSong: { ...s.currentSong, duration: dur },
					playlist: newPlaylist,
				};
			});
		}

		const state = get({ subscribe });
		if (willAutoPlay || state.isPlaying) {
			const playPromise = audio?.play();
			if (playPromise !== undefined) {
				playPromise.catch((error) => {
					console.warn("自动播放被拦截，等待用户交互:", error);
					autoplayFailed = true;
					update((s) => ({ ...s, isPlaying: false }));
				});
			}
		}
	}

	function handleLoadError() {
		const state = get({ subscribe });
		if (!state.currentSong.url) {return;}
		update((s) => ({ ...s, isLoading: false }));
		showErrorMessage(i18n(Key.musicPlayerErrorSong));

		const shouldContinue = state.isPlaying || willAutoPlay;
		if (state.playlist.length > 1) {
			setTimeout(() => nextSong(shouldContinue), 1000);
		} else {
			showErrorMessage(i18n(Key.musicPlayerErrorEmpty));
		}
	}

	function handleAudioEnded() {
		const state = get({ subscribe });
		if (state.isRepeating === 1) {
			if (audio) {
				audio.currentTime = 0;
				audio.play().catch(() => {});
			}
		} else if (state.isRepeating === 2 || state.isShuffled) {
			nextSong(true);
		} else {
			update((s) => ({ ...s, isPlaying: false }));
		}
	}

	function handleUserInteraction() {
		if (autoplayFailed && audio) {
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						autoplayFailed = false;
					})
					.catch(() => {});
			}
		}
	}

	function initAudio() {
		if (audio) {return;}

		audio = new Audio();
		audio.preload = "auto";

		audio.addEventListener("play", () => {
			update((s) => ({ ...s, isPlaying: true }));
		});
		audio.addEventListener("pause", () => {
			update((s) => ({ ...s, isPlaying: false }));
		});
		audio.addEventListener("timeupdate", () => {
			if (audio) {
				update((s) => ({ ...s, currentTime: audio.currentTime }));
			}
		});
		audio.addEventListener("ended", handleAudioEnded);
		audio.addEventListener("error", handleLoadError);
		audio.addEventListener("loadeddata", handleLoadSuccess);
		audio.addEventListener("loadstart", () => {});

		const state = get({ subscribe });
		audio.volume = state.volume;
		audio.muted = state.isMuted;
	}

	function init() {
		if (!musicPlayerConfig.enable) {return;}

		loadVolumeSettings();
		initAudio();

		const state = get({ subscribe });
		audio!.volume = state.volume;
		audio!.muted = state.isMuted;

		if (mode === "meting") {
			fetchMetingPlaylist();
		} else {
			update((s) => ({ ...s, playlist: [...localPlaylist] }));
			if (localPlaylist.length > 0) {
				loadSong(localPlaylist[0]);
			} else {
				showErrorMessage("本地播放列表为空");
			}
		}

		update((s) => ({ ...s, isInitialized: true }));

		const interactionEvents = ["click", "keydown", "touchstart"];
		interactionEvents.forEach((event) => {
			document.addEventListener(event, handleUserInteraction, {
				capture: true,
			});
		});
	}

	function syncAudioState() {
		if (!audio) {return;}
		const state = get({ subscribe });
		audio.volume = state.volume;
		audio.muted = state.isMuted;
	}

	function destroy() {
		if (audio) {
			audio.pause();
			audio.src = "";
			audio = null;
		}
	}

	return {
		subscribe,
		init,
		destroy,
		togglePlay,
		previousSong,
		nextSong,
		playSong,
		toggleShuffle,
		toggleRepeat,
		toggleMute,
		setVolume,
		setProgress,
		syncAudioState,
		showErrorMessage,
		getAssetPath,
		getAudio: () => audio,
	};
}

export const musicPlayerStore = createMusicPlayerStore();

export const isPlaying: Readable<boolean> = derived(
	musicPlayerStore,
	($store) => $store.isPlaying
);
export const currentSong: Readable<Song> = derived(
	musicPlayerStore,
	($store) => $store.currentSong
);
export const playlist: Readable<Song[]> = derived(
	musicPlayerStore,
	($store) => $store.playlist
);
export const currentIndex: Readable<number> = derived(
	musicPlayerStore,
	($store) => $store.currentIndex
);

export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {return "0:00";}
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
