// 本地后台管理服务：仅绑定 127.0.0.1，提供存储配置 CRUD / 上传 / 图库 / 索引 API
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { loadStorages, saveStorages, loadSettings, getStorage, TOOL_DATA_DIR } from './config.js';
import { testConnection, deleteObject, createS3Client, putBucketCors, defaultCorsRules } from './storages.js';
import { uploadFile } from './upload.js';
import { loadIndexCache, removeFromCache, publishIndex, GALLERY_INDEX_PATH } from './index.js';

const ADMIN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin');
const TMP_DIR = path.join(TOOL_DATA_DIR, 'tmp');

function ensureTmp() {
  mkdirSync(TMP_DIR, { recursive: true });
}

export async function startAdminServer(port = 8787) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  ensureTmp();

  const upload = multer({
    storage: multer.diskStorage({
      destination: TMP_DIR,
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname || '.img')}`),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
  });

  // ---- 存储配置 ----
  app.get('/api/storages', (_req, res) => res.json(loadStorages()));
  app.post('/api/storages', (req, res) => {
    const data = req.body;
    if (!data || !Array.isArray(data.storages)) return res.status(400).json({ error: '格式错误' });
    saveStorages(data);
    res.json({ ok: true });
  });
  app.post('/api/storages/test', async (req, res) => {
    try {
      res.json(await testConnection(req.body));
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
  app.post('/api/storages/:id/cors', async (req, res) => {
    try {
      const profile = getStorage(req.params.id);
      const origins = Array.isArray(req.body?.origins) && req.body.origins.length ? req.body.origins : ['*'];
      await putBucketCors(createS3Client(profile), profile.bucket, defaultCorsRules(origins));
      res.json({ ok: true, origins });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ---- 上传 ----
  app.post('/api/upload', upload.array('files'), async (req, res) => {
    const storageId = req.body.storage;
    const poolOverride = req.body.pool || undefined;
    const interval = Math.max(0, parseInt(req.body.interval, 10) || 0);
    const settings = loadSettings();
    const results = [];
    try {
      const profile = getStorage(storageId);
      const files = req.files || [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          const r = await uploadFile({ filePath: f.path, profile, settings, poolOverride, log: () => {} });
          results.push({ name: f.originalname, ...r });
        } catch (e) {
          results.push({ name: f.originalname, status: 'error', error: e.message });
        } finally {
          rmSync(f.path, { force: true });
        }
        if (interval > 0 && i < files.length - 1) await new Promise((r) => setTimeout(r, interval));
      }
      // 上传即生效：把索引发布为桶内对象（CDN 60s 缓存），前端/API 运行时读取，无需重新构建部署
      let indexUrl = null;
      let indexError = null;
      if (results.some((r) => r.status !== 'error')) {
        try {
          indexUrl = await publishIndex(loadIndexCache().images, profile);
        } catch (e) {
          indexError = e.message;
        }
      }
      res.json({ ok: true, results, indexUrl, indexError });
    } catch (e) {
      for (const f of req.files || []) rmSync(f.path, { force: true });
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ---- 图库（本地索引缓存）----
  app.get('/api/gallery', (_req, res) => {
    res.json({ images: loadIndexCache().images });
  });

  app.delete('/api/gallery/:id', async (req, res) => {
    try {
      const hit = removeFromCache(req.params.id);
      if (!hit) return res.status(404).json({ ok: false, error: '索引中未找到' });
      const profile = getStorage(hit.storage);
      const client = createS3Client(profile);
      await deleteObject(client, profile.bucket, hit.key);
      await deleteObject(client, profile.bucket, hit.key.replace(/\.avif$/, '.thumb.avif'));
      // 删除后同步发布，避免已删图片继续出现在线上索引里
      try {
        await publishIndex(loadIndexCache().images, profile);
      } catch (e) {
        return res.json({ ok: true, indexWarning: `索引发布失败：${e.message}，请手动点「发布索引」补发` });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // ---- 索引 ----
  // 发布索引：写本地 gallery-index.json + 桶内对象（运行时数据源），线上约 60 秒内生效
  app.post('/api/index', async (_req, res) => {
    try {
      const images = loadIndexCache().images;
      const url = await publishIndex(images, getStorage());
      res.json({ ok: true, path: GALLERY_INDEX_PATH, url, count: images.length });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.use(express.static(ADMIN_DIR));
  app.listen(port, '127.0.0.1', () => {
    console.log(`本地上传后台已启动：http://127.0.0.1:${port}`);
  });
}

// 直接运行 `node tool/src/server.js` 时启动（CLI `rp admin` 走 startAdminServer）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startAdminServer(Number(process.env.PORT) || 8787);
}
