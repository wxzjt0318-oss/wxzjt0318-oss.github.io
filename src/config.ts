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
  ShareConfig,
  SidebarLayoutConfig,
  SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

// 定义站点语言
const SITE_LANG = "zh_CN"; // 语言代码，例如：'en', 'zh_CN', 'ja' 等。
const SITE_TIMEZONE = 8; //设置你的网站时区 from -12 to 12 default in UTC+8

export const siteConfig: SiteConfig = {
  title: "灵梦的小站",
  subtitle: "One Weblog website",
  siteURL: "https://lm520.cc/", // 改为 HTTPS，避免混合内容
  siteStartDate: "2025-11-01", // 站点开始运行日期，用于站点统计组件计算运行天数

  timeZone: SITE_TIMEZONE,
  lang: SITE_LANG,

  themeColor: {
    hue: 340, // 主题色默认色相
    fixed: false, // 对访问者隐藏主题色选择器
  },

  // 特色页面开关配置（关闭未使用的页面有助于提升 SEO，关闭后请记得在 navbarConfig 中移除对应链接）
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

  // 顶栏标题配置
  navbarTitle: {
    // 显示模式："text-icon" 显示图标+文本，"logo" 仅显示Logo
    // 参考新增字段，保持你的自定义文案与图标
    mode: "text-icon",
    text: "Lingmeng",
    icon: "assets/home/younai.png",
    // logo 可选，未提供则忽略
  },

  bangumi: {
    userId: "1180323", // 你的 Bangumi 用户ID
    fetchOnDev: false, // 与参考保持一致：本地开发默认不抓取
  },

  anime: {
    mode: "bangumi", // 使用 Bangumi API
  },

  // 文章列表布局配置
  postListLayout: {
    defaultMode: "list",
    allowSwitch: true,
  },

  // 标签样式配置
  tagStyle: {
    useNewStyle: false,
  },

  // 壁纸模式配置
  wallpaperMode: {
    defaultMode: "banner",
    // 参考字段名是 showModeSwitchOnMobile，沿用并保留你的值
    showModeSwitchOnMobile: "desktop",
  },

  banner: {
    // 保留你的 dmoe 随机图设置
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

    carousel: {
      enable: true,
      interval: 1.5,
    },

    waves: {
      enable: true,
      performanceMode: false,
      mobileDisable: false,
    },

    // 参考的 imageApi 接口为“文本多行直链”，与你的 dmoe API 不匹配，保持关闭
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

    credit: {
      enable: false,
      text: "Describe",
      url: "",
    },

    navbar: {
      transparentMode: "semifull",
    },
  },

  toc: {
    enable: true,
    mode: "sidebar", // 根据参考新增字段
    depth: 3,
    useJapaneseBadge: false,
  },

  showCoverInContent: true,
  generateOgImages: false,

  favicon: [
    {
      src: "/favicon/icon.png",
      sizes: "32x32",
    },
    {
      src: "/favicon/icon.png",
      sizes: "192x192",
    },
  ],

  // 字体配置
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
  carousel: {
    enable: true,
    interval: 5,
  },
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
        LinkPreset.Diary,
        {
          name: "Gallery",
          url: "/albums/",
          icon: "material-symbols:photo-library",
        },
      ],
    },
    {
      name: "留言版",
      url: "/visitorbook/",
      icon: "material-symbols:chat",
    },
  ],
};

export const profileConfig: ProfileConfig = {
  avatar: "assets/images/celia.png",
  name: "lingmeng",
  bio: "I like the world, because i want live",
  typewriter: {
    enable: true,
    speed: 80,
  },
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

export const licenseConfig: LicenseConfig = {
  enable: true,
  name: "CC BY-NC-SA 4.0",
  url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// Permalink 固定链接配置（参考提供了更完整注释与同名字段）
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

export const shareConfig: ShareConfig = {
  enable: true, // 参考新增：启用文章分享功能
};

export const announcementConfig: AnnouncementConfig = {
  title: "My happy",
  content: "欢迎来到我的个人追番博客站，希望你开心❤",
  closable: true,
  link: {
    enable: true,
    text: "Learn More",
    url: "/about/",
    external: false,
  },
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

/**
 * 侧边栏布局配置
 * 用于控制侧边栏组件的显示、排序、动画和响应式行为
 * sidebar: 控制组件在左侧栏和右侧栏,注意移动端是不会显示右侧栏的内容(unilateral模式除外),在设置了right属性的时候请确保你使用双侧(both)布局
 */
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
      responsive: {
        collapseThreshold: 5,
      },
    },
    {
      type: "tags",
      enable: true,
      order: 5,
      position: "top",
      sidebar: "left",
      class: "onload-animation",
      animationDelay: 250,
      responsive: {
        collapseThreshold: 20,
      },
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

  // 默认动画配置
  defaultAnimation: {
    enable: true,
    baseDelay: 0,
    increment: 50,
  },

  // 响应式布局配置
  responsive: {
    breakpoints: {
      mobile: 768,
      tablet: 1280,
      desktop: 1280, // 按参考修正注释“桌面端：大于等于1280”的同值阈
    },
    // hidden: 隐藏侧边栏; drawer: 抽屉(注释保留); sidebar: 显示侧边栏
    layout: {
      mobile: "sidebar",
      tablet: "sidebar",
      desktop: "sidebar",
    },
  },
};

export const sakuraConfig: SakuraConfig = {
  enable: true,
  sakuraNum: 18,
  limitTimes: -1,
  size: {
    min: 0.5,
    max: 1.1,
  },
  opacity: {
    min: 0.3,
    max: 0.9,
  },
  speed: {
    horizontal: {
      min: -1.7,
      max: -1.2,
    },
    vertical: {
      min: 1.5,
      max: 2.2,
    },
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

// 导出所有配置的统一接口
export const widgetConfigs = {
  profile: profileConfig,
  announcement: announcementConfig,
  music: musicPlayerConfig,
  layout: sidebarLayoutConfig,
  sakura: sakuraConfig,
  fullscreenWallpaper: fullscreenWallpaperConfig,
  pio: pioConfig,
  share: { enable: true }, // 与参考保持：统一导出中包含分享配置
} as const;

export const umamiConfig = {
  enabled: false, // 是否显示Umami统计
  apiKey: import.meta.env.UMAMI_API_KEY || "api_xxxxxxxx",
  baseUrl: "https://api.umami.is",
  scripts: `
<script defer src="XXXX.XXX" data-website-id="ABCD1234"></script>
  `.trim(),
} as const;
