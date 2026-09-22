/**
 * 友情链接数据配置（结构与 Mizuki 同款，便于互相迁移）。
 * 用于管理友情链接页面的数据：src/pages/friends.astro → organisms/FriendSection。
 *
 * 添加友链：在 friendsData 中追加一项即可，页面 / 筛选标签自动生成。
 * tags 会聚合为页面顶部的筛选 chip（OR 命中：选中多个标签时命中任一即显示）。
 */
export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
}

// 友情链接数据
export const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "灵梦资源站",
		imgurl: "https://www.lingmenggal.top/favicon.ico",
		desc: "个人收集资源分享小站",
		siteurl: "https://www.lingmenggal.top/",
		tags: ["资源", "个人站"],
	},
	{
		id: 2,
		title: "灵梦小盘",
		imgurl: "https://pan92.043034.xyz/favicon.ico",
		desc: "个人 OpenList 集成站",
		siteurl: "https://pan92.043034.xyz/",
		tags: ["网盘", "OpenList"],
	},
	{
		id: 3,
		title: "羽生小站",
		imgurl: "https://ysjjzi.top/favicon.ico",
		desc: "galacg 介绍与资源分享站",
		siteurl: "https://ysjjzi.top/",
		tags: ["GAL", "ACG", "资源"],
	},
	{
		id: 4,
		title: "Astro",
		imgurl: "https://avatars.githubusercontent.com/u/44914786?v=4&s=640",
		desc: "The web framework for content-driven websites",
		siteurl: "https://github.com/withastro/astro",
		tags: ["Framework"],
	},
	{
		id: 5,
		title: "Mizuki Docs",
		imgurl:
			"https://q.qlogo.cn/headimg_dl?dst_uin=3231515355&spec=640&img_type=jpg",
		desc: "Mizuki User Manual",
		siteurl: "https://docs.mizuki.mysqil.com",
		tags: ["Docs"],
	},
	{
		id: 6,
		title: "Vercel",
		imgurl: "https://avatars.githubusercontent.com/u/14985020?v=4&s=640",
		desc: "Develop. Preview. Ship.",
		siteurl: "https://vercel.com",
		tags: ["Hosting", "Cloud"],
	},
	{
		id: 7,
		title: "Tailwind CSS",
		imgurl: "https://avatars.githubusercontent.com/u/67109815?v=4&s=640",
		desc: "A utility-first CSS framework for rapidly building custom designs",
		siteurl: "https://tailwindcss.com",
		tags: ["CSS", "Framework"],
	},
	{
		id: 8,
		title: "TypeScript",
		imgurl: "https://avatars.githubusercontent.com/u/6154722?v=4&s=640",
		desc: "TypeScript is JavaScript with syntax for types",
		siteurl: "https://www.typescriptlang.org",
		tags: ["Language", "JavaScript"],
	},
	{
		id: 9,
		title: "React",
		imgurl: "https://avatars.githubusercontent.com/u/6412038?v=4&s=640",
		desc: "A JavaScript library for building user interfaces",
		siteurl: "https://reactjs.org",
		tags: ["Framework", "JavaScript"],
	},
	{
		id: 10,
		title: "GitHub",
		imgurl: "https://avatars.githubusercontent.com/u/9919?v=4&s=640",
		desc: "Where the world builds software",
		siteurl: "https://github.com",
		tags: ["Development", "Platform"],
	},
	{
		id: 11,
		title: "MDN Web Docs",
		imgurl: "https://avatars.githubusercontent.com/u/7565578?v=4&s=640",
		desc: "The web's most comprehensive resource for web developers",
		siteurl: "https://developer.mozilla.org",
		tags: ["Docs", "Reference"],
	},
	{
		id: 12,
		title: "阿晨游戏站",
		imgurl: "https://www.hoarfall.com/favicon.ico",
		desc: "阿晨游戏公益小站",
		siteurl: "https://www.hoarfall.com/",
		tags: ["资源站", "公益"],
	},
];

// 获取所有友情链接数据（稳定顺序，测试可复现）
export function getFriendsList(): FriendItem[] {
	return friendsData;
}

// 获取随机排序的友情链接数据（避免固定排序，按需使用）
export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
