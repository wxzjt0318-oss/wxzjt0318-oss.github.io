// 开发冒烟：用样例索引验证边缘函数路由（UA/type/json/stats/回退）
// 流程：写样例索引 → 重建 manifest → 动态导入函数 → 测试 → 恢复空索引
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sample = {
  version: 1,
  generatedAt: '2026-09-16T08:00:00.000Z',
  images: [
    { id: 'A', storage: 'qiniu', pool: 'pc', url: 'https://cdn.example.com/a.avif', thumb: 'https://cdn.example.com/a.thumb.avif', width: 1920, height: 1080, ratio: 1.778, createdAt: '2026-09-16T08:00:00Z' },
    { id: 'B', storage: 'qiniu', pool: 'pc', url: 'https://cdn.example.com/b.avif', thumb: 'https://cdn.example.com/b.thumb.avif', width: 1600, height: 900, ratio: 1.778, createdAt: '2026-09-16T08:01:00Z' },
    { id: 'C', storage: 'r2', pool: 'phone', url: 'https://cdn2.example.com/c.avif', thumb: 'https://cdn2.example.com/c.thumb.avif', width: 900, height: 1600, ratio: 0.5625, createdAt: '2026-09-16T08:02:00Z' },
    { id: 'D', storage: 'r2', pool: 'both', url: 'https://cdn2.example.com/d.avif', thumb: 'https://cdn2.example.com/d.thumb.avif', width: 1200, height: 1200, ratio: 1, createdAt: '2026-09-16T08:03:00Z' },
  ],
};

writeFileSync('web/public/data/gallery-index.json', JSON.stringify(sample, null, 2));
execSync('node scripts/build-api-manifest.mjs', { stdio: 'inherit' });

const { onRequest } = await import(`../functions/api/[[path]].js?v=${Date.now()}`);

const call = (path, ua) =>
  onRequest({ request: new Request('http://local' + path, { headers: ua ? { 'user-agent': ua } : {} }) });

const out = [];
const log = (name, r) => out.push(`[${name}] status=${r.status} ${r.headers.get('location') || '(body)'}`);

let r = await call('/api', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
log('UA=iPhone', r);
r = await call('/api', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
log('UA=Windows', r);
r = await call('/api?type=pc');
log('type=pc', r);
r = await call('/api?type=phone');
log('type=phone', r);
r = await call('/api?json=1', 'Mozilla/5.0 (iPhone)');
log('json=1(phone)', r);
console.log(await r.text());
console.log('acao=' + r.headers.get('access-control-allow-origin'));
r = await call('/api/stats');
log('stats', r);
console.log(await r.text());

// OPTIONS 预检
const opt = await onRequest({ request: new Request('http://local/api', { method: 'OPTIONS' }) });
out.push(`[OPTIONS] status=${opt.status} acao=${opt.headers.get('access-control-allow-origin')}`);

// 恢复空索引并重建 manifest
writeFileSync('web/public/data/gallery-index.json', JSON.stringify({ version: 1, generatedAt: '2026-09-16T00:00:00.000Z', images: [] }, null, 2));
execSync('node scripts/build-api-manifest.mjs', { stdio: 'inherit' });
console.log(out.join('\n'));
