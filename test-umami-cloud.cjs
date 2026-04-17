const https = require('https');

// Test API Key with cloud.umami.is
const UMAMI_API_KEY = 'api_en9RqdmWT5ad7Q9SaQtkbuRTByUwKMXi';
const WEBSITE_ID = '5529ac8c-8065-46d2-b0dc-83960ac4163c';
const CLOUD_API_BASE = 'https://cloud.umami.is/analytics/us/api';

function fetchData(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            console.log(`\n[${res.statusCode}] ${url}`);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function testCloudApi() {
    try {
        console.log('=== Test API Key with cloud.umami.is ===\n');

        // Test 1: With /v1 path
        console.log('--- Test 1: /v1/websites/{id}/stats ---');
        const url1 = CLOUD_API_BASE.replace('/api', '/api/v1') + '/websites/' + WEBSITE_ID + '/stats?startAt=0&endAt=' + Date.now();
        const result1 = await fetchData(url1, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Result:', result1.data.substring(0, 300));

        // Test 2: Without /v1 path
        console.log('\n--- Test 2: /api/websites/{id}/stats (no v1) ---');
        const url2 = CLOUD_API_BASE + '/websites/' + WEBSITE_ID + '/stats?startAt=0&endAt=' + Date.now();
        const result2 = await fetchData(url2, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Result:', result2.data.substring(0, 300));

    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testCloudApi();