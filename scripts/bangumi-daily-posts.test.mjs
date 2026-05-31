import { describe, expect, it } from "vitest";

import {
	buildAnimeArticleMarkdown,
	chooseBestCoverImage,
	createStateRecord,
	detectContentDuplication,
	detectDuplicatePosts,
	normalizeText,
	selectNextAnimeCandidate,
	slugifyTitle,
	tokenize,
	calculateJaccard,
	calculateCosineSimilarity,
	extractContentFeatures,
} from "./bangumi-daily-posts.mjs";

describe("bangumi daily post helpers", () => {
	it("selects first unseen bangumi candidate", () => {
		const collections = [
			{
				subject_id: 100,
				type: 3,
				updated_at: "2026-04-09T10:00:00Z",
				subject: { name_cn: "新番 A", name: "Anime A" },
			},
			{
				subject_id: 101,
				type: 3,
				updated_at: "2026-04-08T10:00:00Z",
				subject: { name_cn: "新番 B", name: "Anime B" },
			},
		];
		const generatedState = { generated: [{ subjectId: 100 }] };
		const existingPosts = [{ title: "旧文章", sourceLink: "https://bgm.tv/subject/999", alias: "old-post" }];

		const selected = selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun: 1 });
		expect(selected).toHaveLength(1);
		expect(selected[0].subject_id).toBe(101);
	});

	it("prefers bangumi large cover over common cover", () => {
		const result = chooseBestCoverImage([
			{ url: "https://example.com/common.jpg", source: "bangumi-common", title: "Anime A", width: 900, height: 1280 },
			{ url: "https://example.com/large.jpg", source: "bangumi-large", title: "Anime A", width: 1200, height: 1700 },
		], { names: ["Anime A"] });

		expect(result.selected?.url).toBe("https://example.com/large.jpg");
	});

	it("prefers recent unseen candidates before random choice", () => {
		const collections = Array.from({ length: 30 }, (_, index) => ({
			subject_id: index + 1,
			type: 3,
			updated_at: new Date(Date.UTC(2026, 3, 30 - index)).toISOString(),
			subject: { name_cn: `新番 ${index + 1}`, name: `Anime ${index + 1}` },
		}));
		const generatedState = { generated: [] };
		const existingPosts = [];

		const selected = selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun: 1 });
		expect(selected).toHaveLength(1);
		expect(selected[0].subject_id).toBeGreaterThanOrEqual(1);
		expect(selected[0].subject_id).toBeLessThanOrEqual(30);
	});

	it("builds pure bangumi markdown article without moegirl sections", () => {
		const markdown = buildAnimeArticleMarkdown({
			subjectId: 123,
			title: "《测试动画》",
			originalTitle: "Test Anime",
			description: "这是一段摘要。",
			summary: "这是一段较长的简介，用于测试文章模板输出。",
			tags: ["动画", "恋爱", "Bangumi"],
			category: "动画作品介绍",
			sourceLink: "https://bgm.tv/subject/123",
			published: "2026-04-09",
			alias: "test-anime",
			image: "https://example.com/cover.jpg",
			draft: true,
			meta: {
				studio: "P.A.WORKS",
				airDate: "2026-04-01",
				episodes: "12 话",
				progress: "已看到 1 话",
				statusLabel: "在看",
			},
			staff: [{ relation: "监督", name: "测试监督" }],
			characters: [{ name: "主角A", cv: "测试声优", description: "核心角色。" }],
		});

		expect(markdown).toContain("title: \"《测试动画》\"");
		expect(markdown).toContain("draft: true");
		expect(markdown).toContain("## 二、基础信息");
		expect(markdown).toContain("## 三、剧情简介");
		expect(markdown).toContain("## 主要角色");
		expect(markdown).not.toContain("## 萌娘百科资料");
	});

	it("creates stable aliases and state records", () => {
		expect(slugifyTitle("The Angel Next Door", "fallback")).toBe("the-angel-next-door");
		expect(normalizeText("《测试动画》")).toBe("测试动画");

		const record = createStateRecord({
			subjectId: 321,
			title: "《测试》",
			filePath: "src/content/posts/test.md",
			alias: "test",
			sourceLink: "https://bgm.tv/subject/321",
			published: "2026-04-09",
			image: "https://example.com/cover.jpg",
			reviewMode: false,
		});

		expect(record.subjectId).toBe(321);
		expect(record.status).toBe("published");
		expect(record.generatedAt).toBeTruthy();
	});

	it("handles missing summary gracefully", () => {
		const markdown = buildAnimeArticleMarkdown({
			subjectId: 456,
			title: "《无摘要动画》",
			originalTitle: "Anime Without Summary",
			description: "",
			summary: "",
			tags: ["动画"],
			category: "动画作品介绍",
			sourceLink: "https://bgm.tv/subject/456",
			published: "2026-04-09",
			alias: "anime-no-summary",
			image: "https://example.com/cover.jpg",
			draft: false,
			meta: {},
			staff: [],
			characters: [],
		});

		expect(markdown).toContain("《无摘要动画》");
		expect(markdown).toContain("## 一、作品概述");
		expect(markdown).toContain("## 五、综合评价");
	});

	it("prioritizes watching (type 3) over completed (type 2) and planned (type 1)", () => {
		const collections = [
			{
				subject_id: 201,
				type: 2,
				updated_at: "2026-04-10T10:00:00Z",
				subject: { name_cn: "看过动画 A", name: "Watched Anime A" },
			},
			{
				subject_id: 202,
				type: 1,
				updated_at: "2026-04-11T10:00:00Z",
				subject: { name_cn: "想看动画 B", name: "Planned Anime B" },
			},
			{
				subject_id: 203,
				type: 3,
				updated_at: "2026-04-09T10:00:00Z",
				subject: { name_cn: "在看动画 C", name: "Watching Anime C" },
			},
			{
				subject_id: 204,
				type: 4,
				updated_at: "2026-04-12T10:00:00Z",
				subject: { name_cn: "搁置动画 D", name: "On Hold Anime D" },
			},
			{
				subject_id: 205,
				type: 5,
				updated_at: "2026-04-13T10:00:00Z",
				subject: { name_cn: "抛弃动画 E", name: "Dropped Anime E" },
			},
		];
		const generatedState = { generated: [] };
		const existingPosts = [];

		const selected = selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun: 1 });
		expect(selected).toHaveLength(1);
		expect(selected[0].type).toBe(3);
		expect(selected[0].subject_id).toBe(203);
	});

	it("falls back to completed when no watching candidates available", () => {
		const collections = [
			{
				subject_id: 301,
				type: 1,
				updated_at: "2026-04-11T10:00:00Z",
				subject: { name_cn: "想看动画 F", name: "Planned Anime F" },
			},
			{
				subject_id: 302,
				type: 2,
				updated_at: "2026-04-10T10:00:00Z",
				subject: { name_cn: "看过动画 G", name: "Watched Anime G" },
			},
			{
				subject_id: 303,
				type: 4,
				updated_at: "2026-04-12T10:00:00Z",
				subject: { name_cn: "搁置动画 H", name: "On Hold Anime H" },
			},
		];
		const generatedState = { generated: [] };
		const existingPosts = [];

		const selected = selectNextAnimeCandidate({ collections, generatedState, existingPosts, maxPerRun: 1 });
		expect(selected).toHaveLength(1);
		expect(selected[0].type).toBe(2);
		expect(selected[0].subject_id).toBe(302);
	});
});

describe("detectDuplicatePosts", () => {
	it("returns no duplicate for empty inputs", () => {
		const result = detectDuplicatePosts([], "新标题");
		expect(result.hasDuplicate).toBe(false);
		expect(result.duplicates).toHaveLength(0);
	});

	it("detects exact title match", () => {
		const existingPosts = [{ title: "《和班上第二可爱的女孩子成了朋友》", sourceLink: "https://bgm.tv/subject/456079" }];
		const result = detectDuplicatePosts(existingPosts, "《和班上第二可爱的女孩子成了朋友》");
		expect(result.hasDuplicate).toBe(true);
		expect(result.duplicates).toHaveLength(1);
		expect(result.duplicates[0].type).toBe("exact");
	});

	it("ignores punctuation differences in title matching", () => {
		const existingPosts = [{ title: "《和班上第二可爱的女孩子成了朋友》", sourceLink: "https://bgm.tv/subject/456079" }];
		const result = detectDuplicatePosts(existingPosts, "和班上第二可爱的女孩子成了朋友");
		expect(result.hasDuplicate).toBe(true);
		expect(result.duplicates[0].type).toBe("exact");
	});

	it("detects similar titles above threshold", () => {
		const existingPosts = [{ title: "《在异世界获得超强能力的我》", sourceLink: "https://bgm.tv/subject/1" }];
		const result = detectDuplicatePosts(existingPosts, "《在异世界获得超强能力的我，在现实世界照样无敌》", { threshold: 0.5 });
		expect(result.hasDuplicate).toBe(true);
		expect(result.duplicates[0].type).toBe("similar");
	});

	it("does not detect duplicates below threshold", () => {
		const existingPosts = [{ title: "《某科学的超电磁炮》", sourceLink: "https://bgm.tv/subject/1" }];
		const result = detectDuplicatePosts(existingPosts, "《Re:从零开始的异世界生活》", { threshold: 0.8 });
		expect(result.hasDuplicate).toBe(false);
	});

	it("includes filePath when includeFilePath is true", () => {
		const existingPosts = [{ title: "《测试文章》", filePath: "src/content/posts/test.md", sourceLink: "https://bgm.tv/subject/1" }];
		const result = detectDuplicatePosts(existingPosts, "《测试文章》", { includeFilePath: true });
		expect(result.hasDuplicate).toBe(true);
		expect(result.duplicates[0].filePath).toBe("src/content/posts/test.md");
	});
});

describe("content duplication detection", () => {
	it("tokenizes text correctly", () => {
		const tokens = tokenize("Hello World! Hello again.");
		expect(tokens).toEqual(["hello", "world", "hello", "again"]);
	});

	it("calculates jaccard similarity", () => {
		const set1 = new Set(["a", "b", "c"]);
		const set2 = new Set(["b", "c", "d"]);
		expect(calculateJaccard(set1, set2)).toBe(0.5);
	});

	it("calculates cosine similarity", () => {
		const vec1 = { "a": 2, "b": 3 };
		const vec2 = { "a": 2, "b": 3 };
		expect(calculateCosineSimilarity(vec1, vec2)).toBeCloseTo(1, 2);
	});

	it("extracts content features", () => {
		const article = {
			title: "Test Title",
			description: "Test description",
			tags: ["tag1", "tag2"],
			body: "This is a longer paragraph one. It has enough content.\n\nThis is a longer paragraph two. It also has enough content.\n\nThis is a longer paragraph three. It also has enough content.",
		};
		const features = extractContentFeatures(article);
		expect(features.title).toBe("Test Title");
		expect(features.keyParagraphs.length).toBeGreaterThan(0);
	});

	it("detects exact content duplication", () => {
		const newArticle = {
			title: "Test Article",
			body: "This is the test body. It has content. This is a longer paragraph to increase similarity.",
		};
		const existing = [{
			title: "Test Article",
			body: "This is the test body. It has content. This is a longer paragraph to increase similarity.",
		}];
		const result = detectContentDuplication(newArticle, existing, { similarityThreshold: 70 });
		expect(result.hasDuplicate).toBe(true);
	});

	it("detects partial content duplication", () => {
		const newArticle = {
			title: "New Article",
			body: "This is the new article. It shares some content with the old one. This paragraph has common words.",
		};
		const existing = [{
			title: "Old Article",
			body: "This is the old article. It shares some content with the new one. This paragraph has common words.",
		}];
		const result = detectContentDuplication(newArticle, existing, { similarityThreshold: 30 });
		expect(result.hasDuplicate).toBe(true);
	});

	it("does not detect unrelated content", () => {
		const newArticle = {
			title: "Space Article",
			body: "This is about space and rockets. NASA and astronauts.",
		};
		const existing = [{
			title: "Cooking Article",
			body: "This is about cooking and recipes. Baking and ingredients.",
		}];
		const result = detectContentDuplication(newArticle, existing, { similarityThreshold: 70 });
		expect(result.hasDuplicate).toBe(false);
	});

	it("supports override feature", () => {
		const newArticle = { title: "Test", body: "Content" };
		const existing = [{ title: "Test", body: "Content" }];
		const result = detectContentDuplication(newArticle, existing, { similarityThreshold: 50 });
		expect(result.canOverride).toBe(true);
	});

	it("returns detailed similarity breakdown", () => {
		const newArticle = {
			title: "Title",
			description: "Description",
			body: "Body content",
		};
		const existing = [{
			title: "Title",
			description: "Description",
			body: "Body content",
		}];
		const result = detectContentDuplication(newArticle, existing, { similarityThreshold: 50 });
		expect(result.duplicates[0].titleSimilarity).toBeDefined();
		expect(result.duplicates[0].descriptionSimilarity).toBeDefined();
		expect(result.duplicates[0].bodySimilarity).toBeDefined();
	});
});
