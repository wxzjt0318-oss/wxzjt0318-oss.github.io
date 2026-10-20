<script lang="ts">
/**
 * 照片墙：相册图片的瀑布流墙。
 * - 方向筛选（全部 / 横图 / 竖图 / 方图，SegmentedButton）；
 * - 列数切换 3–6（SegmentedButton），偏好存 localStorage `shirone:photo-wall-columns`；
 * - 随机一张：在当前筛选结果里抽一张，直接在灯箱中打开；
 * - 点击任意一张：以当前筛选结果为图集打开灯箱，可左右翻页；
 * - 缩略图懒加载，原图只在灯箱中加载。
 * 横竖判定与随机图入口共用 `photoOrientation()`（宽高比 ≥1.2 横、≤0.9 竖）。
 */
import Button from "@components/atoms/action/Button.svelte";
import SegmentedButton from "@components/atoms/selection/SegmentedButton.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { openFancyboxGallery } from "@utils/fancybox-handler";
import type { PhotoWallItem } from "@utils/photo-wall";
import { url } from "@utils/url-utils";
import { onMount } from "svelte";

let {
	photos = [] as PhotoWallItem[],
	randomHref = "",
}: {
	photos?: PhotoWallItem[];
	/** 静态随机图入口（/wall/<id>/random/），为空则不显示链接 */
	randomHref?: string;
} = $props();

const COLUMNS_KEY = "shirone:photo-wall-columns";
const COLUMN_CHOICES = ["3", "4", "5", "6"];

let filter = $state("all");
let columns = $state("4");

const counts = $derived({
	all: photos.length,
	landscape: photos.filter((p) => p.orientation === "landscape").length,
	portrait: photos.filter((p) => p.orientation === "portrait").length,
	square: photos.filter((p) => p.orientation === "square").length,
});

const filterOptions = $derived(
	[
		{ value: "all", label: i18n(I18nKey.photoWallAll), count: counts.all },
		{
			value: "landscape",
			label: i18n(I18nKey.photoWallLandscape),
			count: counts.landscape,
		},
		{
			value: "portrait",
			label: i18n(I18nKey.photoWallPortrait),
			count: counts.portrait,
		},
		{
			value: "square",
			label: i18n(I18nKey.photoWallSquare),
			count: counts.square,
		},
	]
		.filter((o) => o.value === "all" || o.count > 0)
		.map((o) => ({ value: o.value, label: `${o.label} ${o.count}` })),
);

const columnOptions = COLUMN_CHOICES.map((value) => ({ value, label: value }));

const visible = $derived(
	filter === "all" ? photos : photos.filter((p) => p.orientation === filter),
);

onMount(() => {
	try {
		const stored = localStorage.getItem(COLUMNS_KEY);
		if (stored && COLUMN_CHOICES.includes(stored)) columns = stored;
	} catch {
		/* Ignore local storage access failure */
	}
});

$effect(() => {
	const value = columns;
	try {
		localStorage.setItem(COLUMNS_KEY, value);
	} catch {
		/* Ignore local storage access failure */
	}
});

function open(index: number) {
	void openFancyboxGallery(
		visible.map((photo) => ({ src: url(photo.src), caption: photo.alt })),
		index,
	);
}

function openRandom() {
	if (visible.length === 0) return;
	open(Math.floor(Math.random() * visible.length));
}

function ratio(photo: PhotoWallItem): string {
	return photo.width && photo.height ? `${photo.width} / ${photo.height}` : "1";
}
</script>

<section class="photo-wall" style={`--wall-columns: ${columns}`}>
	<div class="photo-wall__toolbar">
		<div class="photo-wall__filters">
			<SegmentedButton
				options={filterOptions}
				bind:value={filter}
				label={i18n(I18nKey.photoWallFilter)}
			/>
		</div>
		<div class="photo-wall__actions">
			<span class="photo-wall__columns-label">{i18n(I18nKey.photoWallColumns)}</span>
			<SegmentedButton
				options={columnOptions}
				bind:value={columns}
				label={i18n(I18nKey.photoWallColumns)}
			/>
			<Button
				variant="tonal"
				icon="material-symbols:shuffle-rounded"
				label={i18n(I18nKey.photoWallRandom)}
				disabled={visible.length === 0}
				onclick={openRandom}
			/>
			{#if randomHref}
				<Button
					variant="text"
					icon="material-symbols:link-rounded"
					label={i18n(I18nKey.photoWallRandomLink)}
					href={randomHref}
					target="_blank"
					rel="noopener"
				/>
			{/if}
		</div>
	</div>

	<p class="photo-wall__count">
		{i18n(I18nKey.photoWallCount).replace("{count}", String(visible.length))}
	</p>

	{#if visible.length > 0}
		<div class="photo-wall__grid" role="group" aria-label={i18n(I18nKey.imageViewer)}>
			{#each visible as photo, index (photo.id)}
				<button
					type="button"
					class="photo-wall__item"
					aria-label={`${i18n(I18nKey.openImage)} ${index + 1}: ${photo.alt}`}
					onclick={() => open(index)}
				>
					<img
						src={url(photo.thumbnail)}
						alt={photo.alt}
						width={photo.width}
						height={photo.height}
						style={`aspect-ratio: ${ratio(photo)}`}
						loading="lazy"
						decoding="async"
					/>
				</button>
			{/each}
		</div>
	{:else}
		<div class="photo-wall__empty">
			<Icon icon="material-symbols:photo-library-outline-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.noData)}</span>
		</div>
	{/if}
</section>

<style lang="stylus">
.photo-wall
	--wall-gap: var(--m3e-space-3, 0.75rem)
	display: flex
	flex-direction: column
	gap: var(--wall-gap)
	width: 100%

.photo-wall__toolbar
	display: flex
	flex-wrap: wrap
	align-items: center
	justify-content: space-between
	gap: var(--wall-gap)

/* 段内标签不换行（「全部 20」这类带计数的标签），段宽随内容 */
.photo-wall__toolbar :global(.m3-segmented__segment)
	flex: none
	white-space: nowrap

.photo-wall__actions
	display: flex
	flex-wrap: wrap
	align-items: center
	gap: 0.5rem

.photo-wall__columns-label
	color: var(--on-surface-variant)
	font: var(--m3e-type-label-large)

.photo-wall__count
	margin: 0
	color: var(--on-surface-variant)
	font: var(--m3e-type-body-medium)

.photo-wall__grid
	column-count: var(--wall-columns)
	column-gap: var(--wall-gap)

.photo-wall__item
	display: block
	width: 100%
	margin: 0 0 var(--wall-gap)
	padding: 0
	overflow: hidden
	border: 0
	border-radius: var(--shape-corner-m)
	background: var(--surface-container-high)
	cursor: zoom-in
	break-inside: avoid
	&:focus-visible
		outline: 2px solid var(--primary)
		outline-offset: 2px
	> img
		display: block
		width: 100%
		height: auto
		object-fit: cover
		transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate), filter var(--m3e-duration-medium) var(--m3e-easing-standard)

.photo-wall__item:hover > img
	transform: scale(1.03)
	filter: brightness(0.92)

.photo-wall__empty
	display: grid
	place-items: center
	gap: 0.5rem
	min-height: 12rem
	color: var(--on-surface-variant)
	font: var(--m3e-type-body-medium)
	> :global(svg)
		width: 2rem
		height: 2rem

/* 窄屏限制列数，避免缩略图过小 */
@media (max-width: 47.99rem)
	.photo-wall__grid
		column-count: min(var(--wall-columns), 3)

@media (max-width: 29.99rem)
	.photo-wall__grid
		column-count: 2

:global(html.motion-reduced) .photo-wall__item > img
	transition: none

@media (prefers-reduced-motion: reduce)
	.photo-wall__item > img
		transition: none
</style>
