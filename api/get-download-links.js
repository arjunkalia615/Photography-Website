/**
 * Vercel Serverless Function
 * GET /api/get-download-links
 * Returns secure download information for purchased items
 * Validates session_id and returns download links with remaining download counts
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
        // Get session ID from query parameters
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required'
            });
        }

        // Validate session_id format (Stripe session IDs start with cs_)
        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format'
            });
        }

        // Get purchase from database
        const purchase = db.getPurchase(sessionId);

        if (!purchase) {
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID. The purchase may not have been processed yet, or the session ID is invalid.'
            });
        }

        // Build download information for each purchased item
        const downloadInfo = purchase.purchased_items.map(item => {
            const downloadCount = purchase.download_count[item.productId] || 0;
            const remainingDownloads = Math.max(0, item.max_downloads - downloadCount);
            const canDownload = remainingDownloads > 0;

            return {
                productId: item.productId,
                title: item.title,
                fileName: item.fileName,
                quantity: item.quantity,
                maxDownloads: item.max_downloads,
                downloadCount: downloadCount,
                remainingDownloads: remainingDownloads,
                canDownload: canDownload,
                // Secure download URL (points to download-file endpoint)
                downloadUrl: `/api/download-file?session_id=${encodeURIComponent(sessionId)}&productId=${encodeURIComponent(item.productId)}`
            };
        });

        // Return download information
        return res.status(200).json({
            sessionId: sessionId,
            customerEmail: purchase.customer_email,
            purchaseDate: purchase.timestamp,
            items: downloadInfo,
            totalItems: purchase.purchased_items.length
        });

    } catch (error) {
        console.error('Error getting download links:', error);
        return res.status(500).json({
            error: 'Failed to get download links',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your download links.'
        });
    }
}

module.exports = handler;

