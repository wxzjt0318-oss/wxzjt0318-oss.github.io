// 索引：本地增量缓存（tool/data/index.cache.json）+ 站点索引（web/public/data/gallery-index.json）
// 发布链路：上传/删除后把索引写成桶内对象（CDN 可读），前端相册墙与边缘函数 /api 运行时拉取，
// 上传即生效，无需重新构建部署。桶内对象名与 functions/api/index.js 的约定必须一致。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, TOOL_DATA_DIR, WEB_DATA_DIR } from './config.js';
import { createS3Client, keyFor, objectUrl, putObject } from './storages.js';

export const INDEX_CACHE_PATH = path.join(TOOL_DATA_DIR, 'index.cache.json');
export const GALLERY_INDEX_PATH = path.join(WEB_DATA_DIR, 'gallery-index.json');

/** 桶内索引对象名（CDN 公网可读）；改这里必须同步 functions/api/index.js */
export const INDEX_OBJECT_NAME = 'gallery-index.json';
/** 索引对象的 CDN 缓存时长：上传后最多 60 秒全站可见 */
export const INDEX_OBJECT_CACHE_CONTROL = 'public, max-age=60';

export function loadIndexCache() {
  if (!existsSync(INDEX_CACHE_PATH)) return { version: 1, images: [] };
  try {
    return JSON.parse(readFileSync(INDEX_CACHE_PATH, 'utf-8'));
  } catch {
    return { version: 1, images: [] };
  }
}

export function saveIndexCache(data) {
  mkdirSync(path.dirname(INDEX_CACHE_PATH), { recursive: true });
  writeFileSync(INDEX_CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function buildGalleryIndex(images, now = new Date()) {
  return { version: 1, generatedAt: now.toISOString(), images };
}

export function writeGalleryIndex(images, outPath = GALLERY_INDEX_PATH) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(buildGalleryIndex(images), null, 2), 'utf-8');
  return outPath;
}

/**
 * 把索引发布为桶内对象（CDN 公网可读），前端与边缘函数运行时拉取。
 * @returns {Promise<string>} 发布后的公网 URL
 */
export async function publishIndexToBucket(profile, images) {
  const client = createS3Client(profile);
  const key = keyFor(profile, INDEX_OBJECT_NAME);
  await putObject(client, profile.bucket, key, JSON.stringify(buildGalleryIndex(images)), {
    contentType: 'application/json',
    cacheControl: INDEX_OBJECT_CACHE_CONTROL,
    acl: profile.acl,
  });
  return objectUrl(profile, key);
}

/** 发布索引：本地静态产物（构建回退）+ 桶内对象（运行时数据源） */
export async function publishIndex(images, profile) {
  writeGalleryIndex(images);
  return publishIndexToBucket(profile, images);
}

export function removeFromCache(id) {
  const cache = loadIndexCache();
  const hit = cache.images.find((x) => x.id === id);
  if (hit) {
    cache.images = cache.images.filter((x) => x.id !== id);
    saveIndexCache(cache);
  }
  return hit;
}

export { REPO_ROOT };
