// CI：从 S3（七牛/R2）重建站点索引 gallery-index.json + 边缘函数清单 manifest.js
// 元数据来源：上传时写入的对象 Metadata（width/height/pool/hash/createdat/exifdatetime）
// 存储配置读取优先级：config/env.ci.json（inject-env.mjs 生成）> 环境变量
// 本脚本同时输出两份产物：
//   - web/public/data/gallery-index.json   前端相册墙用
//   - functions/generated/manifest.js      边缘函数随机 API 用（CI 环境自足，无需本地缓存）
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { writeGalleryIndex, publishIndexToBucket } from '../tool/src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function envProfiles() {
  const ci = path.join(REPO_ROOT, 'config', 'env.ci.json');
  const env = existsSync(ci) ? JSON.parse(readFileSync(ci, 'utf-8')) : process.env;
  const profiles = [];
  if (env.QINIU_BUCKET) {
    profiles.push({
      id: 'qiniu-cn-east-1', name: '七牛-华东',
      endpoint: env.QINIU_S3_ENDPOINT || 'https://s3.cn-east-1.qiniucs.com',
      region: env.QINIU_REGION || 'cn-east-1',
      accessKeyId: env.QINIU_ACCESS_KEY, secretAccessKey: env.QINIU_SECRET_KEY,
      bucket: env.QINIU_BUCKET, pathPrefix: env.QINIU_PATH_PREFIX || '',
      baseUrl: env.QINIU_BASE_URL,
    });
  }
  if (env.R2_ACCOUNT_ID && env.R2_BUCKET) {
    profiles.push({
      id: 'r2-global', name: 'Cloudflare R2',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET, pathPrefix: env.R2_PATH_PREFIX || '',
      baseUrl: env.R2_BASE_URL,
    });
  }
  return profiles;
}

function client(p) {
  return new S3Client({
    region: p.region,
    endpoint: p.endpoint,
    credentials: { accessKeyId: p.accessKeyId, secretAccessKey: p.secretAccessKey },
    forcePathStyle: true,
  });
}

async function listAllKeys(c, bucket, prefix) {
  const keys = [];
  let token;
  do {
    const r = await c.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    keys.push(...(r.Contents || []).map((o) => ({ key: o.Key, lastModified: o.LastModified })));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const base = (u) => String(u || '').replace(/\/+$/, '');
const urlFor = (p, key) => `${base(p.baseUrl)}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function scan(profile) {
  const c = client(profile);
  const prefix = String(profile.pathPrefix || '').replace(/^\/+/, '');
  const all = await listAllKeys(c, profile.bucket, prefix);
  const mains = all.filter((x) => x.key.endsWith('.avif') && !x.key.endsWith('.thumb.avif'));
  const entries = [];
  for (const { key, lastModified } of mains) {
    const filename = key.split('/').pop();
    const id = filename.replace(/\.avif$/, '');
    const head = await c.send(new HeadObjectCommand({ Bucket: profile.bucket, Key: key }));
    const md = head.Metadata || {};
    if (!md.width || !md.height) {
      console.warn(`[跳过-缺少元数据] ${key}`);
      continue;
    }
    const width = Number(md.width);
    const height = Number(md.height);
    entries.push({
      id,
      storage: profile.id,
      pool: md.pool || 'both',
      url: urlFor(profile, key),
      thumb: urlFor(profile, key.replace(/\.avif$/, '.thumb.avif')),
      key,
      width,
      height,
      ratio: Number((width / height).toFixed(3)),
      exif: md.exifdatetime ? { datetime: md.exifdatetime } : null,
      size: head.ContentLength || 0,
      hash: md.hash || id.split('_').pop() || '',
      createdAt: md.createdat || lastModified || new Date().toISOString(),
    });
  }
  return entries;
}

const profiles = envProfiles();
if (!profiles.length) {
  console.error('未配置任何存储（缺少 QINIU_* / R2_* 环境变量或 config/env.ci.json）');
  process.exit(1);
}

const seen = new Map();
for (const p of profiles) {
  try {
    const entries = await scan(p);
    for (const e of entries) if (!seen.has(e.id)) seen.set(e.id, e);
    console.log(`[${p.id}] ${entries.length} 张`);
  } catch (e) {
    console.error(`[${p.id}] 扫描失败：${e.message}`);
    process.exitCode = 1;
  }
}

const images = [...seen.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
const out = writeGalleryIndex(images);
console.log(`已写入 ${out}（${images.length} 张）`);

// 同步生成边缘函数清单（与 gallery-index 同一份数据源）
const MANIFEST_OUT = path.join(REPO_ROOT, 'functions', 'generated', 'manifest.js');
const manifest = images.map((i) => ({
  url: i.url, thumb: i.thumb, pool: i.pool, width: i.width, height: i.height, createdAt: i.createdAt,
}));
mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
writeFileSync(
  MANIFEST_OUT,
  `// 自动生成：scripts/build-index.mjs，请勿手改
export const IMAGES = ${JSON.stringify(manifest)};
export const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
`,
  'utf-8',
);
console.log(`已写入 ${MANIFEST_OUT}（${manifest.length} 张）`);

// 发布索引对象到桶（CDN 公网可读）：前端相册墙与 /api 运行时拉取，上传即生效
// 发布失败必须让 CI 失败——否则线上会继续用旧的运行时索引
for (const p of profiles) {
  try {
    const url = await publishIndexToBucket(p, images);
    console.log(`已发布索引对象 [${p.id}]：${url}`);
  } catch (e) {
    console.error(`[${p.id}] 索引对象发布失败：${e.message}`);
    process.exitCode = 1;
  }
}
