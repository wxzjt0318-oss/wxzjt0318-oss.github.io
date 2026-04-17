const https = require('https');

// Test with Umami API Key instead of share token
const UMAMI_API_KEY = 'api_en9RqdmWT5ad7Q9SaQtkbuRTByUwKMXi';
const WEBSITE_ID = '5529ac8c-8065-46d2-b0dc-83960ac4163c';
const API_BASE = 'https://api.umami.is/v1';

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

async function testUmamiApiKey() {
    try {
        // Test with API Key
        console.log('=== Test Umami API with Key ===\n');

        // Method 1: API Key as Bearer token
        console.log('--- Method: Bearer token with API Key ---');
        const statsUrl = API_BASE + '/websites/' + WEBSITE_ID + '/stats?startAt=0&endAt=' + Date.now();
        console.log('URL:', statsUrl);
        console.log('API Key:', UMAMI_API_KEY);

        const result = await fetchData(statsUrl, {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log('Result:', result.data.substring(0, 500));

    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testUmamiApiKey();