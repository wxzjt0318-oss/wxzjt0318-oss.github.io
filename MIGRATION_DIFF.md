# MIGRATION DIFF

## Summary
- Scope: Align repo with Mizuki tech stack and release updates
- Personalization: Snapshot and restore scripts added, regression checks enabled
- Tailwind: Migrated to v4 runtime config

## File Changes
- package.json: align dependency versions, add personalization scripts and lint deps
- astro.config.mjs: switch to @tailwindcss/vite, add umami integration
- postcss.config.mjs: align plugin set to Mizuki v4 pipeline
- src/styles/main.css: migrate to Tailwind v4 syntax and theme tokens
- src/components/widget/Announcement.astro: closable behavior and icon update
- src/components/comment/index.astro: per-post comment toggle
- src/content.config.ts: add comments frontmatter field
- src/types/config.ts: add comments field to BlogPostData
- src/components/widget/MusicPlayer.svelte: persist volume to localStorage
- src/components/widget/Profile.astro: update Font Awesome icon set
- src/components/widget/DisplaySettings.svelte: update Font Awesome icon set
- src/components/widget/DropdownMenu.astro: update Font Awesome icon set
- src/components/widget/NavMenuPanel.astro: update Font Awesome icon set
- src/components/misc/License.astro: update Font Awesome icon set
- src/components/Search.svelte: update Font Awesome icon set
- src/layouts/MainGridLayout.astro: update Font Awesome icon set
- src/components/PostPage.astro: add Tailwind reference for v4 apply
- src/layouts/Layout.astro: add Tailwind reference for v4 apply
- src/pages/diary.astro: add Tailwind reference for v4 apply
- src/styles/encrypted-content.css: add Tailwind reference for v4 apply
- src/styles/expressive-code.css: add Tailwind reference for v4 apply
- src/styles/markdown.css: add Tailwind reference for v4 apply
- src/styles/photoswipe.css: add Tailwind reference and remove invalid apply token
- src/styles/scrollbar.css: add Tailwind reference for v4 apply
- src/styles/twikoo.css: add Tailwind reference for v4 apply
- src/components/Footer.astro: remove encoded class comments and bump version
- scripts/update-bilibili.mjs: read SESSDATA from env
- .env.example: add BILI_SESSDATA and snapshot key
- docs/editor/editor.html: add local visual editor page
- docs/editor/editor.css: add local visual editor styles
- docs/editor/editor.js: add local visual editor logic
- scripts/personalization-snapshot.mjs: create encrypted personalization snapshot
- scripts/personalization-restore.mjs: restore personalization snapshot
- scripts/personalization-regression.mjs: regression gate for personalization
- scripts/revert-mizuki-sync.mjs: one-click revert using snapshot
- scripts/db-rollback.sql: database rollback placeholder
- .github/workflows/CI.yml: add personalization regression stage
- README.md: update version badges

## Personalization Writeback
- Snapshot source: src/config.ts, src/data/*, src/content/spec/*, src/assets/images/*, public/assets/home, public/favicon, public/js/umami-share.js, src/FooterConfig.html
- Restore policy: exact file restore with fa6->fa7 icon remap for config

## Validation
- pnpm snapshot-personalization
- pnpm build
- pnpm test:personalization
