/**
 * 自动发文中文化测试：繁转简、日文清洗、标签过滤、角色中文名、百科聚合与出处。
 * 全部离线运行：百科来源用内存假数据注入，不发起网络请求。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnimeArticleMarkdown } from "../scripts/bangumi-daily-posts.mjs";
import {
	measureJapaneseRatio,
	resolveCharacterNameCn,
} from "../scripts/generate-bangumi-daily-post.mjs";
import {
	composeCharacterBio,
	fetchCharacterBio,
	fetchWorkEncyclopedia,
	isRelevantWorkArticle,
	stripDisambiguation,
} from "../scripts/wiki/encyclopedia.mjs";
import { buildTaxonomy } from "../scripts/wiki/taxonomy.mjs";
import {
	cleanChineseProse,
	isMostlyJapanese,
	jpToSimplified,
	normalizeStudioName,
	stripForeignNotes,
	toSimplified,
} from "../scripts/wiki/zh-text.mjs";

describe("zh-text", () => {
	it("converts traditional Chinese and Japanese kanji to simplified", () => {
		assert.equal(
			toSimplified("暗殺者帶著美麗的隨從們"),
			"暗杀者带着美丽的随从们",
		);
		assert.equal(jpToSimplified("平賀才人"), "平贺才人");
		assert.equal(jpToSimplified("釘宮理恵"), "钉宫理惠");
	});

	it("strips foreign-language notes and drops Japanese paragraphs", () => {
		assert.equal(
			stripForeignNotes("《零之使魔》（日语：ゼロの使い魔）是一部轻小说。"),
			"《零之使魔》是一部轻小说。",
		);
		const cleaned = cleanChineseProse(
			"13歳の女の子。イギリスから引っ越してきたが、日本語はまだまだ勉強中。\n\n她是来自英国的少女[1]。",
		);
		assert.equal(cleaned, "她是来自英国的少女。");
	});

	it("treats a Chinese sentence quoting an original title as Chinese", () => {
		assert.equal(
			isMostlyJapanese(
				"本作改编自轻小说，原名为ゼロの使い魔，由J.C.STAFF制作动画，共四季播出。",
			),
			false,
		);
		assert.equal(isMostlyJapanese("ゲームセンターでの遊びに熱中する"), true);
	});
});

describe("glosses and studios", () => {
	it("removes Japanese / English glosses, including nested ones", () => {
		assert.equal(
			cleanChineseProse(
				"小野寺小咲（日语：小野寺（おのでら） 小咲（こさき））是登场角色。",
			),
			"小野寺小咲是登场角色。",
		);
		assert.equal(
			cleanChineseProse("职业：守护者(ガーディアン)Lv10"),
			"职业：守护者Lv10",
		);
		assert.equal(
			cleanChineseProse("安兹·乌尔·恭（Ainz Ooal Gown）是角色"),
			"安兹·乌尔·恭是角色",
		);
		assert.equal(
			cleanChineseProse("本名一之濑千鹤（一ノ瀬 ちづる）。[mask]剧透[/mask]"),
			"本名一之濑千鹤。剧透",
		);
		assert.equal(
			cleanChineseProse("动画（TV版）于2017年播出（第一季）。"),
			"动画（TV版）于2017年播出（第一季）。",
		);
	});

	it("maps katakana studio names to their usual Chinese / English names", () => {
		assert.equal(
			normalizeStudioName("プロダクション リード[苇プロダクション]"),
			"Production Reed",
		);
		assert.equal(
			normalizeStudioName("トムス・エンタテインメント/第6スタジオ"),
			"TMS娱乐/第6工作室",
		);
		assert.equal(
			normalizeStudioName("st.シルバー×アルボアニメーション"),
			"Studio Silver×Arvo Animation",
		);
	});

	it("extends a one-line character lead with the profile section", () => {
		const bio = composeCharacterBio({
			intro: "桐崎千棘是漫画《伪恋》及其衍生作品的登场角色。",
			sections: [
				{
					heading: "简介",
					text: "美国黑帮首领的独生女，金发碧眼，运动神经极佳。",
				},
			],
		});
		assert.equal(
			bio,
			"桐崎千棘是漫画《伪恋》及其衍生作品的登场角色。美国黑帮首领的独生女，金发碧眼，运动神经极佳。",
		);
	});
});

describe("taxonomy", () => {
	it("builds manual-style tags: genres, source, season, themes, series", () => {
		const { category, tags } = buildTaxonomy({
			rawTags: [
				"钉宫理惠",
				"后宫",
				"轻改",
				"傲娇",
				"2012年1月",
				"星期六",
				"TV",
				"J.C.STAFF",
				"Bangumi",
			],
			airDate: "2012-01-07",
			override: {
				category: "使魔与公主的最终章",
				themes: ["使魔", "魔法学院"],
				series: "零之使魔",
			},
		});
		assert.equal(category, "使魔与公主的最终章");
		assert.deepEqual(tags, [
			"后宫",
			"傲娇",
			"轻小说改",
			"2012年1月",
			"使魔",
			"魔法学院",
			"零之使魔",
		]);
	});

	it("falls back to a genre category without curated data", () => {
		const { category, tags } = buildTaxonomy({
			rawTags: ["恋爱", "漫改", "OVA"],
			airDate: "2020-04-01",
		});
		assert.equal(category, "恋爱作品介绍");
		assert.deepEqual(tags, ["恋爱", "漫画改", "OVA", "2020年4月"]);
	});
});

describe("character names", () => {
	it("prefers the Bangumi simplified Chinese name", () => {
		const name = resolveCharacterNameCn(
			{ name: "ルイズ・フランソワーズ" },
			{ infobox: [{ key: "简体中文名", value: "露易丝·弗朗索瓦丝" }] },
		);
		assert.equal(name, "露易丝·弗朗索瓦丝");
	});

	it("converts kanji-only names and rejects kana-only names", () => {
		assert.equal(
			resolveCharacterNameCn({ name: "平賀才人" }, null),
			"平贺才人",
		);
		assert.equal(resolveCharacterNameCn({ name: "シエスタ" }, null), "");
	});
});

function fakeArticle(site, title, intro, story = "") {
	const sections = story ? [{ heading: "剧情简介", text: story }] : [];
	return {
		site,
		title,
		pageUrl: `https://example.org/${encodeURIComponent(title)}`,
		intro,
		sections,
		fullText: `${intro}\n\n${story}`,
	};
}

describe("encyclopedia", () => {
	const moegirlIntro =
		"《零之使魔》（日语：ゼロの使い魔）是由山口昇创作、兔塚英志负责插画的轻小说，并有动画、漫画、游戏等衍生作品。";
	const wikiStory =
		"平賀才人在秋葉原被召喚到異世界，成為了魔法學院學生露易絲的使魔，從此展開了充滿波折的學園生活與冒險。";

	it("uses Moegirl for the intro and Wikipedia for a missing plot, in simplified Chinese", async () => {
		const sources = [
			{
				key: "moegirl",
				label: "萌娘百科",
				license: "CC BY-NC-SA 3.0",
				fetchForWork: async (_titles, { accept }) => {
					const a = fakeArticle("萌娘百科", "零之使魔", moegirlIntro);
					return accept(a) ? a : null;
				},
			},
			{
				key: "wikipedia",
				label: "维基百科",
				license: "CC BY-SA 4.0",
				fetchForWork: async (_titles, { accept }) => {
					const a = fakeArticle(
						"维基百科",
						"零之使魔 (动画)",
						"《零之使魔》是日本的电视动画系列作品。",
						wikiStory,
					);
					return accept(a) ? a : null;
				},
			},
		];
		const result = await fetchWorkEncyclopedia(
			{ titleCn: "零之使魔F", titleJp: "ゼロの使い魔F" },
			{ sources },
		);
		assert.ok(result);
		assert.equal(result.title, "零之使魔");
		assert.equal(result.intro.includes("ゼロ"), false);
		assert.ok(result.intro.includes("山口升"));
		assert.ok(result.story.startsWith("平贺才人在秋叶原被召唤到异世界"));
		assert.deepEqual(
			result.sources.map((s) => s.key),
			["moegirl", "wikipedia"],
		);
	});

	it("rejects unrelated articles that only share a name", () => {
		const unrelated = fakeArticle(
			"维基百科",
			"白夜",
			"白夜是指高纬度地区夏季太阳整夜不落的自然现象，常见于北极圈附近。",
		);
		assert.equal(isRelevantWorkArticle(unrelated, { titleCn: "白夜" }), false);
		assert.equal(stripDisambiguation("零之使魔（動畫）"), "零之使魔");
	});

	it("returns null when every source fails", async () => {
		const failing = [
			{
				key: "moegirl",
				label: "萌娘百科",
				license: "x",
				fetchForWork: async () => {
					throw new Error("offline");
				},
			},
		];
		assert.equal(
			await fetchWorkEncyclopedia({ titleCn: "测试" }, { sources: failing }),
			null,
		);
	});

	it("only accepts a character bio that mentions the work", async () => {
		const bioText =
			"露易丝是轻小说《零之使魔》及其衍生动画的女主角，拉·瓦利埃尔公爵家的三女儿。";
		const bio = await fetchCharacterBio(
			{ nameCn: "露易丝", workTitles: ["零之使魔F"] },
			{
				fetchForWork: async (_titles, { accept }) => {
					const a = fakeArticle("萌娘百科", "露易丝", bioText);
					return accept(a) ? a : null;
				},
			},
		);
		assert.equal(bio?.text, bioText);
	});
});

describe("article markdown", () => {
	it("renders overview, references and license from encyclopedia data", () => {
		const markdown = buildAnimeArticleMarkdown({
			subjectId: 25823,
			title: "《零之使魔F》",
			originalTitle: "ゼロの使い魔F",
			description: "《零之使魔》是由山口升创作的轻小说。",
			overview:
				"《零之使魔》是由山口升创作的轻小说，并有动画、漫画等衍生作品。",
			summary: "平贺才人被召唤到异世界，成为露易丝的使魔。",
			tags: ["奇幻", "后宫", "Bangumi"],
			category: "奇幻作品介绍",
			sourceLink: "https://bgm.tv/subject/25823",
			published: "2026-10-19",
			alias: "bangumi-25823",
			image: "https://example.org/cover.jpg",
			meta: { studio: "J.C.STAFF", airDate: "2012-01-07", episodes: "12 话" },
			characters: [{ name: "露易丝", description: "本作女主角。" }],
			references: [
				{
					key: "moegirl",
					label: "萌娘百科",
					title: "零之使魔",
					url: "https://zh.moegirl.org.cn/零之使魔",
					license: "CC BY-NC-SA 3.0",
				},
			],
			licenseName: "CC BY-NC-SA 3.0",
		});
		assert.match(markdown, /licenseName: "CC BY-NC-SA 3\.0"/);
		assert.match(markdown, /## 参考资料/);
		assert.match(markdown, /\[萌娘百科「零之使魔」\]/);
		assert.match(markdown, /\| \*\*动画制作\*\* \| J\.C\.STAFF \|/);
		assert.match(markdown, /# 二、剧情简介\n\n平贺才人被召唤到异世界/);
		assert.match(markdown, /由J\.C\.STAFF制作，2012-01-07开播，共12话。/);
		assert.match(markdown, /<!-- shirone:auto-draft -->/);
		assert.ok(measureJapaneseRatio(markdown) < 0.03);
	});

	it("drops Japanese paragraphs and links same-series posts", () => {
		const markdown = buildAnimeArticleMarkdown({
			subjectId: 1,
			title: "《测试作品 第二季》",
			summary: "主角踏上旅程。\n\nアレンは村で暮らす少年です。",
			tags: ["奇幻"],
			category: "x",
			sourceLink: "https://bgm.tv/subject/1",
			published: "2026-10-20",
			alias: "test-s2",
			image: "https://example.org/c.jpg",
			characters: [
				{ name: "アレン", name_cn: "亚莲", cv: "某声优", description: "出身农奴的少年。" },
				{ name: "クレナ", name_cn: "克蕾娜", description: "アレンの幼馴染みです。" },
			],
			relatedPosts: [{ title: "《测试作品》", alias: "test" }],
			licenseName: "CC BY 4.0",
		});
		const body = markdown.replace(/^---\n[\s\S]*?\n---/, "");
		assert.ok(!/アレンは/.test(body));
		assert.match(markdown, /## 亚莲（CV：某声优）\n\n出身农奴的少年。/);
		assert.ok(!markdown.includes("## 克蕾娜"));
		assert.match(markdown, /\[测试作品\]\(\/posts\/test\/\)/);
	});
});

describe("duplicate guard", () => {
	const manual = (title, extra = "") =>
		`---\ntitle: ${title}\ntags: ["恋爱"]\nsourceLink: ""\n---\n${extra}`;

	it("matches a manual post with a subtitle, another translation or a Moegirl link", async () => {
		const { findDuplicatePost, postIdentities } = await import(
			"../scripts/wiki/duplicate-guard.mjs"
		);
		const posts = [
			{
				filePath: "a.md",
				identities: postIdentities(
					manual("《月光下的异世界之旅》——被神抛弃之人的异世界改革之路"),
				),
			},
			{
				filePath: "b.md",
				identities: postIdentities(
					'---\ntitle: 《安闲领主的愉快领地防卫》\ntags: []\nsourceLink: "https://zh.moegirl.org.cn/お気楽領主の楽しい領地防衛"\n---\n',
				),
			},
		];
		assert.equal(
			findDuplicatePost(
				{ titleCn: "月光下的异世界之旅", titleJp: "月が導く異世界道中" },
				posts,
			)?.file,
			"a.md",
		);
		assert.equal(
			findDuplicatePost(
				{
					titleCn: "安逸领主的愉快领地防卫～以生产系魔术～",
					titleJp: "お気楽領主の楽しい領地防衛 ～生産系魔術で～",
				},
				posts,
			)?.file,
			"b.md",
		);
	});

	it("keeps other seasons, OVAs and films separate", async () => {
		const { findDuplicatePost, postIdentities } = await import(
			"../scripts/wiki/duplicate-guard.mjs"
		);
		const posts = [
			{
				filePath: "a.md",
				identities: postIdentities(manual("《总之就是非常可爱》")),
			},
		];
		assert.equal(
			findDuplicatePost({ titleCn: "总之就是非常可爱 第二季" }, posts),
			null,
		);
		assert.equal(
			findDuplicatePost(
				{ titleCn: "总之就是非常可爱 ～SNS～", forms: ["OVA"] },
				posts,
			),
			null,
		);
		assert.equal(
			findDuplicatePost({ titleCn: "剧场版 总之就是非常可爱" }, posts),
			null,
		);
		assert.equal(
			findDuplicatePost({ titleCn: "总之就是非常可爱" }, posts)?.file,
			"a.md",
		);
	});
});

describe("duplicate guard subtitle translations", () => {
	it("matches two translations of the same long subtitle", async () => {
		const { findDuplicatePost, postIdentities } = await import(
			"../scripts/wiki/duplicate-guard.mjs"
		);
		const posts = [
			{
				filePath: "hell-mode.md",
				identities: postIdentities(
					'---\ntitle: "地狱模式~极致游戏玩家在废设定的异世界无双~"\ntags: []\nsourceLink: ""\n---\n',
				),
			},
		];
		assert.equal(
			findDuplicatePost(
				{
					titleCn: "地狱模式～喜欢挑战特殊成就的玩家在废设定的异世界成为无双～",
					titleJp: "ヘルモード ～やり込み好きのゲーマーは廃設定の異世界で無双する～",
				},
				posts,
			)?.file,
			"hell-mode.md",
		);
		// 第二季仍是另一部作品
		assert.equal(
			findDuplicatePost(
				{
					titleCn:
						"地狱模式～喜欢挑战特殊成就的玩家在废设定的异世界成为无双～第二季",
				},
				posts,
			),
			null,
		);
	});

	it("keeps specials with different short subtitles apart", async () => {
		const { findDuplicatePost, postIdentities } = await import(
			"../scripts/wiki/duplicate-guard.mjs"
		);
		const posts = [
			{
				filePath: "a.md",
				identities: postIdentities(
					'---\ntitle: "《总之就是非常可爱 ～制服篇～》"\ntags: []\nsourceLink: ""\n---\n',
				),
			},
		];
		assert.equal(
			findDuplicatePost({ titleCn: "总之就是非常可爱 ～女子高中生篇～" }, posts),
			null,
		);
	});
});

describe("duplicate guard sequels", () => {
	it("does not match a sequel through the shared series page", async () => {
		const { findDuplicatePost, postIdentities } = await import(
			"../scripts/wiki/duplicate-guard.mjs"
		);
		const posts = [
			{
				filePath: "s1.md",
				identities: postIdentities(
					'---\ntitle: "《零之使魔》"\ntags: []\nsourceLink: ""\n---\n',
				),
			},
		];
		assert.equal(
			findDuplicatePost(
				{ titleCn: "零之使魔F", encyclopediaTitles: ["零之使魔"] },
				posts,
			),
			null,
		);
		assert.equal(
			findDuplicatePost(
				{
					titleCn: "月光下的异世界之旅 第二幕",
					encyclopediaTitles: ["零之使魔"],
				},
				posts,
			),
			null,
		);
	});
});
