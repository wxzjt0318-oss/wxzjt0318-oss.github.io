/**
 * 书志 / 数据库来源共用的请求层：自定义 User-Agent、磁盘缓存、最小间隔与窗口限额。
 * 只缓存 HTTP 200 的正文。4xx / 5xx 不写入缓存，调用方决定要不要放弃这一来源。
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");

export const SOURCE_USER_AGENT =
	"wxzjt0318-oss-blog-wiki-fetcher/1.0 (https://github.com/wxzjt0318-oss; content curation)";
export const SOURCE_CACHE_DIR = path.join(ROOT_DIR, ".cache", "wiki-sources");
const CACHE_TTL_MS = 7 * 24 * 3_600_000;

/** 各来源的默认限额。窗口上限留在对方公布的额度之下。 */
export const SOURCE_RATES = {
	// aniSearch：无 token 时 id /full 共用「10 秒 1 次」
	anisearch: { minIntervalMs: 10_000 },
	mangaupdates: { minIntervalMs: 1_000 },
	// VNDB Kana：5 分钟 200 次。1.6 秒间隔且 5 分钟最多 150 次。
	vndb: { minIntervalMs: 1_600, maxPerWindow: 150, windowMs: 5 * 60_000 },
	biligame: { minIntervalMs: 1_500 },
	// RanobeDB：请勿超过每分钟 60 次。
	ranobedb: { minIntervalMs: 1_200, maxPerWindow: 50, windowMs: 60_000 },
	// 国会图书馆要求避免并发洪水，没有公布具体数字。
	ndl: { minIntervalMs: 1_200 },
};

const buckets = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function bucket(source) {
	if (!buckets.has(source)) buckets.set(source, { nextAt: 0, hits: [] });
	return buckets.get(source);
}

export async function throttle(source, rate = SOURCE_RATES[source] || {}) {
	const state = bucket(source);
	const minIntervalMs = rate.minIntervalMs || 0;
	const maxPerWindow = rate.maxPerWindow || 0;
	const windowMs = rate.windowMs || 0;
	if (maxPerWindow > 0 && windowMs > 0) {
		const now = Date.now();
		state.hits = state.hits.filter((at) => now - at < windowMs);
		if (state.hits.length >= maxPerWindow) {
			await sleep(windowMs - (now - state.hits[0]) + 50);
		}
	}
	const gap = state.nextAt - Date.now();
	if (gap > 0) await sleep(gap);
	const at = Date.now();
	state.nextAt = at + minIntervalMs;
	state.hits.push(at);
}

function cacheFile(source, key) {
	const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
	return path.join(SOURCE_CACHE_DIR, source, `${hash}.json`);
}

async function readCache(source, key) {
	try {
		const cached = JSON.parse(
			await fs.readFile(cacheFile(source, key), "utf8"),
		);
		if (cached.v !== 1) return undefined;
		if (Date.now() - Date.parse(cached.cachedAt || 0) > CACHE_TTL_MS)
			return undefined;
		return cached.body;
	} catch {
		return undefined;
	}
}

async function writeCache(source, key, body) {
	try {
		const file = cacheFile(source, key);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(
			file,
			JSON.stringify({ v: 1, cachedAt: new Date().toISOString(), body }),
			"utf8",
		);
	} catch {}
}

/**
 * 带缓存和限速的请求。429 时按 Retry-After 等一次再试（最多 30 秒），仍失败就抛出。
 * @returns {Promise<string>}
 */
export async function requestText(source, url, options = {}) {
	const {
		method = "GET",
		body = "",
		accept = "application/json",
		contentType = "",
		timeoutMs = 20_000,
		rate = SOURCE_RATES[source],
		userAgent = SOURCE_USER_AGENT,
		fetchImpl = (...args) => fetch(...args),
	} = options;
	const cacheKey = `${method}\n${url}\n${body}`;
	const cached = await readCache(source, cacheKey);
	if (cached !== undefined) return cached;
	const send = async () => {
		await throttle(source, rate);
		const headers = { "user-agent": userAgent, accept };
		if (body) headers["content-type"] = contentType || "application/json";
		const res = await fetchImpl(url, {
			method,
			headers,
			body: body || undefined,
			signal: AbortSignal.timeout(timeoutMs),
		});
		return res;
	};
	let res = await send();
	if (res.status === 429) {
		const retryAfter = Number(res.headers.get("retry-after") || 10);
		await sleep(
			Math.min(Number.isFinite(retryAfter) ? retryAfter : 10, 30) * 1000,
		);
		res = await send();
	}
	if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
	const text = await res.text();
	await writeCache(source, cacheKey, text);
	return text;
}

export async function requestJson(source, url, options = {}) {
	return JSON.parse(await requestText(source, url, options));
}

/** 环境变量 WIKI_SOURCE_<NAME>=0|false|off|no 时关闭该来源，缺省为开启。 */
export function sourceEnabled(name, env = process.env) {
	const raw = env[`WIKI_SOURCE_${String(name).toUpperCase()}`];
	if (raw == null || raw === "") return true;
	return !/^(0|false|off|no)$/i.test(String(raw));
}
