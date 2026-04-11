import { initializeMoegirlMcp, searchMoegirl, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function debugMoegirlSearch() {
    console.log("🔍 调试萌娘百科搜索返回数据\n");

    try {
        console.log("🚀 初始化 Moegirl MCP 服务器...");
        const initialized = await initializeMoegirlMcp();
        if (!initialized) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }
        console.log("✅ MCP 服务器已初始化\n");

        const query = "欢迎来到实力至上主义教室";
        console.log(`📡 搜索: "${query}"`);

        const result = await searchMoegirl(query, false);

        console.log("\n📊 原始返回结果分析:");
        console.log(`   类型: ${typeof result}`);
        console.log(`   是否为数组: ${Array.isArray(result)}`);
        console.log(`   长度/大小: ${result ? (Array.isArray(result) ? result.length : JSON.stringify(result).length) : 'null'}`);

        if (Array.isArray(result)) {
            console.log("\n📋 数组内容:");
            for (let i = 0; i < Math.min(5, result.length); i++) {
                const item = result[i];
                console.log(`   [${i}] 类型: ${typeof item}, 值: ${JSON.stringify(item).slice(0, 100)}`);
            }
        } else if (typeof result === 'string') {
            console.log("\n📋 字符串内容 (前200字符):");
            console.log(result.slice(0, 200));
        } else {
            console.log("\n📋 对象内容:");
            console.log(JSON.stringify(result, null, 2).slice(0, 500));
        }

    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        console.error(error.stack);
    } finally {
        await stopMoegirlMcpServer();
        console.log("\n🔌 MCP 服务器已关闭");
    }
}

debugMoegirlSearch().catch(console.error);
