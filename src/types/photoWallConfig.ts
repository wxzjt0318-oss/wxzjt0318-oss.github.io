import type { PageMeta } from "./pageMeta.ts";

/**
 * 照片墙：列出的相册在相册详情页（`/albums/<id>/`）改用可调列数、可按横竖筛选、可随机抽取的瀑布流墙展示，
 * 并生成静态随机图入口（`/wall/<id>/random/`）与图片索引（`/wall/<id>/index.json`）。
 * 旧地址 `/wall/<id>/` 跳转到相册页。
 */
export interface PhotoWallConfig extends PageMeta {
	/** 生成照片墙的相册 ID 列表；为空时不生成任何页面 */
	albums?: string[];
}
