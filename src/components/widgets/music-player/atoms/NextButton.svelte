<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		onclick: () => void;
		disabled?: boolean;
	}

	const { onclick, disabled = false }: Props = $props();
</script>

<button
	class="w-10 h-10 rounded-lg transition active:scale-95 flex items-center justify-center hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]"
	{onclick}
	{disabled}
>
	<Icon icon="material-symbols:skip-next" class="text-xl" />
</button>
