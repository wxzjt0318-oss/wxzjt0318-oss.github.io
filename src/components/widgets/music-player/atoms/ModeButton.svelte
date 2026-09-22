<script lang="ts">
import Icon from "@iconify/svelte";

import type { RepeatMode } from "../types";

interface Props {
	mode: "shuffle" | "repeat";
	isActive: boolean;
	repeatMode?: RepeatMode;
	onclick: () => void;
	disabled?: boolean;
}

const {
	mode,
	isActive,
	repeatMode = 0,
	onclick,
	disabled = false,
}: Props = $props();

// legacy 的 btn-plain / btn-regular 主题类在上游不存在，改用等价的表面容器变量
const idleClasses =
	"w-10 h-10 rounded-lg transition active:scale-95 flex items-center justify-center hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]";
const activeClasses =
	"w-10 h-10 rounded-lg transition active:scale-95 flex items-center justify-center bg-[var(--btn-regular-bg)] hover:bg-[var(--btn-regular-bg-hover)] active:bg-[var(--btn-regular-bg-active)] text-[var(--primary)]";
</script>

{#if mode === "shuffle"}
	<button
		class={isActive ? activeClasses : idleClasses}
		{onclick}
		{disabled}
	>
		<Icon icon="material-symbols:shuffle" class="text-lg" />
	</button>
{:else}
	<button class={isActive ? activeClasses : idleClasses} {onclick}>
		{#if repeatMode === 1}
			<Icon icon="material-symbols:repeat-one" class="text-lg" />
		{:else if repeatMode === 2}
			<Icon icon="material-symbols:repeat" class="text-lg" />
		{:else}
			<Icon icon="material-symbols:repeat" class="text-lg opacity-50" />
		{/if}
	</button>
{/if}
