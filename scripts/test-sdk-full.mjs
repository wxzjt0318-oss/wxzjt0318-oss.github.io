import { searchMoegirlSDK, getMoegirlPageSDK, getMoegirlSectionsSDK } from "./moegirl-sdk.mjs";

async function testOfficialSDK() {
    console.log("🔍 测试萌娘百科官方 SDK (完整测试)\n");
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
            const results = await searchMoegirlSDK(q, 5);

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

        const targetPage = await getMoegirlPageSDK("欢迎来到实力至上主义的教室");
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

        const sections = await getMoegirlSectionsSDK("欢迎来到实力至上主义的教室");
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
        console.log("=" .repeat(50));

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    }
}

testOfficialSDK().catch(console.error);
