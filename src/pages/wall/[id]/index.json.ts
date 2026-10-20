import { toPhotoWallItem, wallAlbums } from "@utils/photo-wall";
import { url } from "@utils/url-utils";
import type { APIRoute } from "astro";

export function getStaticPaths() {
	return wallAlbums().map((album) => ({
		params: { id: album.id },
		props: { album },
	}));
}

/** 照片墙图片索引：供外部引用与随机图入口共用（静态 JSON） */
export const GET: APIRoute = ({ props, site }) => {
	const { album } = props as { album: ReturnType<typeof wallAlbums>[number] };
	const absolute = (path: string) =>
		site ? new URL(url(path), site).toString() : url(path);
	const items = album.photos.map(toPhotoWallItem).map((photo) => ({
		...photo,
		src: absolute(photo.src),
		thumbnail: absolute(photo.thumbnail),
	}));
	const stats = {
		total: items.length,
		landscape: items.filter((p) => p.orientation === "landscape").length,
		portrait: items.filter((p) => p.orientation === "portrait").length,
		square: items.filter((p) => p.orientation === "square").length,
	};
	return new Response(
		JSON.stringify({ id: album.id, title: album.title, stats, items }),
		{ headers: { "Content-Type": "application/json; charset=utf-8" } },
	);
};
