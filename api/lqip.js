/**
 * LQIP (Low Quality Image Placeholder) API Endpoint
 * Serves LQIP data on-demand to avoid bundling in serverless function
 */

const fs = require('fs');
const path = require('path');

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const lqipPath = path.join(__dirname, 'lqip-data.js');
        
        if (!fs.existsSync(lqipPath)) {
            return res.status(200).json({ success: true, data: {} });
        }

        // Read and parse LQIP data
        const lqipContent = fs.readFileSync(lqipPath, 'utf8');
        
        // Extract the JSON object from the file
        const jsonMatch = lqipContent.match(/const LQIP_DATA = ({[\s\S]*});/);
        
        if (jsonMatch) {
            const lqipData = JSON.parse(jsonMatch[1]);
            return res.status(200).json({
                success: true,
                data: lqipData,
                count: Object.keys(lqipData).length
            });
        } else {
            // Try as module export
            try {
                delete require.cache[require.resolve('./lqip-data')];
                const lqipData = require('./lqip-data');
                const data = lqipData.LQIP_DATA || lqipData;
                return res.status(200).json({
                    success: true,
                    data: data,
                    count: Object.keys(data).length
                });
            } catch (e) {
                return res.status(200).json({ success: true, data: {} });
            }
        }
    } catch (error) {
        console.error('Error loading LQIP data:', error);
        return res.status(200).json({ success: true, data: {} });
    }
}

module.exports = handler;

