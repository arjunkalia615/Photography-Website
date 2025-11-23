/**
 * Vercel Serverless Function
 * GET /api/get-download-links
 * Returns secure download information for purchased items from Upstash Redis
 * Fetches purchase using exact session ID from Stripe checkout
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
        // Get session ID from query parameters (exact session ID from Stripe)
        const sessionId = req.query.session_id;

        // Validate session_id is provided
        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required'
            });
        }

        // Validate session_id format (Stripe session IDs start with cs_)
        if (!sessionId.startsWith('cs_')) {
            console.error(`❌ Invalid session ID format: ${sessionId}`);
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format. Session ID must start with "cs_"'
            });
        }

        // Fetch purchase from Redis using exact session ID
        const purchase = await db.getPurchase(sessionId);

        // Return 404 only if purchase truly does not exist
        if (!purchase) {
            console.log(`⚠️ Purchase not found in Redis for session: ${sessionId}`);
            console.log(`🔑 Redis key checked: purchase:${sessionId}`);
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID. The purchase may not have been processed yet, or the session ID is invalid.'
            });
        }
        
        console.log(`✅ Purchase found in Redis for session: ${sessionId}`, {
            itemsCount: purchase.purchased_items?.length || purchase.products?.length || 0,
            customerEmail: purchase.customer_email || purchase.email,
            redisKey: `purchase:${sessionId}`
        });

        // Use products array if available, fallback to purchased_items
        const items = purchase.products || purchase.purchased_items || [];
        
        // Build download information for each purchased item
        const downloads = items.map(item => {
            const productId = item.productId;
            const maxDownloads = item.maxDownloads || item.max_downloads || item.quantity || 1;
            const downloadCount = purchase.download_count?.[productId] || 0;
            const remainingDownloads = Math.max(0, maxDownloads - downloadCount);
            const canDownload = remainingDownloads > 0;

            return {
                productId: productId,
                title: item.title,
                fileName: item.fileName,
                quantity: item.quantity || 1,
                maxDownloads: maxDownloads,
                downloadCount: downloadCount,
                remainingDownloads: remainingDownloads,
                canDownload: canDownload,
                // Secure download URL (points to download-file endpoint)
                downloadUrl: `/api/download-file?session_id=${encodeURIComponent(sessionId)}&productId=${encodeURIComponent(productId)}`
            };
        });

        // Return JSON with purchase, downloads, and quantity
        const response = {
            purchase: {
                sessionId: sessionId,
                email: purchase.customer_email || purchase.email,
                purchaseDate: purchase.timestamp || purchase.createdAt,
                paymentStatus: purchase.payment_status
            },
            downloads: downloads,
            quantity: purchase.quantity || items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        };

        console.log(`✅ Download links returned for session: ${sessionId}`, {
            downloadsCount: downloads.length,
            redisKey: `purchase:${sessionId}`
        });

        return res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error getting download links:', error);
        return res.status(500).json({
            error: 'Failed to get download links',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your download links.'
        });
    }
}

module.exports = handler;
