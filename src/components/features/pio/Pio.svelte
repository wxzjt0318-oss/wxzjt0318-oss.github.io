<script lang="ts">
import Key from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { ComponentType } from "svelte";
import { onDestroy, onMount } from "svelte";
import { pioConfig } from "@/config/pioConfig";
import type { PioProps } from "./types";

export let config: PioProps["config"] = {};
const options = { ...pioConfig, ...config };
const modelAsset = options.models?.[0] ?? "";
const protectedModel =
	options.models?.[0]?.split("?")[0].endsWith(".bin") ?? false;
let Legacy: ComponentType | null = null;
let canvas: HTMLCanvasElement;
let host: HTMLDivElement;
let text = "";
let state: "loading" | "ready" | "error" = "loading";
let visible = true;
let offset = { x: 0, y: 0 };
let runtime:
	| Awaited<ReturnType<typeof import("./seria-runtime").mountSeria>>
	| undefined;
const lifetime = new AbortController();
let drag: { x: number; y: number; ox: number; oy: number } | null = null;

onMount(() => {
	if (
		!options.enable ||
		(options.hiddenOnMobile && matchMedia("(max-width: 1280px)").matches)
	)
		return;
	if (!protectedModel) {
		void import("./LegacyPio.svelte").then((module) => {
			if (!lifetime.signal.aborted) Legacy = module.default;
		});
		return;
	}
	void import("./seria-runtime")
		.then(({ mountSeria }) =>
			mountSeria(
				canvas,
				{
					asset: modelAsset,
					width: options.width ?? 280,
					height: options.height ?? 420,
					onText: (message) => {
						text = message;
					},
				},
				lifetime.signal,
			),
		)
		.then((instance) => {
			if (lifetime.signal.aborted) {
				instance.destroy();
				return;
			}
			runtime = instance;
			state = "ready";
		})
		.catch((error) => {
			if (lifetime.signal.aborted) return;
			state = "error";
			console.warn("Seria could not initialize", error);
		});
});
onDestroy(() => {
	lifetime.abort();
	runtime?.destroy();
});
function toggle() {
	visible = !visible;
	runtime?.setVisible(visible);
}
function dragStart(event: PointerEvent) {
	if (event.button !== 0) return;
	drag = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
	(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
}
function dragMove(event: PointerEvent) {
	if (!drag) return;
	const rect = host.getBoundingClientRect();
	const dx = Math.max(
		-rect.left,
		Math.min(
			innerWidth - rect.right,
			event.clientX - drag.x - (offset.x - drag.ox),
		),
	);
	const dy = Math.max(
		-rect.top,
		Math.min(
			innerHeight - rect.bottom,
			event.clientY - drag.y - (offset.y - drag.oy),
		),
	);
	offset = { x: offset.x + dx, y: offset.y + dy };
}
</script>

{#if options.enable && protectedModel}
	<div bind:this={host} class={`seria-widget ${options.position ?? "left"} ${options.hiddenOnMobile ? "seria-mobile-hidden" : ""}`} data-seria-state={state} data-seria-owner="wxzjt0318-oss" style={`--seria-width:${options.width ?? 280}px;--seria-height:${options.height ?? 420}px;transform:translate(${offset.x}px,${offset.y}px)`}>
		<div class="seria-stage" hidden={!visible || state === "error"}>
			{#if text}<div class="seria-bubble" role="status" aria-live="polite">{text}</div>{/if}
			<canvas id="seria-canvas" bind:this={canvas} width={options.width ?? 280} height={options.height ?? 420} aria-hidden="true"></canvas>
		</div>
		<div class="seria-controls">
			<button type="button" on:click={toggle} aria-label={i18n(visible ? Key.live2dHide : Key.live2dShow)} title={i18n(visible ? Key.live2dHide : Key.live2dShow)}>{visible ? "×" : "◌"}</button>
			{#if visible}
				<button type="button" disabled={state !== "ready"} on:click={() => runtime?.intro()} aria-label={i18n(Key.live2dInteract)} title={i18n(state === "error" ? Key.live2dUnavailable : Key.live2dInteract)}>♫</button>
				{#if options.mode === "draggable"}<button type="button" class="seria-drag" on:pointerdown={dragStart} on:pointermove={dragMove} on:pointerup={() => { drag = null; }} on:pointercancel={() => { drag = null; }} aria-label={i18n(Key.live2dDrag)} title={i18n(Key.live2dDrag)}>⠿</button>{/if}
			{/if}
		</div>
	</div>
{:else if options.enable && Legacy}
	<svelte:component this={Legacy} {config} />
{/if}
