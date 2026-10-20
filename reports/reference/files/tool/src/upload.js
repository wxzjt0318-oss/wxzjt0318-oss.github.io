// 上传管线：EXIF/尺寸 → 图池归类 → AVIF 编码 → 缩略图 → 重命名 → S3 上传 → 索引更新
import { existsSync } from 'node:fs';
import exifr from 'exifr';
import {
  createS3Client,
  headExists,
  keyFor,
  objectUrl,
  putObject,
} from './storages.js';
import { orientedSize, encodeAvif, encodeThumb } from './compress.js';
import { buildBaseName, hashHex, pickDatetime, makeFileRe } from './rename.js';
import { loadIndexCache, saveIndexCache } from './index.js';

const EXIF_PICK = [
  'DateTimeOriginal',
  'ISO',
  'FNumber',
  'ExposureTime',
  'Orientation',
  'Make',
  'Model',
  'LensModel',
];

/** 图池归类：比例 ≥ pcMinRatio → pc；≤ phoneMaxRatio → phone；其余 → both */
export function classifyPool(width, height, { pcMinRatio = 1.2, phoneMaxRatio = 0.9 } = {}) {
  const ratio = width / height;
  if (ratio >= pcMinRatio) return 'pc';
  if (ratio <= phoneMaxRatio) return 'phone';
  return 'both';
}

function buildExifSummary(exif) {
  if (!exif) return null;
  return {
    datetime:
      exif.DateTimeOriginal instanceof Date
        ? exif.DateTimeOriginal.toISOString()
        : exif.DateTimeOriginal || null,
    aperture: exif.FNumber ?? null,
    shutter: exif.ExposureTime ?? null,
    iso: exif.ISO ?? null,
    make: exif.Make ?? null,
    model: exif.Model ?? null,
    lens: exif.LensModel ?? null,
  };
}

/**
 * 上传单张图片
 * @returns {{status:'uploaded'|'skipped'|'dry-run', ...}}
 */
export async function uploadFile({
  filePath,
  profile,
  settings,
  poolOverride,
  dryRun = false,
  log = console.log,
}) {
  if (!existsSync(filePath)) throw new Error(`文件不存在：${filePath}`);

  let exif = null;
  try {
    exif = await exifr.parse(filePath, EXIF_PICK);
  } catch {
    /* EXIF 解析失败不阻断上传 */
  }

  const sizeInfo = await orientedSize(filePath);
  const pool = poolOverride || classifyPool(sizeInfo.width, sizeInfo.height, settings.pool);
  const maxDim = settings.avif.maxDimension[pool] ?? 2560;

  const main = await encodeAvif(filePath, {
    maxDimension: maxDim,
    quality: settings.avif.quality,
    effort: settings.avif.effort,
  });
  const thumbBuf = await encodeThumb(main.buffer, {
    width: settings.thumb.width,
    quality: settings.thumb.quality,
  });

  const hash = hashHex(main.buffer, settings.rename.hashLength);
  const baseName = buildBaseName({ datetime: pickDatetime({ exif }) });

  // 幂等：本地索引已有相同 hash → 跳过
  const cache = loadIndexCache();
  const existing = cache.images.find((i) => i.hash === hash);
  if (existing) {
    log(`[跳过] ${filePath} → 已存在 ${existing.id}（hash 相同，幂等）`);
    return { status: 'skipped', reason: 'hash-exists', id: existing.id, pool, hash, image: existing };
  }

  // key 冲突处理：主 key 已存在 → 追加 -2/-3…
  const client = createS3Client(profile);
  let mainKey = keyFor(profile, `${baseName}.avif`);
  if (!dryRun && (await headExists(client, profile.bucket, mainKey))) {
    let n = 2;
    while (await headExists(client, profile.bucket, keyFor(profile, `${baseName}-${n}.avif`))) n += 1;
    mainKey = keyFor(profile, `${baseName}-${n}.avif`);
  }
  const thumbKey = mainKey.replace(/\.avif$/, '.thumb.avif');

  const entry = {
    id: baseName,
    storage: profile.id,
    pool,
    url: objectUrl(profile, mainKey),
    thumb: objectUrl(profile, thumbKey),
    key: mainKey,
    width: main.width,
    height: main.height,
    ratio: Number((main.width / main.height).toFixed(3)),
    exif: buildExifSummary(exif),
    size: main.size,
    hash,
    createdAt: new Date().toISOString(),
  };

  if (dryRun) {
    log(`[dry-run] ${filePath}\n  池=${pool} 尺寸=${main.width}x${main.height} 大小=${(main.size / 1024).toFixed(0)}KB\n  key=${mainKey}`);
    return { status: 'dry-run', ...entry };
  }

  const metadata = {
    width: String(main.width),
    height: String(main.height),
    pool,
    hash,
    createdat: entry.createdAt,
    exifdatetime: entry.exif?.datetime ? String(entry.exif.datetime) : '',
  };
  await putObject(client, profile.bucket, mainKey, main.buffer, {
    contentType: 'image/avif',
    cacheControl: profile.cacheControl,
    acl: profile.acl,
    metadata,
  });
  await putObject(client, profile.bucket, thumbKey, thumbBuf, {
    contentType: 'image/avif',
    cacheControl: profile.cacheControl,
    acl: profile.acl,
    metadata: { ...metadata, variant: 'thumb' },
  });

  cache.images.push(entry);
  cache.images.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  saveIndexCache(cache);

  log(`[上传成功] ${filePath}\n  id=${entry.id} 池=${pool} ${main.width}x${main.height} ${(main.size / 1024).toFixed(0)}KB\n  ${entry.url}`);
  return { status: 'uploaded', ...entry };
}
