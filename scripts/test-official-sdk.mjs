async function testOfficialSDK() {
    console.log("🔍 测试萌娘百科官方 SDK\n");
    console.log("=" .repeat(50));

    const { MediaWikiApi } = await import('wiki-saikou');

    const api = new MediaWikiApi('https://zh.moegirl.org.cn/api.php');

    console.log("\n📡 测试 OpenSearch...");
    try {
        const result = await api.get({
            action: 'opensearch',
            search: '欢迎来到实力至上主义的教室',
            limit: 5,
            namespace: 0,
        });

        console.log(`响应 keys: ${Object.keys(result).join(', ')}`);

        if (result.response) {
            const data = result.response.data || result.response;
            console.log(`数据: ${JSON.stringify(data).slice(0, 500)}`);
        }
    } catch (error) {
        console.error(`OpenSearch 失败: ${error.message}`);
    }

    console.log("\n📡 测试页面查询...");
    try {
        const result = await api.get({
            action: 'query',
            titles: '欢迎来到实力至上主义的教室',
            prop: 'extracts',
            exintro: false,
            explaintext: true,
        });

        if (result.response) {
            const data = result.response.data || result.response;
            console.log(`数据: ${JSON.stringify(data).slice(0, 500)}`);
        }
    } catch (error) {
        console.error(`页面查询失败: ${error.message}`);
    }

    console.log("\n" + "=".repeat(50));
}

testOfficialSDK().catch(console.error);
