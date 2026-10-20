# zmm-RandPic · 随机图片站

个人随机图网站：**相册墙**（瀑布流展示）+ **UA 自适应随机图 API**（手机出竖图、桌面出横图），配套本地上传工具与后台管理页。图片只存 **AVIF**，上传时自动压缩、重命名、按宽高比归类图池。

## 开源公告

本项目已正式开源，采用 [MIT](LICENSE) 协议。欢迎 **Star**、**Fork**、提交 **Issue** 与 **Pull Request**。

- 纯静态前端 + 边缘函数，零服务器成本，适合个人随机图 / 图床 / 相册墙场景
- 上传即自动压缩为 AVIF、按宽高比归类、内容去重，一条龙完成
- 支持七牛云 Kodo 与 Cloudflare R2 双存储，可随时切换

> 仓库仅包含代码与配置模板，**不含任何个人图片数据**。Fork 后配置自己的存储、运行 `npm run build:index` 即可生成自己的图库索引，你的图片永远留在自己的存储桶里。

## 功能一览

| 模块 | 说明 |
|---|---|
| 相册墙（`web`） | Vue3 + Vuetify4 + Vite；瀑布流、列数滑块（3–6）、深浅主题（持久化）、自动隐藏导航、点击放大、滚动懒加载 |
| 随机图 API（`functions`） | EdgeOne Pages Functions；UA 自适应 302、`?type=` 强制、`?json=1`、`/api/list`、`/api/stats`、`/api/index`，全接口带 CORS |
| 上传工具（`tool`） | AVIF 压缩（q60）、命名 `{YYYYMMDD}{timestampS}`、图池归类、S3 上传、内容去重、间隔上传防风控 |
| 本地后台（:8787） | 拖拽上传（上传即发布索引，线上约 1 分钟生效，无需重新部署）/ 存储配置 CRUD + CORS / 图库管理（列数滑块、面板记忆） |

## 项目结构

```
zmm-RandPic/
├── web/                        # 前端相册墙
│   ├── src/App.vue             # 相册墙单页（瀑布流 / 主题 / 导航 / lightbox）
│   └── public/data/gallery-index.json   # 前端图片索引（由 build-index 生成，不入库）
├── functions/
│   ├── api/[[path]].js         # 随机图 API（EdgeOne Pages Functions）
│   └── generated/manifest.js   # API 图片清单（由 build-api-manifest 生成，不入库）
├── tool/                       # 上传工具 + 本地后台
│   ├── src/                    # config / storages / rename / compress / upload / index / server / cli
│   ├── admin/index.html        # 本地后台管理页（单文件）
│   └── test/                   # 单元测试（rename 用例）
├── scripts/                    # 重建索引 / 生成清单 / 本地 API 模拟 / 环境注入等
├── config/                     # storages.example.json / settings.example.json（真实 storages.json 不入库）
├── docs/                       # 开发文档、重命名规则、架构图、设计稿
├── .cnb.yml                   # CNB 部署流水线（push main 自动触发；密钥经 imports 从密钥仓库注入，文件内无密钥）
├── LICENSE                     # MIT
└── package.json                # npm workspaces（tool + web）
```

## 快速开始

要求：**Node ≥ 20**

```bash
npm install
```

### 1. 配置存储（二选一：七牛云 / Cloudflare R2）

```bash
cp config/storages.example.json config/storages.json   # 然后填入真实值
```

关键字段：

| 字段 | 说明 | 示例（七牛云华南） |
|---|---|---|
| `provider` | 存储类型 | `qiniu` / `r2` / `s3` |
| `endpoint` | S3 API 端点（**区域级共享端点**） | `https://s3.cn-south-1.qiniucs.com` |
| `region` | 区域 | `cn-south-1` / `auto` |
| `accessKeyId` / `secretAccessKey` | 密钥（不提交到仓库） | — |
| `bucket` | 桶名 | `your-bucket` |
| `pathPrefix` | 对象前缀（可留空 = 存桶根目录） | `""` |
| `baseUrl` | 公网图片域名（CDN，不写必崩） | `https://cdn.your-domain.com` |
| `cacheControl` | 对象缓存时长 | `public, max-age=31536000, immutable` |

> 七牛控制台里"空间专属 S3 域名"（如 `bucket.s3.cn-south-1.qiniucs.com`）只能用于 API 对接，**不能**当图片下载域名。

### 2. 启动本地后台（上传 + 存储 + 图库）

```bash
npm run admin          # → http://127.0.0.1:8787
```

首次使用：存储配置页填好档案 → 点「测试连接」→ 保存 → 回上传页拖拽图片开始上传。

### 3. 本地跑通全链路（可选）

```bash
node scripts/dev-api-server.mjs   # 本地模拟随机图 API → 8790
npm run web:dev                   # 前端 → 5173（/api 自动代理到 8790）
```

> 首次克隆后 `web/public/data/gallery-index.json` 与 `functions/generated/manifest.js` 尚未生成（两者都是脚本产物、不入库）。上传图片后索引会自动发布到桶；未生成时相册墙显示空状态提示，API 返回「图库为空」。本地联调可运行 `npm run build:index` 从桶重建。

## 上传 → 生效（无需重新部署）

1. **上传**：后台拖拽，或 CLI（见下）。上传即完成：AVIF 压缩 → 命名 → 图池归类 → S3 上传 → 写入本地索引缓存 → **自动发布索引**。
2. **索引发布（自动）**：上传/删除后自动把 `gallery-index.json` 写成**桶内对象**（CDN 公网可读，缓存 60 秒）。相册墙与随机图 API 都在**运行时**拉取它，所以上传后约 1 分钟全站生效——不需要重新构建、不需要重新部署。
   - 手动补发：后台图库页「发布索引」按钮，或 `npm run tool -- index`。
   - 发布失败不会掩盖上传结果（图片已在桶里），后台上传日志和 CLI 都会显式告警，补发即可。
3. **什么时候才需要构建 / 部署**：只有改了站点代码（前端 / 边缘函数），或想做全量对账时：

   ```bash
   npm run build:index          # 扫桶重建索引（本地索引 + manifest + 桶内对象），CI 每次部署都会跑
   npm run web:build            # 产出 web/dist
   ```

   推送到 main 即触发 CNB 流水线自动完成构建与 EdgeOne 部署。

> 兜底链路：运行时拉取失败时，相册墙回退到上次构建的静态 `gallery-index.json`，API 回退到内嵌 `manifest.js`，都不会白屏。

## CLI 命令

| 命令 | 作用 |
|---|---|
| `npm run tool -- storage add` | 新增 S3 存储档案 |
| `npm run tool -- storage list` | 列出存储档案 |
| `npm run tool -- storage test` | 测试连接（桶内对象数） |
| `npm run tool -- storage cors` | 设置/查看桶 CORS（默认 `*` → GET/HEAD） |
| `npm run tool -- storage rm` | 删除档案（仅配置，不动对象） |
| `npm run tool -- upload <files...>` | 上传图片，`--storage <id>` / `--pool <pc\|phone\|both>` / `--quality <n>` / `--delay <ms>` / `--dry-run` |
| `npm run tool -- index` | 发布索引：生成本地 `gallery-index.json` 并上传桶内对象（线上约 1 分钟生效） |
| `npm run tool -- gallery rm <id>` | 从索引和存储删除图片 |
| `npm run tool -- admin --port 8787` | 启动本地后台 |

> PowerShell 传多文件：`$files = @(...)` 数组展开，字符串拼接会被当成单个参数导致"文件不存在"。

## 随机图 API

| 路由 | 说明 |
|---|---|
| `GET /api` | 302 跳转：手机 UA → 竖图池，桌面 UA → 横图池；池空回退全量 |
| `GET /api?type=pc` / `?type=phone` | 强制指定图池 |
| `GET /api?json=1` | 返回 JSON（url / pool / 尺寸等） |
| `GET /api/list` | 全部图片清单 |
| `GET /api/stats` | 图库统计（总数 / pc / phone） |
| `GET /api/index` | 全量图片索引（相册墙数据源；运行时读取桶内对象，失败回退构建期清单） |

所有响应带 `Access-Control-Allow-Origin: *`，支持浏览器直接引用：

```html
<img src="https://你的域名/api" alt="random">
```

## 压缩 / 命名 / 归类规则

- **只存 AVIF**：主图 `quality 60 / effort 4`，长边 `pc 3840 / phone 2160 / both 2560`（`fit:inside`，**不放大不裁切**）；缩略图 640px / q55
- **命名**：`{YYYYMMDD}{timestampS}.avif`（UTC+8；有 EXIF 拍摄时间则优先），存桶根目录、无哈希无目录
- **归类**（上传自动，无需手标）：宽高比 `≥1.2 → pc`、`≤0.9 → phone`、其余 `both`
- **去重**：AVIF 编码后 SHA-256 前 8 位对比索引缓存，命中则跳过
- 参数可在 `config/settings.example.json` 调整

## 开源与隐私说明

- 密钥、本地配置、真实索引、图源素材一律**不入库**，`.gitignore` 已覆盖：`config/storages.json`、`config/settings.json`、`.env*`、`functions/generated/`、`web/public/data/gallery-index.json`、`tool/data/`、`pics/` 等
- `gallery-index.json` 与 `manifest.js` 是**脚本生成物**，含你个人图库的 URL 与元数据，请勿提交到公共仓库；别人 fork 后通过 `npm run build:index` 生成自己的索引
- 部署流水线 `.cnb.yml` **已入库**：文件里只有变量引用（`$EDGEONE_API_TOKEN` 等）和 `imports` 指向，**不含任何密钥**；真密钥放在 CNB 密钥仓库 `Secret-zmm`，构建时经 `imports` 注入。main 分支推送即触发：备份 GitHub → 扫桶重建索引 → EdgeOne 构建 → 部署
- 图片防盗链请在 CDN / 对象存储侧配置 Referer 白名单
- 只上传本人拥有版权 / 已获授权的图片，不上传他人肖像与敏感内容

## 文档

- `docs/开发文档.md` —— 完整开发记录（含决策记录、进度、跨域说明）
- `docs/重命名规则.md` —— 命名规则 v2.0
- `docs/架构图.html` —— 系统架构图
- `docs/设计稿/` —— 界面设计稿（后台 / 相册墙桌面端 / 手机端）

## 更新日志

### 2026-10-18 · 上传即生效（运行时索引）

- **背景**：原链路里上传只写桶对象 + 本地缓存，相册墙与随机 API 读的都是构建期产物（`gallery-index.json` / `manifest.js`），每次上传新图都要重新构建 + 部署才可见；且后台旧「生成」按钮只写本地文件，会造出「墙更新了、API 还是旧的」半修状态。
- **改动**：上传/删除后自动把 `gallery-index.json` 发布为**桶内对象**（CDN 公网可读，缓存 60 秒）；新增 `GET /api/index`，相册墙与 `/api`、`/api/list`、`/api/stats` 均改为**运行时拉取**，拉取失败回退构建期内嵌清单（不白屏）；后台「生成」按钮改为「发布索引」；CLI `upload` / `index` / `gallery rm` 与 `build-index.mjs` 同步发布，失败显式告警。
- **效果**：后台上传 → 约 1 分钟全站生效，**无需重新构建部署**；仅在改动站点代码或全量对账（`npm run build:index`）时才需要构建部署。
- **兼容性**：未部署新代码时线上行为不变（自动回退静态索引）；删除图片同步重发布；图片对象本身仍是长缓存，互不影响。
- **附带修复**：`.cnb.yml` 恢复入库（文件内无密钥，密钥经 CNB 密钥仓库 imports 注入），修复 9/17 开源清理起失效的 main 推送自动触发——在此之前线上已停更一个月。

## License

[MIT](LICENSE)
