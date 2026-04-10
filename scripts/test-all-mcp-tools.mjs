import { initializeMoegirlMcp, searchMoegirl, getMoegirlPage, getMoegirlPageSection, stopMoegirlMcpServer } from "./moegirl-mcp-client.mjs";

async function testAllMoegirlTools() {
    console.log("🔍 完整测试 Moegirl MCP 所有工具\n");
    console.log("=" .repeat(50));

    try {
        console.log("\n📡 初始化 MCP 服务器...");
        const result = await initializeMoegirlMcp();

        if (!result) {
            console.log("❌ MCP 服务器初始化失败");
            return;
        }
        console.log("✅ MCP 服务器已连接!\n");

        console.log("=" .repeat(50));
        console.log("📖 工具列表:");
        console.log("  1. search_moegirl - 搜索萌娘百科条目");
        console.log("  2. get_page - 获取页面内容（含目录）");
        console.log("  3. get_page_sections - 获取指定标题或模板内容");
        console.log("=" .repeat(50));

        console.log("\n📝 [1] 测试 search_moegirl...");
        console.log("-".repeat(50));

        const testQueries = [
            { q: "魔法少女", desc: "标准搜索" },
            { q: "欢迎来到实力至上主义的教室", desc: "完整标题" },
            { q: "实教", desc: "简称" },
        ];

        for (const { q, desc } of testQueries) {
            console.log(`\n  搜索: "${q}" (${desc})`);
            const results = await searchMoegirl(q, false);

            if (Array.isArray(results) && results.length > 0) {
                console.log(`  ✅ 找到 ${results.length} 条结果`);
                console.log(`  示例: ${JSON.stringify(results[0]).slice(0, 80)}`);
            } else if (results && typeof results === 'string' && results.includes("未找到")) {
                console.log(`  ⚠️ 未找到相关条目`);
            } else {
                console.log(`  ⚠️ 结果为空或格式异常`);
                console.log(`  原始结果: ${JSON.stringify(results).slice(0, 100)}`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("📝 [2] 测试 get_page...");
        console.log("-".repeat(50));

        const pages = [
            { name: "魔法少女", desc: "常见条目" },
            { name: "萌娘百科", desc: "网站主页" },
            { name: "欢迎来到实力至上主义的教室", desc: "目标条目" },
        ];

        for (const { name, desc } of pages) {
            console.log(`\n  获取页面: "${name}" (${desc})`);
            const content = await getMoegirlPage(name);

            if (content && !content.includes("操作失败") && content.length > 50) {
                console.log(`  ✅ 成功! 内容长度: ${content.length} 字符`);
                console.log(`  预览: ${content.slice(0, 150)}...`);
            } else {
                console.log(`  ❌ 失败或内容为空`);
                console.log(`  结果: ${String(content).slice(0, 100)}`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("📝 [3] 测试 get_page_sections...");
        console.log("-".repeat(50));
        console.log("  注意: 需要提供 section_titles 或 template_names 参数");

        const sectionTests = [
            { page: "魔法少女", section: "定义", desc: "章节标题" },
            { page: "魔法少女", section: "History", desc: "英文章节" },
        ];

        for (const { page, section, desc } of sectionTests) {
            console.log(`\n  获取章节: "${page}" -> "${section}" (${desc})`);
            const content = await getMoegirlPageSection(page, [section]);

            if (content && !content.includes("操作失败") && content.length > 20) {
                console.log(`  ✅ 成功! 内容长度: ${content.length} 字符`);
                console.log(`  预览: ${content.slice(0, 150)}...`);
            } else {
                console.log(`  ❌ 失败`);
                console.log(`  结果: ${String(content).slice(0, 100)}`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("📊 测试总结:");
        console.log("=".repeat(50));
        console.log("\n已知问题:");
        console.log("  1. search_moegirl - 可能因缓存返回空结果");
        console.log("  2. get_page - MCP包存在bug，参数传递有问题");
        console.log("  3. get_page_sections - 需要正确格式的section_titles参数");
        console.log("\n建议:");
        console.log("  1. 等待30分钟缓存过期后再测试");
        console.log("  2. 向维护者反馈 get_page 的 bug");
        console.log("  3. 实现备用方案直接调用 MediaWiki API");

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
    } finally {
        await stopMoegirlMcpServer();
        console.log("\n🔌 MCP 服务器已关闭");
    }
}

testAllMoegirlTools().catch(console.error);
