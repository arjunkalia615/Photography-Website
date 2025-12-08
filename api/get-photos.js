/**
 * Vercel Serverless Function
 * GET /api/get-photos
 * Returns all photos from the high-quality photos folder
 * Uses placeholder URLs (ready for BunnyCDN integration)
 */

const { getPhotos } = require('./utils');

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET method
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    try {
        const result = await getPhotos();
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(200).json({
                success: false,
                photos: [],
                message: result.message || 'Photos folder not found'
            });
        }
    } catch (error) {
        console.error('❌ Error in get-photos handler:', error);
        return res.status(500).json({
            error: 'Failed to get photos',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching photos.',
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack
            } : undefined
        });
    }
}

module.exports = handler;

