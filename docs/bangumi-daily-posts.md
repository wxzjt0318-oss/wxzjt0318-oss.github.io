# Bangumi 每日自动发文模块说明

## 功能概述

该模块集成到现有 `.github/workflows/bangumi-update.yml` 每日定时流中，在更新 Bangumi 缓存后自动：

1. 从追番缓存中识别尚未生成文章的新动画条目
2. 拉取 Bangumi 条目详情并整理为站内统一长文结构
3. 为文章自动选择封面图（优先 Bangumi 大图，次优先 Bangumi 通用图，失败则使用站内默认封面）
4. 生成 Markdown 文章到 `src/content/posts/`
5. 更新 `src/data/bangumi-posts-state.json` 去重状态
6. 输出审核/调试报告到 `reports/bangumi-daily-posts-latest.json`

## 核心文件

- `scripts/bangumi-daily-posts.mjs`：核心模板、图片选择逻辑
- `scripts/generate-bangumi-daily-post.mjs`：实际执行脚本
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

## 数据来源

模块目前仅依赖 Bangumi API 作为数据源：

- **封面图片**：从 Bangumi 条目 `images.large` 或 `images.common` 获取
- **作品信息**：从 Bangumi 条目详情 API 获取（标题、简介、标签、制作信息等）
- **追番状态**：从本地缓存的 Bangumi 收藏数据获取

## 图片策略

优先级如下：

1. Bangumi 条目大图 `images.large`
2. Bangumi 条目通用图 `images.common`
3. 站内默认封面 `/assets/anime/default.webp`

## 文章结构说明（精简六板块结构）

新文章采用精简六板块结构：

### 引言
- 个性化开场白，与题材类型相匹配

### 第一部分：作品概述
- 作品基本信息、收藏状态、题材定位

### 第二部分：基础信息
- 表格形式呈现作品名、原名、Bangumi 链接、放送时间、话数、制作公司等

### 第三部分：剧情与题材整理
- 作品简介和题材分析

### 第四部分：制作信息与公开资料
- 制作团队核心成员及制作相关信息

### 第五部分：追番视角下的观看要点
- 从追番角度分析作品的观看价值

### 第六部分：总结
- 对全文进行总结性陈述

frontmatter 字段与 `src/content.config.ts` 保持兼容。

## 内容质量保障

### Bangumi 数据标准遵循
- 所有信息内容基于 Bangumi 官方 API 数据
- 自动获取条目详情，确保信息真实可靠
- 符合动漫领域的专业表述规范

### 题材适配
- 根据作品题材类型自动选择合适的开篇语
- 支持恋爱、百合、奇幻、校园、热血、治愈、日常等多种题材

## 审核机制

当 `BANGUMI_POST_REVIEW_MODE=true` 时：

- 文章写入为 `draft: true`
- 审核信息写入 `reports/bangumi-daily-posts-latest.json`
- 可以先人工检查后再改为发布

## 错误处理与兜底

- Bangumi 详情抓取失败：回退使用缓存中的 subject 简介
- 图片获取失败：回退到默认封面 `/assets/anime/default.webp`
- 无新条目：输出报告并跳过生成
- 文章已存在：跳过写入，避免重复

## 建议运维方式

- 正式环境：`BANGUMI_POST_REVIEW_MODE=false`
- 试运行阶段：先设为 `true` 连续观察几天
- 若希望每日多篇：再提升 `BANGUMI_POSTS_PER_RUN`

## 模块维护指南

### 扩展新的内容板块

如需在六板块基础上扩展新的内容板块，请修改 `bangumi-daily-posts.mjs` 中的 `buildAnimeArticleMarkdown` 函数。

### 调整图片策略

如需调整图片评分逻辑，请修改 `bangumi-daily-posts.mjs` 中的 `chooseBestCoverImage` 函数。

### 随机推荐机制

选择下一个动画候选时，系统会：

1. 按更新时间排序所有收藏
2. 进行随机打乱
3. 过滤掉已生成文章或已存在的条目
4. 确保每日推荐内容的多样性

## 优化记录

### 2026-04-10 精简优化（第二版）

- **移除了正文随机图片生成与插入功能**：不再在正文中插入多张随机图片
- **移除了萌娘百科 API 调用逻辑**：萌娘百科 API 返回内容为空，移除相关依赖
- **简化了图片评分系统**：移除了 `jikan-search` 和 `moegirl-wiki` 图片来源评分
- **精简了代码结构**：bangumi-daily-posts.mjs 从约 500 行减少到约 316 行

### 2026-04-10 精简优化（第一版）

- 移除了冗余的高级搜索系统（`advancedMoegirlSearch`）
- 移除了过于复杂的百科全书式文章模板
- 简化了图片评分系统
- 精简了角色、世界观、剧情等专业解析函数
- 优化了随机推荐机制，提升内容多样性
- 保持了所有核心功能：数据获取、封面选择、文章生成、去重机制
