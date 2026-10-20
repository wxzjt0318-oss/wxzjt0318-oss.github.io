// EdgeOne Pages Functions 随机图 API —— 子路径入口
// 路由说明：functions/api/[[path]].js → 域名/api/xxx（匹配 /api/ 后至少一段路径）
// 裸路径 /api 由 functions/api/index.js 处理；两者共用同一份逻辑，见 index.js。
// 路由：
//   GET /api/index       全量图片索引（相册墙数据源，运行时读取）
//   GET /api/list        全部图片清单
//   GET /api/stats       图库统计（总数 / pc / phone）
//   GET /api/其他        404 JSON
export { onRequest } from './index.js';
