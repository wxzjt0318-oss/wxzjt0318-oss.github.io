import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

process.env.BANGUMI_POST_USE_MOEIRL = "true";

async function testMoegirlIntegration() {
    console.log("🔍 测试萌娘百科集成\n");
    console.log("=" .repeat(50));

    try {
        const { generateDailyPost } = await import("./generate-bangumi-daily-post.mjs");

        console.log("\n📡 执行单次日更生成...");
        console.log("(仅预览模式，不会实际发布)\n");

        const result = await generateDailyPost({
            now: new Date(),
            reviewMode: true,
        });

        if (result) {
            console.log("\n✅ 生成成功!");
            console.log(`   标题: ${result.title}`);
            console.log(`   文件: ${result.filePath}`);
            console.log(`   长度: ${result.content?.length || 0} 字符`);

            if (result.content) {
                console.log("\n📝 文章预览 (前500字符):");
                console.log("-".repeat(50));
                console.log(result.content.slice(0, 500));
                console.log("-".repeat(50));
            }
        } else {
            console.log("\n⚠️ 未生成文章 (可能没有候选条目)");
        }

    } catch (error) {
        console.error(`\n❌ 测试失败: ${error.message}`);
        console.error(error.stack);
    }
}

testMoegirlIntegration().catch(console.error);
