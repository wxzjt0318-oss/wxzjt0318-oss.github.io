/**
 * rewrite-bangumi-posts.mjs 的受管内容来源判定测试
 * ─────────────────────────────────────────────────────────────────────────────
 * 保护机制的核心承诺：工具只覆写「自己写的、且此后没人动过」的小节；
 * 一旦内容与机器台账不符（人工编辑），必须整篇跳过、零改动。
 *
 * 这里只测纯函数（不联网、不写文件），覆盖五个判定分支与指纹归一化边界。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	BLOCKING_STATES,
	classifySection,
	currentSectionDigest,
	digestOf,
	extractSectionBody,
	normalizeManagedText,
	rebuildCategory,
	rebuildTags,
	STATE,
} from "../scripts/moegirl/rewrite-bangumi-posts.mjs";

const SAMPLE_BODY = [
	"## 一、作品概述",
	"",
	"萌娘百科导言段落。",
	"",
	"> 以上内容整理自[萌娘百科「测试条目」条目](https://example.org/wiki/测试)（CC BY-NC-SA 3.0）。",
	"",
	"![封面](https://example.org/cover.jpg)",
	"",
	"## 二、基础信息",
	"",
	"- **作品名称**：测试作品",
	"",
	"## 三、剧情简介",
	"",
	"这是剧情简介的机器生成段落。",
	"",
	"## 主要角色",
	"",
	"### 主角",
].join("\n");

describe("normalizeManagedText / digestOf", () => {
	it("把 CRLF 与行尾空格归一化后再取摘要", () => {
		const lf = "第一段\n\n第二段";
		const crlf = "第一段\r\n\r\n第二段  \r\n";
		assert.equal(digestOf(lf), digestOf(crlf));
	});

	it("忽略首尾空白差异", () => {
		assert.equal(digestOf("  内容\n"), digestOf("内容"));
	});

	it("内容实质变化时摘要必须不同", () => {
		assert.notEqual(digestOf("机器写的"), digestOf("人工改过的"));
	});

	it("归一化保留段落结构与正文空格", () => {
		assert.equal(normalizeManagedText("a b\n\nc"), "a b\n\nc");
	});
});

describe("extractSectionBody", () => {
	it("切出指定小节的正文且不含小节标题", () => {
		const section = extractSectionBody(SAMPLE_BODY, "## 一、作品概述", [
			"## 二、基础信息",
		]);
		assert.ok(section);
		assert.ok(!section.includes("## 一、作品概述"));
		assert.ok(section.includes("萌娘百科导言段落。"));
		assert.ok(!section.includes("**作品名称**"));
	});

	it("小节缺失时返回 null", () => {
		assert.equal(
			extractSectionBody("## 别的章节\n\n内容", "## 一、作品概述", ["## 二、"]),
			null,
		);
	});

	it("有开始无结束标题时返回 null（避免越界吞掉后文）", () => {
		assert.equal(
			extractSectionBody("## 一、作品概述\n\n孤立内容", "## 一、作品概述", [
				"## 二、",
			]),
			null,
		);
	});
});

describe("currentSectionDigest", () => {
	it("封面图行不参与指纹（工具会保留而非生成它）", () => {
		const withCover = currentSectionDigest(SAMPLE_BODY, "overview");
		const withoutCover = currentSectionDigest(
			SAMPLE_BODY.replace(/^!\[.*\]\(.*\)\s*$/m, "").replace(/\n{3,}/g, "\n\n"),
			"overview",
		);
		assert.equal(withCover, withoutCover);
	});

	it("正文被人工改写后指纹改变", () => {
		const edited = SAMPLE_BODY.replace(
			"萌娘百科导言段落。",
			"我重新写的导言。",
		);
		assert.notEqual(
			currentSectionDigest(SAMPLE_BODY, "overview"),
			currentSectionDigest(edited, "overview"),
		);
	});

	it("缺失小节返回 null", () => {
		assert.equal(
			currentSectionDigest("## 二、基础信息\n\n内容", "overview"),
			null,
		);
	});
});

describe("classifySection 判定分支", () => {
	const digest = "abc123abc123abc1";

	it("frontmatter 显式保护 → protected，优先于其他一切", () => {
		const r = classifySection({
			protectedByFrontmatter: true,
			ledgerEntry: { origin: "generated", digest },
			currentDigest: digest,
			regeneratedDigest: digest,
		});
		assert.equal(r.state, STATE.PROTECTED);
	});

	it("台账摘要与当前内容一致 → clean（允许覆写）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: { origin: "generated", digest },
			currentDigest: digest,
			regeneratedDigest: "different00000000",
		});
		assert.equal(r.state, STATE.CLEAN);
	});

	it("台账有基线但内容不符 → modified（人工编辑，必须跳过）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: { origin: "generated", digest },
			currentDigest: "edited0000000000",
			regeneratedDigest: "edited0000000000",
		});
		assert.equal(r.state, STATE.MODIFIED);
		assert.ok(BLOCKING_STATES.has(r.state));
	});

	it("无台账但重新生成结果与现状一致 → legacy-verified（存量文章首跑）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: undefined,
			currentDigest: digest,
			regeneratedDigest: digest,
		});
		assert.equal(r.state, STATE.LEGACY_OK);
		assert.ok(!BLOCKING_STATES.has(r.state));
	});

	it("无台账且与重新生成结果不符 → legacy-suspect（疑似人工编辑，必须跳过）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: undefined,
			currentDigest: "human0000000000",
			regeneratedDigest: "machine000000000",
		});
		assert.equal(r.state, STATE.LEGACY_SUSPECT);
		assert.ok(BLOCKING_STATES.has(r.state));
	});

	it("无台账且抓取失败无法比对 → legacy-suspect（宁可不写）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: undefined,
			currentDigest: "something0000000",
			regeneratedDigest: null,
		});
		assert.equal(r.state, STATE.LEGACY_SUSPECT);
		assert.ok(BLOCKING_STATES.has(r.state));
	});

	it("小节缺失 → clean，允许工具新建", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: undefined,
			currentDigest: null,
			regeneratedDigest: digest,
		});
		assert.equal(r.state, STATE.CLEAN);
	});

	it("只有 protected / modified / legacy-suspect 会阻断写入", () => {
		assert.deepEqual(
			[...BLOCKING_STATES].sort(),
			[STATE.LEGACY_SUSPECT, STATE.MODIFIED, STATE.PROTECTED].sort(),
		);
	});

	it("判定顺序：显式保护优先于台账一致（即使内容没动过也不写）", () => {
		const r = classifySection({
			protectedByFrontmatter: true,
			ledgerEntry: { origin: "generated", digest: "same00000000000" },
			currentDigest: "same00000000000",
			regeneratedDigest: "same00000000000",
		});
		assert.equal(r.state, STATE.PROTECTED);
	});

	it("判定顺序：台账一致（clean）优先于重新生成差异（避免误判人工编辑）", () => {
		const r = classifySection({
			protectedByFrontmatter: false,
			ledgerEntry: { origin: "generated", digest: "ledger0000000000" },
			currentDigest: "ledger0000000000",
			regeneratedDigest: "newmachine000000",
		});
		assert.equal(r.state, STATE.CLEAN);
		assert.ok(!BLOCKING_STATES.has(r.state));
	});
});

describe("标签与分类重建（原有行为保持）", () => {
	it("作品名置顶、题材优先、Bangumi 收尾", () => {
		const tags = rebuildTags("测试作品", [
			"测试作品",
			"恋爱",
			"漫画改",
			"TV",
			"ZERO-G",
			"Bangumi",
		]);
		assert.equal(tags[0], "测试作品");
		assert.equal(tags.at(-1), "Bangumi");
		assert.ok(tags.includes("恋爱"));
		assert.ok(tags.length <= 7);
	});

	it("过滤年份与星期类噪声标签", () => {
		const tags = rebuildTags("测试作品", [
			"2026年7月",
			"星期一",
			"恋爱",
			"Bangumi",
		]);
		assert.ok(!tags.includes("2026年7月"));
		assert.ok(!tags.includes("星期一"));
	});

	it("分类为每篇独立的短语式《作品名》+ 主题材", () => {
		assert.equal(
			rebuildCategory("测试作品", ["测试作品", "恋爱", "TV", "Bangumi"]),
			"《测试作品》恋爱",
		);
	});

	it("没有题材标签时回退到作品介绍", () => {
		assert.equal(
			rebuildCategory("测试作品", ["测试作品", "TV", "Bangumi"]),
			"《测试作品》作品介绍",
		);
	});
});
