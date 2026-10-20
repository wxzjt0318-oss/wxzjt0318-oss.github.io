// EdgeOne Pages Functions 随机图 API —— 裸路径 /api 入口
// 路由说明：functions/api/index.js → 域名/api（EdgeOne Pages 目录下 index.js 映射该目录裸路径）
// 子路径（/api/list、/api/stats 等）由 functions/api/[[path]].js 处理，逻辑与本文件共用（见其 re-export）。
// 路由：
//   GET /api/index       全量图片索引（相册墙数据源）
//   GET /api/list        全部图片清单
//   GET /api/stats       图库统计（总数 / pc / phone）
//   GET /api             UA 自适应 302 跳转（手机/桌面）
//   GET /api?type=pc|phone  强制图池
//   GET /api?json=1      JSON 返回随机一张的元数据
//   GET /api/其他        404 JSON
//
// 运行时索引（上传即生效，无需重新部署）：
//   上传工具会把 gallery-index.json 发布为桶内对象（CDN 公网可读、缓存 60s），本函数优先拉取它；
//   拉取失败时回退到构建期内嵌清单 functions/generated/manifest.js。
//   桶内索引对象名与 tool/src/index.js 的 INDEX_OBJECT_NAME 约定必须一致。
let manifestCache = null;

async function loadManifest() {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = await import('../generated/manifest.js');
  } catch {
    manifestCache = { IMAGES: [], GENERATED_AT: '' };
  }
  return manifestCache;
}

/** 桶内索引对象名，与 tool/src/index.js 保持一致 */
const INDEX_OBJECT_NAME = 'gallery-index.json';
const INDEX_CACHE_TTL = 60;

/** 运行时索引对象 URL：环境变量 INDEX_URL 优先，否则由内嵌清单首图域名推导（不硬编码域名） */
function indexObjectUrl(manifest, env) {
  if (env && typeof env.INDEX_URL === 'string' && env.INDEX_URL) return env.INDEX_URL;
  const first = manifest.IMAGES && manifest.IMAGES[0];
  if (!first || !first.url) return null;
  try {
    return new URL(first.url).origin + '/' + INDEX_OBJECT_NAME;
  } catch {
    return null;
  }
}

/** 校验索引结构：必须有非空 images 数组，防止 CDN 错误页污染数据 */
function normalizeIndex(data) {
  if (!data || !Array.isArray(data.images) || !data.images.length) return null;
  return data;
}

/** 拉取运行时索引：Cache API 缓存 60s（不可用则直连），任何失败返回 null 走回退 */
async function loadRuntimeIndex(context, manifest) {
  const url = indexObjectUrl(manifest, context && context.env);
  if (!url) return null;
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) {
        const idx = normalizeIndex(await hit.json());
        if (idx) return idx;
      }
    } catch {
      /* 缓存不可用或内容损坏 → 直连源站 */
    }
  }
  let resp;
  try {
    resp = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  let data;
  try {
    data = await resp.json();
  } catch {
    return null;
  }
  const idx = normalizeIndex(data);
  if (idx && cache) {
    try {
      await cache.put(
        url,
        new Response(JSON.stringify(idx), {
          headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${INDEX_CACHE_TTL}` },
        }),
      );
    } catch {
      /* 缓存写入失败不影响响应 */
    }
  }
  return idx;
}

/** 回退索引：由内嵌清单合成（缺 id/exif/size，前端仍可完整渲染） */
function fallbackIndex(manifest) {
  return {
    version: 1,
    generatedAt: manifest.GENERATED_AT || null,
    images: (manifest.IMAGES || []).map((i) => ({
      ...i,
      id: i.url ? i.url.split('/').pop().replace(/\.avif$/, '') : '',
    })),
  };
}

const MOBILE_RE = /android|iphone|ipad|ipod|mobile|huawei|xiaomi|oppo|vivo|oneplus|miui|harmonyos/i;

// 跨域：允许前端站点跨域调用 /api（公开内容，放开来源）
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Accept',
  'access-control-max-age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...CORS_HEADERS,
    },
  });

export async function onRequest(context) {
  const { request } = context;

  // 预检请求：直接放行
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const manifest = await loadManifest();

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const type = url.searchParams.get('type');
  const wantJson = url.searchParams.get('json') !== null;

  // 运行时索引优先；拉取失败回退内嵌清单（构建期快照）
  const runtime = await loadRuntimeIndex(context, manifest);
  const images = runtime ? runtime.images : manifest.IMAGES;
  const generatedAt = runtime ? runtime.generatedAt : manifest.GENERATED_AT;

  if (pathname === '/api/index') {
    return json(runtime || fallbackIndex(manifest));
  }

  if (pathname === '/api/stats') {
    const pc = images.filter((i) => i.pool === 'pc' || i.pool === 'both').length;
    const phone = images.filter((i) => i.pool === 'phone' || i.pool === 'both').length;
    return json({ total: images.length, pc, phone, generatedAt });
  }

  if (pathname === '/api/list') {
    return json({ total: images.length, images });
  }

  if (pathname !== '/api') return json({ error: 'not found' }, 404);

  const ua = request.headers.get('user-agent') || '';
  const want = type === 'pc' ? 'pc' : type === 'phone' ? 'phone' : MOBILE_RE.test(ua) ? 'phone' : 'pc';
  let pool = images.filter((i) => i.pool === want || i.pool === 'both');
  if (!pool.length) pool = images; // 目标图池为空 → 回退全量
  if (!pool.length) return json({ error: '图库为空' }, 404);

  const img = pool[Math.floor(Math.random() * pool.length)];
  if (wantJson) return json(img);
  return Response.redirect(img.url, 302);
}
