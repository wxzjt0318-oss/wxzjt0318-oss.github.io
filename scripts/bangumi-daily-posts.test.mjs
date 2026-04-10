import { describe, expect, it } from "vitest";

import {
	buildAnimeArticleMarkdown,
	chooseBestCoverImage,
	createStateRecord,
	normalizeText,
	pickRandomBodyImages,
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

	it("prefers bangumi large cover over fallback search results", () => {
		const result = chooseBestCoverImage([
			{ url: "https://example.com/jikan.jpg", source: "jikan-search", title: "Anime A", width: 720, height: 1080 },
			{ url: "https://example.com/bangumi.jpg", source: "bangumi-large", title: "Anime A", width: 1200, height: 1700 },
		], { names: ["Anime A"] });

		expect(result.selected?.url).toBe("https://example.com/bangumi.jpg");
	});

	it("builds compatible markdown article with three inline images", () => {
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
			bodyImages: [
				{ url: "https://example.com/body-1.jpg", alt: "测试动画 相关图片 1" },
				{ url: "https://example.com/body-2.jpg", alt: "测试动画 相关图片 2" },
				{ url: "https://example.com/body-3.jpg", alt: "测试动画 相关图片 3" },
			],
			draft: true,
			meta: {
				studio: "P.A.WORKS",
				airDate: "2026-04-01",
				episodes: "12 话",
				progress: "已看到 1 话",
			},
			staff: [{ relation: "监督", name: "测试监督" }],
			statusLabel: "在看",
			reviewMode: true,
		});

		expect(markdown).toContain("title: \"《测试动画》\"");
		expect(markdown).toContain("draft: true");
		expect(markdown).toContain("## 一、作品概述");
		expect((markdown.match(/!\[/g) || []).length).toBe(3);
	});

	it("picks three body images from related candidates", () => {
		const picked = pickRandomBodyImages([
			{ url: "https://example.com/cover.jpg", alt: "cover" },
			{ url: "https://example.com/1.jpg", alt: "1" },
			{ url: "https://example.com/2.jpg", alt: "2" },
			{ url: "https://example.com/3.jpg", alt: "3" },
			{ url: "https://example.com/4.jpg", alt: "4" },
		], "https://example.com/cover.jpg", 3, "seed");

		expect(picked).toHaveLength(3);
		expect(picked.some((item) => item.url === "https://example.com/cover.jpg")).toBe(false);
	});

	it("creates stable aliases and state records", () => {
		expect(slugifyTitle("The Angel Next Door", "fallback")).toBe("the-angel-next-door");
		expect(normalizeText("《测试动画》")).toBe("测试动画");

		const record = createStateRecord({
			subjectId: 321,
			title: "《测试动画》",
			filePath: "src/content/posts/测试动画.md",
			alias: "test-anime",
			sourceLink: "https://bgm.tv/subject/321",
			published: "2026-04-09",
			image: "https://example.com/cover.jpg",
			reviewMode: true,
		});
		expect(record.status).toBe("review");
		expect(record.subjectId).toBe(321);
	});
});
