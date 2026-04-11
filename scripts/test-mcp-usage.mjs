import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testMcpConnection() {
    console.log("🔍 测试 Moegirl MCP 连接和使用方法\n");

    try {
        console.log("📡 初始化 MCP 服务器...");
        const result = await initializeMoegirlMcp();
        console.log(`初始化结果: ${result}\n`);

        if (!result) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }

        console.log("✅ MCP 服务器已连接!\n");
        console.log("📖 MCP 服务器使用方法:\n");
        console.log("  1. searchMoegirl(query, exact) - 搜索萌娘百科条目");
        console.log("  2. getMoegirlPage(pageName) - 获取指定页面内容");
        console.log("  3. stopMoegirlMcpServer() - 停止服务器\n");

        console.log("📝 测试搜索功能...");
        const searchResults = await searchMoegirl("欢迎来到实力至上主义的教室", false);

        console.log(`\n搜索结果类型: ${typeof searchResults}`);
        console.log(`搜索结果: ${JSON.stringify(searchResults, null, 2).slice(0, 500)}`);

        if (searchResults && searchResults.length > 0) {
            console.log(`\n✅ 搜索成功! 找到 ${searchResults.length} 条结果`);

            for (let i = 0; i < Math.min(3, searchResults.length); i++) {
                console.log(`  [${i + 1}] ${JSON.stringify(searchResults[i]).slice(0, 100)}`);
            }

            console.log("\n📝 测试获取页面内容...");
            const firstResult = searchResults[0];
            const pageName = firstResult.title || firstResult.name;

            if (pageName) {
                const pageContent = await getMoegirlPage(pageName);
                console.log(`\n页面内容长度: ${pageContent?.length || 0}`);
                console.log(`页面内容预览: ${String(pageContent).slice(0, 200)}`);
            }
        } else {
            console.log("\n⚠️ 搜索结果为空");
        }

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
        console.error(error.stack);
    } finally {
        console.log("\n🔌 关闭 MCP 服务器...");
        await stopMoegirlMcpServer();
        console.log("✅ 测试完成");
    }
}

testMcpConnection().catch(console.error);
