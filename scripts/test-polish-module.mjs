import {
	analyzeMoegirlArticle,
	polishArticleContent,
	qualityCheck
} from "./moegirl-article-analyzer.mjs";

const testCases = [
	{
		name: "测试1: 验证连接词插入逻辑修复",
		content: `# 作品标题

这是一个测试段落。这是一个测试段落。

## 角色介绍

角色内容

## 剧情简介

剧情内容`
	},
	{
		name: "测试2: 验证角色介绍章节自动添加",
		content: `# 作品标题

这是一个测试段落。这是一个测试段落。

## 原作信息

作品信息内容

## 总结

总结内容`
	},
	{
		name: "测试3: 验证剧情介绍章节自动添加",
		content: `# 作品标题

这是一个测试段落。这是一个测试段落。

## 主要角色介绍

角色内容`
	},
	{
		name: "测试4: 验证过渡词添加",
		content: `# 作品标题

这是一个测试段落。角色们在故事中经历了许多冒险。

然而故事并没有结束。

## 总结

总结内容`
	},
	{
		name: "测试5: 验证章节数量优化(不足3章时补充)",
		content: `# 作品标题

这是一个测试段落。`
	},
	{
		name: "测试6: 验证完整文章结构",
		content: `# 和班上第二可爱的女孩子成了朋友

《和班上第二可爱的女孩子成了朋友》是一部备受关注的作品。

## 原作信息

作品信息

## 主要角色介绍

故事中的角色形象鲜明`

	},
	{
		name: "测试7: 验证多个连续段落不会错误插入连接词",
		content: `# 测试标题

## 角色介绍

### 第一主角

这是第一主角的描述。

### 第二主角

这是第二主角的描述。

### 第三主角

这是第三主角的描述。

## 剧情简介

剧情内容`

	},
	{
		name: "测试8: 验证标题不会被添加连接词",
		content: `# 测试标题

## 角色

内容

## 剧情

更多内容`
	}
];

async function runTests() {
	console.log("=" .repeat(60));
	console.log("文章优化润色模块 - 全面测试验证");
	console.log("=".repeat(60));
	console.log("");

	let passed = 0;
	let failed = 0;

	for (const testCase of testCases) {
		console.log(`\n${"─".repeat(60)}`);
		console.log(`🧪 ${testCase.name}`);
		console.log(`${"─".repeat(60)}`);

		const analysis = await analyzeMoegirlArticle(testCase.content, "测试文章");
		console.log(`📊 分析得分: ${analysis.score}/100`);
		console.log(`📋 结构分析:`, {
			hasIntro: analysis.structure.hasIntro,
			hasCharacterSection: analysis.structure.hasCharacterSection,
			hasPlotSection: analysis.structure.hasPlotSection,
			missingSections: analysis.structure.missingSections,
			sectionCount: analysis.structure.sectionOrder?.length || 0
		});

		const original = testCase.content;
		const polished = polishArticleContent(testCase.content, analysis);

		console.log(`\n📝 润色前段落数: ${original.split(/\n\n+/).length}`);
		console.log(`📝 润色后段落数: ${polished.split(/\n\n+/).length}`);

		const originalSections = (original.match(/^##\s+/gm) || []).length;
		const polishedSections = (polished.match(/^##\s+/gm) || []).length;
		console.log(`📝 润色前章节数: ${originalSections}`);
		console.log(`📝 润色后章节数: ${polishedSections}`);

		const hasCharacterSection = /##\s*角色/.test(polished);
		const hasPlotSection = /##\s*剧情/.test(polished);
		console.log(`\n✅ 检查项:`);
		console.log(`   - 角色介绍章节: ${hasCharacterSection ? "✅ 已添加/已存在" : "❌ 未添加"}`);
		console.log(`   - 剧情介绍章节: ${hasPlotSection ? "✅ 已添加/已存在" : "❌ 未添加"}`);
		console.log(`   - 章节数量(3-8章): ${polishedSections >= 3 && polishedSections <= 8 ? "✅ 符合" : `⚠️ ${polishedSections}章`}`);

		const incorrectTransition = polished.match(/\n##\s+此外，/);
		if (incorrectTransition) {
			console.log(`   - 连接词插入: ⚠️ 发现标题前错误插入连接词`);
		} else {
			console.log(`   - 连接词插入: ✅ 未发现错误插入`);
		}

		const qualityResult = qualityCheck(polished, "测试文章");
		console.log(`\n🔍 质量检查: ${qualityResult.passed ? "✅ 通过" : "❌ 未通过"}`);

		const testPassed = hasCharacterSection && hasPlotSection &&
			polishedSections >= 3 && polishedSections <= 8 &&
			!incorrectTransition;

		if (testPassed) {
			console.log(`\n🎉 测试结果: ✅ 通过`);
			passed++;
		} else {
			console.log(`\n🎉 测试结果: ❌ 失败`);
			failed++;
		}

		console.log(`\n📄 润色后内容预览:`);
		console.log(`${"-".repeat(40)}`);
		console.log(polished.slice(0, 800) + (polished.length > 800 ? "\n...(内容截断)..." : ""));
		console.log(`${"-".repeat(40)}`);
	}

	console.log(`\n${"=".repeat(60)}`);
	console.log(`📊 测试总结`);
	console.log(`${"=".repeat(60)}`);
	console.log(`✅ 通过: ${passed}/${testCases.length}`);
	console.log(`❌ 失败: ${failed}/${testCases.length}`);
	console.log(`📈 通过率: ${Math.round((passed / testCases.length) * 100)}%`);
	console.log(`${"=".repeat(60)}`);

	if (failed === 0) {
		console.log(`\n🎊 所有测试通过！文章优化润色模块改进成功！`);
	} else {
		console.log(`\n⚠️ 存在 ${failed} 项测试失败，请检查。`);
	}
}

runTests().catch(console.error);
