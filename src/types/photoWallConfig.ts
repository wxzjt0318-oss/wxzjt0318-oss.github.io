import type { PageMeta } from "./pageMeta.ts";

/**
 * 照片墙：把相册（`public/images/albums/<id>/`）渲染成可调列数、可按横竖筛选、可随机抽取的瀑布流墙，
 * 并为每个相册生成静态随机图入口（`/wall/<id>/random/`）与图片索引（`/wall/<id>/index.json`）。
 */
export interface PhotoWallConfig extends PageMeta {
	/** 生成照片墙的相册 ID 列表；为空时不生成任何页面 */
	albums?: string[];
}
