async function testPublicApi() {
    console.log("🧪 测试 Bangumi 公开 API...\n");

    const BANGUMI_API_BASE = "https://api.bgm.tv/v0";

    async function fetchWithRetry(url, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "BangumiDailyPosts/1.0",
                    },
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    const testSubjects = [
        { id: 445334, expectedType: 4, expectedName: "游戏" },
        { id: 501963, expectedType: 2, expectedName: "动画" },
    ];

    for (const test of testSubjects) {
        try {
            console.log(`📡 获取条目 ${test.id} (预期: ${test.expectedName}, type=${test.expectedType})...`);
            const data = await fetchWithRetry(`${BANGUMI_API_BASE}/subjects/${test.id}`);
            if (data) {
                console.log(`   标题: ${data.name_cn || data.name}`);
                console.log(`   类型: ${data.type} ${data.type === test.expectedType ? "✅" : "❌"}`);
                console.log(`   简介: ${(data.summary || "").slice(0, 80)}...\n`);
            }
        } catch (error) {
            console.log(`   ❌ 获取失败: ${error.message}\n`);
        }
    }
}

testPublicApi().catch(console.error);
