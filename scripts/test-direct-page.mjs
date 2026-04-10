import { initializeMoegirlMcp, getMoegirlPage, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testDirectPageAccess() {
    console.log("🔍 测试直接页面获取功能\n");

    try {
        console.log("🚀 初始化 Moegirl MCP 服务器...");
        const initialized = await initializeMoegirlMcp();
        if (!initialized) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }
        console.log("✅ MCP 服务器已初始化\n");

        const testPages = [
            { name: "欢迎来到实力至上主义的教室", desc: "完整标题" },
            { name: "欢迎来到实力至上主义教室", desc: "无de字" },
            { name: "实教", desc: "简称" },
        ];

        for (const { name, desc } of testPages) {
            console.log(`📡 获取页面: "${name}" (${desc})`);

            const content = await getMoegirlPage(name);

            if (content && content.length > 0) {
                console.log(`   ✅ 成功! 内容长度: ${content.length} 字符`);
                console.log(`   内容预览: ${content.slice(0, 150)}...\n`);
            } else {
                console.log(`   ❌ 获取失败或内容为空\n`);
            }
        }

    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
    } finally {
        await stopMoegirlMcpServer();
        console.log("🔌 MCP 服务器已关闭");
    }
}

testDirectPageAccess().catch(console.error);
