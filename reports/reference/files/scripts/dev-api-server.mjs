// 本地随机图 API 模拟服务：复用 functions/api/[[path]].js 的边缘函数逻辑
// 用法：node scripts/dev-api-server.mjs [端口，默认 8790]
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequest } from '../functions/api/[[path]].js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_INDEX = path.join(REPO_ROOT, 'web', 'public', 'data', 'gallery-index.json');
const port = Number(process.argv[2] || process.env.PORT || 8790);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, String(v));
  const request = new Request(url, { method: req.method, headers });

  // 本地联调：直接吐本地 gallery-index.json，并通过 INDEX_URL 指给边缘函数，
  // 让 /api/index 在本地也走「运行时索引」同一条代码路径（未生成索引时函数自动回退内嵌清单）
  if (url.pathname === '/data/gallery-index.json') {
    if (!existsSync(LOCAL_INDEX)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: '本地索引不存在，先运行 npm run build:index' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(readFileSync(LOCAL_INDEX));
    return;
  }

  try {
    const resp = await onRequest({
      request,
      env: { INDEX_URL: `http://127.0.0.1:${port}/data/gallery-index.json` },
    });
    res.writeHead(resp.status, Object.fromEntries(resp.headers));
    res.end(Buffer.from(await resp.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(port, () => {
  console.log(`本地随机图 API 已启动：http://127.0.0.1:${port}/api`);
  console.log('用法：');
  console.log(`  http://127.0.0.1:${port}/api            随机一张（按 UA 自动 pc/phone，302 跳转）`);
  console.log(`  http://127.0.0.1:${port}/api?type=phone 强制 phone 池`);
  console.log(`  http://127.0.0.1:${port}/api?type=pc    强制 pc 池`);
  console.log(`  http://127.0.0.1:${port}/api?json=1     返回随机一张的 JSON`);
  console.log(`  http://127.0.0.1:${port}/api/index      全量索引 JSON（相册墙数据源）`);
  console.log(`  http://127.0.0.1:${port}/api/list       全量列表 JSON`);
  console.log(`  http://127.0.0.1:${port}/api/stats      图库统计 JSON`);
});
