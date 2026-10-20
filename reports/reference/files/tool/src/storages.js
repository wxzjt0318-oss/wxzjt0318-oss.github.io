// S3 客户端封装：七牛 Kodo 与 CF R2 统一走 S3 兼容协议（path-style）
import {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  DeleteBucketCorsCommand,
} from '@aws-sdk/client-s3';

export function createS3Client(profile) {
  return new S3Client({
    region: profile.region || 'auto',
    endpoint: profile.endpoint,
    credentials: {
      accessKeyId: profile.accessKeyId,
      secretAccessKey: profile.secretAccessKey,
    },
    forcePathStyle: true,
    maxAttempts: 3,
  });
}

/** 规范化 pathPrefix：去首尾斜杠，统一以 / 结尾 */
export function normalizePrefix(prefix = '') {
  const p = String(prefix || '').replace(/^\/+|\/+$/g, '');
  return p ? `${p}/` : '';
}

/** 拼接对象 key：{prefix}{filename}（当前无年月目录，直存根目录） */
export function keyFor(profile, ...segments) {
  return normalizePrefix(profile.pathPrefix) + segments.filter(Boolean).join('/');
}

/** 由 baseUrl + key 生成公网 URL（分类/中文已取消，仍对路径段做 encode 以兼容） */
export function objectUrl(profile, key) {
  const base = String(profile.baseUrl || '').replace(/\/+$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function headObject(client, bucket, key) {
  const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return {
    exists: true,
    size: r.ContentLength,
    metadata: r.Metadata || {},
    contentType: r.ContentType,
  };
}

export async function headExists(client, bucket, key) {
  try {
    await headObject(client, bucket, key);
    return true;
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

export async function listKeys(client, bucket, prefix) {
  const keys = [];
  let token;
  do {
    const r = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    keys.push(...(r.Contents || []).map((o) => o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function putObject(client, bucket, key, body, { contentType, cacheControl, acl, metadata } = {}) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
      ACL: acl,
      Metadata: metadata,
    }),
  );
}

export async function deleteObject(client, bucket, key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** 连通性自检：ListObjectsV2 取 1 条 */
export async function testConnection(profile) {
  const client = createS3Client(profile);
  const r = await client.send(new ListObjectsV2Command({ Bucket: profile.bucket, MaxKeys: 1 }));
  return { ok: true, keyCount: r.KeyCount ?? 0 };
}

/**
 * 默认 CORS 规则：公开图片场景
 * 允许任意来源 GET/HEAD（浏览器 <img>/<picture> 展示 + fetch 读取元数据），暴露 ETag/Content-Length
 */
export function defaultCorsRules(origins = ['*']) {
  return [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length'],
      MaxAgeSeconds: 86400,
    },
  ];
}

export async function putBucketCors(client, bucket, rules) {
  await client.send(
    new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }),
  );
}

export async function getBucketCors(client, bucket) {
  const r = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  return r.CORSRules || [];
}

export async function deleteBucketCors(client, bucket) {
  await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }));
}
