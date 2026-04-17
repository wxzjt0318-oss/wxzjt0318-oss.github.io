const https = require('https');

const shareUrl = 'https://cloud.umami.is/analytics/us/share/ACFz2ANbIAuCxHmI';
const url = new URL(shareUrl);
const pathParts = url.pathname.split('/');
const shareIndex = pathParts.indexOf('share');
const shareId = pathParts[shareIndex + 1];
const apiBase = url.protocol + '//' + url.host + pathParts.slice(0, shareIndex).join('/') + '/api';

console.log('=== Umami Share API Test ===\n');
console.log('shareId:', shareId);
console.log('apiBase:', apiBase);

// First get share data to get token
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

async function testUmamiShare() {
    try {
        // Step 1: Get share info
        console.log('\n=== Step 1: Get Share Info ===');
        const shareResult = await fetchData(apiBase + '/share/' + shareId);
        const shareData = JSON.parse(shareResult.data);
        console.log('Share Data:', JSON.stringify(shareData, null, 2));

        const token = shareData.token;
        const websiteId = shareData.websiteId;
        console.log('\nExtracted:');
        console.log('  Token:', token.substring(0, 50) + '...');
        console.log('  WebsiteId:', websiteId);

        // Step 2: Try different auth methods
        console.log('\n=== Step 2: Test Stats API with different auth methods ===');

        // Method 1: x-umami-share-token header
        console.log('\n--- Method 1: x-umami-share-token header ---');
        try {
            const statsUrl1 = apiBase + '/websites/' + websiteId + '/stats?startAt=0&endAt=' + Date.now();
            const result1 = await fetchData(statsUrl1, {
                headers: { 'x-umami-share-token': token }
            });
            console.log('Result:', result1.data.substring(0, 200));
        } catch (e) {
            console.log('Error:', e.message);
        }

        // Method 2: Bearer token
        console.log('\n--- Method 2: Bearer token ---');
        try {
            const statsUrl2 = apiBase + '/websites/' + websiteId + '/stats?startAt=0&endAt=' + Date.now();
            const result2 = await fetchData(statsUrl2, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            console.log('Result:', result2.data.substring(0, 200));
        } catch (e) {
            console.log('Error:', e.message);
        }

        // Method 3: Cookie with share-token
        console.log('\n--- Method 3: Cookie with share-token ---');
        try {
            const statsUrl3 = apiBase + '/websites/' + websiteId + '/stats?startAt=0&endAt=' + Date.now();
            const result3 = await fetchData(statsUrl3, {
                headers: { 'Cookie': 'share-token=' + token }
            });
            console.log('Result:', result3.data.substring(0, 200));
        } catch (e) {
            console.log('Error:', e.message);
        }

        // Step 3: Try without auth (public data)
        console.log('\n=== Step 3: Test if endpoint requires auth ===');
        try {
            const publicUrl = apiBase + '/share/' + shareId + '/stats';
            const result4 = await fetchData(publicUrl);
            console.log('Result:', result4.data.substring(0, 200));
        } catch (e) {
            console.log('Error:', e.message);
        }

    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testUmamiShare();