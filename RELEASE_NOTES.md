# 🌸 灵梦Mizuki v9.0.0

**发布日期：** 2026年3月25日

---

## 📖 版本概述

灵梦Mizuki v9.0.0 是基于 Mizuki 项目的个性化定制版本，在保留原项目核心功能的基础上，进行了品牌重塑、性能优化和功能增强。

---

## ✨ 主要功能改进与新特性

### 核心功能更新
| 功能 | 说明 |
|------|------|
| 🏷️ 品牌重塑 | 项目名称更新为"灵梦Mizuki"，打造个人品牌标识 |
| 🔐 密码提示 | 加密文章支持添加自定义密码提示信息 |
| 📁 嵌套链接 | 支持嵌套目录结构的永久链接，保留文件名大小写 |
| 🖼️ 图片优化 | 响应式图片 srcset 支持，自适应设备加载 |

### 性能优化
- **构建优化**：代码压缩增强、代码分割优化、Iconify v3 升级
- **图片优化**：全站 WebP 转换、Banner 压缩、懒加载策略
- **缓存策略**：静态资源 1 年 immutable 缓存、AVIF 支持、CDN 预连接
- **安全增强**：CSP 头配置、脚本延迟加载

---

## 📦 依赖项及版本要求

| 依赖项 | 版本要求 | 说明 |
|--------|----------|------|
| Node.js | ≥ 20 | 运行环境 |
| pnpm | ≥ 9 | 包管理器 |
| Astro | 6.0.7 | 静态站点生成框架 |
| TypeScript | 5.9.3 | 类型支持 |
| Tailwind CSS | 4.x | 样式框架 |
| Svelte | 5.x | 组件框架 |
| Swup | 1.8.0 | 页面过渡动画 |
| Pagefind | latest | 搜索功能 |
| KaTeX | latest | 数学公式渲染 |
| Twikoo | latest | 评论系统 |

---

## 🔗 借鉴自 Mizuki 项目的模块

本版本基于 [Mizuki](https://github.com/matsuzaka-yuki/Mizuki) 项目开发，继承以下核心模块：

| 模块 | 说明 |
|------|------|
| 🎨 主题系统 | 亮/暗主题切换、动态配色、响应式布局 |
| 📝 文章系统 | Markdown 增强、代码高亮、目录生成、阅读时间 |
| 🔍 搜索功能 | Pagefind 全文搜索集成 |
| 🎵 音乐播放器 | 浮动播放器、播放列表管理 |
| 📱 特殊页面 | 动漫追踪、友链、日记、归档页面 |
| 💬 评论系统 | Twikoo 评论集成 |
| 🖼️ 图片画廊 | PhotoSwipe 图片查看器 |
| 🎭 Live2D | Pio 看板娘插件 |
| 📊 统计分析 | Umami 访问统计集成 |
| 🔄 页面过渡 | Swup 平滑过渡动画 |
| 📐 布局组件 | 双侧边栏、网格布局、响应式适配 |

---

## 🌟 本版本独有特性

| 特性 | 说明 |
|------|------|
| 🏷️ 品牌定制 | 项目名称、Logo、域名全面个性化定制 |
| 🔐 密码提示功能 | 加密文章支持自定义密码提示，提升用户体验 |
| 📊 Umami 统计集成 | 集成 Umami 网站统计，实时显示浏览量和访问次数 |
| ⚡ 性能深度优化 | 代码压缩、图片 WebP 化、缓存策略全面升级 |
| 🔒 安全头配置 | 添加 Content-Security-Policy 等安全响应头 |
| 📁 嵌套 Permalink | 支持多层目录结构的文章链接 |
| 🎨 自定义样式 | 针对个人需求的样式调整和优化 |
| 📝 内容定制 | 个人文章、动漫追踪、友链等内容定制 |

---

## 📥 快速开始

```bash
# 克隆仓库
git clone https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io.git
cd wxzjt0318-oss.github.io

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

---

## 🔗 相关链接

| 链接 | 地址 |
|------|------|
| 在线演示 | https://lm520.cc |
| 源代码 | https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io |
| 上游项目 | https://github.com/matsuzaka-yuki/Mizuki |
| 问题反馈 | https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/issues |

---

## 📝 致谢

- 感谢 [@matsuzaka-yuki](https://github.com/matsuzaka-yuki) 提供优秀的 Mizuki 项目
- 感谢 [@saicaca](https://github.com/saicaca) 提供原始 Fuwari 模板

---

**完整更新日志**：https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io/compare/8.2...灵梦Mizuki-v9.0
