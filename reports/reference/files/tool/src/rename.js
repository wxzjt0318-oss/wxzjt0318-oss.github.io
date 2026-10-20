// 重命名规则实现 —— 严格对齐 docs/重命名规则.md（v2.0）
// 文件名：{YYYYMMDD}{timestampS}.avif / {YYYYMMDD}{timestampS}.thumb.avif
// 说明：timestampS = Unix 秒级时间戳；文件名不含内容哈希，
//       去重依赖索引缓存/对象元数据中的 hash 字段（上传管线比对）
import { createHash } from 'node:crypto';

/** SHA-256 十六进制前 len 位（用于去重比对，不进入文件名） */
export function hashHex(buf, len = 8) {
  return createHash('sha256').update(buf).digest('hex').slice(0, len);
}

/** UTC+8 的 YYYYMMDD（时间戳的日期部分） */
export function formatYmdUtc8(date) {
  const d = new Date(date.getTime() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** Unix 秒级时间戳（绝对时间，UTC 基准） */
export function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

/** 时间戳来源优先级：EXIF DateTimeOriginal > 上传时刻（mtime 由调用方决定是否采用） */
export function pickDatetime({ exif, fallback = new Date() }) {
  const raw = exif?.DateTimeOriginal;
  if (raw) {
    const t = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(t.getTime())) return t;
  }
  return fallback;
}

/** 基名 = UTC+8 年月日 + Unix 秒戳，如 202609161758105730 */
export function buildBaseName({ datetime }) {
  return `${formatYmdUtc8(datetime)}${unixSeconds(datetime)}`;
}

/** 校验正则：18 位数字（8 位 Ymd + 10 位秒戳）+ 可选冲突序号 */
export function makeFileRe() {
  return /^[0-9]{18}(-(2|[3-9][0-9]*))?\.(avif|thumb\.avif)$/;
}

/** key 级校验：当前无年月目录，key 即文件名 */
export function makeKeyRe() {
  return /^[0-9]{18}(-(2|[3-9][0-9]*))?\.(avif|thumb\.avif)$/;
}
