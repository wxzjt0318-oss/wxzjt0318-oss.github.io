import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testMcpWithDifferentQueries() {
    console.log("🔍 测试不同搜索关键词\n");

    try {
        console.log("📡 初始化 MCP 服务器...");
        await initializeMoegirlMcp();
        console.log("✅ MCP 服务器已连接!\n");

        const testQueries = [
            { q: "魔法少女", desc: "常见词" },
            { q: "动漫", desc: "通用词" },
            { q: "Love Live", desc: "英文+空格" },
            { q: "Fate", desc: "英文单词" },
            { q: "进击的巨人", desc: "常见动漫" },
        ];

        for (const { q, desc } of testQueries) {
            console.log(`📡 搜索: "${q}" (${desc})`);

            const results = await searchMoegirl(q, false);

            if (results && Array.isArray(results) && results.length > 0) {
                console.log(`   ✅ 找到 ${results.length} 条结果`);
                console.log(`   示例: ${JSON.stringify(results[0]).slice(0, 80)}`);
            } else {
                console.log(`   ⚠️ 无结果`);
            }
            console.log();
        }

        console.log("📡 测试直接获取已知页面...");
        const knownPages = [
            { name: "魔法少女", desc: "常见条目" },
            { name: "萌娘百科", desc: "网站主页" },
        ];

        for (const { name, desc } of knownPages) {
            console.log(`📡 获取页面: "${name}" (${desc})`);

            const content = await getMoegirlPage(name);

            if (content && !content.includes("操作失败") && content.length > 50) {
                console.log(`   ✅ 成功! 内容长度: ${content.length}`);
                console.log(`   预览: ${content.slice(0, 100)}...\n`);
            } else {
                console.log(`   ❌ 失败: ${String(content).slice(0, 50)}\n`);
            }
        }

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    } finally {
        await stopMoegirlMcpServer();
        console.log("🔌 MCP 服务器已关闭");
    }
}

testMcpWithDifferentQueries().catch(console.error);
