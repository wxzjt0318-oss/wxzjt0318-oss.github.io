import { MediaWikiApi } from "./moegirl-api-direct.mjs";

async function testFinalDirectApi() {
    console.log("🔍 测试最终版直接 MediaWiki API\n");
    console.log("=" .repeat(50));

    const api = new MediaWikiApi();

    try {
        console.log("\n📝 [1] 测试 OpenSearch (推荐方式)...");
        console.log("-".repeat(50));

        const searchQueries = [
            { q: "魔法少女", desc: "标准搜索" },
            { q: "欢迎来到实力至上主义的教室", desc: "完整标题" },
            { q: "实教", desc: "简称" },
        ];

        for (const { q, desc } of searchQueries) {
            console.log(`\n  搜索: "${q}" (${desc})`);
            const results = await api.openSearch(q, 5);

            if (results && results.length > 0) {
                console.log(`  ✅ 找到 ${results.length} 条结果`);
                for (const r of results.slice(0, 3)) {
                    console.log(`    - ${r.title}`);
                }
            } else {
                console.log(`  ⚠️ 无结果`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("\n📝 [2] 测试获取页面...");
        console.log("-".repeat(50));

        const targetPage = await api.getPage("欢迎来到实力至上主义的教室");
        if (targetPage) {
            console.log(`  ✅ 成功!`);
            console.log(`     标题: ${targetPage.title}`);
            console.log(`     页面ID: ${targetPage.pageid}`);
            console.log(`     内容长度: ${targetPage.extract.length} 字符`);
            console.log(`     分类: ${targetPage.categories.slice(0, 5).join(', ')}`);
            console.log(`     预览: ${targetPage.extract.slice(0, 150)}...`);
        } else {
            console.log(`  ❌ 页面不存在`);
        }

        console.log("\n" + "=".repeat(50));
        console.log("\n📝 [3] 测试获取章节...");
        console.log("-".repeat(50));

        const sections = await api.getPageSections("欢迎来到实力至上主义的教室");
        if (sections && sections.length > 0) {
            console.log(`  ✅ 找到 ${sections.length} 个章节`);
            for (const s of sections.slice(0, 10)) {
                console.log(`    - ${s.title}`);
            }
        } else {
            console.log(`  ⚠️ 无章节 (页面可能无子标题)`);
        }

        console.log("\n" + "=".repeat(50));
        console.log("\n📝 [4] 测试按ID获取页面...");
        console.log("-".repeat(50));

        if (targetPage?.pageid) {
            const pageById = await api.getPageById(targetPage.pageid);
            if (pageById) {
                console.log(`  ✅ 通过ID获取成功: ${pageById.title}`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("📊 测试完成!");
        console.log("=" .repeat(50));

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    }
}

testFinalDirectApi().catch(console.error);
