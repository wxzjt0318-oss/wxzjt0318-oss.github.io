const https = require('https');

const UMAMI_API_KEY = 'api_en9RqdmWT5ad7Q9SaQtkbuRTByUwKMXi';
const WEBSITE_ID = '5529ac8c-8065-46d2-b0dc-83960ac4163c';

function fetchData(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: data.substring(0, 500) }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function findCorrectApiPath() {
    const paths = [
        '/api/v1/websites/' + WEBSITE_ID + '/stats',
        '/analytics/api/v1/websites/' + WEBSITE_ID + '/stats',
        '/analytics/us/api/v1/websites/' + WEBSITE_ID + '/stats',
    ];

    for (const path of paths) {
        console.log(`\n=== Testing: https://cloud.umami.is${path} ===`);
        try {
            const result = await fetchData('https://cloud.umami.is' + path, {
                headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
            });
            console.log(`Status: ${result.status}`);
            console.log(`Data: ${result.data}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    // Also check api.umami.is directly
    console.log('\n=== Reference: https://api.umami.is/v1/websites/' + WEBSITE_ID + '/stats ===');
    try {
        const result = await fetchData('https://api.umami.is/v1/websites/' + WEBSITE_ID + '/stats?startAt=0&endAt=' + Date.now(), {
            headers: { 'Authorization': 'Bearer ' + UMAMI_API_KEY }
        });
        console.log(`Status: ${result.status}`);
        console.log(`Data: ${result.data}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

findCorrectApiPath();