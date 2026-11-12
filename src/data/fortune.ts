/**
 * 命运页数据：程序员老黄历的事项、朝向、饮品，以及求签的签文。
 * 文案是站点内容（与友链、动态同类），只有中文；页面上的固定标签走 i18n。
 * 抽取算法见 src/utils/fortune.ts：同一天所有访客看到的结果相同。
 */

export interface AlmanacActivity {
	name: string;
	/** 落在「宜」时的批注 */
	good: string;
	/** 落在「不宜」时的批注 */
	bad: string;
	/** 只在工作日出现（开会、面试这类周末不会发生的事） */
	weekdayOnly?: boolean;
}

/** name / good / bad 里的 {n} 会替换成当天的一个随机数 */
export const almanacActivities: AlmanacActivity[] = [
	{ name: "洗澡", good: "你几天没洗澡了？", bad: "会把设计方面的灵感洗掉" },
	{
		name: "锻炼一下身体",
		good: "是时候舒展下僵硬的肌肉了",
		bad: "能量没消耗多少，吃得却更多",
	},
	{ name: "重构", good: "代码质量得到提高", bad: "你很有可能会陷入泥潭" },
	{
		name: "面试",
		good: "面试官今天心情很好",
		bad: "面试官不爽，会拿你出气",
		weekdayOnly: true,
	},
	{
		name: "晚上加班",
		good: "晚上是程序员精神最好的时候",
		bad: "身心憔悴，早点休息",
	},
	{
		name: "写超过{n}行的方法",
		good: "你的代码组织的很好，长一点没关系",
		bad: "你的代码将混乱不堪，你自己都看不懂",
	},
	{
		name: "开会",
		good: "写代码之余放松一下打个盹，有益健康",
		bad: "小心被扣屎盆子背黑锅",
		weekdayOnly: true,
	},
	{
		name: "写单元测试",
		good: "写单元测试将减少出错",
		bad: "写单元测试会降低你的开发效率",
	},
	{
		name: "提交代码",
		good: "遇到冲突的几率是最低的",
		bad: "你遇到的一大堆冲突会让你觉得自己是不是时间穿越了",
	},
	{
		name: "代码复审",
		good: "发现重要问题的几率大大增加",
		bad: "你什么问题都发现不了，白白浪费时间",
	},
	{
		name: "上线发布",
		good: "今天上线一路绿灯",
		bad: "刚发出去就要回滚",
		weekdayOnly: true,
	},
	{
		name: "修复 BUG",
		good: "你今天对 BUG 的嗅觉特别灵敏",
		bad: "新产生的 BUG 将比修复的更多",
	},
	{
		name: "设计评审",
		good: "设计评审会议将变成头脑风暴",
		bad: "人人筋疲力尽，评审就这么过了",
		weekdayOnly: true,
	},
	{
		name: "需求评审",
		good: "需求清晰明了，一次过",
		bad: "需求改了又改，最后用回第一版",
		weekdayOnly: true,
	},
	{
		name: "命名变量",
		good: "今天起的名字连同事都夸",
		bad: "最后只会留下 a、b、tmp 和 data2",
	},
	{ name: "写文档", good: "文思泉涌，一气呵成", bad: "写了也没人看" },
	{
		name: "升级依赖",
		good: "所有测试一次通过",
		bad: "一个小版本号带来一下午的排查",
	},
	{
		name: "学习一门新技术",
		good: "未来的你会感谢现在的你",
		bad: "学会之前它就过时了",
	},
	{
		name: "跳槽",
		good: "该放手时就放手",
		bad: "鉴于当前的经济形势，你的下一份工作未必比现在强",
	},
	{
		name: "招人",
		good: "你面前这位有成为牛人的潜质",
		bad: "这人会写程序吗？",
		weekdayOnly: true,
	},
	{
		name: "申请加薪",
		good: "老板今天心情很好",
		bad: "公司正在考虑裁员",
		weekdayOnly: true,
	},
	{ name: "在群里摸鱼", good: "还需要理由吗？", bad: "老板正好在翻聊天记录" },
	{
		name: "追番",
		good: "今天的更新不会让你失望",
		bad: "一集接一集，回过神来天亮了",
	},
	{
		name: "打游戏",
		good: "抽卡必出金，排位连胜",
		bad: "队友全是来考验你心态的",
	},
	{ name: "点外卖", good: "骑手比你想的还快", bad: "今天的满减怎么都凑不上" },
	{ name: "早起", good: "一天之计在于晨", bad: "早起之后一整天都没精神" },
	{ name: "熬夜", good: "夜深人静，灵感最多", bad: "明天开会时你会睡着" },
	{
		name: "清理硬盘",
		good: "腾出的空间又能装几部番",
		bad: "你会手滑删掉不该删的东西",
	},
	{ name: "备份数据", good: "未雨绸缪，有备无患", bad: "备份到一半硬盘满了" },
	{ name: "重启试试", good: "重启之后一切正常", bad: "重启之后连机都开不了" },
];

export const almanacDirections: string[] = [
	"北方",
	"东北方",
	"东方",
	"东南方",
	"南方",
	"西南方",
	"西方",
	"西北方",
];

export const almanacDrinks: string[] = [
	"水",
	"茶",
	"红茶",
	"绿茶",
	"咖啡",
	"奶茶",
	"可乐",
	"鲜奶",
	"豆奶",
	"果汁",
	"果味汽水",
	"苏打水",
	"运动饮料",
	"酸奶",
	"热可可",
	"柠檬水",
];

export interface FortuneTopic {
	id: string;
	name: string;
}

export const fortuneTopics: FortuneTopic[] = [
	{ id: "coding", name: "编码" },
	{ id: "testing", name: "测试" },
	{ id: "bugfix", name: "修复BUG" },
	{ id: "commit", name: "提交代码" },
	{ id: "other", name: "其他" },
];

export interface FortuneRank {
	id: "great" | "good" | "fair" | "plain" | "bad";
	name: string;
	/** 抽中的权重 */
	weight: number;
	/** 签诗，抽中该等级后从中取一首 */
	verses: string[];
}

export const fortuneRanks: FortuneRank[] = [
	{
		id: "great",
		name: "上上签",
		weight: 2,
		verses: [
			"键落如飞意自通，一行未改测全绿。",
			"需求不变人不催，今朝提测便收工。",
			"万事俱备东风至，回车一按即功成。",
		],
	},
	{
		id: "good",
		name: "上吉签",
		weight: 3,
		verses: [
			"前人注释字字真，顺藤摸瓜不费神。",
			"小有波折终无碍，日落之前可交差。",
			"贵人相助在评审，一语点破梦中人。",
		],
	},
	{
		id: "fair",
		name: "中吉签",
		weight: 4,
		verses: [
			"稳扎稳打莫贪快，先写测试后写码。",
			"山重水复疑无路，重读报错又一村。",
			"事缓则圆急则乱，喝杯奶茶再动手。",
		],
	},
	{
		id: "plain",
		name: "中平签",
		weight: 3,
		verses: [
			"不好不坏寻常日，按部就班即可安。",
			"改一行来错三行，三思而后再回车。",
			"今日宜守不宜攻，留得分支好回滚。",
		],
	},
	{
		id: "bad",
		name: "下下签",
		weight: 2,
		verses: [
			"本地无恙线上崩，日志茫茫何处寻。",
			"一夜重构两行泪，回头还是旧代码。",
			"冲突连环三百处，合并不如从头来。",
		],
	},
];

/** 各事项在不同签运下的解签；ranks 的顺序与 fortuneRanks 一致 */
export const fortuneAdvice: Record<
	string,
	Record<FortuneRank["id"], string>
> = {
	coding: {
		great: "思路清晰，今天写下的代码日后回看也不会脸红。",
		good: "进展顺利，记得随手补上注释。",
		fair: "能写完，但别急着炫技，朴素的写法最稳。",
		plain: "产出一般，先把最要紧的那块做完。",
		bad: "今天不宜开新坑，整理旧代码更划算。",
	},
	testing: {
		great: "用例全过，还顺手发现一个藏了很久的问题。",
		good: "覆盖到位，结果可信。",
		fair: "大体通过，边界条件再多看一眼。",
		plain: "有几个用例时灵时不灵，重跑之前先查环境。",
		bad: "测试环境今天不在状态，结果先别当真。",
	},
	bugfix: {
		great: "一眼定位，一行修复，不留后患。",
		good: "根因找得准，改动不大。",
		fair: "修得好，但记得补一个回归测试。",
		plain: "治标容易治本难，先止血，再安排时间根治。",
		bad: "按下葫芦浮起瓢，改之前先备份。",
	},
	commit: {
		great: "一次通过，评审只回了两个字：很好。",
		good: "没有冲突，流水线一路绿灯。",
		fair: "提交前再看一遍 diff，有一处调试输出忘了删。",
		plain: "会有小冲突，耐心合并即可。",
		bad: "今天先别急着推送，尤其别在下班前五分钟。",
	},
	other: {
		great: "心想事成，放手去做。",
		good: "顺风顺水，把握时机。",
		fair: "事在人为，多一分准备多一分把握。",
		plain: "平平淡淡才是真，不必强求。",
		bad: "诸事不宜，早点休息，明天再来。",
	},
};
