import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleLongform } from "../scripts/wiki/assemble-longform.mjs";

const POST = `---
title: "《测试作品》"
description: "旧简介"
tags: ["奇幻"]
category: "奇幻作品介绍"
licenseName: "CC BY 4.0"
alias: "test"
image: "https://example.org/c.jpg"
---

> 旧引言

旧正文

<!-- shirone:auto-draft -->

---

## 参考资料

- [Bangumi](https://bgm.tv/subject/1)
`;

describe("assembleLongform", () => {
	it("replaces head fields and body, keeps references when refs is empty", () => {
		const draft = [
			"description: 新简介",
			"quote: 新引言",
			"category: 新分类",
			'tags: ["奇幻", "异世界"]',
			"refs:",
			"说实话，这是正文。",
			"",
			"{{COVER}}",
			"",
			"# 一、基本信息",
		].join("\n");
		const { markdown } = assembleLongform(draft, POST);
		assert.match(markdown, /^description: "新简介"$/m);
		assert.match(markdown, /^category: "新分类"$/m);
		assert.match(markdown, /^tags: \["奇幻", "异世界"\]$/m);
		assert.match(markdown, /^> 新引言$/m);
		assert.match(markdown, /!\[测试作品封面\]\(https:\/\/example\.org\/c\.jpg\)/);
		assert.match(markdown, /## 参考资料\n\n- \[Bangumi\]/);
		assert.ok(!markdown.includes("旧正文"));
		assert.ok(!markdown.includes("shirone:auto-draft"));
	});

	it("uses the given references and switches the license for Moegirl", () => {
		const draft = 'description: a\nquote: b\ncategory: c\ntags: ["x"]\nrefs: [Bangumi](https://bgm.tv/subject/1) | [萌娘百科](https://zh.moegirl.org.cn/x)\n正文\n\n{{COVER}}';
		const { markdown } = assembleLongform(draft, POST);
		assert.match(markdown, /- \[萌娘百科\]\(https:\/\/zh\.moegirl\.org\.cn\/x\)/);
		assert.match(markdown, /^licenseName: "CC BY-NC-SA 3\.0"$/m);
	});

	it("rejects drafts with a missing head line or cover marker", () => {
		assert.throws(() => assembleLongform("quote: b\n正文", POST));
		assert.throws(() => assembleLongform('description: a\nquote: b\ncategory: c\ntags: ["x"]\nrefs:\n没有封面', POST));
	});
});
