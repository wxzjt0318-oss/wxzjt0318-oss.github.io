import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, getMoegirlPageSection, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testOptimizedMcp() {
    console.log("🔍 测试优化后的 Moegirl MCP\n");

    try {
        console.log("📡 初始化 MCP 服务器...");
        const result = await initializeMoegirlMcp();
        console.log(`初始化结果: ${result}\n`);

        if (!result) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }

        console.log("✅ MCP 服务器已连接!\n");

        console.log("📖 可用函数:");
        console.log("  1. initializeMoegirlMcp() - 初始化服务器");
        console.log("  2. searchMoegirl(query, exact) - 搜索词条");
        console.log("  3. getMoegirlPage(pageName) - 获取页面内容");
        console.log("  4. getMoegirlPageSection(pageName, section) - 获取页面章节");
        console.log("  5. stopMoegirlMcpServer() - 停止服务器\n");

        console.log("📝 测试搜索功能...");
        const searchResults = await searchMoegirl("魔法少女", false);
        console.log(`搜索结果: ${Array.isArray(searchResults) ? `${searchResults.length} 条` : typeof searchResults}`);

        if (searchResults && searchResults.length > 0) {
            console.log(`✅ 搜索成功! 找到 ${searchResults.length} 条结果`);
            console.log(`示例: ${JSON.stringify(searchResults[0]).slice(0, 100)}`);
        } else {
            console.log("⚠️ 搜索返回空结果 (MCP API 问题)");
        }

        console.log("\n📝 测试获取页面功能...");
        const pageContent = await getMoegirlPage("魔法少女");

        if (pageContent && !pageContent.includes("操作失败")) {
            console.log(`✅ 页面获取成功!`);
            console.log(`内容长度: ${pageContent.length} 字符`);
            console.log(`预览: ${pageContent.slice(0, 200)}...`);
        } else {
            console.log("❌ 页面获取失败 (MCP 服务器 bug)");
            console.log("   这是 moegirl-wiki-mcp 包的已知问题");
        }

        console.log("\n📝 测试获取页面章节功能...");
        const sectionContent = await getMoegirlPageSection("魔法少女", "定义");
        console.log(`章节结果: ${sectionContent ? `${sectionContent.length} 字符` : 'null'}`);

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    } finally {
        await stopMoegirlMcpServer();
        console.log("\n🔌 MCP 服务器已关闭");
    }
}

testOptimizedMcp().catch(console.error);
