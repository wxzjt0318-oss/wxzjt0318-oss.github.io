async function testAnimeApi() {
    console.log("🧪 测试 Bangumi 动漫 API...\n");

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

    const testEndpoints = [
        { url: `${BANGUMI_API_BASE}/subjects?type=2&limit=5`, name: "动漫目录" },
        { url: `${BANGUMI_API_BASE}/subjects/501963`, name: "动漫详情(501963)" },
        { url: "https://api.bgm.tv/calendar", name: "Bangumi日历" },
    ];

    for (const endpoint of testEndpoints) {
        try {
            console.log(`📡 测试: ${endpoint.name}`);
            console.log(`   URL: ${endpoint.url.slice(0, 80)}...`);
            const data = await fetchWithRetry(endpoint.url);
            if (data) {
                if (Array.isArray(data)) {
                    console.log(`   ✅ 返回 ${data.length} 条数据`);
                    if (data.length > 0) {
                        console.log(`   示例: ${JSON.stringify(data[0]).slice(0, 100)}...`);
                    }
                } else {
                    console.log(`   ✅ 返回对象: type=${data.type}, name=${data.name || data.name_cn}`);
                }
            }
            console.log();
        } catch (error) {
            console.log(`   ❌ 失败: ${error.message}\n`);
        }
    }
}

testAnimeApi().catch(console.error);
