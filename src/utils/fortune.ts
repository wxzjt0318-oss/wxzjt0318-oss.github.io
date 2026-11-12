import {
	type AlmanacActivity,
	almanacActivities,
	almanacDirections,
	almanacDrinks,
	type FortuneRank,
	fortuneAdvice,
	fortuneRanks,
	fortuneTopics,
} from "../data/fortune.ts";

/**
 * 命运页的抽取算法：以日期为种子的伪随机，同一天对所有访客给出相同的黄历与签。
 * 纯函数，不读时钟、不碰浏览器 API，日期由调用方传入（"YYYY-MM-DD"）。
 */

export interface AlmanacEntry {
	name: string;
	note: string;
}

export interface Almanac {
	good: AlmanacEntry[];
	bad: AlmanacEntry[];
	direction: string;
	drinks: string[];
	/** 女神亲近指数，1–5 */
	stars: number;
}

export interface FortuneLot {
	rank: FortuneRank;
	verse: string;
	advice: string;
}

/** mulberry32：小而均匀的 32 位种子随机数发生器 */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** "2026-11-13" → 20261113；格式不对时返回 0 */
export function dateSeed(date: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	return match
		? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3])
		: 0;
}

function isWeekend(date: string): boolean {
	const [y, m, d] = date.split("-").map(Number);
	const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return day === 0 || day === 6;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function getAlmanac(date: string): Almanac {
	const random = createRandom(dateSeed(date));
	const pool = isWeekend(date)
		? almanacActivities.filter((activity) => !activity.weekdayOnly)
		: almanacActivities;
	const picked = shuffle(pool, random);
	const goodCount = 2 + Math.floor(random() * 3);
	const badCount = 2 + Math.floor(random() * 3);
	const fill = (text: string, n: number) => text.replace("{n}", String(n));
	const entry = (
		activity: AlmanacActivity,
		side: "good" | "bad",
	): AlmanacEntry => {
		const n = 50 + Math.floor(random() * 150);
		return { name: fill(activity.name, n), note: fill(activity[side], n) };
	};
	return {
		good: picked.slice(0, goodCount).map((activity) => entry(activity, "good")),
		bad: picked
			.slice(goodCount, goodCount + badCount)
			.map((activity) => entry(activity, "bad")),
		direction:
			almanacDirections[Math.floor(random() * almanacDirections.length)],
		drinks: shuffle(almanacDrinks, random).slice(0, 2),
		stars: 1 + Math.floor(random() * 5),
	};
}

/** 同一天、同一件事永远是同一支签；未知事项按「其他」处理 */
export function drawLot(date: string, topicId: string): FortuneLot {
	const found = fortuneTopics.findIndex((topic) => topic.id === topicId);
	const index = found < 0 ? fortuneTopics.length - 1 : found;
	const topic = fortuneTopics[index];
	const random = createRandom(dateSeed(date) * 31 + (index + 1) * 7919);
	const total = fortuneRanks.reduce((sum, rank) => sum + rank.weight, 0);
	let roll = random() * total;
	let rank = fortuneRanks[fortuneRanks.length - 1];
	for (const candidate of fortuneRanks) {
		roll -= candidate.weight;
		if (roll < 0) {
			rank = candidate;
			break;
		}
	}
	return {
		rank,
		verse: rank.verses[Math.floor(random() * rank.verses.length)],
		advice: (fortuneAdvice[topic.id] ?? fortuneAdvice.other)[rank.id],
	};
}
