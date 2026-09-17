import type { PioConfig } from "@/types/pioConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 看板娘（Pio / Live2D）配置（自用户 fork 平移）。
 * enable: false 时不加载 /pio 运行时脚本与样式，零额外负担。
 */
export const pioConfig: PioConfig = withUserConfig("pio", {
	enable: true,
	models: ["/pio/models/kato/katou_01.model.json"],
	position: "left",
	width: 280,
	height: 250,
	mode: "draggable",
	hiddenOnMobile: true,
	dialog: {
		welcome: "欢迎来到灵梦的小站!",
		touch: [
			"你干什么呀！",
			"不要摸我了哦！",
			"真拿你没办法了！",
			"随便你好啦～",
		],
		home: "点击这里回到首页哟！",
		skin: ["想看看我的新衣服吗？", "新衣服真漂亮~"],
		close: "QWQ 下次再见吧~",
		link: "https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io",
	},
});
