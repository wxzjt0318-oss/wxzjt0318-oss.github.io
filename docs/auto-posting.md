# 自动发文模块说明（Bangumi 每日追番 + 萌娘百科增强）

本文档说明博客的自动发文模块：它做什么、怎么运行、如何排障。
适用文件：

| 文件 | 作用 |
| --- | --- |
| `scripts/generate-bangumi-daily-post.mjs` | 每日发文主流程（选候选 → 抓详情 → 生成文章 → 查重 → 落盘） |
| `scripts/bangumi-daily-posts.mjs` | 共享工具库（Markdown 模板、封面选择、查重算法、状态记录） |
| `scripts/moegirl/scraper.mjs` | 萌娘百科精准爬取工具（本模块内容增强源） |
| `scripts/moegirl/rewrite-bangumi-posts.mjs` | 存量 bangumi 文章的批量重写/维护工具 |
| `.github/workflows/bangumi-update.yml` | GitHub Actions 每日定时驱动 |

---

## 一、整体功能

模块每天从 **Bangumi 追番快照** 中选出一部尚未写过文章的作品，自动抓取资料并生成一篇结构完整的作品介绍文章（`src/content/posts/bangumi-<subjectId>.md`），随后提交到仓库并触发部署。

文章结构固定为：作品概述 → 基础信息 → 剧情简介 → 主要角色 → 制作阵容 → 作品看点 → 综合评价。

数据来源优先级：

1. **番剧快照** `src/data/anime-snapshots/bangumi.json`（由 `anime:sync` 每日刷新，与番剧页同源）作为候选池；
2. **Bangumi API**（`api.bgm.tv`）补充条目详情、角色表、封面图；
3. **萌娘百科**（`zh.moegirl.org.cn`，可选增强，默认开启）提供更准确完整的作品导言与剧情简介，替换 Bangumi 简介；
4. 全部失败时仍有降级链：萌娘百科失败 → Bangumi 简介；Bangumi 失败 → 快照自带短简介。

### 内置安全机制

- **选候选去重**：已存在于 state 记录或已有文章（按标题/别名比对）的作品不会重复发文；
- **正文查重**：新文章与全部现有文章做加权相似度检测（标题 0.4 / 描述 0.3 / 正文 0.3，阈值 70），疑似重复时中止发文；可用 `BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE=1` 强制放行；
- **别名唯一**：slug 冲突时回退到稳定的 `bangumi-<subjectId>`，保证 URL 不互相覆盖；
- **快照保护**：`anime:sync` 抓取为空时保留上一份有效快照（`keepLastValid`），不会因为 API 故障把数据清空。

---

## 二、日常使用

### 1. 全自动（默认，无需操作）

GitHub Actions 每天北京时间 16:00 运行 `bangumi-update.yml`：

```text
anime:sync 刷新快照 → generate-bangumi-post 生成 1 篇文章 → 提交并推送 → 自动触发部署
```

在仓库 **Actions → Update Bangumi Data → Run workflow** 可随时手动触发；
勾选 `clear_cache` 会先清空快照再重新抓取（数据异常时用）。

### 2. 本地手动发文

```bash
# 先刷新追番快照（需要能访问 api.bgm.tv）
pnpm.cmd anime:sync --provider bangumi

# 生成 1 篇文章（默认）；一次多发可设环境变量
pnpm.cmd generate-bangumi-post
```

```bash
# Windows 环境变量示例：一次发 3 篇、且先进入草稿审核
set BANGUMI_POSTS_PER_RUN=3
set BANGUMI_POST_REVIEW_MODE=1
pnpm.cmd generate-bangumi-post
```

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `BANGUMI_POSTS_PER_RUN` | `1` | 单次运行发文数量上限 |
| `BANGUMI_POST_REVIEW_MODE` | `false` | `1/true` 时新文章标记 `draft: true`，需人工改为 `false` 才会发布 |
| `BANGUMI_POST_MOEGIRL` | `true` | `0` 时关闭萌娘百科增强，纯用 Bangumi 简介 |
| `BANGUMI_DAILY_POSTS_ALLOW_DUPLICATE` | `false` | `1` 时跳过查重中止（慎用） |

产出物：

- 文章：`src/content/posts/bangumi-<subjectId>.md`
- 状态：`src/data/bangumi-posts-state.json`（本地记录，防止重复选取）
- 报告：`reports/bangumi-daily-posts-latest.json`（本次选取、封面候选、输出路径）

### 3. 萌娘百科爬取工具（单条查询）

```bash
# 查看某条目解析结果（导言 + 章节结构）
pnpm.cmd moegirl:fetch "伪恋 OAD"

# 输出完整 JSON（含全文）
node scripts/moegirl/scraper.mjs "伪恋" --json

# 跳过缓存强制重新抓取
node scripts/moegirl/scraper.mjs "伪恋" --no-cache
```

特性：标题变体回退（自动去掉 `OAD/OVA/第X季` 等后缀匹配系列主条目）→ 全文搜索兜底；
结果缓存于 `.cache/moegirl/`（7 天 TTL，已 gitignore，可安全删除重建）。

### 4. 存量文章批量重写（维护工具）

```bash
# 全部 bangumi-* 文章：重新抓萌娘百科，重写概述/剧情简介 + 标签 + 分类
pnpm.cmd posts:rewrite-moegirl

# 只预演不写文件
node scripts/moegirl/rewrite-bangumi-posts.mjs --dry-run

# 只处理指定条目
node scripts/moegirl/rewrite-bangumi-posts.mjs --only 104196,4255

# 只更新 frontmatter（description/标签/分类），不动正文
node scripts/moegirl/rewrite-bangumi-posts.mjs --meta-only
```

重写规则：

- `description` ← 萌娘百科导言首段（≤120 字）；
- 「一、作品概述」← 萌娘百科导言 + 原作介绍，文末附出处链接（CC BY-NC-SA 3.0）；
- 「三、剧情简介」← 萌娘百科「剧情简介」章节（抓不到则保留原文）；
- 标签重建为 `作品名 / 题材≤3 / 形式≤1 / 其他≤1 / Bangumi`（≤7 个，作品名置顶保证区分度）；
- 分类重建为每篇独立短语 `《作品名》+ 主题材`，全库唯一；
- **其余内容一律不动**：基础信息、主要角色、制作阵容、看点、评价、封面、
  sourceLink、alias、发布日期均保持原值。

运行报告：`reports/moegirl-rewrite-latest.json`（含每篇命中情况与变更明细）。

---

## 三、注意事项

1. **网络依赖**：`anime:sync` 与详情抓取依赖 `api.bgm.tv`；该 API 故障（如 502）时
   发文会自动使用快照与萌娘百科兜底，但候选池不会更新。萌娘百科大陆可直连。
2. **内容授权**：萌娘百科内容采用 **CC BY-NC-SA 3.0 CN**，重写后的文章正文已自动附
   出处链接，请勿移除；Bangumi 数据遵循其 API 使用条款。
3. **抓取礼仪**：萌娘百科工具内置 300ms 请求间隔与 7 天缓存，请勿缩短间隔或用于批量镜像。
4. **不要手工改 bangumi-* 文章的正文结构**：重写工具与查重依赖固定小节标题
   （`## 一、作品概述` 等）；要深度定制某篇作品，请新建自主编辑文章（中文文件名），
   模块的去重机制会保护它不被覆盖。
5. **重复文章处理原则**：同一作品同时存在自动发文与自主编辑文章时，**保留自主编辑版**，
   删除 `bangumi-<id>.md` 即可；后续模块不会为同一作品再次发文。
6. **草稿审核流**：希望先发后审，设置 `BANGUMI_POST_REVIEW_MODE=1`，
   审核时把文章 frontmatter 的 `draft: true` 改为 `false` 再提交。
7. **缓存清理**：`.cache/moegirl/` 可随时整个删除；解析逻辑升级时工具会通过
   缓存版本号自动失效旧缓存，无需手动处理。
