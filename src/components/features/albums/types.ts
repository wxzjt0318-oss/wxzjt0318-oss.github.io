export interface AlbumPhoto {
	src: string;
	alt?: string;
	width?: number;
	height?: number;
}

export interface Album {
	id: string;
	title: string;
	description?: string;
	cover?: string;
	date?: string;
	location?: string;
	tags?: string[];
	photos: AlbumPhoto[];
}

export interface AlbumCardProps {
	album: Album;
}
