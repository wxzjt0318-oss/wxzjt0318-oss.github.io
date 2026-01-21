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
} from "./types/config";
import { LinkPreset } from "./types/config";

// 如果 ./types/config 已有 ShareConfig，请用下面的导入替换本地类型声明：
// import type { ShareConfig } from "./types/config";
export type ShareConfig = {
  enable: boolean;
  poster: { enable: boolean };
};

// 定义站点语言
const SITE_LANG = "zh_CN";
const SITE_TIMEZONE = 8;

export const siteConfig: SiteConfig = {
  title: "灵梦的小站",
  subtitle: "One Weblog website",
  siteURL: "https://lm520.cc/",
  siteStartDate: "2025-11-01",
  timeZone: SITE_TIMEZONE,
  lang: SITE_LANG,
  themeColor: { hue: 340, fixed: false },
  featurePages: {
    anime: true,
    diary: true,
    friends: false,
    projects: false,
    skills: false,
    timeline: false,
    albums: true,
    devices: false,
  },
  navbarTitle: { text: "Lingmeng", icon: "assets/home/younai.png" },
  bangumi: { userId: "1180323" },
  anime: { mode: "bangumi" },
  postListLayout: { defaultMode: "list", allowSwitch: true },
  tagStyle: { useNewStyle: false },
  wallpaperMode: { defaultMode: "banner", showModeSwitchOnMobile: "desktop" },
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
      typewriter: { enable: true, speed: 100, deleteSpeed: 50, pauseTime: 2000 },
    },
    credit: { enable: false, text: "Describe", url: "" },
    navbar: { transparentMode: "semifull" },
  },
  toc: { enable: true, depth: 3, mode: "sidebar", useJapaneseBadge: false },
  showCoverInContent: true,
  generateOgImages: false,
  favicon: [
    { src: "/favicon/icon.png", sizes: "32x32" },
    { src: "/favicon/icon.png", sizes: "192x192" },
  ],
  // 仅使用本地 TTF，避免任何 woff2 请求
  font: {
    asciiFont: {
      fontFamily: "ZenMaruGothic-Medium",
      fontWeight: "400",
      // 指向你实际存在的 TTF 文件；路径相对项目根或由主题解析
      // 建议将字体放在 public/fonts 下，并在这里写 "fonts/xxx.ttf"
      localFonts: ["fonts/ZenMaruGothic-Medium.ttf"],
      // 关闭压缩/转换，防止构建管线尝试生成 woff2
      enableCompress: false,
    },
    cjkFont: {
      fontFamily: "萝莉体 第二版",
      fontWeight: "500",
      // 同样仅用 TTF；为避免 URL 编码问题，建议将文件改成 ASCII 名称并同步修改此处
      localFonts: ["fonts/萝莉体 第二版.ttf"],
      enableCompress: false,
    },
  },
  showLastModified: true,
};

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
          icon: "simple-icons:neteasecloudmusic",
        },
      ],
    },
    {
      name: "My",
      url: "/content/",
      icon: "material-symbols:person",
      children: [
        LinkPreset.Anime,
        LinkPreset.Diary,
        { name: "Gallery", url: "/albums/", icon: "material-symbols:photo-library" },
      ],
    },
    { name: "留言版", url: "/visitorbook/", icon: "material-symbols:chat" },
  ],
};

export const profileConfig: ProfileConfig = {
  avatar: "assets/images/celia.png",
  name: "lingmeng",
  bio: "I like the world, because i want live",
  typewriter: { enable: true, speed: 80 },
  links: [
    { name: "Bilibili", icon: "fa6-brands:bilibili", url: "https://b23.tv/Ny6RChH" },
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
    { name: "Discord", icon: "fa6-brands:discord", url: "https://discord.gg/cZSyH7RKvu" },
  ],
};

export const licenseConfig: LicenseConfig = {
  enable: true,
  name: "CC BY-NC-SA 4.0",
  url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const permalinkConfig: PermalinkConfig = {
  enable: false,
  format: "%postname%",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
  theme: "github-dark",
  hideDuringThemeTransition: true,
};

export const commentConfig: CommentConfig = {
  enable: true,
  twikoo: {
    envId: "https://twikoo-api-gmgc.vercel.app/",
    lang: "zh-CN",
  },
};

export const announcementConfig: AnnouncementConfig = {
  title: "My happy",
  content: "欢迎来到我的个人追番博客站，希望你开心❤",
  closable: true,
  link: { enable: true, text: "Learn More", url: "/about/", external: false },
};

export const musicPlayerConfig: MusicPlayerConfig = {
  enable: true,
  mode: "meting",
  meting_api:
    "https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
  id: "13985124277",
  server: "netease",
  type: "playlist",
};

export const footerConfig: FooterConfig = {
  enable: false,
  customHtml: "",
};

export const sidebarLayoutConfig: SidebarLayoutConfig = {
  position: "both",
  components: [
    {
      type: "profile",
      enable: true,
      order: 1,
      position: "top",
      sidebar: "left",
      class: "onload-animation",
      animationDelay: 0,
    },
    {
      type: "announcement",
      enable: true,
      order: 2,
      position: "top",
      sidebar: "left",
      class: "onload-animation",
      animationDelay: 50,
    },
    {
      type: "categories",
      enable: true,
      order: 3,
      position: "sticky",
      sidebar: "left",
      class: "onload-animation",
      animationDelay: 150,
      responsive: { collapseThreshold: 5 },
    },
    {
      type: "tags",
      enable: true,
      order: 5,
      position: "top",
      sidebar: "left",
      class: "onload-animation",
      animationDelay: 250,
      responsive: { collapseThreshold: 20 },
    },
    {
      type: "site-stats",
      enable: true,
      order: 5,
      position: "top",
      sidebar: "right",
      class: "onload-animation",
      animationDelay: 200,
    },
    {
      type: "calendar",
      enable: true,
      order: 6,
      position: "top",
      sidebar: "right",
      class: "onload-animation",
      animationDelay: 250,
    },
  ],
  defaultAnimation: { enable: true, baseDelay: 0, increment: 50 },
  responsive: {
    breakpoints: { mobile: 768, tablet: 1280, desktop: 1280 },
    layout: { mobile: "sidebar", tablet: "sidebar", desktop: "sidebar" },
  },
};

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

// Pio 看板娘配置
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
    touch: ["你干什么呀！", "不要摸我了啦！", "有死变态，主人救命呀~", "不可以这样欺负我啦！"],
    home: "点击这里回到首页哟！",
    skin: ["想看看我的新衣服吗？", "新衣服真漂亮~"],
    close: "QWQ 下次再见吧~",
    link: "https://github.com/wxzjt0318-oss/wxzjt0318-oss.github.io",
  },
};

// 分享配置：供 [...slug].astro 使用
export const shareConfig: ShareConfig = {
  enable: true,
  poster: { enable: true },
};

// 导出所有小部件配置
export const widgetConfigs = {
  profile: profileConfig,
  announcement: announcementConfig,
  music: musicPlayerConfig,
  layout: sidebarLayoutConfig,
  sakura: sakuraConfig,
  fullscreenWallpaper: fullscreenWallpaperConfig,
  pio: pioConfig,
} as const;

export const umamiConfig = {
  enabled: false,
  apiKey: import.meta.env.UMAMI_API_KEY || "api_xxxxxxxx",
  baseUrl: "https://api.umami.is",
  scripts: `
<script defer src="XXXX.XXX" data-website-id="ABCD1234"></script>
  `.trim(),
} as const;
