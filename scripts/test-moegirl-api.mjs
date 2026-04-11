async function testMoegirlSearchApi() {
    console.log("🔍 测试萌娘百科搜索 API\n");

    async function fetchWithTimeout(url, timeout = 15000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                }
            });
            clearTimeout(timer);
            return await response.json();
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }

    const searchQueries = [
        { q: "欢迎来到实力至上主义的教室", source: "URL编码" },
        { q: "欢迎来到实力至上主义教室", source: "标准搜索" },
        { q: "教室_of_the_Elite", source: "英文名" },
        { q: "实力至上主义", source: "部分名称" },
    ];

    for (const { q, source } of searchQueries) {
        console.log(`📡 测试搜索: "${q}" (${source})`);

        try {
            const apiUrl = `https://zh.moegirl.org.cn/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=10`;
            const result = await fetchWithTimeout(apiUrl);

            if (result.query?.search) {
                const results = result.query.search;
                console.log(`   ✅ 找到 ${results.length} 条结果`);
                for (const r of results.slice(0, 3)) {
                    console.log(`   - ${r.title} (${r.wordcount} words)`);
                }
            } else if (result.query?.searchinfo?.suggestion) {
                console.log(`   💡 建议: ${result.query.searchinfo.suggestion}`);
            } else {
                console.log(`   ⚠️ 无结果`);
                if (result.error) console.log(`   错误: ${result.error.info}`);
            }
        } catch (error) {
            console.log(`   ❌ 失败: ${error.message}`);
        }
        console.log();
    }

    console.log("📊 测试直接获取页面内容...");

    const pageName = "欢迎来到实力至上主义的教室";
    const pageApiUrl = `https://zh.moegirl.org.cn/api.php?action=parse&page=${encodeURIComponent(pageName)}&format=json&prop=text`;

    try {
        const result = await fetchWithTimeout(pageApiUrl);
        if (result.parse?.text?.["*"]) {
            console.log(`✅ 页面存在!`);
            console.log(`   页面ID: ${result.parse.pageid}`);
            const content = result.parse.text["*"].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`   内容摘要: ${content.slice(0, 200)}...`);
        } else if (result.error) {
            console.log(`❌ 页面不存在: ${result.error.info}`);
        }
    } catch (error) {
        console.log(`❌ 获取页面失败: ${error.message}`);
    }
}

testMoegirlSearchApi().catch(console.error);
