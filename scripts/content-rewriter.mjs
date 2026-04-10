export async function fetchMoegirlContentWithRetry(pageName, retryCount = 0) {
	const MAX_RETRIES = 3;
	const RETRY_DELAY_MS = 1000;

	try {
		const { getMoegirlPageSDK } = await import("./moegirl-sdk.mjs");
		const content = await getMoegirlPageSDK(pageName);

		if (!content || !content.extract || content.extract.length < 100) {
			throw new Error("内容获取失败或内容过短");
		}

		if (!validateContentQuality(content)) {
			throw new Error("内容质量校验未通过");
		}

		return content;
	} catch (error) {
		if (retryCount < MAX_RETRIES) {
			await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
			return fetchMoegirlContentWithRetry(pageName, retryCount + 1);
		}
		throw error;
	}
}

function validateContentQuality(content) {
	if (!content.extract || content.extract.length < 100) {
		return false;
	}

	const wikiMarkupPatterns = [
		/\[\[[^|\]]+\|([^\]]+)\]\]/g,
		/\{\{[^}]+\}\}/g,
		/<ref[^>]*>[\s\S]*?<\/ref>/gi,
	];

	let cleanedLength = content.extract.length;
	for (const pattern of wikiMarkupPatterns) {
		const matches = content.extract.match(pattern);
		if (matches) {
			cleanedLength -= matches.join("").length;
		}
	}

	return cleanedLength >= 50;
}

export function rewriteArticleContent(content, options = {}) {
	const {
		preserveCoreInfo = true,
		synonymReplacement = true,
		sentenceRestructuring = true,
		paragraphReordering = false,
		variationSeed = Date.now()
	} = options;

	const random = createSeededRandom(variationSeed);

	let rewritten = content;

	if (synonymReplacement) {
		rewritten = applySynonymReplacement(rewritten, random);
	}

	if (sentenceRestructuring) {
		rewritten = applySentenceRestructuring(rewritten, random);
	}

	if (paragraphReordering) {
		rewritten = applyParagraphReordering(rewritten, random);
	}

	const originalTokens = tokenize(content);
	const rewrittenTokens = tokenize(rewritten);
	const changedTokens = countChangedTokens(originalTokens, rewrittenTokens);

	return {
		content: rewritten,
		metadata: {
			originalLength: content.length,
			rewrittenLength: rewritten.length,
			changes: {
				synonymReplacements: changedTokens.synonymCount,
				sentenceRestructurings: changedTokens.restructureCount
			}
		}
	};
}

function createSeededRandom(seed) {
	let s = seed;
	return () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
}

const SYNONYM_MAP = {
	"动画": ["动漫", "动画作品", "动画番剧"],
	"作品": ["本作", "该作品", "这部作品"],
	"角色": ["人物", "登场角色", "角色设定"],
	"剧情": ["故事", "情节", "叙事"],
	"制作": ["打造", "创作", "制作"],
	"播出": ["播放", "上映", "放送"],
	"主角": ["主人公", "主要角色", "男/女主角"],
	"介绍": ["概述", "说明", "简介"],
	"精彩": ["出色", "优秀", "卓越"],
	"推荐": ["建议", "安利", "推荐"],
	"观看": ["观赏", "收看", "观看"],
	"感受": ["体会", "体验", "感悟"],
	"设定": ["世界观", "故事设定"],
	"展开": ["发展", "推进", "进行"],
	"高潮": ["精彩段落", "高潮部分", "巅峰时刻"],
	"结局": ["结尾", "收尾", "终结"],
	"独特": ["特别", "与众不同", "独到"],
	"魅力": ["吸引力", "魔力", "诱惑力"],
	"感动": ["触动", "打动", "感染"],
	"治愈": ["疗愈", "温暖", "抚慰"],
	"热血": ["激情", "昂扬", "炸裂"],
	"萌": ["可爱", "软萌", "甜"],
	"燃": ["热血", "激情", "炸裂"],
	"神作": ["杰作", "经典", "巅峰之作"],
	"佳作": ["良品", "优秀作品", "好作品"],
	"作画": ["画面", "视觉表现", "美术"],
	"音乐": ["配乐", "原声", "音律"],
	"声优": ["配音演员", "CV", "声演"],
	"脚本": ["剧本", "编剧", "文案"],
	"导演": ["监督", "执导", "引导"],
	"改编": ["原作改编", "小说改编", "漫改"],
	"原创": ["独创", "自创", "原创"],
	"番剧": ["动画", "动画作品", "新番"],
	"季度": ["季节", "档期", "时期"],
	"新番": ["新动画", "新作", "新品番"],
	"完结": ["完结篇", "大结局", "结束"],
	"续作": ["续集", "第二季", "后续作品"],
	"第一季": ["首季", "第一期", "初期"],
	"第二季": ["第二期", "后续", "续篇"],
	"剧场版": ["动画电影", "电影版", "影院版"],
	"OVA": ["特别篇", "附赠篇", "原创动画"],
	"特别篇": ["SP", "番外", "外传篇"],
	"日常": ["日常生活", "平常时光", "轻松日常"],
	"校园": ["学校", "学园", "学生时代"],
	"恋爱": ["爱情", "情愫", " romance"],
	"百合": [" GL", "女孩子", "百合"],
	"耽美": [" BL", "美少年", "耽美"],
	"冒险": ["探险", "闯荡", "远征"],
	"奇幻": ["幻想", "魔幻", "异世界"],
	"科幻": [" SF", "科学幻想", "未来"],
	"悬疑": ["推理", "侦探", "谜团"],
	"恐怖": ["惊悚", "害怕", "恐惧"],
	"搞笑": ["喜剧", "幽默", "逗趣"],
	"运动": ["体育", "竞技", " Athletics"],
	"战斗": ["战争", "对决", "格斗"],
	"机战": ["机器人", "机甲", "高达"],
	"神魔": ["神话", "超自然", "神秘"],
	"竞技": ["比赛", "对决", "较量"],
	"料理": ["烹饪", "美食", "厨艺"],
	"绘画": ["美术", "艺术", "插画"],
	"推理": ["侦探", "破案", "解谜"],
	"历史": ["史实", "过往", "年代"],
	"战争": ["战斗", "军事", "冲突"],
	"职场": ["工作", "社会", "事业"],
	"美食": ["料理", "餐饮", "食物"],
	"旅行": ["旅游", "观光", "游历"],
	"宠物": ["动物", "萌宠", "伴侣动物"],
	"偶像": ["明星", "艺人", "歌姬"],
	"魔法": ["巫术", "魔导", "法术"],
	"异世界": ["异次元", " another", "异空间"],
	"转生": ["重生", "再世", "轮回"],
	"穿越": ["时空穿越", "往来", "time travel"],
	"超能力": ["异能", "特异功能", "能力"],
	"灵力": ["魔力", "超自然力", "精神力"],
	"妖怪": ["妖魔", "精灵", "怪物"],
	"神明": ["神", "神灵", "天界"],
	"人类": ["人", "人们", "众生"],
	"怪物": ["魔兽", "妖怪", "怪物"],
	"召唤": ["呼唤", "召集", "召唤术"],
	"剑": ["刀剑", "武器", "宝剑"],
	"技能": ["技巧", "技术", "本领"],
	"等级": ["级别", "阶位", "层次"],
	"属性": ["特质", "特性", "元素"],
	"时间": ["时光", "时刻", "年月"],
	"空间": ["空间", "维度", "领域"],
	"速度": ["快速", "迅速", "敏捷"],
	"力量": ["力量", "力气", "力道"],
	"智慧": ["才智", "智力", "聪慧"],
	"勇气": ["胆量", "勇敢", "无畏"],
	"友情": ["友谊", "伙伴", "情谊"],
	"亲情": ["血缘", "家人", "亲情"],
	"爱情": ["恋情", "爱意", "情感"],
	"不错": ["很好", "优秀", "很棒"],
	"喜欢": ["喜爱", "热爱", "喜欢"],
	"讨厌": ["厌恶", "反感", "讨厌"],
	"朋友": ["伙伴", "友人", "朋友"],
	"敌人": ["对手", "仇敌", "敌人"],
	"学校": ["学院", "学园", "校园"],
	"老师": ["教师", "导师", "老师"],
	"学生": ["学员", "学子", "学生"],
	"父亲": ["爸爸", "父亲", "老爸"],
	"母亲": ["妈妈", "母亲", "老妈"],
	"哥哥": ["兄长", "哥哥", "兄长"],
	"姐姐": ["姐姐", "姐姐", "姐姐"],
	"弟弟": ["弟弟", "弟弟", "弟弟"],
	"妹妹": ["妹妹", "妹妹", "妹妹"],
	"时间": ["时候", "时刻", "时期"],
	"地方": ["地方", "场所", "地点"],
	"样子": ["模样", "样子", "形态"],
	"方法": ["方式", "办法", "方法"],
	"理由": ["原因", "缘由", "理由"],
	"意思": ["意义", "含义", "意思"],
	"东西": ["事物", "东西", "物品"],
	"事情": ["事务", "事情", "事项"],
	"问题": ["疑问", "问题", "难题"],
	"开始": ["开端", "开始", "起始"],
	"结束": ["终结", "结束", "完毕"],
	"以前": ["之前", "从前", "以往"],
	"以后": ["之后", "将来", "未来"],
	"现在": ["目前", "现在", "此刻"],
	"非常": ["十分", "特别", "相当"],
	"真的": ["确实", "真正", "实在"],
	"应该": ["应当", "应该", "理应"],
	"能够": ["可以", "能够", "得以"],
	"知道": ["了解", "知道", "晓得"],
	"觉得": ["感觉", "认为", "觉得"],
	"认为": ["以为", "觉得", "认为"],
	"希望": ["期望", "希望", "渴望"],
	"知道": ["了解", "知道", "晓得"],
	"理解": ["明白", "理解", "懂得"],
	"发现": ["发觉", "发现", "察觉"],
	"理解": ["明白", "理解", "懂得"],
	"出现": ["浮现", "出现", "显现"],
	"消失": ["消散", "消失", "隐没"],
	"发生": ["产生", "发生", "出现"],
	"存在": ["存有", "存在", "位于"],
	"形成": ["构成", "形成", "产生"],
	"变成": ["化为", "变成", "成为"],
	"保持": ["维持", "保持", "保留"],
	"改变": ["转变", "改变", "变化"],
	"增加": ["增长", "增加", "增多"],
	"减少": ["减少", "降低", "缩减"],
	"完全": ["彻底", "完全", "全部"],
	"特别": ["格外", "特别", "尤其"],
	"一般": ["通常", "一般", "平常"],
	"原来": ["原本", "本来", "最初"],
	"可能": ["或许", "可能", "大概"],
	"当然": ["自然", "当然", "理应"],
	"因为": ["由于", "因为", "因"],
	"所以": ["因此", "所以", "因而"],
	"但是": ["然而", "但是", "不过"],
	"如果": ["假如", "倘若", "如果"],
	"虽然": ["尽管", "虽然", "虽"],
	"即使": ["即便", "纵使", "即使"],
	"或者": ["还是", "或者", "亦或"],
	"而且": ["并且", "而且", "同时"],
	"只是": ["不过", "只是", "仅"],
	"关于": ["有关", "关于", "对于"],
	"对于": ["对于", "关于", "对待"],
	"通过": ["经过", "通过", "基于"],
};

function applySynonymReplacement(text, random) {
	let result = text;

	const sortedKeys = Object.keys(SYNONYM_MAP).sort((a, b) => b.length - a.length);

	for (const original of sortedKeys) {
		const synonyms = SYNONYM_MAP[original];
		const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		const regex = new RegExp(escapedOriginal, 'g');

		result = result.replace(regex, (match) => {
			if (random() < 0.4) {
				const synonym = synonyms[Math.floor(random() * synonyms.length)];
				return synonym;
			}
			return match;
		});
	}

	return result;
}

function applySentenceRestructuring(text, random) {
	const sentences = text.split(/(?<=[。！？；\n])/);
	const restructured = sentences.map(sentence => {
		if (sentence.length < 8 || random() > 0.6) {
			return sentence;
		}

		if (random() > 0.7) {
			const match = sentence.match(/^([^，,、；]+[，,、]?)(.+)$/);
			if (match && match[1].length > 2 && match[2].length > 2) {
				return match[2] + '，' + match[1].replace(/[，,、]$/, '');
			}
		}

		if (random() > 0.8 && sentence.includes('的')) {
			const parts = sentence.split('的');
			if (parts.length > 2) {
				const last = parts.pop();
				if (random() > 0.5) {
					return last + '的' + parts.join('的');
				}
			}
		}

		return sentence;
	});

	return restructured.join('');
}

function applyParagraphReordering(text, random) {
	const paragraphs = text.split(/\n\n+/);
	if (paragraphs.length < 3) {
		return text;
	}

	const introEnd = paragraphs.findIndex(p => /简介|概述|介绍/.test(p));
	const outroStart = paragraphs.findLastIndex(p => /总结|结语|结尾/.test(p));

	if (introEnd === -1 || outroStart === -1 || outroStart <= introEnd + 1) {
		return text;
	}

	const intro = paragraphs.slice(0, introEnd + 1);
	const body = paragraphs.slice(introEnd + 1, outroStart);
	const outro = paragraphs.slice(outroStart);

	if (body.length < 2 || random() > 0.4) {
		return text;
	}

	const shuffled = [...body];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return [...intro, ...shuffled, ...outro].join('\n\n');
}

function countChangedTokens(originalTokens, rewrittenTokens) {
	const origSet = new Set(originalTokens);
	const rewriteSet = new Set(rewrittenTokens);

	let synonymCount = 0;
	for (const word of origSet) {
		if (!rewriteSet.has(word)) {
			synonymCount++;
		}
	}

	return {
		synonymCount: Math.floor(synonymCount * 0.7),
		restructureCount: Math.abs(originalTokens.length - rewrittenTokens.length)
	};
}

export function calculateSimilarity(text1, text2) {
	if (!text1 || !text2) return 0;
	if (text1 === text2) return 1;

	const words1 = tokenize(text1);
	const words2 = tokenize(text2);

	if (words1.length === 0 || words2.length === 0) return 0;

	const set1 = new Set(words1);
	const set2 = new Set(words2);

	const intersection = [...set1].filter(w => set2.has(w)).length;
	const union = new Set([...set1, ...set2]).size;

	return union > 0 ? intersection / union : 0;
}

function tokenize(text) {
	if (!text) return [];
	return text
		.replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 1);
}

export function calculateOriginality(original, rewritten) {
	const similarity = calculateSimilarity(original, rewritten);
	return Math.round((1 - similarity) * 100);
}

export function generateDifferentiatedIntro(template, originalContent, seed = Date.now()) {
	const random = createSeededRandom(seed);

	const workTitle = extractWorkTitle(originalContent);

	const openingPatterns = [
		() => `当提及${workTitle}，许多观众首先想到的便是其中令人难忘的角色与跌宕起伏的剧情。`,
		() => `在众多优秀作品中，${workTitle}以其独特的魅力脱颖而出。`,
		() => `今天要为大家介绍的是${workTitle}，这是一部值得细细品味的作品。`,
		() => `说起${workTitle}，相信不少人都对其中的一些场景印象深刻。`,
		() => `${workTitle}自播出以来，便以其精彩的剧情收获了众多观众的喜爱。`,
		() => `在动画的世界里，${workTitle}可以说是一部相当特别的作品。`,
		() => `如果要选出一部近期最受欢迎的作品，${workTitle}必定榜上有名。`,
		() => `近日，${workTitle}引发了广泛讨论，其独特的设定吸引了大量粉丝。`
	];

	const selectedIndex = Math.floor(random() * openingPatterns.length);
	return openingPatterns[selectedIndex]();
}

export function generateDifferentiatedOutro(template, originalContent, seed = Date.now()) {
	const random = createSeededRandom(seed + 1000);

	const closingPatterns = [
		() => `以上就是关于这部作品的简要介绍，期待与大家更多交流。`,
		() => `希望这篇介绍能帮助你更好地了解这部作品。`,
		() => `如果你对这部作品感兴趣，不妨亲自体验一下它的魅力。`,
		() => `更多精彩内容，敬请期待后续更新。`,
		() => `感谢阅读，希望对你有所帮助。`,
		() => `欢迎在评论区分享你的看法。`,
		() => `这部作品还有很多值得探索的地方。`,
		() => `下次再见，继续探索更多精彩作品。`
	];

	const selectedIndex = Math.floor(random() * closingPatterns.length);
	return closingPatterns[selectedIndex]();
}

function extractWorkTitle(content) {
	const titleMatch = content.match(/《([^》]+)》/);
	if (titleMatch) return titleMatch[1];

	const hashMatch = content.match(/^#\s+(.+)$/m);
	if (hashMatch) return hashMatch[1];

	return "该作品";
}

export function checkTemplateSimilarity(intro, outro, template) {
	const introSimilarity = calculateSimilarity(intro, template);
	const outroSimilarity = calculateSimilarity(outro, template);

	return {
		introSimilarity: Math.round(introSimilarity * 100),
		outroSimilarity: Math.round(outroSimilarity * 100),
		isValid: introSimilarity < 0.3 && outroSimilarity < 0.3
	};
}

export function generateRewriteVariations(content, count = 3) {
	const variations = [];

	for (let i = 0; i < count; i++) {
		const seed = Date.now() + i * 1000 + Math.floor(Math.random() * 1000);

		const synonymIntensity = 0.3 + (i * 0.2);
		const restructureIntensity = i === 0 ? 0.3 : (i === 1 ? 0.5 : 0.7);

		const rewritten = rewriteArticleContent(content, {
			synonymReplacement: true,
			sentenceRestructuring: i > 0,
			paragraphReordering: i === 2,
			variationSeed: seed + i * 100
		});

		const originality = calculateOriginality(content, rewritten.content);

		variations.push({
			...rewritten,
			seed,
			originality,
			params: {
				synonymIntensity,
				restructureIntensity
			}
		});
	}

	return variations;
}
