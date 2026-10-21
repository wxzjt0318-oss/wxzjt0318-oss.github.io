# 长文改写流程（每日定时任务）

每日自动发文（[`docs/auto-posting.md`](./auto-posting.md)）只产出**资料稿**：结构与站内长文一致、只含 Bangumi / 萌娘百科 / 维基百科的事实，正文末尾带 `<!-- shirone:auto-draft -->`。本流程把资料稿改写成带个人语气的深度长文，并重写引言、分类、标签，最后合并上线。

它由 Claude Code 的定时任务每天执行一次（北京时间约 20:47），也可以手动让 Claude Code「按 docs/longform-rewrite.md 改写资料稿」。不调用付费 API。

GitHub 的定时任务经常推迟 4–7 小时，发文工作流可能在改写任务之后才运行，所以第 0 步会先确认当天的资料稿已经生成。发文脚本每天只发一篇（当天已有 `bangumi-*.md` 文章就跳过），手动触发后迟到的定时运行不会重复发文。

## 一、操作步骤

0. **确认今天已发文**：在最新的 `main` 上查看 `src/content/posts/bangumi-*.md` 里有没有 `published:` 为今天（北京时间）的文章。没有的话，用 GitHub 工具对 `main` 手动触发「Update Bangumi Data」工作流（`bangumi-update.yml`，workflow_dispatch），等它运行完成（约 3 分钟，它会自动触发部署），再 `git pull`。工作流成功但仍没有新文章（没有候选作品）就继续下一步。

1. **找资料稿**：在最新的 `main` 上运行

   ```bash
   node scripts/wiki/find-auto-drafts.mjs
   ```

   输出 `共 0 篇待改写` 就直接结束，什么都不用提交。

2. **建分支并抓资料**：本沙箱访问不了萌娘百科和维基百科，资料由 GitHub Actions 抓取。
   - 在一个 `claude/` 开头的分支上工作（会话指定了分支就用指定的，否则用 `claude/longform-<日期>`），从最新 `main` 切出。
   - 运行 `node scripts/wiki/find-auto-drafts.mjs --requests`，它会写出 `scripts/wiki/source-requests.json`，每篇一组 `{ zh, ja, en }`：`zh` 是中文标题与主要角色名，`ja` 是日文原名，`en` 是由文章英文链接还原的罗马字 / 英文标题。可以手动补充更准确的条目名（例如系列主条目的日文名、官方英文名）。
   - 提交 `source-requests.json` 并推送。推送会触发「Fetch Wiki Sources」工作流（`.github/workflows/fetch-wiki-sources.yml`，4 个分片，约 2 分钟），它把结果提交回同一分支的 `reports/wiki-sources/<slug>.json`。
   - 等待：用 GitHub 工具查看该工作流运行完成（每个有资料的分片提交一个 `chore(sources)`，篇数少时不足 4 个），然后 `git pull`。不要用前台 `sleep`。

3. **写稿**：每篇按第二节的要求写到会话的临时目录（如 `<scratchpad>/longform/<slug>.md`）。超过 3 篇时，可以把文章分给几个子代理并行写，把本文件第二节原样交给它们，并要求它们不要碰 git。

4. **写回文章**：

   ```bash
   node scripts/wiki/assemble-longform.mjs <临时目录> <slug> [...slug]
   ```

   它打印每篇的中文字数与假名数（假名应接近 0）。写回后正文不再带资料稿标记。

5. **检查**（全部通过才继续）：
   - `node scripts/wiki/find-auto-drafts.mjs` 不再列出刚改写的文章；
   - 所有 `](/posts/<x>/)` 站内链接的 `<x>` 都是某篇文章的 `alias` 或文件名；
   - `npx astro check` 0 errors，`node --test "tests/**/*.test.mjs"` 全部通过。

6. **清理并合并**：
   - `git rm -r --cached reports/wiki-sources`、`git rm scripts/wiki/source-requests.json`（两者都不进 `main`）；
   - 按约定式提交提交（`docs(posts): long-form rewrites — <作品名>`），推送，开 PR 到 `main`（按 `.github/pull_request_template.md` 的结构填写）；
   - CI 全绿后 squash 合并，确认「Deploy to GitHub Pages」运行成功；
   - 用户已授权这一流程直接合并上线。CI 失败时修复后再合并，修不了就在 PR 上留言说明并停止。

## 二、写作要求

### 稿件格式

稿件开头 5 行依次为：

- `description: ` 120–200 字中文简介，单行；
- `quote: ` 封面上方的引言：一句话——角色口吻的台词，或「设定 + 反转」句式，贴合作品主旨；
- `category: ` 一个概括作品主题的短语（如「邪王真眼的中二恋爱」），不要用「XX作品介绍」；
- `tags: ` JSON 数组，最多 7 个：2–3 个类型 + 原作类型（如「轻小说改」）+ 形式（OVA / 剧场版，TV 不写）+ 播出季（如「2026年7月」）+ 1–2 个作品主题词 + 系列名（同系列文章靠它聚在一起）；不写星期、电视台、制作公司；
- `refs: ` 参考资料，`[名称](链接)` 用 ` | ` 分隔：Bangumi 条目必列，实际采用的萌娘百科 / 维基百科（中文、日文、英文）/ Anime News Network / Kitsu 页面也列上（用 json 里的 `url`）；留空则保留文章原有的参考资料。

之后是正文 Markdown：开头一两段后单独一行 `{{COVER}}`（封面位置）。不要写 frontmatter、引言和参考资料小节。

### 结构

参照手写范文 `src/content/posts/tonikaku-kawaii-deep-analysis.md`，以及已改写的长文（如 `bangumi-29648.md` 主作品、`bangumi-347887.md` 续作、`bangumi-241418.md` OVA）：

开头「说实话……」式的个人化引入 → `{{COVER}}` → `# 一、` 作者与原作 / 基本信息表 → 剧情简介 → 动画制作信息表与声优阵容 → 分阶段剧情解析（加 `> ⚠️` 剧透提示）→ 角色解析 → 名场面 / 主题曲 / 原作与动画差异（有资料时）→ 观看顺序与入坑建议 → `# 总结` 收尾金句。标题用 `# 一、`、`## 1.1` 层级。

### 字数

主作品 TV 动画 4000–5000 中文字；续作 3000–4000；OVA / 剧场版 / 短篇 1500–2500。资料少（例如刚开播的新番）时宁可写短（2000–3000），**绝不编造**。成人向作品只写基本信息与系列介绍，不写露骨内容。

### 硬性要求

- 全中文：作品原名、歌名可保留日文原文并附中文译名；人名用通行中文译名。
- 事实只能来自 `reports/wiki-sources/<slug>.json` 与资料稿里的 Bangumi 数据：播出日期、话数、staff、声优、剧情、销量、奖项都不能凭空写。资料稿里的声优表可能有错配，以百科为准。不确定就不写。资料里常混有错配的无关条目，忽略它们。
- 资料来源与优先级（JSON 结构见 `scripts/wiki/fetch-sources.mjs` 开头）：
  1. **日文维基百科**（`<日文查询>.jawiki`）：日本动画、轻小说、漫画的作品概要、制作阵容、播出信息、主题曲通常最完整，事实优先以它为准；
  2. **萌娘百科**、**中文维基百科**（`<中文查询>.moegirl` / `.wikipedia`）：中文译名（角色名、歌名、作品名）以它们为准；
  3. **英文维基百科**（`.enwiki`）、**Anime News Network**（`_databases.ann`，结构化的 staff / 声优 / 分集标题）、**Kitsu**（`_databases.kitsu`，播出日期、话数、简介）：用于补充与交叉核对。
  - 外文资料是原文，写稿时翻译成中文，不要整段照搬；不同来源说法冲突时以日文维基为准，仍拿不准就不写。
  - ニコニコ大百科、pixiv 百科事典会拦截 GitHub Actions 的请求，AniList 接口已停用，暂未接入。
- 站内链接只能用 `/posts/<alias>/`，`<alias>` 必须是某篇文章 frontmatter 的 `alias` 或 `src/content/posts/` 下的文件名（不含 `.md`）。资料稿的「系列作品」小节已列出站内同系列文章，可直接沿用。
- 不改手写文章（没有资料稿标记的文章）。
