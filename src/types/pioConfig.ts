/**
 * 看板娘（Pio / Live2D）配置类型（自用户 fork 平移）。
 */
export interface PioConfig {
	enable: boolean;
	/** 模型文件路径数组 */
	models?: string[];
	/** 看板娘位置 */
	position?: "left" | "right";
	width?: number;
	height?: number;
	/** 展现模式 */
	mode?: "static" | "fixed" | "draggable";
	/** 是否在移动设备上隐藏 */
	hiddenOnMobile?: boolean;
	dialog?: {
		/** 欢迎词 */
		welcome?: string | string[];
		/** 触摸提示 */
		touch?: string | string[];
		/** 首页提示 */
		home?: string;
		/** 换装提示 [切换前, 切换后] */
		skin?: [string, string];
		/** 关闭提示 */
		close?: string;
		/** 关于链接 */
		link?: string;
		custom?: {
			selector: string;
			type: "read" | "link";
			text?: string;
		}[];
	};
}
