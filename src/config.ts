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

// 移除i18n导入以避免循环依赖

// 定义站点语言
const SITE_LANG = "ja"; // 语言代码，例如：'en', 'zh_CN', 'ja' 等。
const SITE_TIMEZONE = 8; //设置你的网站时区 from -12 to 12 default in UTC+8
export const siteConfig: SiteConfig = {
    title: "Mizuki",
    subtitle: "One demo website",
    siteURL: "https://mizuki.mysqil.com/", // 请替换为你的站点URL，以斜杠结尾
    siteStartDate: "2025-01-01", // 站点开始运行日期，用于站点统计组件计算运行天数

    timeZone: SITE_TIMEZONE,

    lang: SITE_LANG,

    themeColor: {
        hue: 60, // 主题色的默认色相，范围从 0 到 360。例如：红色：0，青色：200，蓝绿色：250，粉色：345
        fixed: false, // 对访问者隐藏主题色选择器
    },

    // 特色页面开关配置（关闭未使用的页面有助于提升 SEO，关闭后请记得在 navbarConfig 中移除对应链接）
    featurePages: {
        anime: true, // 番剧页面开关
        diary: true, // 日记页面开关
        friends: true, // 友链页面开关
        projects: true, // 项目页面开关
        skills: true, // 技能页面开关
        timeline: true, // 时间线页面开关
        albums: true, // 相册页面开关
        devices: true, // 设备页面开关
    },

    // 顶栏标题配置
    navbarTitle: {
        // 显示模式："text-icon" 显示图标+文本，"logo" 仅显示Logo
        mode: "logo",
        // 顶栏标题文本
        text: "MizukiUI",
        // 顶栏标题图标路径，默认使用 public/assets/home/home.png
        icon: "assets/home/home.png",
        // 网站Logo图片路径
        logo: "assets/home/default-logo.png",
    },

    // 页面自动缩放配置
    pageScaling: {
        enable: true, // 是否开启自动缩放
        targetWidth: 2000, // 目标宽度，低于此宽度时开始缩放
    },

    bangumi: {
        userId: "your-bangumi-id", // 在此处设置你的Bangumi用户ID，可以设置为 "sai" 测试
        fetchOnDev: false, // 是否在开发环境下获取 Bangumi 数据（默认 false），获取前先执行 pnpm build 构建 json 文件
    },

    anime: {
        mode: "local", // 番剧页面模式："bangumi" 使用Bangumi API，"local" 使用本地配置
    },

    // 文章列表布局配置
    postListLayout: {
        // 默认布局模式："list" 列表模式（单列布局），"grid" 网格模式（双列布局）
        // 注意：如果侧边栏配置启用了"both"双侧边栏，则无法使用文章列表"grid"网格（双列）布局
        defaultMode: "list",
        // 是否允许用户切换布局
        allowSwitch: true,
    },

    // 标签样式配置
    tagStyle: {
        // 是否使用新样式（悬停高亮样式）还是旧样式（外框常亮样式）
        useNewStyle: false,
    },

    // 壁纸模式配置
    wallpaperMode: {
        // 默认壁纸模式：banner=顶部横幅，fullscreen=全屏壁纸，none=无壁纸
        defaultMode: "banner",
        // 整体布局方案切换按钮显示设置（默认："desktop"）
        // "off" = 不显示
        // "mobile" = 仅在移动端显示
        // "desktop" = 仅在桌面端显示
        // "both" = 在所有设备上显示
        showModeSwitchOnMobile: "desktop",
    },

    banner: {
        // 支持单张图片或图片数组，当数组长度 > 1 时自动启用轮播
        src: {
            desktop: [
                "/assets/desktop-banner/1.webp",
                "/assets/desktop-banner/2.webp",
                "/assets/desktop-banner/3.webp",
                "/assets/desktop-banner/4.webp",
                "/assets/desktop-banner/5.webp",
                "/assets/desktop-banner/6.webp",
            ], // 桌面横幅图片
            mobile: [
                "/assets/mobile-banner/1.webp",
                "/assets/mobile-banner/2.webp",
                "/assets/mobile-banner/3.webp",
                "/assets/mobile-banner/4.webp",
                "/assets/mobile-banner/5.webp",
                "/assets/mobile-banner/6.webp",
            ], // 移动横幅图片
        }, // 使用本地横幅图片

        position: "center", // 等同于 object-position，仅支持 'top', 'center', 'bottom'。默认为 'center'

        carousel: {
            enable: true, // 为 true 时：为多张图片启用轮播。为 false 时：从数组中随机显示一张图片
            interval: 1.5, // 轮播间隔时间（秒）
        },

        waves: {
            enable: true, // 是否启用水波纹效果（注意：此功能性能开销较大）
            performanceMode: false, // 性能模式：减少动画复杂度(性能提升40%)
            mobileDisable: false, // 移动端禁用
        },

        // PicFlow API支持(智能图片API)
        imageApi: {
            enable: false, // 启用图片API
            url: "http://domain.com/api_v2.php?format=text&count=4", // API地址，返回每行一个图片链接的文本
        },
        // 这里需要使用PicFlow API的Text返回类型,所以我们需要format=text参数
        // 项目地址:https://github.com/matsuzaka-yuki/PicFlow-API
        // 请自行搭建API

        homeText: {
            enable: true, // 在主页显示自定义文本
            title: "わたしの部屋", // 主页横幅主标题

            subtitle: [
                "特別なことはないけど、君がいると十分です",
                "今でもあなたは私の光",
                "君ってさ、知らないうちに私の毎日になってたよ",
                "君と話すと、なんか毎日がちょっと楽しくなるんだ",
                "今日はなんでもない日。でも、ちょっとだけいい日",
            ],
            typewriter: {
                enable: true, // 启用副标题打字机效果

                speed: 100, // 打字速度（毫秒）
                deleteSpeed: 50, // 删除速度（毫秒）
                pauseTime: 2000, // 完全显示后的暂停时间（毫秒）
            },
        },

        credit: {
            enable: false, // 显示横幅图片来源文本

            text: "Describe", // 要显示的来源文本
            url: "", // （可选）原始艺术品或艺术家页面的 URL 链接
        },

        navbar: {
            transparentMode: "semifull", // 导航栏透明模式："semi" 半透明加圆角，"full" 完全透明，"semifull" 动态透明
        },
    },
    toc: {
        enable: true, // 启用目录功能
        mode: "sidebar", // 目录显示模式："float" 悬浮按钮模式，"sidebar" 侧边栏模式
        depth: 2, // 目录深度，1-6，1 表示只显示 h1 标题，2 表示显示 h1 和 h2 标题，依此类推
        useJapaneseBadge: true, // 使用日语假名标记（あいうえお...）代替数字，开启后会将 1、2、3... 改为 あ、い、う...
    },
    showCoverInContent: true, // 在文章内容页显示文章封面
    generateOgImages: false, // 启用生成OpenGraph图片功能,注意开启后要渲染很长时间，不建议本地调试的时候开启
    favicon: [
        // 留空以使用默认 favicon
        // {
        //   src: '/favicon/icon.png',    // 图标文件路径
        //   theme: 'light' | 'dark',     // 可选
        //   sizes: '32x32',              // 可选
        // }
    ],

    // 字体配置
    font: {
        // 注意：字体子集优化功能目前仅支持 TTF 格式字体
        // 与 scripts/compress-fonts.js 对齐：文件需位于 public/assets/font/
        asciiFont: {
            // 英文字体（ASCII 子集）
            fontFamily: "ZenMaruGothic",              // 家族名（用于 CSS 中引用）
            fontWeight: "400",
            localFonts: ["ZenMaruGothic-Medium.ttf"], // 精确文件名，位于 public/assets/font/
            enableCompress: true,                      // 构建时子集化为 .woff2
        },
        cjkFont: {
            // 中日韩字体（作为回退）
            fontFamily: "LuoLiTi",                     // 将原“萝莉体 第二版”改为 ASCII 名称，避免中文/空格
            fontWeight: "500",
            localFonts: ["LuoLiTi-2.ttf"],             // 将原文件重命名为 ASCII：LuoLiTi-2.ttf
            enableCompress: true,
        },
    },
    showLastModified: true, // 控制“上次编辑”卡片显示的开关
};
export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = {
    src: {
        desktop: [
            "/assets/desktop-banner/1.webp",
            "/assets/desktop-banner/2.webp",
            "/assets/desktop-banner/3.webp",
            "/assets/desktop-banner/4.webp",
            "/assets/desktop-banner/5.webp",
            "/assets/desktop-banner/6.webp",
        ], // 桌面横幅图片
        mobile: [
            "/assets/mobile-banner/1.webp",
            "/assets/mobile-banner/2.webp",
            "/assets/mobile-banner/3.webp",
            "/assets/mobile-banner/4.webp",
            "/assets/mobile-banner/5.webp",
            "/assets/mobile-banner/6.webp",
        ], // 移动横幅图片
    }, // 使用本地横幅图片
    position: "center", // 壁纸位置，等同于 object-position
    carousel: {
        enable: true, // 启用轮播
        interval: 5, // 轮播间隔时间（秒）
    },
    zIndex: -1, // 层级，确保壁纸在背景层
    opacity: 0.8, // 壁纸透明度
    blur: 1, // 背景模糊程度
};

export const navBarConfig: NavBarConfig = {
    links: [
        LinkPreset.Home,
        LinkPreset.Archive,
        // 支持自定义导航栏链接，支持多级菜单
        {
            name: "Links",
            url: "/links/",
            icon: "material-symbols:link",
            children: [
                {
                    name: "GitHub",
                    url: "https://github.com/matsuzaka-yuki/Mizuki",
                    external: true,
                    icon: "fa6-brands:github",
                },
                {
                    name: "Bilibili",
                    url: "https://space.bilibili.com/701864046",
                    external: true,
                    icon: "fa6-brands:bilibili",
                },
                {
                    name: "Gitee",
                    url: "https://gitee.com/matsuzakayuki/Mizuki",
                    external: true,
                    icon: "mdi:git",
                },
            ],
        },
        {
            name: "My",
            url: "/content/",
            icon: "material-symbols:person",
            children: [
                {
                    name: "Anime",
                    url: "/anime/",
                    icon: "material-symbols:movie",
                },
                {
                    name: "Diary",
                    url: "/diary/",
                    icon: "material-symbols:book",
                },
                {
                    name: "Gallery",
                    url: "/albums/",
                    icon: "material-symbols:photo-library",
                },
                {
                    name: "Devices",
                    url: "devices/",
                    icon: "material-symbols:devices",
                    external: false,
                },
            ],
        },
        {
            name: "About",
            url: "/content/",
            icon: "material-symbols:info",
            children: [
                {
                    name: "About",
                    url: "/about/",
                    icon: "material-symbols:person",
                },
                {
                    name: "Friends",
                    url: "/friends/",
                    icon: "material-symbols:group",
                },
            ],
        },
        {
            name: "Others",
            url: "#",
            icon: "material-symbols:more-horiz",
            children: [
                {
                    name: "Projects",
                    url: "/projects/",
                    icon: "material-symbols:work",
                },
                {
                    name: "Skills",
                    url: "/skills/",
                    icon: "material-symbols:psychology",
                },
                {
                    name: "Timeline",
                    url: "/timeline/",
                    icon: "material-symbols:timeline",
                },
            ],
        },
    ],
};

export const profileConfig: ProfileConfig = {
    avatar: "assets/images/avatar.webp", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
    name: "まつざか ゆき",
    bio: "世界は大きい、君は行かなければならない",
    typewriter: {
        enable: true, // 启用个人简介打字机效果
        speed: 80, // 打字速度（毫秒）
    },
    links: [
        {
            name: "Bilibili",
            icon: "fa6-brands:bilibili",
            url: "https://space.bilibili.com/701864046",
        },
        {
            name: "Gitee",
            icon: "mdi:git",
            url: "https://gitee.com/matsuzakayuki",
        },
        {
            name: "GitHub",
            icon: "fa6-brands:github",
            url: "https://github.com/matsuzaka-yuki",
        },
        {
            name: "Codeberg",
            icon: "simple-icons:codeberg",
            url: "https://codeberg.org",
        },
        {
            name: "Discord",
            icon: "fa6-brands:discord",
            url: "https://discord.gg/MqW6TcQtVM",
        },
    ],
};

export const licenseConfig: LicenseConfig = {
    enable: true,
    name: "CC BY-NC-SA 4.0",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// Permalink 固定链接配置
export const permalinkConfig: PermalinkConfig = {
    enable: false, // 是否启用全局 permalink 功能，关闭时使用默认的文件名作为链接
    /**
     * permalink 格式模板
     * 支持的占位符：
     * - %year% : 4位年份 (2024)
     * - %monthnum% : 2位月份 (01-12)
     * - %day% : 2位日期 (01-31)
     * - %hour% : 2位小时 (00-23)
     * - %minute% : 2位分钟 (00-59)
     * - %second% : 2位秒数 (00-59)
     * - %post_id% : 文章序号（按发布时间升序排列，最早的文章为1）
     * - %postname% : 文章文件名（slug）
     * - %category% : 分类名（无分类时为 "uncategorized"）
     *
     * 注意：不支持斜杠 "/"，所有生成的链接都在根目录下
     */
    format: "%postname%", // 默认使用文件名
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
    // 注意：某些样式（如背景颜色）已被覆盖，请参阅 astro.config.mjs 文件。
    // 请选择深色主题，因为此博客主题目前仅支持深色背景
    theme: "github-dark",
    // 是否在主题切换时隐藏代码块以避免卡顿问题
    hideDuringThemeTransition: true,
};

export const commentConfig: CommentConfig = {
    enable: false, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
    twikoo: {
        envId: "https://twikoo.vercel.app",
        lang: SITE_LANG,
    },
};

export const shareConfig: ShareConfig = {
    enable: true, // 启用分享功能
};

export const announcementConfig: AnnouncementConfig = {
    title: "", // 公告标题，填空使用i18n字符串Key.announcement
    content: "ブログへようこそ！これはサンプルの告知です", // 公告内容
    closable: true, // 允许用户关闭公告
    link: {
        enable: true, // 启用链接
        text: "Learn More", // 链接文本
        url: "/about/", // 链接 URL
        external: false, // 内部链接
    },
};

export const musicPlayerConfig: MusicPlayerConfig = {
    enable: true, // 启用音乐播放器功能
    mode: "meting", // 音乐播放器模式，可选 "local" 或 "meting"
    meting_api:
        "https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r", // Meting API 地址
    id: "14164869977", // 歌单ID
    server: "netease", // 音乐源服务器
    type: "playlist", // 播单类型
};

export const footerConfig: FooterConfig = {
    enable: false, // 是否启用Footer HTML注入功能
    customHtml: "", // HTML格式的自定义页脚信息
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
    defaultAnimation: {
        enable: true,
        baseDelay: 0,
        increment: 50,
    },
    responsive: {
        breakpoints: {
            mobile: 768,
            tablet: 1280,
            desktop: 1280,
        },
        layout: {
            mobile: "sidebar",
            tablet: "sidebar",
            desktop: "sidebar",
        },
    },
};

export const sakuraConfig: SakuraConfig = {
    enable: false,
    sakuraNum: 21,
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

export const pioConfig: import("./types/config").PioConfig = {
    enable: true,
    models: ["/pio/models/pio/model.json"],
    position: "left",
    width: 280,
    height: 250,
    mode: "draggable",
    hiddenOnMobile: true,
    dialog: {
        welcome: "Welcome to Mizuki Website!",
        touch: ["What are you doing?", "Stop touching me!", "HENTAI!", "Don't bully me like that!"],
        home: "Click here to go back to homepage!",
        skin: ["Want to see my new outfit?", "The new outfit looks great~"],
        close: "QWQ See you next time~",
        link: "https://github.com/matsuzaka-yuki/Mizuki",
    },
};

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
    enabled: false,
    apiKey: import.meta.env.UMAMI_API_KEY || "api_xxxxxxxx",
    baseUrl: "https://api.umami.is",
    scripts: `
<script defer src="XXXX.XXX" data-website-id="ABCD1234"></script>
  `.trim(),
} as const;
