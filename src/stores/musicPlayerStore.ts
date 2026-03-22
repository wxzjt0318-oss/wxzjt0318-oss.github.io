import { derived, get,writable } from "svelte/store";

export type Song = {
	id: number;
	title: string;
	artist: string;
	cover: string;
	url: string;
	duration: number;
};

export type PlayerState = {
	isPlaying: boolean;
	isLoading: boolean;
	currentSong: Song;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	isShuffled: boolean;
	isRepeating: number;
	playlist: Song[];
	currentIndex: number;
	showPlaylist: boolean;
	errorMessage: string;
	showError: boolean;
};

const defaultSong: Song = {
	id: 0,
	title: "Sample Song",
	artist: "Sample Artist",
	cover: "/favicon/favicon.ico",
	url: "",
	duration: 0,
};

const initialState: PlayerState = {
	isPlaying: false,
	isLoading: false,
	currentSong: defaultSong,
	currentTime: 0,
	duration: 0,
	volume: 0.7,
	isMuted: false,
	isShuffled: false,
	isRepeating: 0,
	playlist: [],
	currentIndex: 0,
	showPlaylist: false,
	errorMessage: "",
	showError: false,
};

function createMusicPlayerStore() {
	const { subscribe, set, update } = writable<PlayerState>(initialState);

	return {
		subscribe,
		set,
		update,
		init: (playlist: Song[]) => {
			update((state) => ({
				...state,
				playlist,
				currentSong: playlist[0] || defaultSong,
			}));
		},
		play: () => update((state) => ({ ...state, isPlaying: true })),
		pause: () => update((state) => ({ ...state, isPlaying: false })),
		togglePlay: () =>
			update((state) => ({ ...state, isPlaying: !state.isPlaying })),
		setLoading: (loading: boolean) =>
			update((state) => ({ ...state, isLoading: loading })),
		setCurrentSong: (song: Song, index: number) =>
			update((state) => ({ ...state, currentSong: song, currentIndex: index })),
		setCurrentTime: (time: number) =>
			update((state) => ({ ...state, currentTime: time })),
		setDuration: (duration: number) =>
			update((state) => ({ ...state, duration })),
		setVolume: (volume: number) =>
			update((state) => ({ ...state, volume })),
		toggleMute: () =>
			update((state) => ({ ...state, isMuted: !state.isMuted })),
		setMuted: (muted: boolean) =>
			update((state) => ({ ...state, isMuted: muted })),
		toggleShuffle: () =>
			update((state) => ({ ...state, isShuffled: !state.isShuffled, isRepeating: 0 })),
		toggleRepeat: () =>
			update((state) => ({
				...state,
				isRepeating: (state.isRepeating + 1) % 3,
				isShuffled: false,
			})),
		nextSong: () =>
			update((state) => {
				if (state.playlist.length <= 1) {return state;}
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
				return {
					...state,
					currentIndex: newIndex,
					currentSong: state.playlist[newIndex],
					isLoading: true,
				};
			}),
		previousSong: () =>
			update((state) => {
				if (state.playlist.length <= 1) {return state;}
				const newIndex =
					state.currentIndex > 0
						? state.currentIndex - 1
						: state.playlist.length - 1;
				return {
					...state,
					currentIndex: newIndex,
					currentSong: state.playlist[newIndex],
					isLoading: true,
				};
			}),
		playSong: (index: number) =>
			update((state) => {
				if (index < 0 || index >= state.playlist.length) {return state;}
				return {
					...state,
					currentIndex: index,
					currentSong: state.playlist[index],
					isLoading: true,
					isPlaying: true,
				};
			}),
		togglePlaylist: () =>
			update((state) => ({ ...state, showPlaylist: !state.showPlaylist })),
		showError: (message: string) =>
			update((state) => ({
				...state,
				errorMessage: message,
				showError: true,
			})),
		hideError: () => update((state) => ({ ...state, showError: false })),
		reset: () => set(initialState),
	};
}

export const musicPlayerStore = createMusicPlayerStore();

export const formattedCurrentTime = derived(musicPlayerStore, ($state) => {
	const mins = Math.floor($state.currentTime / 60);
	const secs = Math.floor($state.currentTime % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
});

export const formattedDuration = derived(musicPlayerStore, ($state) => {
	const mins = Math.floor($state.duration / 60);
	const secs = Math.floor($state.duration % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
});

export const progressPercent = derived(musicPlayerStore, ($state) => {
	if ($state.duration <= 0) {return 0;}
	return ($state.currentTime / $state.duration) * 100;
});

export const volumePercent = derived(musicPlayerStore, ($state) => {
	return $state.volume * 100;
});

export function getStoreState(): PlayerState {
	return get(musicPlayerStore);
}
