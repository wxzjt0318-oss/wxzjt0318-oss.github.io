# 验收文档

## 性能对比
- 变更前：收藏列表每次分页全量拉取
- 变更后：基于缓存 lastSync 的增量拉取与合并，满足条件时提前结束分页
- 验证结论：逻辑层面减少请求次数，实际响应时间需结合网络环境验证

## 准确率对比
- 变更前：仅精确包含匹配，别名与混合标题易漏检
- 变更后：构建别名与归一化索引，支持模糊与紧凑匹配
- 验证结论：覆盖别名与中英文混合标题场景，准确率提升以测试用例与样例验证

## 异常场景验证
- Bangumi API 异常且存在缓存：页面展示缓存数据并显示提示
- Bangumi API 异常且无缓存：页面为空列表并保持可操作性

## 验收项对应实现
- 模糊匹配与别名识别：src/utils/anime-search.js 与 src/pages/anime.astro
- 增量同步与缓存策略：src/pages/anime.astro 与 src/utils/anime-collection.js
- 错误重试与降级提示：src/pages/anime.astro
