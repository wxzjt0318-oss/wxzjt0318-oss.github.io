// 开发验证：用真实管线参数转换指定图片，输出 AVIF + 缩略图 + 左右对比预览图
// 用法：node scripts/dev-test-avif.mjs <图片1> [图片2...]
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { encodeAvif, encodeThumb } from '../tool/src/compress.js';

const OUT = 'tool/data/selftest/avif-test';
mkdirSync(OUT, { recursive: true });

const SETTINGS = {
  avif: { quality: 60, effort: 4, maxDimension: { pc: 3840, phone: 2160, both: 2560 } },
  thumb: { width: 640, quality: 55 },
};

const files = process.argv.slice(2);
for (const src of files) {
  const base = path.basename(src).replace(/\.[^.]+$/, '');
  const origSize = statSync(src).size;
  const main = await encodeAvif(src, { maxDimension: SETTINGS.avif.maxDimension.pc, quality: SETTINGS.avif.quality, effort: SETTINGS.avif.effort });
  const thumbBuf = await encodeThumb(main.buffer, { width: SETTINGS.thumb.width, quality: SETTINGS.thumb.quality });

  const avifPath = `${OUT}/${base}.avif`;
  const thumbPath = `${OUT}/${base}.thumb.avif`;
  const meta = await sharp(main.buffer).metadata();
  const thumbMeta = await sharp(thumbBuf).metadata();
  await sharp(main.buffer).toFile(avifPath);
  await sharp(thumbBuf).toFile(thumbPath);

  // 对比预览：左=原图(缩到高560) 右=AVIF(缩到高560)，中间留白
  const H = 560;
  const left = await sharp(src).rotate().resize({ height: H, withoutEnlargement: true }).toBuffer();
  const right = await sharp(main.buffer).resize({ height: H, withoutEnlargement: true }).toBuffer();
  const lMeta = await sharp(left).metadata();
  const rMeta = await sharp(right).metadata();
  const pad = 24;
  const width = lMeta.width + rMeta.width + pad * 3;
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44">
      <text x="${pad}" y="26" font-size="22" fill="#0f766e" font-family="sans-serif" font-weight="bold">原图 ${lMeta.width}x${lMeta.height}</text>
      <text x="${lMeta.width + pad * 2}" y="26" font-size="22" fill="#b45309" font-family="sans-serif" font-weight="bold">AVIF q60 ${rMeta.width}x${rMeta.height}</text>
    </svg>`,
  );
  const cmpPath = `${OUT}/${base}.compare.png`;
  await sharp({ create: { width, height: H + 44, channels: 3, background: '#f8fafc' } })
    .composite([
      { input: left, top: 44, left: pad },
      { input: right, top: 44, left: lMeta.width + pad * 2 },
      { input: label, top: 0, left: 0 },
    ])
    .png()
    .toFile(cmpPath);

  console.log(`\n=== ${base} ===`);
  console.log(`原图    ${origSize / 1024 / 1024}MB → AVIF ${(main.size / 1024).toFixed(0)}KB  压缩 ${(100 - (main.size / origSize) * 100).toFixed(1)}%`);
  console.log(`主图    ${meta.width}x${meta.height}  ${(main.size / 1024).toFixed(0)}KB  ${avifPath}`);
  console.log(`缩略图  ${thumbMeta.width}x${thumbMeta.height}  ${(thumbBuf.length / 1024).toFixed(0)}KB  ${thumbPath}`);
  console.log(`对比图  ${cmpPath}`);
}
