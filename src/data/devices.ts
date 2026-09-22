/**
 * 设备展示页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/devicesConfig.ts 控制。
 */
import type { DeviceItem } from "@/types/devicesConfig";

export const devicesData: DeviceItem[] = [
	{
		id: "oneplus-13t",
		name: "OnePlus 13T",
		brand: "OnePlus",
		category: "mobile",
		status: "active",
		specs: "Gray / 16G + 1TB",
		description: "Flagship performance, Hasselblad imaging, 80W SuperVOOC.",
		image: "/images/device/oneplus13t.png",
		link: "https://www.oneplus.com/cn/13t",
	},
	{
		id: "gl-mt3000",
		name: "GL-MT3000",
		brand: "GL.iNet",
		category: "peripheral",
		status: "active",
		specs: "1000Mbps / 2.5G",
		description:
			"Portable WiFi 6 router suitable for business trips and home use.",
		image: "/images/device/mt3000.png",
		link: "https://www.gl-inet.cn/products/gl-mt3000/",
	},
];

/** 获取所有设备数据列表 */
export function getDevicesList(): DeviceItem[] {
	return devicesData;
}
