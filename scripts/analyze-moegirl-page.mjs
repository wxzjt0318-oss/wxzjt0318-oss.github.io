async function analyzeMoegirlPage() {
    console.log("🔍 分析萌娘百科页面内容和搜索问题\n");

    const pageUrl = "https://zh.moegirl.org.cn/%E6%AC%A2%E8%BF%8E%E6%9D%A5%E5%88%B0%E5%AE%9E%E5%8A%9B%E8%87%B3%E4%B8%8A%E4%B8%BB%E4%B9%89%E7%9A%84%E6%95%99%E5%AE%A4";
    console.log(`📄 页面URL: ${pageUrl}\n`);

    async function fetchWithTimeout(url, timeout = 15000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            });
            clearTimeout(timer);
            return await response.text();
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }
    }

    try {
        console.log("📡 获取页面内容...");
        const html = await fetchWithTimeout(pageUrl);
        console.log(`✅ 获取到 HTML，长度: ${html.length} 字符\n`);

        const patterns = {
            title: /<title>(.*?)<\/title>/i,
            h1: /<h1[^>]*>(.*?)<\/h1>/i,
            canonical: /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
            keywords: /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i,
            description: /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
            ogTitle: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
        };

        console.log("📊 页面元数据分析:");
        const titleMatch = html.match(patterns.title);
        if (titleMatch) console.log(`   标题: ${titleMatch[1]}`);

        const h1Match = html.match(patterns.h1);
        if (h1Match) console.log(`   H1: ${h1Match[1].replace(/<[^>]+>/g, '')}`);

        const canonicalMatch = html.match(patterns.canonical);
        if (canonicalMatch) console.log(`   规范URL: ${canonicalMatch[1]}`);

        const keywordsMatch = html.match(patterns.keywords);
        if (keywordsMatch) console.log(`   关键词: ${keywordsMatch[1]}`);

        const descriptionMatch = html.match(patterns.description);
        if (descriptionMatch) console.log(`   描述: ${descriptionMatch[1].slice(0, 100)}...`);

        const ogTitleMatch = html.match(patterns.ogTitle);
        if (ogTitleMatch) console.log(`   OG标题: ${ogTitleMatch[1]}`);

        console.log("\n📊 搜索相关分析:");

        const searchIndexPatterns = [
            /data-search[^>]*=["']([^"']+)["']/gi,
            /search-index[^>]*>([^<]+)</gi,
            /wgTitle[^>]*=["']([^"']+)["']/gi,
            /pageTitle[^>]*=["']([^"']+)["']/gi,
        ];

        for (const pattern of searchIndexPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`   匹配 ${pattern}: ${matches.slice(0, 3).join(', ')}`);
            }
        }

        const jsVariables = [
            { name: 'wgPageName', pattern: /wgPageName\s*=\s*["']([^"']+)["']/ },
            { name: 'wgTitle', pattern: /wgTitle\s*=\s*["']([^"']+)["']/ },
            { name: 'wgArticleId', pattern: /wgArticleId\s*=\s*["']?(\d+)["']?/ },
        ];

        console.log("\n📊 JavaScript变量:");
        for (const v of jsVariables) {
            const match = html.match(v.pattern);
            if (match) {
                console.log(`   ${v.name}: ${match[1]}`);
            }
        }

        const searchApiPatterns = [
            /action=query[^&]*list=search[^&]*/i,
            /api\.php\?action=query[^"']+/i,
        ];

        console.log("\n📊 搜索API模式:");
        for (const pattern of searchApiPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                console.log(`   发现: ${matches[0].slice(0, 100)}`);
            }
        }

        const pageContentMatch = html.match(/<div[^>]*id=["']mw-content-text["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<div[^>]*id=["']footer["']/i);
        if (pageContentMatch) {
            const content = pageContentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            console.log("\n📊 页面内容摘要 (前300字符):");
            console.log(`   ${content.slice(0, 300)}...`);
        }

    } catch (error) {
        console.error(`❌ 获取页面失败: ${error.message}`);
    }
}

analyzeMoegirlPage().catch(console.error);
