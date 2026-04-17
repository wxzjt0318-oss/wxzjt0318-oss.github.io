// 测试 oddmisc 暴露的 API
const https = require('https');

// 配置信息
const UMAMI_SHARE_URL = 'https://cloud.umami.is/analytics/us/share/ACFz2ANbIAuCxHmI';
const UMAMI_API_KEY = 'api_en9RqdmWT5ad7Q9SaQtkbuRTByUwKMXi';
const WEBSITE_ID = '5529ac8c-8065-46d2-b0dc-83960ac4163c';
const API_BASE = 'https://api.umami.is/v1';

function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data.substring(0, 500) });
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function testUmamiFunctions() {
    console.log('=== 测试 oddmisc 风格的 Umami API 调用 ===\n');

    // 测试 1: 获取网站统计 (getSiteStats)
    console.log('--- Test 1: getSiteStats ---');
    try {
        const result = await fetchJson(`${API_BASE}/websites/${WEBSITE_ID}/stats?startAt=0&endAt=${Date.now()}`, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Status:', result.status);
        console.log('Data:', JSON.stringify(result.data));
    } catch (e) {
        console.log('Error:', e.message);
    }

    // 测试 2: 获取页面统计 (getStats)
    console.log('\n--- Test 2: getStats (/posts/xxx/) ---');
    try {
        const pageUrl = '/posts/test/';
        const result = await fetchJson(`${API_BASE}/websites/${WEBSITE_ID}/stats?startAt=0&endAt=${Date.now()}&path=${encodeURIComponent(pageUrl)}`, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Status:', result.status);
        console.log('Data:', JSON.stringify(result.data));
    } catch (e) {
        console.log('Error:', e.message);
    }

    // 测试 3: 获取页面浏览量 (pageviews)
    console.log('\n--- Test 3: pageviews API ---');
    try {
        const pageUrl = '/posts/test/';
        const result = await fetchJson(`${API_BASE}/websites/${WEBSITE_ID}/pageviews?startAt=0&endAt=${Date.now()}&path=${encodeURIComponent(pageUrl)}`, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Status:', result.status);
        console.log('Data:', JSON.stringify(result.data));
    } catch (e) {
        console.log('Error:', e.message);
    }

    // 测试 4: 获取分享数据
    console.log('\n--- Test 4: Share API ---');
    try {
        const shareId = 'ACFz2ANbIAuCxHmI';
        const result = await fetchJson(`https://cloud.umami.is/analytics/us/api/share/${shareId}`);
        console.log('Status:', result.status);
        console.log('Share Data:', JSON.stringify(result.data, null, 2));
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testUmamiFunctions();