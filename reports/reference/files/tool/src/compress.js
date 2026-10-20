// 图片处理：sharp AVIF 编码 + 缩略图（全部本地完成，不裁剪、不缩放留白）
import sharp from 'sharp';

/**
 * 读取图片方向校正后的尺寸（用于图池归类）
 * EXIF orientation >= 5 时宽高互换
 */
export async function orientedSize(filePath) {
  const meta = await sharp(filePath, { failOn: 'none' }).metadata();
  let { width, height, orientation } = meta;
  if (orientation >= 5) [width, height] = [height, width];
  return { width, height, orientation, format: meta.format };
}

/** AVIF 主图编码：旋转校正 → 长边限制（fit: inside，不放大、不裁切） */
export async function encodeAvif(filePath, { maxDimension, quality, effort }) {
  const buffer = await sharp(filePath, { failOn: 'none' })
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .avif({ quality, effort })
    .toBuffer();
  const m = await sharp(buffer).metadata();
  return { buffer, width: m.width, height: m.height, size: buffer.length };
}

/** 缩略图：长边 width，AVIF */
export async function encodeThumb(input, { width, quality }) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .avif({ quality })
    .toBuffer();
}
