# 上游同步流程（每日定时任务）

本站基于主题 [LyraVoid/Shirone](https://github.com/LyraVoid/Shirone)，但**两个仓库没有共同的 git 历史**，不能直接 `git merge`。同步由 `scripts/upstream/sync.mjs` 逐个文件做三方合并：

- **基准**：上次同步到的上游提交（记录在 `scripts/upstream/state.json` 的 `lastSynced`）；
- **ours**：本仓库当前文件；
- **theirs**：上游 `main` 最新文件。

Claude Code 的定时任务每天执行一次本流程，也可以手动让 Claude Code「按 docs/upstream-sync.md 同步上游」。仓库所有者已授权这个流程在 CI 全绿后直接合并上线。

## 一、操作步骤

1. **检查更新**：在最新 `main` 上运行

   ```bash
   node scripts/upstream/sync.mjs
   ```

   输出「上游没有更新」就直接结束，什么都不用提交。

2. **合并**：在一个 `claude/` 开头的分支上（会话指定了分支就用指定的，从最新 `main` 重新切出）运行

   ```bash
   node scripts/upstream/sync.mjs --apply
   ```

   它把上游改动合并进工作区，并把 `state.json` 的 `lastSynced` 更新为上游最新提交。退出码 2 表示有冲突，冲突文件里留有 `<<<<<<< 本仓库 / ======= / >>>>>>> 上游` 标记，按第二节解决。

3. **依赖**：`package.json` 有变化时运行 `pnpm install --no-frozen-lockfile` 重新生成 `pnpm-lock.yaml`（锁文件不做文本合并）；否则运行 `pnpm install --frozen-lockfile` 确认依赖可装。

4. **检查**（全部通过才继续）：

   ```bash
   pnpm exec biome ci ./src
   npx astro check                 # 0 errors
   pnpm type-check                 # 只允许文档记录的 TS9013 例外
   node --test "tests/**/*.test.mjs"
   pnpm check:manifest
   pnpm check:package-manifest
   pnpm exec svelte-check --threshold error
   pnpm build
   ```

   确认 `grep -rn "<<<<<<<" --include=* . --exclude-dir=node_modules --exclude-dir=.git` 没有残留冲突标记。

5. **提交并合并**：
   - 提交信息：`chore(sync): merge upstream Shirone up to <上游短 SHA>`，正文列出上游提交与本仓库的取舍；
   - 推送，按 `.github/pull_request_template.md` 开 PR 到 `main`，PR 里写清楚每个冲突怎么解决的；
   - CI 全绿后 squash 合并，确认「Deploy to GitHub Pages」成功。

6. **拿不准就停**：冲突涉及业务逻辑、又无法判断怎么合并时，不要猜。把已完成的部分推送到分支、开 PR（不合并），在 PR 里写明卡在哪个文件、两边各改了什么，然后结束。

## 二、冲突处理原则

本仓库在主题之上做了不少站点定制，合并时这些定制优先：

| 情况 | 处理 |
|------|------|
| 两边只是写法不同（Biome 规则、格式、等价改写） | 保留本仓库版本（已通过本仓库的 Biome 检查） |
| `.github/workflows/CI.yml` | 上游的 `ci.yml` 映射到这里。接受 action 版本升级等改动；**不要**加回上游的 Comment / Style regressions 浏览器测试任务和只为它们服务的 `changes` 任务——它们针对上游演示站的内容和配置，在本站必然失败（见文件里的注释） |
| 站点配置（`src/config/*`，评论、导航、番剧、音乐等） | 保留本站的取值；上游新增的配置项照常合并进来 |
| 本站独有的功能（照片墙、游戏页、留言板、网易云音源、每日发文 / 改写脚本等） | 保留本站实现，只合入上游对其依赖的接口改动 |
| 上游的示例文章、示例配置 | 本仓库已删除的不要加回来；`state.json` 的 `keepOurs` 里的文件始终保留本站版本 |
| 上游删除了本仓库改过的文件 | 脚本会保留并标为冲突：确认本站是否还在用，没在用再删除 |
| 真正的逻辑冲突 | 读懂两边的意图后合并；拿不准按第一节第 6 步停下 |

需要长期保留本站版本的文件，加进 `state.json` 的 `keepOurs`；上游改了路径的文件，加进 `pathMap`。

## 三、同步记录

- 2026-10：同步到 v1.0.6（`90aad9b`），见 PR #62；
- 2026-10-24：同步到 `35976a5`（默认配色改为静态 CSS），见 PR #69；
- 2026-10-29：同步到 `dd1b782`（文章级许可证覆写、sharp 构建、CI 路径过滤），并引入本流程与 `scripts/upstream/sync.mjs`。
