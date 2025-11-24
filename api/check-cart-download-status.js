/**
 * Vercel Serverless Function
 * GET /api/check-cart-download-status
 * Checks if a cart item has been downloaded (for immediate download feature)
 * Uses Redis to track download status per user and item
 */

const db = require('./db');

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
        const { userId, itemId } = req.query;

        if (!userId || !itemId) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both userId and itemId are required'
            });
        }

        // Check download status in Redis
        // Key format: cart_download:{userId}:{itemId}
        const redisKey = `cart_download:${userId}:${itemId}`;
        
        try {
            const redisClient = db.getRedis();
            const downloaded = await redisClient.get(redisKey);
            
            return res.status(200).json({
                itemId: itemId,
                userId: userId,
                downloaded: downloaded === true || downloaded === 'true',
                timestamp: downloaded ? new Date().toISOString() : null
            });
        } catch (redisError) {
            console.error('❌ Redis error checking download status:', redisError);
            // If Redis fails, assume not downloaded (allow download)
            return res.status(200).json({
                itemId: itemId,
                userId: userId,
                downloaded: false,
                error: 'Redis unavailable, allowing download'
            });
        }

    } catch (error) {
        console.error('❌ Error checking cart download status:', error);
        
        return res.status(500).json({
            error: 'Check failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while checking download status.'
        });
    }
}

module.exports = handler;

