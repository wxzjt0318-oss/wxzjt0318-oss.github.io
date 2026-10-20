// CI 注入：把流水线环境变量落地为 config/env.ci.json（gitignored），供 build-index.mjs 消费
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEYS = [
  'QINIU_S3_ENDPOINT', 'QINIU_REGION', 'QINIU_ACCESS_KEY', 'QINIU_SECRET_KEY',
  'QINIU_BUCKET', 'QINIU_PATH_PREFIX', 'QINIU_BASE_URL',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET', 'R2_PATH_PREFIX', 'R2_BASE_URL',
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = {};
for (const k of KEYS) out[k] = process.env[k] || '';
mkdirSync(path.join(REPO_ROOT, 'config'), { recursive: true });
writeFileSync(path.join(REPO_ROOT, 'config', 'env.ci.json'), JSON.stringify(out, null, 2), 'utf-8');
const missing = KEYS.filter((k) => !out[k]);
console.log(missing.length ? `已写入 config/env.ci.json（缺失：${missing.join(', ')}）` : '已写入 config/env.ci.json（完整）');
