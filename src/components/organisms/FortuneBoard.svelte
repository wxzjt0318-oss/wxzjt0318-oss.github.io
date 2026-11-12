<script lang="ts">
/**
 * 命运：程序员老黄历 + 求签。
 * - 黄历与签都以日期为种子（src/utils/fortune.ts），同一天所有访客结果相同；
 * - SSR 用构建当天的日期输出（无脚本也可读），挂载后换成访客本地的今天；
 * - 同一件事一天只出一支签：已求过的事项记在组件状态里，再点只会显示同一支签。
 */
import Button from "@components/atoms/action/Button.svelte";
import SegmentedButton from "@components/atoms/selection/SegmentedButton.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { drawLot, type FortuneLot, getAlmanac } from "@utils/fortune";
import { onMount } from "svelte";
import { fortuneTopics } from "@/data/fortune";

let {
	initialDate,
	locale = "zh-CN",
}: {
	/** 构建当天的日期（YYYY-MM-DD），SSR 与首次渲染使用 */
	initialDate: string;
	/** 日期显示用的 BCP 47 语言标签 */
	locale?: string;
} = $props();

// svelte-ignore state_referenced_locally
let date = $state(initialDate);
let topic = $state("");
let drawn = $state<Record<string, FortuneLot>>({});

const almanac = $derived(getAlmanac(date));
const dateText = $derived.by(() => {
	const [y, m, d] = date.split("-").map(Number);
	// 用 UTC 正午构造，避免时区把日期推前或推后一天
	const formatted = new Intl.DateTimeFormat(locale, {
		dateStyle: "full",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(y, m - 1, d, 12)));
	return i18n(I18nKey.fortuneToday).replace("{date}", formatted);
});
const topicOptions = fortuneTopics.map((item) => ({
	value: item.id,
	label: item.name,
}));
const lot = $derived(topic ? drawn[topic] : undefined);

onMount(() => {
	const now = new Date();
	const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	if (local !== date) {
		date = local;
		drawn = {};
	}
});

function draw() {
	if (!topic || drawn[topic]) return;
	drawn = { ...drawn, [topic]: drawLot(date, topic) };
}
</script>

<div class="fortune">
	<section class="fortune__section" aria-labelledby="fortune-almanac-title">
		<h2 id="fortune-almanac-title" class="fortune__bar">{i18n(I18nKey.fortuneAlmanac)}</h2>
		<p class="fortune__date">{dateText}</p>

		<div class="fortune__table">
			<div class="fortune__row fortune__row--good">
				<div class="fortune__side">{i18n(I18nKey.fortuneGood)}</div>
				<ul class="fortune__items">
					{#each almanac.good as item (item.name)}
						<li>
							<strong>{item.name}</strong>
							<span>{item.note}</span>
						</li>
					{/each}
				</ul>
			</div>
			<div class="fortune__row fortune__row--bad">
				<div class="fortune__side">{i18n(I18nKey.fortuneBad)}</div>
				<ul class="fortune__items">
					{#each almanac.bad as item (item.name)}
						<li>
							<strong>{item.name}</strong>
							<span>{item.note}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<dl class="fortune__extras">
			<div>
				<dt>{i18n(I18nKey.fortuneDirection)}</dt>
				<dd>{i18n(I18nKey.fortuneDirectionText).replace("{direction}", almanac.direction)}</dd>
			</div>
			<div>
				<dt>{i18n(I18nKey.fortuneDrink)}</dt>
				<dd>{almanac.drinks.join("，")}</dd>
			</div>
			<div>
				<dt>{i18n(I18nKey.fortuneGoddess)}</dt>
				<dd class="fortune__stars" aria-label={`${almanac.stars} / 5`}>
					{#each [1, 2, 3, 4, 5] as n (n)}
						<span class={`fortune__star ${n <= almanac.stars ? "fortune__star--on" : ""}`} aria-hidden="true">
							<Icon icon="material-symbols:star-rounded" />
						</span>
					{/each}
				</dd>
			</div>
		</dl>
	</section>

	<section class="fortune__section" aria-labelledby="fortune-draw-title">
		<h2 id="fortune-draw-title" class="fortune__bar">{i18n(I18nKey.fortuneDraw)}</h2>
		<p class="fortune__hint">{i18n(I18nKey.fortuneDrawHint)}</p>

		<div class="fortune__controls">
			<div class="fortune__topics">
				<SegmentedButton
					options={topicOptions}
					bind:value={topic}
					label={i18n(I18nKey.fortuneDrawTopic)}
				/>
			</div>
			<Button
				variant="filled"
				icon="material-symbols:auto-awesome-rounded"
				label={i18n(I18nKey.fortuneDrawButton)}
				disabled={!topic || Boolean(lot)}
				onclick={draw}
			/>
		</div>

		<div class="fortune__result" aria-live="polite">
			{#if lot}
				<div class={`fortune__lot fortune__lot--${lot.rank.id}`}>
					<p class="fortune__rank">{lot.rank.name}</p>
					<p class="fortune__verse">{lot.verse}</p>
					<p class="fortune__advice">{lot.advice}</p>
				</div>
				<p class="fortune__once">{i18n(I18nKey.fortuneDrawOnce)}</p>
			{:else}
				<p class="fortune__prompt">{i18n(I18nKey.fortuneDrawPrompt)}</p>
			{/if}
		</div>
	</section>
</div>

<style lang="stylus">
.fortune
	display: flex
	flex-direction: column
	gap: 2rem

.fortune__bar
	margin: 0 0 1rem
	padding: 0.5rem 1rem
	border-radius: var(--shape-corner-s)
	background: var(--primary)
	color: var(--on-primary)
	font: var(--m3e-type-title-medium)

.fortune__date
	margin: 0 0 1rem
	color: var(--on-surface)
	font: var(--m3e-type-headline-small)
	text-align: center

.fortune__table
	overflow: hidden
	border-radius: var(--shape-corner-m)

.fortune__row
	display: grid
	grid-template-columns: 5.5rem minmax(0, 1fr)
	@media (min-width: 48rem)
		grid-template-columns: 8rem minmax(0, 1fr)

.fortune__side
	display: grid
	place-items: center
	padding: 1rem 0.5rem
	font: var(--m3e-type-display-small)
	font-weight: 700
	text-align: center

.fortune__row--good
	background: var(--tertiary-container)
	color: var(--on-tertiary-container)
	.fortune__side
		background: var(--tertiary)
		color: var(--on-tertiary)

.fortune__row--bad
	background: var(--error-container)
	color: var(--on-error-container)
	.fortune__side
		background: var(--error)
		color: var(--on-error)

.fortune__items
	display: flex
	flex-direction: column
	gap: 0.75rem
	margin: 0
	padding: 1rem 1.25rem
	list-style: none
	> li
		display: flex
		flex-direction: column
		gap: 0.125rem
	strong
		font: var(--m3e-type-title-large)
		font-weight: 700
	span
		opacity: 0.8
		font: var(--m3e-type-body-medium)

.fortune__extras
	display: flex
	flex-direction: column
	gap: 0.5rem
	margin: 1rem 0 0
	padding: 0 0.25rem
	> div
		display: flex
		flex-wrap: wrap
		align-items: center
		gap: 0.5rem
	dt
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 700
		&::after
			content: "："
	dd
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-large)

.fortune__stars
	display: inline-flex
	gap: 0.125rem

.fortune__star
	display: inline-flex
	color: var(--outline-variant)
	> :global(svg)
		width: 1.375rem
		height: 1.375rem

.fortune__star--on
	color: var(--primary)

.fortune__hint
	margin: 0 0 1rem
	color: var(--on-surface-variant)
	font: var(--m3e-type-body-medium)

.fortune__controls
	display: flex
	flex-wrap: wrap
	align-items: center
	gap: 0.75rem

.fortune__topics
	flex: 1 1 18rem
	min-width: 0

/* 窄屏放不下五个事项时换行，而不是横向滚动把最后一项藏起来 */
.fortune__topics :global(.m3-segmented)
	flex-wrap: wrap

.fortune__topics :global(.m3-segmented__segment)
	flex: 1 0 auto
	white-space: nowrap

.fortune__result
	display: grid
	grid-template-columns: minmax(0, 1fr)
	place-items: center
	gap: 0.75rem
	min-height: 12rem
	margin-top: 1rem
	padding: 1.5rem 1rem
	border: 1px dashed var(--outline-variant)
	border-radius: var(--shape-corner-m)
	text-align: center

.fortune__prompt
	margin: 0
	color: var(--on-surface-variant)
	font: var(--m3e-type-headline-small)

.fortune__lot
	display: flex
	flex-direction: column
	align-items: center
	gap: 0.5rem
	box-sizing: border-box
	width: min(100%, 28rem)
	padding: 1.25rem 1.5rem
	border-radius: var(--shape-corner-l)
	background: var(--secondary-container)
	color: var(--on-secondary-container)
	> p
		margin: 0

.fortune__lot--great,
.fortune__lot--good
	background: var(--tertiary-container)
	color: var(--on-tertiary-container)

.fortune__lot--bad
	background: var(--error-container)
	color: var(--on-error-container)

.fortune__rank
	font: var(--m3e-type-headline-medium)
	font-weight: 700

.fortune__verse
	font: var(--m3e-type-title-medium)

.fortune__advice
	opacity: 0.85
	font: var(--m3e-type-body-medium)

.fortune__once
	margin: 0
	color: var(--on-surface-variant)
	font: var(--m3e-type-body-small)
</style>
