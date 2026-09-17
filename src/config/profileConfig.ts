import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "assets/images/celia.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "lingmeng",
	bio: "I like the world, because i want live",
	links: [
		{
			name: "Bilibili",
			icon: "fa6-brands:bilibili", // Visit https://icones.js.org/ for icon codes
			url: "https://b23.tv/Ny6RChH",
		},
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io",
		},
		{
			name: "Steam",
			icon: "fa6-brands:steam",
			url: "https://steamcommunity.com/profiles/76561198428249076/",
		},
		{
			name: "Discord",
			icon: "fa6-brands:discord",
			url: "https://discord.gg/cZSyH7RKvu",
		},
	],
});
