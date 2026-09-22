/**
 * 「最近修改数据的时间」倒序排序（番剧页 / 游戏页共享的唯一排序语义）。
 *
 * 数据源提供的更新时间（Bangumi 收藏条目的 `updated_at`，即用户在番剧/游戏条目上
 * 最近一次修改数据的时间）是唯一主排序键：最近更新过的条目排在最前，其余条目按
 * 修改时间由近及远依次顺延。
 *
 * 时间缺失（0）或完全相同时才回退到调用方给定的稳定次级排序，再以输入顺序兜底，
 * 保证任何筛选按钮触发的列表顺序都确定、无遗漏、无错序。
 */

/** 解析更新时间字符串为毫秒时间戳；无法解析或为空时返回 0（视为最早）。 */
export function parseUpdatedTime(input: unknown): number {
	if (typeof input !== "string" || !input.trim()) return 0;
	const parsed = Date.parse(input.trim());
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * 按「最近修改数据的时间」倒序排序（纯函数，不修改入参）。
 *
 * @param items 待排序集合
 * @param getUpdatedAt 取更新时间的访问器（返回 ISO 字符串或其它可被 Date.parse 识别的值）
 * @param tieBreak 可选的稳定次级比较器（更新时间相同/缺失时生效）
 */
export function sortByUpdatedAtDesc<T>(
	items: readonly T[],
	getUpdatedAt: (item: T) => unknown,
	tieBreak?: (a: T, b: T) => number,
): T[] {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			const diff =
				parseUpdatedTime(getUpdatedAt(b.item)) -
				parseUpdatedTime(getUpdatedAt(a.item));
			if (diff !== 0) return diff;
			const tie = tieBreak ? tieBreak(a.item, b.item) : 0;
			if (tie !== 0) return tie;
			return a.index - b.index;
		})
		.map((entry) => entry.item);
}
