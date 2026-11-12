/**
 * 生成足迹页用的中国地图路径数据 src/data/china-map.json。
 * ─────────────────────────────────────────────────────────────────────────────
 * 数据来源：Apache ECharts 4.9.0 的 map/json/china.json（Apache-2.0），
 * 以及它为「南海诸岛」示意框、钓鱼岛补的几何（src/coord/geo/fix/）。
 * 这里把 ECharts 的压缩坐标解码，按它的中国地图投影（经度 : 纬度 = 0.75 : 1）
 * 转成 SVG path，页面直接内联输出，运行时不需要任何地图库或网络请求。
 *
 * 周边国家（日本、朝鲜、韩国、俄罗斯）取自同一个包的 map/json/world.json，
 * 精度比省界低，画在中国地图下层；俄罗斯只露出画幅内的部分。
 *
 *   npm pack echarts@4.9.0 && tar -xzf echarts-4.9.0.tgz package/map/json
 *   node scripts/footprints/build-china-map.mjs package/map/json/china.json package/map/json/world.json
 *
 * 地图数据很少变化，生成结果已提交到仓库；只有需要重新生成时才运行本脚本。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
	__dirname,
	"..",
	"..",
	"src",
	"data",
	"china-map.json",
);
const source = process.argv[2];
const worldSource = process.argv[3];
if (!source || !worldSource) {
	console.error(
		"用法: node scripts/footprints/build-china-map.mjs <china.json 路径> <world.json 路径>",
	);
	process.exit(1);
}

const ASPECT = 0.75;
const SCALE = 20; // 每经度 20 个 SVG 单位，坐标取整
const PAD = 10;

/** ECharts UTF8Encoding：zigzag 差分编码，精度 1/1024 度 */
function decodeRing(text, offsets) {
	const ring = [];
	let [prevX, prevY] = offsets;
	for (let i = 0; i < text.length; i += 2) {
		let x = text.charCodeAt(i) - 64;
		let y = text.charCodeAt(i + 1) - 64;
		x = (x >> 1) ^ -(x & 1);
		y = (y >> 1) ^ -(y & 1);
		x += prevX;
		y += prevY;
		prevX = x;
		prevY = y;
		ring.push([x / 1024, y / 1024]);
	}
	return ring;
}

function decodeFeature(feature) {
	const { type, coordinates, encodeOffsets } = feature.geometry;
	const polygons = type === "Polygon" ? [coordinates] : coordinates;
	const offsets = type === "Polygon" ? [encodeOffsets] : encodeOffsets;
	return polygons.flatMap((rings, p) =>
		rings.map((ring, r) => decodeRing(ring, offsets[p][r])),
	);
}

// 钓鱼岛（并入台湾，与 ECharts 一致）
const DIAOYU = [
	[123.45165252685547, 25.73527164402261],
	[123.49731445312499, 25.73527164402261],
	[123.49731445312499, 25.750734064600884],
	[123.45165252685547, 25.750734064600884],
];

// 南海诸岛示意框（ECharts 的示意几何：以 [126, 25] 为锚点的小框与断续线）
const NANHAI_ANCHOR = [126, 25];
const NANHAI = [
	[
		[0, 3.5],
		[7, 11.2],
		[15, 11.9],
		[30, 7],
		[42, 0.7],
		[52, 0.7],
		[56, 7.7],
		[59, 0.7],
		[64, 0.7],
		[64, 0],
		[5, 0],
		[0, 3.5],
	],
	[
		[13, 16.1],
		[19, 14.7],
		[16, 21.7],
		[11, 23.1],
		[13, 16.1],
	],
	[
		[12, 32.2],
		[14, 38.5],
		[15, 38.5],
		[13, 32.2],
		[12, 32.2],
	],
	[
		[16, 47.6],
		[12, 53.2],
		[13, 53.2],
		[18, 47.6],
		[16, 47.6],
	],
	[
		[6, 64.4],
		[8, 70],
		[9, 70],
		[8, 64.4],
		[6, 64.4],
	],
	[
		[23, 82.6],
		[29, 79.8],
		[30, 79.8],
		[25, 82.6],
		[23, 82.6],
	],
	[
		[37, 70.7],
		[43, 62.3],
		[44, 62.3],
		[39, 70.7],
		[37, 70.7],
	],
	[
		[48, 51.1],
		[51, 45.5],
		[53, 45.5],
		[50, 51.1],
		[48, 51.1],
	],
	[
		[51, 35],
		[51, 28.7],
		[53, 28.7],
		[53, 35],
		[51, 35],
	],
	[
		[52, 22.4],
		[55, 17.5],
		[56, 17.5],
		[53, 22.4],
		[52, 22.4],
	],
	[
		[58, 12.6],
		[62, 7],
		[63, 7],
		[60, 12.6],
		[58, 12.6],
	],
	[
		[0, 3.5],
		[0, 93.1],
		[64, 93.1],
		[64, 0],
		[63, 0],
		[63, 92.4],
		[1, 92.4],
		[1, 3.5],
		[0, 3.5],
	],
].map((ring) =>
	ring.map(([x, y]) => [
		x / 10.5 + NANHAI_ANCHOR[0],
		y / (-10.5 / ASPECT) + NANHAI_ANCHOR[1],
	]),
);

const geo = JSON.parse(fs.readFileSync(source, "utf8"));
const regions = geo.features.map((feature) => {
	const rings = decodeFeature(feature);
	if (feature.properties.name === "台湾") rings.push(DIAOYU);
	return {
		id: String(feature.id),
		name: feature.properties.name,
		center: feature.properties.cp,
		rings,
	};
});
regions.push({
	id: "nanhai",
	name: "南海诸岛",
	center: [126.9, 22.9],
	rings: NANHAI,
	inset: true,
});

// 周边国家：world.json 是未压缩的 GeoJSON
const FOREIGN = {
	Japan: { id: "JPN", name: "日本", center: [138.3, 36.3] },
	"Dem. Rep. Korea": { id: "PRK", name: "朝鲜", center: [126.9, 40.2] },
	Korea: { id: "KOR", name: "韩国", center: [127.9, 36.4] },
	Russia: { id: "RUS", name: "俄罗斯", center: [104, 56.5] },
};
// 画幅：西到新疆、东到北海道、北到能露出一条俄罗斯、南到南海诸岛示意框
const BOUNDS = { minX: 73, maxX: 147, minY: 17.5, maxY: 60 };
const world = JSON.parse(fs.readFileSync(worldSource, "utf8"));
const inView = (ring) =>
	ring.some(
		([x, y]) =>
			x >= BOUNDS.minX &&
			x <= BOUNDS.maxX &&
			y >= BOUNDS.minY &&
			y <= BOUNDS.maxY,
	);
// 画幅外的点夹到画幅外一圈，路径不会带着半个西伯利亚的坐标
const clamp = ([x, y]) => [
	Math.min(Math.max(x, BOUNDS.minX - 2), BOUNDS.maxX + 2),
	Math.min(Math.max(y, BOUNDS.minY - 2), BOUNDS.maxY + 2),
];
const foreign = world.features
	.filter((feature) => FOREIGN[feature.properties.name])
	.map((feature) => {
		const { type, coordinates } = feature.geometry;
		const rings = (type === "Polygon" ? [coordinates] : coordinates)
			.flat()
			.filter(inView)
			.map((ring) => ring.map(clamp));
		return { ...FOREIGN[feature.properties.name], rings, foreign: true };
	});
// 周边国家排在前面，先画、压在中国地图下面
regions.unshift(...foreign);

const { minX, maxX, minY, maxY } = BOUNDS;
const project = ([lng, lat]) => [
	Math.round((lng - minX) * SCALE + PAD),
	Math.round(((maxY - lat) / ASPECT) * SCALE + PAD),
];

function ringToPath(ring) {
	const points = ring.map(project);
	// 丢掉投影后重合的相邻点，减小体积
	const kept = points.filter(
		(p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
	);
	if (kept.length < 3) return "";
	// 相对坐标（l dx dy）比绝对坐标短得多
	let d = `M${kept[0][0]} ${kept[0][1]}`;
	for (let i = 1; i < kept.length; i++) {
		const dx = kept[i][0] - kept[i - 1][0];
		const dy = kept[i][1] - kept[i - 1][1];
		d += `l${dx}${dy < 0 ? "" : " "}${dy}`;
	}
	return `${d}z`;
}

const output = {
	source: "Apache ECharts 4.9.0 map/json/china.json + world.json (Apache-2.0)",
	width: Math.ceil((maxX - minX) * SCALE + PAD * 2),
	height: Math.ceil(((maxY - minY) / ASPECT) * SCALE + PAD * 2),
	regions: regions.map((region) => ({
		id: region.id,
		name: region.name,
		center: project(region.center),
		...(region.inset ? { inset: true } : {}),
		...(region.foreign ? { foreign: true } : {}),
		path: region.rings.map(ringToPath).join(""),
	})),
};

fs.writeFileSync(OUT, `${JSON.stringify(output)}\n`);
console.log(
	`已写出 ${path.relative(process.cwd(), OUT)}：${output.regions.length} 个区域，${output.width}×${output.height}，${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`,
);
