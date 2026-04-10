import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testMoegirlSearch() {
    console.log("🧪 测试萌娘百科搜索: 欢迎来到实力至上主义教室\n");

    try {
        console.log("🚀 初始化 Moegirl MCP 服务器...");
        const initialized = await initializeMoegirlMcp();
        if (!initialized) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }
        console.log("✅ MCP 服务器已初始化\n");

        const searchTerms = [
            "欢迎来到实力至上主义教室",
            "欢迎来到实力至上主义教室 第四季",
            "教室_of_the_Elite",
        ];

        for (const term of searchTerms) {
            console.log(`📡 搜索: "${term}"`);
            const results = await searchMoegirl(term, false);

            if (results && results.length > 0) {
                console.log(`   ✅ 找到 ${results.length} 条结果`);
                for (let i = 0; i < Math.min(3, results.length); i++) {
                    console.log(`   [${i + 1}] ${results[i].title || results[i].name || JSON.stringify(results[i]).slice(0, 60)}`);
                }

                console.log(`\n📄 获取第一个结果的详情...`);
                const firstResult = results[0];
                const pageName = firstResult.title || firstResult.name;
                if (pageName) {
                    const pageContent = await getMoegirlPage(pageName);
                    if (pageContent) {
                        console.log(`   ✅ 获取到页面内容，长度: ${pageContent.length} 字符`);
                        console.log(`   内容预览: ${pageContent.slice(0, 200)}...`);
                    } else {
                        console.log(`   ❌ 获取页面内容失败`);
                    }
                }
            } else {
                console.log(`   ⚠️ 未找到结果`);
            }
            console.log();
        }

    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        console.error(error.stack);
    } finally {
        await stopMoegirlMcpServer();
        console.log("🔌 MCP 服务器已关闭");
    }
}

testMoegirlSearch().catch(console.error);
