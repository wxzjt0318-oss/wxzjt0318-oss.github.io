# 长文改写流程（每日定时任务）

每日自动发文（[`docs/auto-posting.md`](./auto-posting.md)）只产出**资料稿**：结构与站内长文一致、只含 Bangumi / 萌娘百科 / 维基百科的事实，正文末尾带 `<!-- shirone:auto-draft -->`，frontmatter 为 `draft: true`。本流程把资料稿改写成带个人语气的深度长文，并重写引言、分类、标签，去掉资料稿标记，把 `draft` 改回 `false`，最后合并上线。

它由定时任务每天执行一次（北京时间约 20:47；Claude Code 或 Cursor 云端代理都按本文执行）。也可以手动让代理「按 docs/longform-rewrite.md 改写资料稿」。不调用付费 API。

## 时间与发布闸门

| 时刻（北京时间） | 谁在跑 | 访客能看到什么 |
| --- | --- | --- |
| 14:17，cron `17 6 * * *` UTC。GitHub 定时经常推迟数小时，晚 4–7 小时也正常 | `.github/workflows/bangumi-update.yml` | 番剧快照和 **1 篇资料稿**推到 `main`。资料稿是 `draft: true`。随后触发的部署只更新快照。生产构建不收录 `draft: true`，也不收录正文仍带 `<!-- shirone:auto-draft -->` 的文章 |
| 16:00，cron `0 8 * * *` UTC | `.github/workflows/deploy.yml` 兜底重建 | 再次生产构建。资料稿仍然不会出现在首页、文章页、归档、标签、RSS、sitemap 或 llms.txt |
| 约 20:47 | 本长文改写任务 | 改写仓库里**所有**仍带资料稿标记的文章，不限 `published` 是不是今天。`scripts/wiki/assemble-longform.mjs` 去掉标记并把 `draft` 写成 `false`。PR squash 合并进 `main` 之后的部署，访客才看得到长文 |

GitHub 发文可能晚于 20:47。遇到这种情况**不要**触发「Update Bangumi Data」（`bangumi-update.yml` 的 `workflow_dispatch`）。云端代理没有 `actions:write`，调用会 403；而且也不需要。晚到的资料稿仍以草稿进入 `main`，不会先上线。下一轮约 20:47 的改写会扫到它。发文脚本每天只留一篇（当天已有 `bangumi-*.md`，含草稿，就跳过），迟到的定时运行不会重复发文。

## 一、操作步骤

0. **不要触发发文工作流**。在最新的 `main` 上直接找资料稿。今天的文章还没生成不是错误：只处理已经在仓库里的资料稿；一篇都没有就结束，什么都不用提交。

1. **找资料稿**：在最新的 `main` 上运行

   ```bash
   node scripts/wiki/find-auto-drafts.mjs
   ```

   输出 `共 0 篇待改写` 就直接结束，什么都不用提交。

2. **建分支并抓资料**：本沙箱访问不了萌娘百科和维基百科，资料由 GitHub Actions 抓取。
   - 在一个 `claude/` 或 `cursor/` 开头的分支上工作（会话指定了分支就用指定的；未指定时，Claude Code 用 `claude/longform-<日期>`，Cursor 用 `cursor/longform-<日期>`），从最新 `main` 切出。
   - 运行 `node scripts/wiki/find-auto-drafts.mjs --requests`，它会写出 `scripts/wiki/source-requests.json`，每篇一组 `{ zh, ja, en, bangumi }`：`zh` 是中文标题与主要角色名，`ja` 是日文原名，`en` 是由文章英文链接还原的罗马字 / 英文标题，`bangumi` 是 Bangumi 条目编号。可以手动补充更准确的条目名（例如系列主条目的日文名、官方英文名）。
   - 提交 `source-requests.json` 并推送。推送会触发「Fetch Wiki Sources」工作流（`.github/workflows/fetch-wiki-sources.yml`，4 个分片，约 2 分钟），它把结果提交回同一分支的 `reports/wiki-sources/<slug>.json`。
   - 等待：用 GitHub 工具查看该工作流运行完成（每个有资料的分片提交一个 `chore(sources)`，篇数少时不足 4 个），然后 `git pull`。不要用前台 `sleep`。

3. **写稿**：每篇按第二节的要求写到会话的临时目录（如 `<scratchpad>/longform/<slug>.md`）。超过 3 篇时，可以把文章分给几个子代理并行写，把本文件第二节原样交给它们，并要求它们不要碰 git。

4. **写回文章**：

   ```bash
   node scripts/wiki/assemble-longform.mjs <临时目录> <slug> [...slug]
   ```

   它打印每篇的中文字数与假名数（假名应接近 0）。写回后正文不再带资料稿标记，frontmatter 的 `draft` 为 `false`。这两件事都发生之后，生产构建才会收录这篇文章。

5. **检查**（全部通过才继续）：
   - `node scripts/wiki/find-auto-drafts.mjs` 不再列出刚改写的文章；
   - 刚改写的文章 frontmatter 是 `draft: false`，正文没有 `<!-- shirone:auto-draft -->`；
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
- `refs: ` 参考资料，`[名称](链接)` 用 ` | ` 分隔：Bangumi 条目必列，实际采用的其他来源页面（各百科、しょぼいカレンダー、アニメハック、MyAnimeList 等）也列上（用 json 里的 `url`）；留空则保留文章原有的参考资料。

之后是正文 Markdown：开头一两段后单独一行 `{{COVER}}`（封面位置）。不要写 frontmatter、引言和参考资料小节。

### 结构

参照手写范文 `src/content/posts/tonikaku-kawaii-deep-analysis.md`，以及已改写的长文（如 `bangumi-29648.md` 主作品、`bangumi-347887.md` 续作、`bangumi-241418.md` OVA）：

开头「说实话……」式的个人化引入 → `{{COVER}}` → `# 一、` 作者与原作 / 基本信息表 → 剧情简介 → 动画制作信息表与声优阵容 → 分阶段剧情解析（加 `> ⚠️` 剧透提示）→ 角色解析 → 名场面 / 主题曲 / 原作与动画差异（有资料时）→ 观看顺序与入坑建议 → `# 总结` 收尾金句。标题用 `# 一、`、`## 1.1` 层级。

### 字数

主作品 TV 动画 4000–5000 中文字；续作 3000–4000；OVA / 剧场版 / 短篇 1500–2500。资料少（例如刚开播的新番）时宁可写短（2000–3000），**绝不编造**。

成人向 / 擦边向作品**篇幅要求与正常作品相同**，不因题材缩短；只是内容上不写露骨描写，在开头加一句内容提示。篇幅用这些内容撑起来：设定与规则解析、原作出版与海外发行、动画制作与播出版本、宣传活动与周边、角色与人物关系、主题曲、评价与评分、作品主题解读、观看建议。

### 硬性要求

- 全中文：作品原名、歌名可保留日文原文并附中文译名；人名用通行中文译名。
- 事实只能来自 `reports/wiki-sources/<slug>.json` 与资料稿里的 Bangumi 数据：播出日期、话数、staff、声优、剧情、销量、奖项都不能凭空写。资料稿里的声优表可能有错配，以百科为准。不确定就不写。资料里常混有错配的无关条目，忽略它们。
- 资料来源与优先级（JSON 结构见 `scripts/wiki/fetch-sources.mjs` 开头）：
  1. **日文资料（事实优先以它们为准）**：
     - 日文维基百科（`<日文查询>.jawiki`）：作品概要、制作阵容、播出信息；长篇系列的动画资料常拆在「〇〇 (アニメ)」子条目里，有的话另存为 `<日文查询> (アニメ).jawiki`。注意主题曲、各话列表在维基里是表格，纯文本里常常只剩空标题，主题曲以下面第 5 类来源为准；
     - しょぼいカレンダー（`_linked.syoboi`）：日本播出数据库，staff、全部声优、各话日文标题、首播电视台；
     - アニメハック（`_linked.animehack`）：映画.com 的动画资讯，staff、声优、主题曲、简介和相关新闻（动画化、开播的公布日期）；
     - メディア芸術データベース（`_linked.mediaarts`）：日本文化厅数据库，原作单行本各卷的发售日、出版社、ISBN；
  2. **中文资料（中文译名以它们为准）**：萌娘百科、中文维基（`<中文查询>.moegirl` / `.wikipedia`）、Bangumi（`_linked.bangumi`，完整制作人员表与官方中文简介）、巴哈姆特 ACG 资料库（`_linked.bahamut`，台湾地区资料，已转简体）；
  3. **补充与交叉核对**：英文维基（`.enwiki`）、Anime News Network（`_databases.ann`）、MyAnimeList（`_linked.mal`，播出时段、制作 / 发行公司、海外代理、角色与声优）、LiveChart（`_linked.livechart`）、Kitsu（`_databases.kitsu`）；
  4. **只用于补充角色细节**：Fandom 作品维基（`_linked.fandom`），粉丝编写，与上面的来源冲突时一律以上面为准。
  5. **主题曲**（写「主题曲」小节时用）：Bangumi 关联音乐条目（`_linked.bangumiMusic`，片头曲 / 片尾曲 / 插入歌 / 角色歌 / 原声集，含演唱者和单曲发售日，最可靠）、MyAnimeList 页面里的「主题曲」一段（`_linked.mal`，OP / ED 与使用话数）、Shikimori（`_linked.shikimori`，基本信息与 OP / ED 视频名，名称不规范，只用于核对）。ANN 的 Opening / Ending Theme 也可参考，但 ANN 是按标题搜索的，先确认条目是不是本作。
  6. **官方 API 书志**（`scripts/wiki/catalog-sources.mjs`，各自可用环境变量 `WIKI_SOURCE_<NAME>=0` 关闭，某一来源失败不影响其他来源）。有 Wikidata 编号时按编号抓，否则按作品标题搜索并做相关性校验，对不上就丢掉。带「第N季 / V」这类季数后缀的标题会先去掉后缀，再按系列名搜；英文标题仍参加相关性校验，避免日文季名对不上英文数据库条目：
     - aniSearch（`_linked.anisearch`，Wikidata P12477）：作品详情、集数、角色与职员。公开 API 没有按标题检索的端点（全量标题表 24 小时只能拉一次），没有编号就是 null。无 token 时详情接口 10 秒 1 次。转载它自己写的简介时，正文里要带上条目链接；
     - MangaUpdates（`_linked.mangaupdates`，Wikidata P11149 是站内 slug，不是 API 的数字 id）：漫画 / 小说的作者、出版社、连载杂志、关联作品。slug 出现在搜索结果里时优先用它；
     - VNDB（`_linked.vndb`，Wikidata P3180，只走 `https://api.vndb.org/kana`，遵守 5 分钟 200 次）：视觉小说和游戏改编。标题搜索到的可能是外传游戏，先看返回的完整标题是不是本作；
     - 哔哩哔哩游戏 Wiki（`_linked.biligame`，`https://wiki.biligame.com/<子站>/api.php`）：只在 Bangumi 类型是游戏，或 Wikidata 条目 / 原作的类型是电子游戏（Q7889）、视觉小说（Q689445）时抓角色设定。子站从农场名册按作品名匹配，对不上不抓；
     - RanobeDB（`_linked.ranobedb`，可选，非商业、ODbL）：轻小说系列、作者、出版社和卷目；
     - 国立国会图书馆サーチ OpenSearch（`_linked.ndl`，可选，`dpid=iss-ndl-opac` 且 `mediatype=books`）：单行本书目（ISBN、出版者、发行日）。非营利引用，输出里写明来自 NDL サーチ。
  - `_linked.wikidata` 记录了作品在各站的编号，按编号抓取的 `_linked.*` 比按标题搜索可靠；Wikidata 没有收录的作品，这些来源就是 null。按标题只找到原作条目时，会顺着 Wikidata 的改编关系找名称或 Bangumi 编号对得上的动画条目；动画条目没记 MAL 编号时，用 Shikimori（与 MAL 编号相同）按英文名搜到的编号抓 MAL 页面。
  - 外文资料是原文，写稿时翻译成中文，不要整段照搬；不同来源说法冲突时以日文资料为准，仍拿不准就不写。
  - 萌娘百科（2026-11-14 起的抓取）：GitHub Actions 运行 [43624948189](https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/actions/runs/43624948189) 里，《约会大作战 第五季》（bangumi-389466）、《转生为第七王子》（bangumi-407133）、《不动声色的柏田与喜形于色的太田》（bangumi-544104）的每一条中文查询都在标题匹配之前收到 `HTTP 403`。同一 runner 上的中文维基百科是成功的。响应头是 `cf-mitigated: challenge`，正文是 Cloudflare 的 “Just a moment...” 挑战页，不是空的 API JSON，也不是标题变体或相关性校验把条目滤掉。用仓库里的联系方式 User-Agent 在 Actions 之外请求 `zh.moegirl.org.cn/api.php` 同样得到这个挑战页。这是对方边缘节点在拦截自动化客户端，不是我们的查询或解析写错。不实现挑战求解、指纹伪装、cookie / clearance、代理轮换或其他绕过。4xx 也不再重试。
  - 实测不可用、未接入：ニコニコ大百科、pixiv 百科事典、百度百科、哔哩哔哩（站内，不是上面的游戏 Wiki API）、コミックナタリー、AniDB（拦截 GitHub Actions）；灰机 wiki、VGMdb、allcinema、マンガペディア（被拦截或明确禁止抓取，不写抓取器）；Annict、TMDB（需要密钥）；Jikan（连接超时）；AniList（接口停用）；MusicBrainz（经常 503）；アニソンジェネレーション（页面声明 noai，不抓取）。
- 站内链接只能用 `/posts/<alias>/`，`<alias>` 必须是某篇文章 frontmatter 的 `alias` 或 `src/content/posts/` 下的文件名（不含 `.md`）。资料稿的「系列作品」小节已列出站内同系列文章，可直接沿用。
- 不改手写文章（没有资料稿标记的文章）。
