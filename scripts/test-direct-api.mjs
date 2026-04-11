import { searchMoegirlDirect, getMoegirlPageDirect, getMoegirlSectionsDirect } from "./moegirl-api-direct.mjs";

async function testDirectApi() {
    console.log("🔍 测试直接 MediaWiki API\n");
    console.log("=" .repeat(50));

    try {
        console.log("\n📝 [1] 测试搜索...");
        console.log("-".repeat(50));

        const searchQueries = [
            { q: "魔法少女", desc: "标准搜索" },
            { q: "欢迎来到实力至上主义的教室", desc: "完整标题" },
            { q: "实教", desc: "简称" },
        ];

        for (const { q, desc } of searchQueries) {
            console.log(`\n  搜索: "${q}" (${desc})`);
            const results = await searchMoegirlDirect(q, 5);

            if (results && results.length > 0) {
                console.log(`  ✅ 找到 ${results.length} 条结果`);
                for (const r of results.slice(0, 3)) {
                    console.log(`    - ${r.title} (${r.wordcount}字)`);
                }
            } else {
                console.log(`  ⚠️ 无结果`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("\n📝 [2] 测试获取页面...");
        console.log("-".repeat(50));

        const pages = [
            { name: "魔法少女", desc: "常见条目" },
            { name: "欢迎来到实力至上主义的教室", desc: "目标条目" },
        ];

        for (const { name, desc } of pages) {
            console.log(`\n  获取页面: "${name}" (${desc})`);
            const page = await getMoegirlPageDirect(name);

            if (page) {
                console.log(`  ✅ 成功!`);
                console.log(`     标题: ${page.title}`);
                console.log(`     页面ID: ${page.pageid}`);
                console.log(`     内容长度: ${page.extract.length} 字符`);
                console.log(`     分类: ${page.categories.slice(0, 5).join(', ')}`);
                console.log(`     预览: ${page.extract.slice(0, 200)}...`);
            } else {
                console.log(`  ❌ 页面不存在或获取失败`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("\n📝 [3] 测试获取章节列表...");
        console.log("-".repeat(50));

        const sections = await getMoegirlSectionsDirect("魔法少女");
        if (sections && sections.length > 0) {
            console.log(`  ✅ 找到 ${sections.length} 个章节`);
            for (const s of sections.slice(0, 10)) {
                console.log(`    - ${s.title} (level: ${s.level})`);
            }
        } else {
            console.log(`  ⚠️ 无章节`);
        }

        console.log("\n" + "=".repeat(50));
        console.log("📊 测试完成!");
        console.log("=".repeat(50));

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    }
}

testDirectApi().catch(console.error);
