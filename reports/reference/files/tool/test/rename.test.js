// 重命名规则单元测试 —— 对齐 docs/重命名规则.md（v2.0：{YYYYMMDD}{timestampS}）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashHex,
  formatYmdUtc8,
  unixSeconds,
  pickDatetime,
  buildBaseName,
  makeFileRe,
  makeKeyRe,
} from '../src/rename.js';

test('hashHex 取 SHA-256 前 8 位', () => {
  const h = hashHex(Buffer.from('zmm-randpic'));
  assert.match(h, /^[0-9a-f]{8}$/);
  assert.equal(hashHex(Buffer.from('zmm-randpic')), h, '相同内容哈希一致');
});

test('formatYmdUtc8 输出 UTC+8 年月日', () => {
  // 2026-09-16T06:30:22Z = UTC+8 14:30:22 同日
  const d = new Date('2026-09-16T06:30:22Z');
  assert.equal(formatYmdUtc8(d), '20260916');
  // UTC 23:00 → UTC+8 次日 07:00，日期进一
  const d2 = new Date('2026-09-16T23:00:00Z');
  assert.equal(formatYmdUtc8(d2), '20260917');
});

test('unixSeconds 为绝对秒级时间戳', () => {
  const d = new Date('2026-09-16T06:30:22Z');
  assert.equal(unixSeconds(d), Math.floor(d.getTime() / 1000));
});

test('pickDatetime 优先 EXIF 拍摄时间', () => {
  const fallback = new Date('2026-09-16T00:00:00Z');
  const t = pickDatetime({ exif: { DateTimeOriginal: '2026-09-10T08:30:12' }, fallback });
  assert.equal(formatYmdUtc8(t), '20260910');
  assert.equal(formatYmdUtc8(pickDatetime({ exif: null, fallback })), '20260916');
});

test('buildBaseName = {YYYYMMDD}{timestampS}', () => {
  const d = new Date('2026-09-16T06:30:22Z');
  const base = buildBaseName({ datetime: d });
  assert.equal(base, `20260916${unixSeconds(d)}`);
  assert.match(base, /^[0-9]{18}$/);
});

test('文件名/路径校验正则（无年月目录）', () => {
  const fileRe = makeFileRe();
  const keyRe = makeKeyRe();
  const base = '202609161758105730';
  assert.ok(fileRe.test(`${base}.avif`));
  assert.ok(fileRe.test(`${base}.thumb.avif`));
  assert.ok(fileRe.test(`${base}-2.avif`), '冲突序号合法');
  assert.ok(!fileRe.test(`${base}.jpg`), '非 AVIF 拒绝');
  assert.ok(!fileRe.test(`20260916_183210_a7d5173a.avif`), '旧格式（含下划线/哈希）拒绝');
  assert.ok(!fileRe.test(`2026/09/${base}.avif`), 'key 不含年月目录');
  assert.ok(keyRe.test(`${base}.thumb.avif`));
  assert.ok(!keyRe.test(`rand/${base}.avif`), 'key 不含前缀目录');
});

test('边界：同秒同内容 → 文件名可能不同（去重不靠文件名）', () => {
  const buf = Buffer.from('same-content');
  const t = new Date('2026-09-16T06:30:22Z');
  const a = buildBaseName({ datetime: t });
  const b = buildBaseName({ datetime: new Date(t.getTime() + 1000) });
  assert.notEqual(a, b, '时间戳不同则文件名不同');
  assert.equal(hashHex(buf), hashHex(buf), '去重依据（hash）仍稳定可比对');
});
