#!/usr/bin/env node
// rp —— zmm-RandPic 本地上传工具 CLI
import { Command } from 'commander';
import { loadStorages, saveStorages, loadSettings, getStorage } from './config.js';
import { testConnection, deleteObject, createS3Client, putBucketCors, getBucketCors, deleteBucketCors, defaultCorsRules } from './storages.js';
import { uploadFile } from './upload.js';
import { loadIndexCache, writeGalleryIndex, removeFromCache, publishIndex } from './index.js';

const program = new Command();
program
  .name('rp')
  .description('zmm-RandPic 上传工具：AVIF 压缩 / 重命名 / S3 上传 / 索引')
  .version('0.1.0');

const storage = program.command('storage').description('S3 存储档案管理');

storage
  .command('add')
  .description('新增 S3 存储档案')
  .argument('<name>', '显示名，如 七牛-华东')
  .requiredOption('--provider <qiniu|r2|s3>', '存储类型')
  .requiredOption('--endpoint <url>', 'S3 端点')
  .requiredOption('--region <region>', '区域 ID')
  .requiredOption('--ak <key>', 'Access Key')
  .requiredOption('--sk <secret>', 'Secret Key')
  .requiredOption('--bucket <bucket>', '存储桶')
  .option('--prefix <prefix>', '对象前缀，默认 rand/', 'rand/')
  .requiredOption('--base-url <url>', '公网访问域名')
  .option('--default', '设为默认存储')
  .action((name, opts) => {
    const data = loadStorages();
    const id = opts.provider === 'r2' ? 'r2-' + (opts.bucket || 'bucket') : `${opts.provider}-${opts.region || 'region'}`;
    const exists = data.storages.some((s) => s.id === id);
    const profile = {
      id: exists ? `${id}-${Date.now().toString(36)}` : id,
      name,
      provider: opts.provider,
      endpoint: opts.endpoint,
      region: opts.region,
      accessKeyId: opts.ak,
      secretAccessKey: opts.sk,
      bucket: opts.bucket,
      pathPrefix: opts.prefix,
      baseUrl: opts.baseUrl,
      acl: 'public-read',
      cacheControl: 'public, max-age=31536000, immutable',
      enabled: true,
    };
    data.storages.push(profile);
    if (opts.default || !data.defaultStorageId) data.defaultStorageId = profile.id;
    saveStorages(data);
    console.log(`已添加存储：${profile.id}（${name}）`);
  });

storage
  .command('list')
  .description('列出全部存储档案')
  .action(() => {
    const { storages, defaultStorageId } = loadStorages();
    if (!storages.length) return console.log('（空）先运行 rp storage add');
    for (const s of storages) {
      console.log(`${s.id === defaultStorageId ? '*' : ' '} ${s.id}\t${s.name}\t${s.provider}\t${s.bucket}\t${s.baseUrl}`);
    }
  });

storage
  .command('test')
  .description('测试存储连接')
  .argument('[id]', '存储 ID，缺省用默认')
  .action(async (id) => {
    try {
      const r = await testConnection(getStorage(id));
      console.log(`连接成功，桶内对象数：${r.keyCount}`);
    } catch (e) {
      console.error(`连接失败：${e.message}`);
      process.exitCode = 1;
    }
  });

storage
  .command('rm')
  .description('删除存储档案（仅删配置，不动对象）')
  .argument('<id>')
  .action((id) => {
    const data = loadStorages();
    data.storages = data.storages.filter((s) => s.id !== id);
    if (data.defaultStorageId === id) data.defaultStorageId = data.storages[0]?.id || null;
    saveStorages(data);
    console.log(`已删除存储：${id}`);
  });

storage
  .command('cors')
  .description('设置/查看存储桶 CORS（默认 * → GET/HEAD，公开图片场景）')
  .argument('[id]', '存储 ID，缺省用默认')
  .option('--origins <list>', '允许的来源，逗号分隔，默认 *')
  .option('--list', '只查看当前规则')
  .option('--clear', '删除 CORS 规则')
  .action(async (id, opts) => {
    const profile = getStorage(id);
    const client = createS3Client(profile);
    try {
      if (opts.list) {
        const rules = await getBucketCors(client, profile.bucket);
        console.log(rules.length ? JSON.stringify(rules, null, 2) : '（未配置 CORS）');
        return;
      }
      if (opts.clear) {
        await deleteBucketCors(client, profile.bucket);
        console.log(`已删除 ${profile.bucket} 的 CORS 规则`);
        return;
      }
      const origins = opts.origins ? opts.origins.split(',').map((s) => s.trim()) : ['*'];
      await putBucketCors(client, profile.bucket, defaultCorsRules(origins));
      console.log(`已设置 ${profile.bucket} CORS：${origins.join(', ')} → GET/HEAD`);
    } catch (e) {
      console.error(`CORS 操作失败：${e.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('upload')
  .description('上传图片：自动 AVIF 压缩/重命名/图池归类/上传')
  .argument('<files...>', '图片文件或目录')
  .option('--storage <id>', '目标存储 ID，缺省用默认')
  .option('--pool <pc|phone|both>', '强制图池归属')
  .option('--quality <n>', 'AVIF 质量覆盖', parseInt)
  .option('--delay <ms>', '每张上传间隔（毫秒），防风控限流', parseInt)
  .option('--dry-run', '只处理不上传')
  .action(async (files, opts) => {
    const settings = loadSettings();
    if (opts.quality) settings.avif.quality = opts.quality;
    const profile = getStorage(opts.storage);
    const delay = Math.max(0, opts.delay || 0);
    console.log(`目标存储：${profile.id}（${profile.name}）`);
    if (delay > 0) console.log(`上传间隔：${delay}ms`);
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        await uploadFile({ filePath: f, profile, settings, poolOverride: opts.pool, dryRun: !!opts.dryRun });
      } catch (e) {
        failed += 1;
        console.error(`[失败] ${f}：${e.message}`);
      }
      if (delay > 0 && i < files.length - 1) await new Promise((r) => setTimeout(r, delay));
    }
    console.log(failed ? `完成，${failed} 个失败` : '全部完成');
    if (opts.dryRun) return;
    // 上传后自动发布索引（桶内对象，CDN 约 60 秒生效）；失败不掩盖上传结果，显式告警
    try {
      const url = await publishIndex(loadIndexCache().images, profile);
      console.log(`索引已发布：${url}（线上约 1 分钟内生效）`);
    } catch (e) {
      console.error(`[告警] 图片已上传，但索引发布失败：${e.message}`);
      console.error('        修复网络后执行 rp index 补发，否则前端看不到新图');
    }
  });

program
  .command('index')
  .description('发布索引：生成本地 gallery-index.json 并上传桶内对象（线上约 1 分钟生效）')
  .option('--out <path>', '本地输出路径，缺省 web/public/data/gallery-index.json')
  .action(async (opts) => {
    const cache = loadIndexCache();
    if (opts.out) {
      const out = writeGalleryIndex(cache.images, opts.out);
      console.log(`已生成索引：${out}（${cache.images.length} 张）`);
      return;
    }
    const url = await publishIndex(cache.images, getStorage());
    console.log(`索引已发布：${url}（${cache.images.length} 张，线上约 1 分钟内生效）`);
  });

const gallery = program.command('gallery').description('图库索引管理');
gallery
  .command('rm')
  .description('从索引删除图片（并删除存储对象）')
  .argument('<id>', '图片 ID（文件名基名）')
  .action(async (id) => {
    const hit = removeFromCache(id);
    if (!hit) return console.error(`索引中未找到：${id}`);
    const profile = getStorage(hit.storage);
    const client = createS3Client(profile);
    await deleteObject(client, profile.bucket, hit.key);
    await deleteObject(client, profile.bucket, hit.key.replace(/\.avif$/, '.thumb.avif'));
    console.log(`已删除：${id}（存储 ${profile.id}）`);
    // 删除后同步发布，线上索引立即移除该图
    try {
      const url = await publishIndex(loadIndexCache().images, profile);
      console.log(`索引已发布：${url}`);
    } catch (e) {
      console.error(`[告警] 索引发布失败：${e.message}，请执行 rp index 补发`);
    }
  });

program
  .command('admin')
  .description('启动本地后台管理页')
  .option('--port <n>', '端口，默认 8787', parseInt)
  .action(async (opts) => {
    const { startAdminServer } = await import('./server.js');
    await startAdminServer(opts.port || 8787);
  });

program.parse();
