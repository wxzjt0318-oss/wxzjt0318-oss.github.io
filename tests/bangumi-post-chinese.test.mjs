/**
 * 自动发文中文化测试：繁转简、日文清洗、标签过滤、角色中文名、百科聚合与出处。
 * 全部离线运行：百科来源用内存假数据注入，不发起网络请求。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnimeArticleMarkdown } from "../scripts/bangumi-daily-posts.mjs";
import {
	buildTags,
	measureJapaneseRatio,
	resolveCharacterNameCn,
} from "../scripts/generate-bangumi-daily-post.mjs";
import {
	fetchCharacterBio,
	fetchWorkEncyclopedia,
	isRelevantWorkArticle,
	stripDisambiguation,
} from "../scripts/wiki/encyclopedia.mjs";
import {
	cleanChineseProse,
	isMostlyJapanese,
	jpToSimplified,
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

describe("tags", () => {
	it("keeps genres and drops voice actors, weekdays and air months", () => {
		const tags = buildTags(
			{
				subject: {
					tags: [
						"钉宫理惠",
						"零之使魔",
						"J.C.STAFF",
						"后宫",
						"2012年1月",
						"星期六",
					].map((name) => ({ name })),
				},
			},
			{ tags: [{ name: "奇幻" }, { name: "轻小说改" }, { name: "TV" }] },
			{ titleCn: "零之使魔F", studio: "J.C.STAFF" },
		);
		assert.deepEqual(tags, [
			"奇幻",
			"轻小说改",
			"后宫",
			"TV",
			"J.C.STAFF",
			"Bangumi",
		]);
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
		assert.match(
			markdown,
			/动画由J\.C\.STAFF制作，于2012-01-07开播，全12 话。/,
		);
		assert.ok(measureJapaneseRatio(markdown) < 0.03);
	});
});
