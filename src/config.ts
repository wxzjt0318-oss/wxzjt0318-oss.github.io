import type {
	AnnouncementConfig,
	CommentConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	FullscreenWallpaperConfig,
	LicenseConfig,
	MusicPlayerConfig,
	NavBarConfig,
	PermalinkConfig,
	ProfileConfig,
	SakuraConfig,
	SidebarLayoutConfig,
	SiteConfig,
	ShareConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

// 自定义：分享配置类型（你的模板里已用到 SharePoster）
export type SharePosterConfig = {
	enable: boolean;
};

export type ShareConfigWithPoster = ShareConfig & {
	poster: SharePosterConfig;
};

// 站点语言与时区（保留你的设置）
const SITE_LANG = "zh_CN";
const SITE_TIMEZONE = 8;

// 站点配置（保留你的个性化标题/副标题/域名/文案等）
export const siteConfig: SiteConfig = {
	title: "灵梦的小站",
	subtitle: "One Weblog website",
	siteURL: "https://lm520.cc/",
	siteStartDate: "2025-11-01",
	timeZone: SITE_TIMEZONE,
	lang: SITE_LANG,
	themeColor: { hue: 340, fixed: false },

	// 保留你的开关
	featurePages: {
		anime: true,
		games: true,
		diary: true,
		friends: false,
		projects: false,
		skills: false,
		timeline: false,
		albums: true,
		devices: false,
	},

	// 顶栏标题（保留你的文案与图标）
	navbarTitle: { text: "Lingmeng", icon: "assets/home/younai.png" },

	// 番剧与动画模式（保留你的 bangumi 与 anime 配置）
	bangumi: { userId: "1180323" },
	anime: { mode: "bangumi" },
	game: { mode: "bangumi", cacheTtlHours: 0 },

	// 页面缩放
	pageScaling: {
		enable: true,
		targetWidth: 2000,
	},

	postListLayout: { defaultMode: "list", allowSwitch: true },
	tagStyle: { useNewStyle: false },
	wallpaperMode: { defaultMode: "banner", showModeSwitchOnMobile: "desktop" },

	// Banner
	banner: {
		src: {
			desktop: [
				"https://www.dmoe.cc/random.php?t=1",
				"https://www.dmoe.cc/random.php?t=2",
				"https://www.dmoe.cc/random.php?t=3",
				"https://www.dmoe.cc/random.php?t=4",
				"https://www.dmoe.cc/random.php?t=5",
				"https://www.dmoe.cc/random.php?t=6",
			],
			mobile: [
				"https://www.dmoe.cc/random.php?t=m1",
				"https://www.dmoe.cc/random.php?t=m2",
				"https://www.dmoe.cc/random.php?t=m3",
				"https://www.dmoe.cc/random.php?t=m4",
				"https://www.dmoe.cc/random.php?t=m5",
				"https://www.dmoe.cc/random.php?t=m6",
			],
		},
		position: "center",
		carousel: { enable: true, interval: 1.5 },
		waves: { enable: true, performanceMode: false, mobileDisable: false },
		imageApi: {
			enable: false,
			url: "http://domain.com/api_v2.php?format=text&count=4",
		},
		homeText: {
			enable: true,
			title: "霊夢の小站",
			subtitle: [
				"特別なことはないけど、君がいると十分です",
				"今でもあなたは私の光",
				"世界は広いけど、ここに来てくれてありがとう",
				"今日も一日、よろしくお願いします！",
				"平凡な日々に、ちょっとした幸せを",
				"心に桜を、手に梦を",
				"あなたの訪問が、私の喜びです",
			],
			typewriter: {
				enable: true,
				speed: 100,
				deleteSpeed: 50,
				pauseTime: 2000,
			},
		},
		credit: { enable: false, text: "Describe", url: "" },
		navbar: { transparentMode: "semifull" },
	},

	toc: { enable: true, depth: 3, mode: "sidebar", useJapaneseBadge: false },
	showCoverInContent: true,
	generateOgImages: false,
	favicon: [],

	// 字体
	font: {
		asciiFont: {
			fontFamily: "ZenMaruGothic-Medium",
			fontWeight: "400",
			localFonts: ["ZenMaruGothic-Medium.ttf"],
			enableCompress: true,
		},
		cjkFont: {
			fontFamily: "萝莉体 第二版",
			fontWeight: "500",
			localFonts: ["萝莉体 第二版.ttf"],
			enableCompress: true,
		},
	},

	showLastModified: true,
};

// 全屏壁纸
export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = {
	src: {
		desktop: [
			"/assets/desktop-banner/1.webp",
			"/assets/desktop-banner/2.webp",
			"/assets/desktop-banner/3.webp",
			"/assets/desktop-banner/4.webp",
		],
		mobile: [
			"/assets/mobile-banner/1.webp",
			"/assets/mobile-banner/2.webp",
			"/assets/mobile-banner/3.webp",
			"/assets/mobile-banner/4.webp",
		],
	},
	position: "center",
	carousel: { enable: true, interval: 5 },
	zIndex: -1,
	opacity: 0.8,
	blur: 1,
};

// 导航
export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "Links",
			url: "/links/",
			icon: "material-symbols:link",
			children: [
				{
					name: "GitHub",
					url: "https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io",
					external: true,
					icon: "fa6-brands:github",
				},
				{
					name: "Bilibili",
					url: "https://b23.tv/Ny6RChH",
					external: true,
					icon: "fa6-brands:bilibili",
				},
				{
					name: "QQ",
					url: "https://qm.qq.com/q/toDlBSdPxu",
					external: true,
					icon: "fa6-brands:qq",
				},
				{
					name: "网易云",
					url: "https://music.163.com/#/user/home?id=118926845",
					external: true,
					icon: "simple-icons:spotify",
				},
			],
		},
		{
			name: "My",
			url: "/content/",
			icon: "material-symbols:person",
			children: [
				LinkPreset.Anime,
				LinkPreset.Games,
				LinkPreset.Diary,
				{
					name: "Gallery",
					url: "/albums/",
					icon: "material-symbols:photo-library",
				},
			],
		},
		{ name: "留言版", url: "/visitorbook/", icon: "material-symbols:chat" },
	],
};

// 个人资料
export const profileConfig: ProfileConfig = {
	avatar: "assets/images/celia.png",
	name: "lingmeng",
	bio: "I like the world, because i want live",
	typewriter: { enable: true, speed: 80 },
	links: [
		{
			name: "Bilibli",
			icon: "fa6-brands:bilibili",
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
};

// 版权
export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// 固定链接
export const permalinkConfig: PermalinkConfig = {
	enable: false,
	format: "%postname%",
};

// 代码块
export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
	hideDuringThemeTransition: true,
};

// 评论
export const commentConfig: CommentConfig = {
	enable: true,
	twikoo: {
		envId: "https://twikoo-api-gmgc.vercel.app/",
		lang: "zh-CN",
	},
};

// 公告
export const announcementConfig: AnnouncementConfig = {
	title: "My happy",
	content: "欢迎来到我的个人追番博客站，希望你开心❤",
	closable: true,
	link: { enable: true, text: "Learn More", url: "/about/", external: false },
};

// 音乐
export const musicPlayerConfig: MusicPlayerConfig = {
	enable: true,
	mode: "meting",
	meting_api:
		"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
	id: "13985124277",
	server: "netease",
	type: "playlist",
};

// 页脚
export const footerConfig: FooterConfig = {
	enable: false,
	customHtml: "",
};

/**
 * 侧边栏布局
 * - 修正 WidgetComponentConfig 字段名：enable -> enabled
 * - 去掉 responsive.layout（类型仅接受 breakpoints）
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 不再声明 position，页面根据 components 的左右是否有内容自行判断
	properties: [
		{
			type: "profile",
			enabled: true,
			position: "top",
			class: "onload-animation",
			animationDelay: 0,
		},
		{
			type: "announcement",
			enabled: true,
			position: "top",
			class: "onload-animation",
			animationDelay: 50,
		},
		{
			type: "categories",
			enabled: true,
			position: "sticky",
			class: "onload-animation",
			animationDelay: 150,
			responsive: { collapseThreshold: 5 },
		},
		{
			type: "tags",
			enabled: true,
			position: "top",
			class: "onload-animation",
			animationDelay: 250,
			responsive: { collapseThreshold: 20 },
		},
		{
			type: "site-stats",
			enabled: true,
			position: "top",
			class: "onload-animation",
			animationDelay: 200,
		},
		{
			type: "calendar",
			enabled: true,
			position: "top",
			class: "onload-animation",
			animationDelay: 250,
		},
	],
	components: {
		left: ["profile", "announcement", "categories", "tags"],
		right: ["site-stats", "calendar"],
		drawer: ["profile", "announcement"],
	},
	defaultAnimation: { enable: true, baseDelay: 0, increment: 50 },
	responsive: {
		breakpoints: { mobile: 768, tablet: 1280, desktop: 1280 },
	},
};

// 樱花
export const sakuraConfig: SakuraConfig = {
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
};

// Pio
export const pioConfig: import("./types/config").PioConfig = {
	enable: true,
	models: ["/pio/models/pio/model.json"],
	position: "left",
	width: 280,
	height: 250,
	mode: "draggable",
	hiddenOnMobile: true,
	dialog: {
		welcome: "欢迎来到灵梦的小站!",
		touch: [
			"你干什么呀！",
			"不要摸我了啦！",
			"有死变态，主人救命呀~",
			"不可以这样欺负我啦！",
		],
		home: "点击这里回到首页哟！",
		skin: ["想看看我的新衣服吗？", "新衣服真漂亮~"],
		close: "QWQ 下次再见吧~",
		link: "https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io",
	},
};

// 分享（保留你的 SharePoster 能力）
export const shareConfig: ShareConfigWithPoster = {
	enable: true,
	poster: { enable: true },
};

// 统一导出 widgets
export const widgetConfigs = {
	profile: profileConfig,
	announcement: announcementConfig,
	music: musicPlayerConfig,
	layout: sidebarLayoutConfig,
	sakura: sakuraConfig,
	fullscreenWallpaper: fullscreenWallpaperConfig,
	pio: pioConfig,
	share: shareConfig,
} as const;

export const umamiConfig = {
	enabled: true,
	apiKey:
		import.meta.env.UMAMI_API_KEY || "api_en9RqdmWT5ad7Q9SaQtkbuRTByUwKMXi",
	baseUrl: "https://api.umami.is",
	scripts: `
<script defer src="https://cloud.umami.is/script.js" data-website-id="5529ac8c-8065-46d2-b0dc-83960ac4163c"></script>
  `.trim(),
} as const;
