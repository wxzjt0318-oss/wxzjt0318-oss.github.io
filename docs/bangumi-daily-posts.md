# Bangumi 每日自动发文模块说明

## 功能概述

该模块是一个纯 Bangumi 数据驱动的自动发文流程，集成在 `.github/workflows/bangumi-update.yml` 每日定时流中。在更新 Bangumi 缓存后会自动：

1. 从动画收藏缓存中识别尚未生成文章的新条目
2. 拉取 Bangumi 条目详情与角色信息
3. 为文章自动选择封面图（优先 Bangumi 大图，其次通用图，失败则回退站内默认封面）
4. 生成 Markdown 文章到 `src/content/posts/`
5. 更新 `src/data/bangumi-posts-state.json` 去重状态
6. 输出最近一次生成报告到 `reports/bangumi-daily-posts-latest.json`

## 核心文件

- `scripts/generate-bangumi-daily-post.mjs`：自动发文主控脚本
- `scripts/bangumi-daily-posts.mjs`：候选筛选、元数据整理、Markdown 模板与状态写入工具
- `src/data/bangumi-posts-state.json`：已生成文章的状态记录
- `reports/bangumi-daily-posts-latest.json`：最近一次生成结果报告

## 工作流接入

已接入：`.github/workflows/bangumi-update.yml`

在缓存更新与页面数据同步完成后，工作流会执行：

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
- `true`：生成的文章会带 `draft: true`，用于人工审核
- `false`：直接生成正式文章
- 默认：`false`

### `BANGUMI_POSTS_PER_RUN`
- 每次定时任务最多生成几篇文章
- 当前默认建议：`1`

## 数据来源

模块当前仅依赖 Bangumi 数据：

- **动画收藏缓存**：来自 `.cache/bangumi/anime.json`
- **条目详情**：来自 Bangumi Subject Detail API
- **角色信息**：来自 Bangumi Subject Characters API
- **封面图片**：来自 Bangumi 条目 `images.large` 或 `images.common`

## 图片策略

优先级如下：

1. Bangumi 条目大图 `images.large`
2. Bangumi 条目通用图 `images.common`
3. 站内默认封面 `/assets/anime/default.webp`

## 文章结构说明

纯 Bangumi 版文章采用固定结构：

### 引言
- 基于 Bangumi 简介自动提炼 1~3 句开场说明

### 作品信息
- 表格形式展示作品名、原名、Bangumi 链接、首播时间、话数、动画制作、题材标签、追番状态

### 剧情概述
- 优先使用 Bangumi summary
- 当条目简介不足时使用兜底说明

### 制作信息
- 从 Bangumi infobox 中提取导演、监督、系列构成、人物设定、制作公司等

### 主要角色介绍
- 当 Bangumi 角色接口返回数据时，按角色列表自动生成角色小节

### 观看要点
- 根据标签和追番语境输出固定分析模板

### 总结
- 输出收束性总结段落

frontmatter 字段与 `src/content.config.ts` 保持兼容。

## 审核机制

当 `BANGUMI_POST_REVIEW_MODE=true` 时：

- 文章写入为 `draft: true`
- 审核信息写入 `reports/bangumi-daily-posts-latest.json`
- 可人工检查后再发布

## 错误处理与兜底

- Bangumi 详情抓取失败：回退使用缓存中的 `short_summary`
- Bangumi 角色抓取失败：跳过角色段落，不阻塞发文
- 图片获取失败：回退到默认封面 `/assets/anime/default.webp`
- 无新条目：输出空报告并跳过生成
- 文章已存在：通过状态文件与现有文章双重去重，避免重复写入

## 当前实现边界

当前模块**只面向站内 Markdown 自动生成**，不包含：

- 萌娘百科增强内容
- 自动润色/文风重写
- 多平台分发发布
- 可视化编辑器或模板后台

## 建议运维方式

- 正式环境：`BANGUMI_POST_REVIEW_MODE=false`
- 试运行阶段：先设为 `true` 连续观察几天
- 若希望每日多篇：再提升 `BANGUMI_POSTS_PER_RUN`

## 模块维护指南

### 调整候选选择策略

如需修改发文候选筛选逻辑，请调整 `bangumi-daily-posts.mjs` 中的 `selectNextAnimeCandidate`。

### 调整图片策略

如需调整图片评分逻辑，请修改 `bangumi-daily-posts.mjs` 中的 `chooseBestCoverImage`。

### 调整文章结构

如需调整当前纯 Bangumi 模板，请修改 `bangumi-daily-posts.mjs` 中的 `buildAnimeArticleMarkdown`。
