<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		isPlaying: boolean;
		isLoading: boolean;
		onclick: () => void;
	}

	const { isPlaying, isLoading, onclick }: Props = $props();
</script>

<button
	class="w-12 h-12 rounded-full transition active:scale-95 flex items-center justify-center bg-[var(--btn-regular-bg)] hover:bg-[var(--btn-regular-bg-hover)] active:bg-[var(--btn-regular-bg-active)]"
	class:opacity-50={isLoading}
	disabled={isLoading}
	{onclick}
>
	{#if isLoading}
		<Icon icon="eos-icons:loading" class="text-xl" />
	{:else if isPlaying}
		<Icon icon="material-symbols:pause" class="text-xl" />
	{:else}
		<Icon icon="material-symbols:play-arrow" class="text-xl" />
	{/if}
</button>
