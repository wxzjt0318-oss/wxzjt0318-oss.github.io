# 自动发文模块工作流程审计报告

> 审计日期：2026-05-27
> 审计范围：自动发文模块全链路（触发 → 数据获取 → 内容生成 → 审核 → 部署 → 错误处理）
> 审计目标：梳理完整工作流程，识别潜在风险点，提出优化建议

---

## 一、模块架构总览

### 1.1 核心文件清单

| 文件路径 | 类型 | 职责说明 |
|---------|------|---------|
| `.github/workflows/bangumi-update.yml` | GitHub Actions 工作流 | 每日定时触发，协调整个数据更新与发文流程 |
| `.github/workflows/trigger-bangumi.yml` | GitHub Actions 工作流 | 手动触发入口，通过 repository_dispatch 触发主工作流 |
| `.github/workflows/deploy.yml` | GitHub Actions 工作流 | 网站部署工作流，接收 bangumi-update 的 dispatch 事件 |
| `scripts/generate-bangumi-daily-post.mjs` | Node.js 主控脚本 | 自动发文核心逻辑，负责候选筛选、API调用、文章生成 |
| `scripts/bangumi-daily-posts.mjs` | Node.js 工具库 | 提供候选筛选、元数据整理、Markdown模板、验证与状态管理函数 |
| `scripts/bangumi-daily-posts.test.mjs` | Vitest 单元测试 | 对核心工具函数的自动化测试 |
| `scripts/sync-bangumi-cache.mjs` | Node.js 同步脚本 | 将缓存数据同步到页面数据文件 (`src/data/bangumi-data.json`) |
| `src/data/bangumi-posts-state.json` | JSON 状态文件 | 记录已生成文章的 subjectId、文件路径、发布状态等去重信息 |
| `reports/bangumi-daily-posts-latest.json` | JSON 报告文件 | 最近一次生成结果的详细报告 |
| `reports/bangumi-daily-posts-test-report.md` | Markdown 测试报告 | 模块测试结论与上线策略建议 |
| `docs/bangumi-daily-posts.md` | Markdown 文档 | 模块功能说明与配置指南 |

### 1.2 依赖关系图

```
trigger-bangumi.yml (手动触发)
        │
        ▼  repository_dispatch: update-bangumi
bangumi-update.yml (主工作流)
        │
        ├──→ Fetch Bangumi Anime Data (API: /v0/users/{id}/collections)
        ├──→ Fetch Bangumi Game Data  (API: /v0/users/{id}/collections)
        ├──→ Verify Cache Files
        ├──→ Sync Bangumi Cache       (pnpm sync-bangumi-cache)
        ├──→ Install & Generate Post   (pnpm generate-bangumi-post)
        │       │
        │       ├──→ generate-bangumi-daily-post.mjs (主控)
        │       │       ├──→ selectNextAnimeCandidate()  [bangumi-daily-posts.mjs]
        │       │       ├──→ fetchBangumiSubjectDetail() [Bangumi API /v0/subjects/{id}]
        │       │       ├──→ fetchBangumiCharacters()    [Bangumi API /v0/subjects/{id}/characters]
        │       │       ├──→ resolveCoverImage()         [chooseBestCoverImage()]
        │       │       ├──→ buildArticlePayload()
        │       │       ├──→ buildAnimeArticleMarkdown() [bangumi-daily-posts.mjs]
        │       │       ├──→ 写入 .md 文件到 src/content/posts/
        │       │       ├──→ 更新 bangumi-posts-state.json
        │       │       └──→ 输出 reports/bangumi-daily-posts-latest.json
        │       │
        │       └──→ 工具函数库 (bangumi-daily-posts.mjs)
        │               ├──→ validateArticleMetadata()
        │               ├──→ validateCharacterData()
        │               ├──→ validateCacheEntry()
        │               ├──→ verifyCacheClassification()
        │               ├──→ autoFillMetadata()
        │               ├──→ buildFrontmatter()
        │               └──→ sanitizeFileName() / slugifyTitle()
        │
        ├──→ Verify Generated Content
        ├──→ Commit Changes (git push to main)
        ├──→ Trigger Deploy Workflow (repository_dispatch: deploy)
        └──→ Notify (Slack / Discord)
```

---

## 二、触发条件分析

### 2.1 自动定时触发

**工作流文件**：`.github/workflows/bangumi-update.yml`

```yaml
on:
  schedule:
    - cron: '0 8 * * *'   # 每日 UTC 08:00（北京时间 16:00）
```

- **触发频率**：每天一次
- **触发时间**：北京时间 16:00（UTC 08:00）
- **时区配置**：`TZ: "Asia/Shanghai"`
- **并发控制**：`concurrency.group: "bangumi-update"`，`cancel-in-progress: true`

### 2.2 手动触发

**触发入口**：`.github/workflows/trigger-bangumi.yml`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `force_update` | boolean | `true` | 强制更新缓存 |
| `clear_cache` | boolean | `false` | 清除所有缓存后重新获取 |
| `skip_build` | boolean | `false` | 兼容性参数，已无实际作用 |
| `force_sync` | boolean | `true` | 强制同步缓存到页面数据 |

手动触发通过 `peter-evans/repository-dispatch@v3` 发送 `update-bangumi` 事件到主工作流。

### 2.3 Repository Dispatch 触发

主工作流同时监听 `repository_dispatch.types: [update-bangumi]` 事件，支持从其他工作流或外部系统触发。

---

## 三、数据获取流程

### 3.1 Bangumi 收藏列表获取

**API 端点**：`https://api.bgm.tv/v0/users/{USER_ID}/collections`

| 参数 | 值 | 说明 |
|------|-----|------|
| `subject_type` | `2`（动画）/ `4`（游戏） | 条目类型 |
| `limit` | `100` | 每页数量 |
| `offset` | 递增 | 分页偏移量 |

**分页策略**：
- 每次请求获取 100 条数据
- 当返回数据少于 100 条时停止分页
- 使用临时文件逐步合并分页结果

**请求配置**：
- 连接超时：30 秒
- 最大超时：120 秒
- User-Agent：`wxzjt0318-oss-bangumi-daily-posts/1.0`
- 缓存控制：`no-cache`

### 3.2 Bangumi 条目详情获取

**API 端点**：`https://api.bgm.tv/v0/subjects/{subject_id}`

- 获取条目的完整信息，包括 `infobox` 字段（含动画制作、导演、系列构成等）
- 失败时返回 `null`，不阻塞后续流程

### 3.3 Bangumi 角色信息获取

**API 端点**：`https://api.bgm.tv/v0/subjects/{subject_id}/characters`

- 获取条目关联的角色列表
- 失败时返回空数组，跳过角色段落生成

### 3.4 数据缓存策略

| 缓存文件 | 位置 | 内容 |
|---------|------|------|
| 动画缓存 | `.cache/bangumi/anime.json` | 用户动画收藏列表 |
| 游戏缓存 | `.cache/bangumi/games.json` | 用户游戏收藏列表 |
| 页面数据 | `src/data/bangumi-data.json` | 同步后的结构化数据 |

缓存更新时机：
- 每日定时任务自动更新
- 手动触发时可选 `clear_cache=true` 强制清除重建

---

## 四、内容生成机制

### 4.1 候选筛选逻辑

**函数**：`selectNextAnimeCandidate()`（`bangumi-daily-posts.mjs`）

**筛选流程**：

```
1. 从缓存中提取所有条目，标准化 subject_id
2. 按 updated_at 时间降序排序
3. 取前 max(10, maxPerRun*10) 个最近更新的条目
4. 随机打乱（Fisher-Yates shuffle）
5. 逐一遍历，排除：
   ├── subjectId 已在 bangumi-posts-state.json 中记录的
   ├── subjectId 已在现有文章的 sourceLink 中出现的
   └── 标题（normalizeText 后）与现有文章标题重复的
6. 返回最多 maxPerRun 个候选
```

**去重机制**（双重保障）：
1. **状态文件去重**：检查 `bangumi-posts-state.json` 中的 `generated[].subjectId`
2. **现有文章去重**：扫描 `src/content/posts/*.md` 的 frontmatter 中的 `sourceLink` 和 `title`

### 4.2 元数据自动填充

**函数**：`autoFillMetadata()`（`bangumi-daily-posts.mjs`）

| 字段 | 填充逻辑 |
|------|---------|
| `title` | 优先中文名，其次日文名，最后 `Bangumi 条目 {id}` |
| `description` | 从 summary 截取前 120 字符 |
| `tags` | 从 Bangumi 标签取前 5 个 + 平台信息 + "Bangumi" |
| `category` | 根据 tags 自动判断（轻小说/漫画/游戏/音乐/动画） |
| `sourceLink` | `https://bgm.tv/subject/{subjectId}` |
| `published` | 当前日期 `YYYY-MM-DD` |
| `alias` | `slugifyTitle()` 生成（仅 ASCII，最长 80 字符） |
| `image` | Bangumi 大图 > 通用图 > 默认封面 |
| `author` | 固定值 `"灵梦"` |
| `licenseName` | 固定值 `"CC BY 4.0"` |
| `draft` | 由 `BANGUMI_POST_REVIEW_MODE` 环境变量控制 |

### 4.3 封面图选择策略

**函数**：`chooseBestCoverImage()`（`bangumi-daily-posts.mjs`）

**优先级**：
1. Bangumi 条目大图 `images.large`（评分 100）
2. Bangumi 条目通用图 `images.common`（评分 80）
3. 站内默认封面 `/assets/anime/default.webp`（兜底）

**候选来源**：
- `detail.images.large` / `detail.images.common`
- `subject.images.large` / `subject.images.common` / `subject.images.medium`

### 4.4 Markdown 文章生成

**函数**：`buildAnimeArticleMarkdown()`（`bangumi-daily-posts.mjs`）

**文章结构**：

```markdown
---
frontmatter (title, description, tags, category, ...)
---

> 引言（基于类型标签的模板化引言）

---

# 作品名称

## 一、作品概述
（从简介中提取 1~3 句开场 + 基础信息总结）

## 二、基础信息
（作品名、原名、动画制作、首播时间、话数、标签、追番状态、链接）

## 三、剧情简介
（Bangumi summary 或兜底说明）

## 主要角色
（从 Bangumi 角色 API 数据生成，含 CV 信息）

## 制作阵容
（从 Bangumi infobox 提取导演、监督、系列构成、人物设定等）

## 四、作品看点
（基于标签和追番语境的模板化分析）

## 五、综合评价
（收束性总结段落）
```

### 4.5 文件命名策略

**函数**：`sanitizeFileName()`（`bangumi-daily-posts.mjs`）

- 从标题中去除 `<>:"/\|?*` 及控制字符
- 保留中文字符
- 空格合并为单个空格
- 兜底名称：`bangumi-{subjectId}`
- 文件扩展名：`.md`
- 输出目录：`src/content/posts/`

---

## 五、审核流程

### 5.1 审核模式

**环境变量**：`BANGUMI_POST_REVIEW_MODE`

| 模式 | `draft` 值 | 行为 |
|------|-----------|------|
| 审核模式 (`true`) | `draft: true` | 文章写入但不公开发布，需人工审核后手动改为 `false` |
| 正式模式 (`false`) | `draft: false` | 文章直接发布 |

**当前状态**：GitHub Actions 变量 `BANGUMI_POST_REVIEW_MODE` 默认为 `false`（正式发布模式）。

### 5.2 审核报告

**输出文件**：`reports/bangumi-daily-posts-latest.json`

```json
{
  "generatedAt": "ISO 时间戳",
  "reviewMode": true/false,
  "selectedAnime": { ... },
  "coverCandidates": [ ... ],
  "outputPath": "文章输出路径",
  "statePath": "状态文件路径"
}
```

### 5.3 人工审核流程（建议）

1. 将 `BANGUMI_POST_REVIEW_MODE` 设为 `true`
2. 每日定时任务自动生成 `draft: true` 的文章
3. 人工检查 `reports/bangumi-daily-posts-latest.json` 中的报告
4. 审核文章内容、封面图、标签等
5. 确认无误后将 frontmatter 中的 `draft` 改为 `false`
6. 提交更改，触发部署

---

## 六、平台对接方式

### 6.1 GitHub Actions 工作流链

```
[定时/手动] → bangumi-update.yml → 更新缓存 → 生成文章 → git push to main → dispatch deploy → deploy.yml → GitHub Pages
```

### 6.2 Git 提交策略

**提交范围**：
- `.cache/bangumi/`（缓存数据）
- `src/content/posts/`（生成的文章）
- `src/data/bangumi-data.json`（同步后的页面数据）
- `src/data/bangumi-posts-state.json`（状态记录）
- `reports/bangumi-daily-posts-latest.json`（生成报告）

**提交信息**：`chore: update bangumi cache and daily anime post`

**推送目标**：`origin HEAD:main`

### 6.3 部署触发

文章提交到 `main` 分支后，通过两种方式触发部署：
1. **自动触发**：`deploy.yml` 监听 `push` 到 `main` 分支的事件
2. **手动触发**：`bangumi-update.yml` 通过 `repository_dispatch: deploy` 事件显式触发

### 6.4 通知机制

**成功通知**：
- Slack 通知（需配置 `SLACK_WEBHOOK_URL`）
- Discord 通知（需配置 `DISCORD_WEBHOOK_URL`）

**失败通知**：
- 同样通过 Slack 和 Discord 发送失败消息

---

## 七、错误处理机制

### 7.1 API 请求错误

| 错误场景 | 处理策略 | 是否阻塞 |
|---------|---------|---------|
| HTTP 429（速率限制） | 输出错误信息，设置 `cache_updated=false`，`exit 1` | **是** |
| HTTP 非 200 | 输出错误信息，设置相应 output，`exit 1` | **是** |
| JSON 格式无效 | 输出响应预览，`exit 1` | **是** |
| 条目详情获取失败 | 输出警告，返回 `null`，使用缓存中的 `short_summary` | 否 |
| 角色信息获取失败 | 输出警告，返回空数组，跳过角色段落 | 否 |

### 7.2 内容生成错误

| 错误场景 | 处理策略 |
|---------|---------|
| 无新条目可选 | 输出空报告，跳过生成，正常退出 |
| 元数据验证失败 | 输出警告到 console，不阻塞生成 |
| 角色数据验证失败 | 输出警告，仍包含该角色 |
| 文件名生成失败 | 使用兜底名称 `bangumi-{subjectId}` |

### 7.3 图片获取错误

| 错误场景 | 处理策略 |
|---------|---------|
| Bangumi 图片 URL 无效 | 跳过该候选 |
| 所有图片候选均无效 | 使用默认封面 `/assets/anime/default.webp` |

### 7.4 工作流级别错误

| 错误场景 | 处理策略 |
|---------|---------|
| 缓存获取失败 | `exit 1`，工作流失败 |
| 文章生成脚本失败 | `exit 1`，工作流失败 |
| 同步计数不一致 | `exit 1`，建议 `clear_cache=true` 重跑 |
| Git 提交无变更 | 跳过提交和部署触发 |
| 部署触发失败 | 不影响主流程 |

### 7.5 全局错误捕获

**主控脚本**（`generate-bangumi-daily-post.mjs`）：

```javascript
main().catch((error) => {
    console.error("❌ Bangumi daily post generation failed:", error);
    process.exit(1);
});
```

**工作流错误处理步骤**：

```yaml
- name: Handle Errors
  id: handle-error
  if: failure()
  run: |
    echo "::error title=Bangumi Update Failed::The workflow encountered an error"
    echo "error_message=Workflow failed during data fetch, sync, validation, or deployment" >> $GITHUB_OUTPUT
```

---

## 八、重试策略

### 8.1 当前重试机制

**现状**：模块当前**没有内置自动重试机制**。

- API 请求失败后直接退出（`exit 1`）或跳过（返回 null/空数组）
- 工作流级别通过 `concurrency.cancel-in-progress: true` 控制并发，但不自动重试

### 8.2 手动重试方式

1. **重新触发工作流**：通过 GitHub Actions 页面手动运行 `Trigger Bangumi Update Workflow`
2. **清除缓存重试**：设置 `clear_cache: true` 和 `force_update: true`
3. **强制同步**：设置 `force_sync: true`

### 8.3 速率限制应对

Bangumi API 的速率限制（HTTP 429）是当前最大的运行风险：
- 当前处理：检测到 429 后直接失败退出
- 缺失：没有退避重试（exponential backoff）机制

---

## 九、验证机制

### 9.1 数据验证

**缓存条目验证**（`validateCacheEntry()`）：
- 检查 `link` 或 `subjectId` 存在
- 检查 `title` 或 `titleRaw` 存在
- 检查 `contentType` 存在且有效

**文章元数据验证**（`validateArticleMetadata()`）：
- 必需字段检查：`title`, `category`, `author`, `published`, `image`
- 类型检查：字符串、日期、URL、数组、布尔
- 返回 `{ valid, errors, warnings, metadata }`

**角色数据验证**（`validateCharacterData()`）：
- 检查 `name` 存在
- 检查 `cv` 类型为字符串

### 9.2 缓存分类验证

**函数**：`verifyCacheClassification()`

生成验证报告，包含：
- 总条目数 / 有效 / 无效 / 动画 / 游戏 / 未分类
- 详细错误和警告列表

### 9.3 同步计数一致性检查

工作流中的 `Validate Sync Count Consistency` 步骤：
- 比较获取的动画数量与同步后的页面数据数量
- 不一致时 `exit 1`，建议 `clear_cache=true` 重跑

### 9.4 单元测试

**测试文件**：`scripts/bangumi-daily-posts.test.mjs`

| 测试用例 | 验证内容 |
|---------|---------|
| 候选筛选 | 正确排除已生成的条目，选择下一个未见条目 |
| 封面图选择 | 优先选择 Bangumi 大图而非通用图 |
| 时间排序 | 优先选择最近更新的条目 |
| Markdown 生成 | 文章包含正确的 frontmatter 和章节结构 |
| 状态记录 | 正确创建 subjectId、status、generatedAt |
| 空摘要处理 | 优雅处理缺失的 summary 字段 |

---

## 十、完整工作流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        触 发 阶 段                              │
├─────────────────────────────────────────────────────────────────┤
│  [定时 cron: 0 8 * * *]  ──或──  [手动 workflow_dispatch]       │
│                    │                                            │
│                    ▼                                            │
│         bangumi-update.yml 启动                                  │
│                    │                                            │
│         ┌──────────┴──────────┐                                 │
│         ▼                     ▼                                 │
│   清除缓存（可选）        Checkout 代码                          │
│   (clear_cache=true)      Setup Node.js + pnpm                  │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     数 据 获 取 阶 段                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐      ┌─────────────────┐                 │
│   │ Fetch Anime Data │      │ Fetch Game Data  │                │
│   │ (subject_type=2) │      │ (subject_type=4) │                │
│   └────────┬────────┘      └────────┬────────┘                 │
│            │                        │                           │
│            ▼                        ▼                           │
│   分页获取 (limit=100)      分页获取 (limit=100)                │
│   HTTP 429 → exit 1         HTTP 429 → exit 1                   │
│   HTTP !200 → exit 1        HTTP !200 → exit 1                  │
│   JSON 无效 → exit 1        JSON 无效 → exit 1                  │
│            │                        │                           │
│            ▼                        ▼                           │
│   .cache/bangumi/anime.json  .cache/bangumi/games.json          │
│                                                                 │
│            └────────────┬────────────┘                          │
│                         ▼                                       │
│              Verify Cache Files                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     同 步 阶 段                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   条件：schedule || (dispatch && force_sync) || (repo_dispatch)  │
│                    │                                            │
│                    ▼                                            │
│         pnpm sync-bangumi-cache                                 │
│                    │                                            │
│                    ▼                                            │
│         src/data/bangumi-data.json 更新                         │
│                    │                                            │
│                    ▼                                            │
│         Validate Sync Count Consistency                         │
│         (fetched vs synced 不一致 → exit 1)                     │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   文 章 生 成 阶 段                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         pnpm install && pnpm generate-bangumi-post              │
│                    │                                            │
│                    ▼                                            │
│   ┌────────────────────────────────────────────┐                │
│   │     generate-bangumi-daily-post.mjs         │                │
│   │                                             │                │
│   │  1. 读取缓存 (.cache/bangumi/anime.json)    │                │
│   │     └→ 无缓存 → 跳过，输出空报告            │                │
│   │                                             │                │
│   │  2. 标准化集合数据                          │                │
│   │     └→ 映射 subject_id, type, ep_status     │                │
│   │                                             │                │
│   │  3. selectNextAnimeCandidate()              │                │
│   │     ├→ 按更新时间排序                       │                │
│   │     ├→ 取最近 max(10, 20) 个               │                │
│   │     ├→ 随机打乱                             │                │
│   │     ├→ 排除已生成（状态文件）               │                │
│   │     ├→ 排除已存在（文章目录）               │                │
│   │     └→ 返回 0~1 个候选                      │                │
│   │     └→ 无候选 → 输出空报告，退出            │                │
│   │                                             │                │
│   │  4. fetchBangumiSubjectDetail(subjectId)    │                │
│   │     └→ 失败 → 返回 null，继续               │                │
│   │                                             │                │
│   │  5. fetchBangumiCharacters(subjectId)       │                │
│   │     └→ 失败 → 返回 []，继续                 │                │
│   │                                             │                │
│   │  6. resolveCoverImage()                     │                │
│   │     ├→ collectBangumiImageCandidates()      │                │
│   │     ├→ chooseBestCoverImage() (评分排序)    │                │
│   │     └→ 无候选 → 默认封面                    │                │
│   │                                             │                │
│   │  7. buildArticlePayload()                   │                │
│   │     ├→ 提取标题、描述、标签                 │                │
│   │     ├→ 构建 meta (studio, airDate, eps)     │                │
│   │     └→ 提取 staff 信息                      │                │
│   │                                             │                │
│   │  8. buildAnimeArticleMarkdown(payload)      │                │
│   │     ├→ buildFrontmatter()                   │                │
│   │     ├→ autoFillMetadata()                   │                │
│   │     ├→ generate 引言/信息/剧情/角色/看点    │                │
│   │     └→ 拼接完整 Markdown                    │                │
│   │                                             │                │
│   │  9. sanitizeFileName() → 生成文件名         │                │
│   │                                             │                │
│   │  10. fs.writeFile() → 写入 src/content/posts│                │
│   │                                             │                │
│   │  11. 更新 bangumi-posts-state.json          │                │
│   │                                             │                │
│   │  12. 输出 reports/bangumi-daily-posts-latest │                │
│   └────────────────────────────────────────────┘                │
│                                                                 │
│                    ▼                                            │
│         Verify Generated Content                                │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   提 交 与 部 署 阶 段                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         git add (缓存 + 文章 + 状态 + 报告)                      │
│                    │                                            │
│              ┌─────┴─────┐                                      │
│              ▼           ▼                                      │
│         有变更？      无变更                                     │
│              │           │                                      │
│              ▼           ▼                                      │
│     git commit &    跳过提交                                     │
│     git push main   跳过部署                                     │
│              │                                                  │
│              ▼                                                  │
│     repository_dispatch: deploy                                 │
│              │                                                  │
│              ▼                                                  │
│     deploy.yml 启动                                             │
│              │                                                  │
│              ▼                                                  │
│     pnpm build → GitHub Pages 部署                              │
│              │                                                  │
│              ▼                                                  │
│     通知 (Slack / Discord)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十一、配置参数汇总

### 11.1 环境变量

| 变量名 | 来源 | 默认值 | 说明 |
|--------|------|--------|------|
| `BANGUMI_USER_ID` | GitHub Vars | `1180323` | Bangumi 用户 ID |
| `BANGUMI_POST_REVIEW_MODE` | GitHub Vars | `false` | 审核模式开关 |
| `BANGUMI_POSTS_PER_RUN` | Workflow env | `1` | 每次运行最多生成文章数 |
| `TZ` | Workflow env | `Asia/Shanghai` | 时区设置 |

### 11.2 代码内常量

| 常量 | 值 | 位置 | 说明 |
|------|-----|------|------|
| `DEFAULT_MAX_PER_RUN` | `1` | `bangumi-daily-posts.mjs` | 每次默认生成文章数 |
| `DEFAULT_FALLBACK_IMAGE` | `/assets/anime/default.webp` | `bangumi-daily-posts.mjs` | 默认封面图 |
| `BANGUMI_API_BASE` | `https://api.bgm.tv/v0` | `generate-bangumi-daily-post.mjs` | API 基础地址 |

### 11.3 路径配置

| 路径 | 说明 |
|------|------|
| `.cache/bangumi/anime.json` | 动画收藏缓存 |
| `.cache/bangumi/games.json` | 游戏收藏缓存 |
| `src/content/posts/` | 文章输出目录 |
| `src/data/bangumi-posts-state.json` | 状态记录文件 |
| `src/data/bangumi-data.json` | 同步后的页面数据 |
| `reports/bangumi-daily-posts-latest.json` | 生成报告 |

---

## 十二、潜在风险与优化建议

### 12.1 高优先级风险

#### 风险 1：Bangumi API 速率限制无重试机制

**现状**：检测到 HTTP 429 后直接 `exit 1`，工作流失败。

**建议**：
- 实现指数退避重试（exponential backoff），最多重试 3 次
- 在分页请求间增加延迟（如 500ms~1000ms）
- 考虑使用 Bangumi API 的 `Retry-After` 响应头

#### 风险 2：并发控制过于激进

**现状**：`cancel-in-progress: true` 意味着新的定时任务会取消正在运行的上一个任务。

**建议**：
- 如果任务执行时间较长（涉及多次 API 调用），考虑改为 `cancel-in-progress: false`
- 或者增加任务锁机制，避免重复执行

#### 风险 3：slugifyTitle 生成纯 ASCII 别名

**现状**：`slugifyTitle()` 会剥离所有非 ASCII 字符（包括中文），导致别名无意义。

**建议**：
- 对中文标题使用 `sanitizeFileName()` 作为别名基础
- 或保留拼音转换方案

### 12.2 中优先级风险

#### 风险 4：文章质量依赖 Bangumi 数据完整性

**现状**：当 Bangumi 条目缺少 `summary`、`infobox`、`characters` 等信息时，生成的文章内容会非常单薄。

**建议**：
- 增加数据完整性评分，优先选择数据丰富的条目
- 对数据不完整的条目自动标记 `draft: true` 待人工补充

#### 风险 5：封面图候选可能包含重复 URL

**现状**：虽然 `chooseBestCoverImage()` 内部有去重，但候选收集阶段可能产生重复。

**建议**：已在 `chooseBestCoverImage()` 中通过 `Set` 去重，风险较低。

#### 风险 6：状态文件可能膨胀

**现状**：`bangumi-posts-state.json` 的 `generated` 数组会持续增长。

**建议**：
- 定期归档旧记录
- 或改用数据库/SQLite 存储

### 12.3 低优先级优化

#### 优化 1：增加 API 请求缓存

对于已获取过的条目详情，可以缓存到本地，避免重复请求。

#### 优化 2：增加文章模板多样性

当前所有文章使用相同的模板结构，可以增加模板变体或随机化元素。

#### 优化 3：增加多语言支持

当前文章仅生成中文，可以考虑生成日文/英文版本。

#### 优化 4：增加监控指标

- 每日生成成功率
- 平均 API 响应时间
- 文章质量评分（基于数据完整性）

---

## 十三、测试覆盖情况

### 13.1 已覆盖

| 测试项 | 测试文件 | 状态 |
|--------|---------|------|
| 候选筛选逻辑 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |
| 封面图评分排序 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |
| 时间排序优先级 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |
| Markdown 文章模板 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |
| 状态记录生成 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |
| 空摘要处理 | `bangumi-daily-posts.test.mjs` | ✅ 通过 |

### 13.2 未覆盖

| 测试项 | 风险等级 | 说明 |
|--------|---------|------|
| API 请求错误处理 | 高 | 未 mock API 调用测试错误路径 |
| 分页逻辑 | 高 | 未测试多页数据合并 |
| 并发安全 | 中 | 未测试状态文件的并发读写 |
| 文件名特殊字符 | 中 | 未测试含特殊字符的标题 |
| 大规模数据性能 | 低 | 未测试大量缓存条目时的性能 |

---

## 十四、审计结论

### 14.1 模块优势

1. **架构清晰**：模块职责分离明确，工具库/主控脚本/工作流各司其职
2. **去重有效**：双重去重机制（状态文件 + 文章索引）确保不重复生成
3. **降级优雅**：API 失败时有合理的降级策略，不阻塞整体流程
4. **审核支持**：支持 `draft: true` 的审核模式
5. **可观测性**：生成报告 + 工作流 Step Summary 提供良好的可观测性
6. **测试覆盖**：核心工具函数有单元测试保障

### 14.2 主要改进方向

1. **增加 API 请求的重试机制**（高优先级）
2. **优化 slugifyTitle 对中文的处理**（高优先级）
3. **增加数据完整性评分以提升文章质量**（中优先级）
4. **补充 API 错误路径的测试覆盖**（中优先级）
5. **增加状态文件的归档机制**（低优先级）

### 14.3 运维建议

| 环境 | 建议配置 |
|------|---------|
| 生产环境 | `BANGUMI_POST_REVIEW_MODE=false`，`BANGUMI_POSTS_PER_RUN=1` |
| 试运行 | `BANGUMI_POST_REVIEW_MODE=true`，连续观察 3~7 天 |
| 扩容阶段 | 稳定后提升 `BANGUMI_POSTS_PER_RUN` 至 2~3 |
| 紧急重试 | 手动触发，`clear_cache=true`，`force_sync=true` |
