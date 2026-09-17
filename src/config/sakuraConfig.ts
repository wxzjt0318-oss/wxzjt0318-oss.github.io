import type { SakuraConfig } from "@/types/sakuraConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 樱花飘落特效配置（自用户 fork 平移）。
 * enable: false 时不注入任何脚本与 canvas，零额外负担。
 */
export const sakuraConfig: SakuraConfig = withUserConfig("sakura", {
	enable: true,
	sakuraNum: 18,
	limitTimes: -1,
	size: { min: 0.5, max: 1.1 },
	opacity: { min: 0.3, max: 0.9 },
	speed: {
		horizontal: { min: -1.7, max: -1.2 },
		vertical: { min: 1.5, max: 2.2 },
		rotation: 0.03,
		fadeSpeed: 0.03,
	},
	zIndex: 100,
});
