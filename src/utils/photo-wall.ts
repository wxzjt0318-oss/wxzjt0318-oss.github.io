import { photoWallConfig } from "@/config/photoWallConfig";
import type { AlbumGroup, AlbumPhoto } from "@/types/album";
import { findAlbum } from "./album-scanner";

export type PhotoOrientation = "landscape" | "portrait" | "square";

export type PhotoWallItem = {
	id: string;
	src: string;
	thumbnail: string;
	alt: string;
	width?: number;
	height?: number;
	orientation: PhotoOrientation;
};

/** 宽高比 ≥ 1.2 为横图、≤ 0.9 为竖图，其余（含尺寸未知）归为方图 */
export function photoOrientation(
	photo: Pick<AlbumPhoto, "width" | "height">,
): PhotoOrientation {
	if (!photo.width || !photo.height) return "square";
	const ratio = photo.width / photo.height;
	if (ratio >= 1.2) return "landscape";
	if (ratio <= 0.9) return "portrait";
	return "square";
}

export function toPhotoWallItem(photo: AlbumPhoto): PhotoWallItem {
	return {
		id: photo.id,
		src: photo.src,
		thumbnail: photo.thumbnail || photo.src,
		alt: photo.alt,
		width: photo.width,
		height: photo.height,
		orientation: photoOrientation(photo),
	};
}

/** 已启用照片墙且确实存在、未加密的相册；功能关闭时返回空数组，不生成任何页面 */
export function wallAlbums(): AlbumGroup[] {
	if (photoWallConfig.enable === false) return [];
	return (photoWallConfig.albums ?? [])
		.map((id) => findAlbum(id))
		.filter((album): album is AlbumGroup => Boolean(album) && !album?.password);
}
