# Shirone 上游合并实施计划

## Context（背景与目标）

用户博客（wxzjt0318-oss.github.io，GitHub Pages 用户站）是 [Shirone 主题](https://github.com/LyraVoid/Shirone) 的分叉，深度自定义后已落后上游。经调研确认：

- **血缘**：两项目共享约 1500 个完全相同的文件，用户侧 442 个自定义文件、65 个漂移修改文件；上游已演进至 Astro 7.3.2 + Svelte 5.57 + @astrojs/svelte 9 + Tailwind 4.3.3 + MDX，并新增内容分离架构、M3 组件体系（atoms/molecules/organisms）与官方功能组件。
- **目标**：以上游最新版为基底重建工作区（用户已确认），遵循 Shirone 官方项目规范（AGENTS.md / rules/ / docs/content-separation / .agents/skills），保留用户全部自定义设置与功能；播放器采用上游侧栏 MusicSidebar（M3 波浪 ProgressIndicator 进度条 + 透明 range input 拖拽 seek），保留用户悬浮播放器/FAB 但其进度条统一替换为上游样式；用户播放设置（Meting API / 歌单 / 音量 / 播放模式）全部迁入。
- **已确认决策**：功能等价处用上游、独有才平移；内容采用上游 `local` 单仓模式（`shirone.content.json` 不存在时 `content:sync` 直接跳过，配置直接改 `src/config/*Config.ts` 默认值，已核实 `src/user/user-config.ts` 头部注释）；本地完成 git init + 提交，推送由用户执行。

上游参考副本：`C:\Users\Administrator\AppData\Local\Temp\shirone-extract\Shirone-main`

## 配置迁移映射表（用户 src/config.ts → 上游 src/config/*Config.ts）

| 用户配置段 | 目标文件 | 要点 |
|---|---|---|
| siteConfig（title/subtitle/siteURL/lang/themeColor/toc/favicon） | `src/config/siteConfig.ts` | `SITE_TIMEZONE`→`timeZone:"Asia/Shanghai"`；hue 340 |
| siteConfig.banner（loliapi URL × 6、homeText、typewriter、waves、carousel） | `siteConfig.banner` | 上游支持远程 URL；interval 3s→3000ms |
| featurePages（anime/games/albums/friends=on，projects/skills/timeline/devices=off） | 各领域 Config 的 `enable` | animeConfig/gamesConfig/albumsConfig/friendsConfig/projectsConfig/skillsConfig/timelineConfig/devicesConfig |
| navbarTitle | siteConfig.title（无独立字段） | |
| bangumi/anime/game 同步 | `animeConfig.source:{kind:"snapshot",provider:"bangumi"}` + `providers.bangumi:{userId:"1180323"}`，跑 `pnpm anime:sync` | 替代 update-bangumi 脚本 |
| postListLayout | `postListConfig` | layout.mode:"list" |
| wallpaperMode | `siteConfig.wallpaperMode.defaultMode:"banner"` | |
| font（萝莉体等） | `fontConfig` roles（body/cjk），字体文件放上游约定目录 | 走 fonts:subset 管线 |
| license/permalink/expressiveCode/comment(twikoo)/announcement/footer | 同名 Config 模块 | twikoo envId/lang 迁入；用户 EC 插件（language-badge/custom-copy-button）迁入 `expressiveCodeConfig` |
| musicPlayerConfig | `src/config/musicConfig.ts` | `provider:"meting"`；`meting:{api:"https://meting.mysqil.com/api?server=:server&type=:type&id=:id&auth=:auth&r=:r", server:"netease", type:"playlist", id:"13985124277"}`；`showFloatingPlayer/floatingEntryMode:"fab"` 随悬浮播放器保留为扩展字段 |
| sidebarLayoutConfig（双栏、widget 顺序） | `src/config/sidebarConfig.ts` | arrangement:"dual"；components 顺序：profile/announcement、music、categories、tags、card-toc→toc、site-stats→stats、calendar |
| sakuraConfig / pioConfig / fullscreenWallpaperConfig | 新建 `src/config/sakuraConfig.ts`、`pioConfig.ts`（fullscreenWallpaper 二期） | 从 `src/config/index.ts` barrel 导出 |
| shareConfig（海报）+ relatedPosts/randomPosts | `articleConfig.share` + `articleConfig.discovery` | 上游已有，无需平移组件 |
| umamiConfig | `src/config/umamiConfig.ts` | enabled/scripts/websiteId/shareUrl 迁入；apiKey/baseUrl 随 site-stats widget 平移 |

## 实施步骤

### 阶段 0：留档与连接仓库
1. 工作区 `git init` → `git add -A` → 提交现状 → 打 tag `legacy/fork-snapshot`
2. `git remote add origin https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io.git`（不推送）

### 阶段 1：换基底
1. 除 `.git` 外清空工作区 → 复制上游全部（含 AGENTS.md、rules/、.agents/、docs/、tests/、.github）
2. **剔除**上游 `src/content/*`（demo 内容）、`.git`、`shirone.content.example.json`
3. `pnpm install` → `pnpm build` 验证 → 提交 `chore: rebase on upstream Shirone`

### 阶段 2：内容与静态资源
1. 迁入 `src/content/posts/**`（48 篇）、`src/content/spec/**`；增补上游 content schema 用户独有字段（priority/author/sourceLink/licenseName/licenseUrl）
2. 迁入 `public/`：favicon、images、assets（字体）、js/、`pio/**`、`sakura.png/webp`
3. 用户 `src/data/`（friends/devices/projects/skills/timeline/games/diary）数值迁入上游对应数据文件
4. 验证：`pnpm build` + `pnpm dev` 走查首页/文章页/归档

### 阶段 3：配置迁移
按映射表逐文件修改 `src/config/*.ts`。验证：`astro check` 0 错误；`pnpm dev` 核对标题/主题色/banner/导航/评论/公告。

### 阶段 4：独有功能平移（源 → 目标）

| 源（用户仓） | 目标 | 方式 |
|---|---|---|
| data/diary.ts + features/diary/** + pages/diary.astro | organisms/diary/** + pages/diary.astro | 平移适配 |
| pages/visitorbook.astro + styles/twikoo.css | 原路径 | 平移 |
| pages/api/{calendar-data,banner-images,allPostMeta}.json.ts | 原路径 | 平移（Astro 7 静态端点兼容） |
| utils/banner-api/** + scripts/banner-carousel.ts | 原路径 | 一期先 loliapi 静态列表；二期改 BannerStage 拉取 /api/banner-images.json 加权轮换 |
| utils/sakura-manager.ts + scripts/effects/sakura-effect.ts | 原路径 | Layout.astro 挂载，enable:false 零负担 |
| features/pio/** + utils/live2d-utils.ts + public/pio | 上游 SideBar 机制 | `types/sidebarConfig.ts` 扩展 type `"pio"` + `SideBar.astro` componentMap 注册 |
| widgets/music-player/**（MusicPlayer/FabMusicPanel） | 保留为悬浮播放器 | **进度条替换为上游 `atoms/feedback/ProgressIndicator.svelte` + 透明 range input seek**（参照 `MusicSidebarClient.svelte` + `musicSidebarStyles.ts` + `utils/music/music-runtime.ts` 接入运行时） |
| widgets/calendar、site-stats | 上游已有 calendar/stats | 仅迁移 api 数据差异 |
| styles/mobile-*.css、panel-animations.css、wallpaper-navbar-transparent.css、widget-responsive.css、anime.css、albums.css 等 | src/styles/ 并引入 | 旧变量→M3 tokens（--primary→surface tokens、--radius-large→--shape-corner-*） |
| i18n diary*/guestbook* 键 | i18nKey.ts + 全部 10 个语言模块 | 上游硬性要求 |
| scripts/handlers、scripts/core/swup-* | 仅保留确有增量者 | 上游 swup 由 integration 接管，改挂 `content:replace`/`swup:enable` |
| 用户 Encryptor/PasswordProtection | 上游已有 EncryptedContent/PasswordGate | 勿重复平移，仅核对差异 |

### 阶段 5：部署收尾
1. 重写 `.github/workflows/deploy.yml`（pnpm install --frozen-lockfile → 可选 `pnpm anime:sync` → `pnpm build`）；`bangumi-update.yml` 改为定时 `anime:sync`
2. 删除用户 update-bangumi/sync-content/compress-fonts/test-umami-*.cjs 脚本；vercel.json 保留安全头或对齐上游
3. 最终提交（不推送，由用户执行）

## 风险与对策

- **Astro 6→7**：丢弃用户 astro.config 的 vite 手工优化（manualChunks/optimizeDeds 等，上游 vite 8/rolldown 接管）；pages/api 静态端点仍支持
- **Svelte 5**：平移组件不得混用 runes/legacy 语法（rules/pitfalls.md）
- **图标集**：用户大量 `fa7-brands:*`，上游为 fa6-brands——全局改名或补装 @iconify-json/fa7-*
- **i18n**：漏加任一 locale 会构建报错
- **侧栏**：diary/visitorbook 需扩展 `SidebarPage` 联合类型（SideBar 客户端过滤依赖 data-current-page）

## 端到端验证

1. `pnpm install`（corepack 启用 pnpm@9.14.4，Node ≥22）
2. `astro check` 0 错误 → `pnpm build`（含 pagefind + fonts:check）
3. `pnpm dev` 走查清单：banner 轮播/打字机、双栏 widget、音乐侧栏（meting 13985124277 可播放、**ProgressIndicator 波浪进度条 + 拖拽 seek**）、悬浮播放器（同款进度条）、pio/sakura、diary/visitorbook、twikoo 评论、加密文章、umami script、/api/*.json 三端点 200
4. playwright 回归子集：`tests/site/music-widget.spec.ts`、`banner.spec.ts`、`comments.spec.ts`、`post-encryption.spec.ts`

## 关键参照文件

- 用户配置唯一源：`src/config.ts`
- 上游配置样板：`Shirone-main/src/config/siteConfig.ts`、`integrationsConfig.ts`
- 上游 widget 注册核心：`Shirone-main/src/components/organisms/SideBar.astro`
- 进度条参照：`Shirone-main/src/components/organisms/music/MusicSidebarClient.svelte`、`musicSidebarStyles.ts`、`src/components/atoms/feedback/ProgressIndicator.svelte`、`src/utils/music/music-runtime.ts`
