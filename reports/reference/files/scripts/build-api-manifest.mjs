// 由 gallery-index.json 生成边缘函数内嵌清单 functions/generated/manifest.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(REPO_ROOT, 'web', 'public', 'data', 'gallery-index.json');
const OUT_DIR = path.join(REPO_ROOT, 'functions', 'generated');
const OUT = path.join(OUT_DIR, 'manifest.js');

if (!existsSync(SRC)) {
  console.error(`缺少 ${SRC}，先运行 rp index 或 build-index`);
  process.exit(1);
}
const idx = JSON.parse(readFileSync(SRC, 'utf-8'));
const images = (idx.images || []).map((i) => ({
  url: i.url,
  thumb: i.thumb,
  pool: i.pool,
  width: i.width,
  height: i.height,
  createdAt: i.createdAt,
}));
const src =
  `// 自动生成：scripts/build-api-manifest.mjs，请勿手改\n` +
  `export const IMAGES = ${JSON.stringify(images)};\n` +
  `export const GENERATED_AT = ${JSON.stringify(idx.generatedAt || null)};\n`;
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, src, 'utf-8');
console.log(`已写入 ${OUT}（${images.length} 张）`);
