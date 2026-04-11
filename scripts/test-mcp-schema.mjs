import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testMcpToolsSchema() {
    console.log("🔍 检查 MCP 工具定义\n");

    try {
        console.log("📡 初始化 MCP 服务器...");
        await initializeMoegirlMcp();
        console.log("✅ MCP 服务器已连接!\n");

        console.log("📡 测试 search_moegirl 不同参数格式...");

        const searchTests = [
            { args: { query: "魔法少女", exact: false }, desc: "标准参数" },
            { args: { query: "魔法少女", exact: true }, desc: "精确搜索" },
            { args: { search: "魔法少女" }, desc: "使用 search 字段" },
            { args: { q: "魔法少女" }, desc: "使用 q 字段" },
        ];

        for (const test of searchTests) {
            console.log(`\n测试: ${test.desc}`);
            console.log(`参数: ${JSON.stringify(test.args)}`);

            const result = await searchMoegirl(test.args.query || test.args.search || test.args.q, false);
            console.log(`结果: ${Array.isArray(result) ? `${result.length} 条` : typeof result}`);
        }

        console.log("\n\n📡 测试 get_page 不同参数格式...");

        const pageTests = [
            { args: { pageName: "魔法少女" }, desc: "pageName" },
            { args: { title: "魔法少女" }, desc: "title" },
            { args: { ttitle: "魔法少女" }, desc: "ttitle" },
            { args: { page: "魔法少女" }, desc: "page" },
            { args: { name: "魔法少女" }, desc: "name" },
        ];

        for (const test of pageTests) {
            console.log(`\n测试: ${test.desc}`);
            console.log(`参数: ${JSON.stringify(test.args)}`);

            const result = await getMoegirlPage(test.args.pageName || test.args.title || test.args.ttitle || test.args.page || test.args.name);
            console.log(`结果: ${String(result).slice(0, 100)}`);
        }

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    } finally {
        await stopMoegirlMcpServer();
        console.log("\n🔌 MCP 服务器已关闭");
    }
}

testMcpToolsSchema().catch(console.error);
