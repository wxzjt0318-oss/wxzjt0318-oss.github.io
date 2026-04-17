const https = require('https');

const shareUrl = 'https://cloud.umami.is/analytics/us/share/ACFz2ANbIAuCxHmI';
const url = new URL(shareUrl);
const pathParts = url.pathname.split('/');
const shareIndex = pathParts.indexOf('share');
const shareId = pathParts[shareIndex + 1];
const apiBase = url.protocol + '//' + url.host + pathParts.slice(0, shareIndex).join('/') + '/api';

console.log('shareId:', shareId);
console.log('apiBase:', apiBase);

// First get share data to get token
https.get(apiBase + '/share/' + shareId, (res) => {
    console.log('Share API Status:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const shareData = JSON.parse(data);
            console.log('Share Data:', JSON.stringify(shareData, null, 2));

            const token = shareData.token;
            const websiteId = shareData.websiteId;
            console.log('\nToken:', token);
            console.log('WebsiteId:', websiteId);

            // Now get stats with Bearer token
            const statsUrl = apiBase + '/websites/' + websiteId + '/stats?startAt=0&endAt=' + Date.now();
            console.log('\nStats URL:', statsUrl);

            const options = {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            };

            https.get(statsUrl, options, (res2) => {
                console.log('Stats API Status:', res2.statusCode);
                let statsData = '';
                res2.on('data', chunk => statsData += chunk);
                res2.on('end', () => {
                    console.log('Stats Response:', statsData);
                });
            }).on('error', (err) => {
                console.log('Stats Error:', err.message);
            });
        } catch (e) {
            console.log('Parse Error:', e.message);
            console.log('Raw data:', data);
        }
    });
}).on('error', (err) => {
    console.log('Share API Error:', err.message);
});