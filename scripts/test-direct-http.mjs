async function testDirectHttpFetch() {
    console.log("🔍 测试直接 HTTP 获取萌娘百科页面\n");

    const pageName = "欢迎来到实力至上主义的教室";
    const url = `https://zh.moegirl.org.cn/${encodeURIComponent(pageName)}`;

    console.log(`📡 请求 URL: ${url}\n`);

    async function fetchWithHeaders(url, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Referer": "https://zh.moegirl.org.cn/",
                    "Origin": "https://zh.moegirl.org.cn",
                    ...options.headers,
                },
            });

            clearTimeout(timer);
            return response;
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }

    try {
        console.log("📡 获取 HTML 页面 (带完整头部)...");
        const response = await fetchWithHeaders(url);

        if (!response.ok) {
            console.log(`❌ HTTP 错误: ${response.status} ${response.statusText}`);
            return;
        }

        console.log(`✅ 状态: ${response.status}`);
        console.log(`   内容类型: ${response.headers.get("content-type")}`);

        const html = await response.text();
        console.log(`   HTML 长度: ${html.length} 字符`);

        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
            console.log(`   页面标题: ${titleMatch[1].replace(/<[^>]+>/g, '')}`);
        }

        const contentMatch = html.match(/<div[^>]*id=["']mw-content-text["'][^>]*>([\s\S]*?)<div[^>]*class=["'][^"]*printfooter["']/i);
        if (contentMatch) {
            let content = contentMatch[1];
            content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            content = content.replace(/<[^>]+>/g, ' ');
            content = content.replace(/\s+/g, ' ').trim();
            console.log(`\n📊 页面内容摘要 (前400字符):`);
            console.log(`   ${content.slice(0, 400)}...`);
        } else {
            console.log(`   ⚠️ 无法提取正文内容`);
        }

    } catch (error) {
        console.error(`❌ 获取失败: ${error.message}`);
    }
}

testDirectHttpFetch().catch(console.error);
