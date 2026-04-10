async function debugSearch() {
    console.log("🔍 调试 MediaWiki 搜索 API\n");

    const baseUrl = "https://zh.moegirl.org.cn/api.php";

    const testQueries = [
        "魔法少女",
        "欢迎来到实力至上主义的教室",
        "测试",
        "anime",
    ];

    for (const query of testQueries) {
        console.log(`\n📡 搜索: "${query}"`);
        console.log("-".repeat(50));

        const url = `${baseUrl}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                }
            });

            console.log(`状态: ${response.status}`);

            const data = await response.json();

            console.log(`JSON keys: ${Object.keys(data).join(', ')}`);

            if (data.query) {
                console.log(`query keys: ${Object.keys(data.query).join(', ')}`);

                if (data.query.search) {
                    console.log(`搜索结果数: ${data.query.search.length}`);
                    for (const item of data.query.search.slice(0, 3)) {
                        console.log(`  - ${item.title} (pageid: ${item.pageid})`);
                    }
                } else {
                    console.log(`无 search 字段`);
                    console.log(`完整 query: ${JSON.stringify(data.query).slice(0, 300)}`);
                }

                if (data.query.searchinfo) {
                    console.log(`searchinfo: ${JSON.stringify(data.query.searchinfo)}`);
                }
            }

            if (data.error) {
                console.log(`错误: ${data.error.info}`);
            }

        } catch (error) {
            console.log(`请求失败: ${error.message}`);
        }
    }

    console.log("\n\n📡 测试 opensearch API...");
    console.log("-".repeat(50));

    const openSearchUrl = `${baseUrl}?action=opensearch&search=${encodeURIComponent("魔法少女")}&limit=5&namespace=0&format=json`;

    try {
        const response = await fetch(openSearchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }
        });

        console.log(`状态: ${response.status}`);
        const data = await response.json();

        console.log(`数据类型: ${Array.isArray(data) ? '数组' : typeof data}`);
        console.log(`数据长度: ${Array.isArray(data) ? data.length : 'N/A'}`);

        if (Array.isArray(data) && data.length > 0) {
            console.log(`标题: ${data[0]}`);
            console.log(`结果数: ${data[1]?.length || 0}`);
            console.log(`结果: ${data[1]?.join(', ')}`);
        }

    } catch (error) {
        console.log(`请求失败: ${error.message}`);
    }
}

debugSearch().catch(console.error);
