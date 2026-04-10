# Bangumi 每日自动发文模块说明

## 功能概述

该模块集成到现有 `.github/workflows/bangumi-update.yml` 每日定时流中，在更新 Bangumi 缓存后自动：

1. 从追番缓存中识别尚未生成文章的新动画条目
2. 拉取 Bangumi 条目详情并整理为站内统一长文结构
3. 为文章自动选择封面图（优先 Bangumi 大图，失败时回退到 Jikan 搜索，再失败则使用站内默认封面），并从同作品候选图中随机挑选 3 张插入正文
4. 生成 Markdown 文章到 `src/content/posts/`
5. 更新 `src/data/bangumi-posts-state.json` 去重状态
6. 输出审核/调试报告到 `reports/bangumi-daily-posts-latest.json`

## 新增文件

- `scripts/bangumi-daily-posts.mjs`：核心模板与选择逻辑
- `scripts/generate-bangumi-daily-post.mjs`：实际执行脚本
- `scripts/bangumi-daily-posts.test.mjs`：测试
- `src/data/bangumi-posts-state.json`：去重状态文件
- `reports/bangumi-daily-posts-latest.json`：最近一次生成报告

## 工作流接入

已接入：`.github/workflows/bangumi-update.yml`

在缓存更新完成后，工作流会执行：

```bash
pnpm run generate-bangumi-post
```

并自动提交：

- `.cache/bangumi/`
- `src/content/posts/`
- `src/data/bangumi-posts-state.json`
- `reports/bangumi-daily-posts-latest.json`

## 可配置项

通过 GitHub Actions Variables / 环境变量控制：

### `BANGUMI_POST_REVIEW_MODE`
- `true`：生成的文章会带 `draft: true`，用于审核
- `false`：直接按正式文章生成
- 默认：`false`

### `BANGUMI_POSTS_PER_RUN`
- 每次定时任务最多生成几篇文章
- 当前默认建议：`1`

### `BANGUMI_ANIME_CACHE_FILE`
- 自定义缓存输入文件路径
- 默认：`.cache/bangumi/anime.json`

## 封面图策略

优先级如下：

1. Bangumi 条目大图 `images.large`
2. Bangumi 条目通用图 `images.common`
3. Bangumi 条目中图 `images.medium`
4. Jikan 搜索结果封面
5. 站内默认封面 `/assets/anime/default.webp`

正文会自动随机插入 3 张与当前作品关联的图片；frontmatter 中的 `image` 仍作为文章封面。

## 文章结构说明

新文章沿用站内现有长文结构风格，固定包含：

- 引言
- `## 一、作品概述`
- `## 二、基础信息`
- `## 三、剧情与题材整理`
- `## 四、制作信息与公开资料`
- `## 五、追番视角下的观看要点`
- `## 六、总结`

frontmatter 字段与 `src/content.config.ts` 保持兼容。

## 审核机制

当 `BANGUMI_POST_REVIEW_MODE=true` 时：

- 文章写入为 `draft: true`
- 审核信息写入 `reports/bangumi-daily-posts-latest.json`
- 可以先人工检查后再改为发布

## 错误处理与兜底

- Bangumi 详情抓取失败：回退使用缓存中的 subject 简介
- 图片搜索失败：回退到默认封面
- 无新条目：输出报告并跳过生成
- 文章已存在：跳过写入，避免重复

## 建议运维方式

- 正式环境：`BANGUMI_POST_REVIEW_MODE=false`
- 试运行阶段：先设为 `true` 连续观察几天
- 若希望每日多篇：再提升 `BANGUMI_POSTS_PER_RUN`
