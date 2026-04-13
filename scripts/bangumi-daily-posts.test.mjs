import { describe, expect, it } from "vitest";

import {
	buildAnimeArticleMarkdown,
	chooseBestCoverImage,
	createStateRecord,
	normalizeText,
	selectNextAnimeCandidate,
	slugifyTitle,
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
		expect(selected[0].subject_id).toBeLessThanOrEqual(20);
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
		expect(markdown).toContain("## 作品信息");
		expect(markdown).toContain("## 剧情概述");
		expect(markdown).toContain("## 主要角色介绍");
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

		expect(markdown).toContain("目前公开资料主要集中在作品定位与基础设定层面");
	});
});
