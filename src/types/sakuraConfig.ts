/**
 * 樱花飘落特效配置类型（自用户 fork 平移）。
 */
export interface SakuraConfig {
	enable: boolean;
	/** 樱花数量，默认 21 */
	sakuraNum: number;
	/** 樱花越界限制次数，-1 为无限循环 */
	limitTimes: number;
	size: {
		/** 樱花最小尺寸倍数 */
		min: number;
		/** 樱花最大尺寸倍数 */
		max: number;
	};
	opacity: {
		/** 樱花最小不透明度 */
		min: number;
		/** 樱花最大不透明度 */
		max: number;
	};
	speed: {
		horizontal: {
			/** 水平移动速度最小值 */
			min: number;
			/** 水平移动速度最大值 */
			max: number;
		};
		vertical: {
			/** 垂直移动速度最小值 */
			min: number;
			/** 垂直移动速度最大值 */
			max: number;
		};
		/** 旋转速度 */
		rotation: number;
		/** 消失速度 */
		fadeSpeed: number;
	};
	/** 层级，确保樱花在合适的层级显示 */
	zIndex: number;
}
