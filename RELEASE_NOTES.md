# 🌸 灵梦Mizuki v9.0

**发布日期：** 2026年3月25日

---

## 📖 版本概述

灵梦Mizuki v9.0 是一个重要的里程碑版本，包含全面的性能优化、项目品牌重塑以及多项功能增强。本版本从上游 Mizuki 项目合并了大量优化更新，并加入了个性化定制功能。

---

## ✨ 新功能

| 功能 | 描述 |
|------|------|
| 🏷️ 项目品牌重塑 | 项目名称更新为"灵梦Mizuki"，打造个人品牌标识 |
| 🔐 密码提示功能 | 加密文章支持添加密码提示，提升用户体验 |
| 📁 嵌套Permalink支持 | 支持嵌套目录结构的永久链接，保留文件名大小写 |
| 📊 第三方分析集成 | 可选配置 Clarity 分析工具 |
| 🖼️ 响应式图片优化 | 添加 srcset 支持，实现自适应图片加载 |

---

## ⚡ 性能优化

### 构建优化
- **代码压缩增强**：assetsInlineLimit 提升至 8KB，优化 CSS 压缩配置
- **代码分割优化**：新增 vendor-dayjs、vendor-sharp 独立 chunk
- **Iconify 升级**：升级至 v3 版本，减少图标加载延迟

### 图片优化
- **WebP 转换**：首页、设备、日记、相册、音乐封面图片全面 WebP 化
- **Banner 图片压缩**：减少首屏加载时间
- **图片懒加载**：Pagefind 搜索面板按需加载

### 缓存策略
- **静态资源缓存**：图片、字体、JS/CSS 资源缓存提升至 1 年 immutable
- **AVIF 支持**：新增 AVIF 格式缓存配置
- **CDN 预连接**：添加 Iconify API 预连接提示

### 安全增强
- **CSP 头配置**：添加 Content-Security-Policy 安全策略
- **资源加载优化**：分析脚本仅在用户交互后加载

---

## 🐛 问题修复

| 类别 | 修复内容 |
|------|----------|
| 布局问题 | 移除 logo 显式宽高修复布局问题 |
| 404 错误 | 移除导致 404 的字体预加载链接 |
| 类型错误 | 解决所有 TypeScript 类型检查错误 |
| YAML 语法 | 修复 bangumi-update.yml 多行字符串语法错误 |
| 统计显示 | 修复页面访问统计在桌面端不显示的问题 |

---

## ♿ 无障碍改进

- 为分页链接添加 aria-labels
- 为音乐播放器按钮添加无障碍标签
- 修正 ARIA 角色以通过 Lighthouse 检查
- 移除导航图标冗余 alt 文本

---

## 🔄 兼容性说明

| 项目 | 要求 |
|------|------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| Astro | 6.0.7 |
| TypeScript | 5.9.3 |
| 浏览器 | 现代浏览器 |

---

## ⚠️ 已知问题

暂无已知问题。如遇到问题，请在 [GitHub Issues](https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/issues) 反馈。

---

## 📥 升级指南

### 从 v8.x 升级

1. **拉取最新代码**
   ```bash
   git fetch --prune --tags
   git checkout 灵梦Mizuki-v9.0
   ```

2. **更新依赖**
   ```bash
   pnpm install
   ```

3. **检查配置**
   - 确认 `src/config.ts` 中的站点配置
   - 更新环境变量（如使用 Umami 统计）

4. **重新构建**
   ```bash
   pnpm build
   ```

---

## 📝 贡献者

感谢以下贡献者的付出：
- @matsuzaka-yuki (上游 Mizuki 项目)
- @lingmeng (个性化定制)

---

## 🔗 相关链接

- **在线演示**：https://lm520.cc
- **源代码**：https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io
- **问题反馈**：https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/issues

---

**完整更新日志**：https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/compare/8.2...灵梦Mizuki-v9.0
