// 开发自检：生成不同宽高比的测试图（横图 16:9 / 竖图 9:16 / 方图 1:1），
// 输出到 tool/data/selftest/（gitignored），用于上传管线冒烟验证
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('tool/data/selftest', { recursive: true });

const cases = [
  { name: 'pc-16x9', w: 1600, h: 900, color: '#0f766e' },
  { name: 'phone-9x16', w: 900, h: 1600, color: '#0369a1' },
  { name: 'both-1x1', w: 1200, h: 1200, color: '#a16207' },
  { name: 'wide-2x1', w: 1600, h: 800, color: '#7c3aed' },
];

const svg = (w, h, color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${color}"/>
  <text x="50%" y="50%" font-size="${Math.min(w, h) / 8}" fill="#fff" text-anchor="middle" dominant-baseline="middle"
    font-family="sans-serif">${w} x ${h}</text>
</svg>`;

for (const c of cases) {
  await sharp(Buffer.from(svg(c.w, c.h, c.color))).png().toFile(`tool/data/selftest/${c.name}.png`);
  console.log(`生成 ${c.name}.png`);
}
