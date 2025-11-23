/**
 * Vercel Serverless Function
 * GET /api/get-download-links
 * Returns secure download information for purchased items
 * Supports lookup by session_id or email (fallback)
 */

const db = require('./db');
const stripe = require('stripe');

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
        const email = req.query.email; // Optional fallback

        // If no session_id, try to get last purchase by email
        if (!sessionId && email) {
            console.log(`Looking up purchase by email: ${email}`);
            
            // Get all purchases and find by email
            const allPurchases = db.readDB();
            const purchases = Object.values(allPurchases)
                .filter(p => p.customer_email === email)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Most recent first
            
            if (purchases.length > 0) {
                const latestPurchase = purchases[0];
                console.log(`Found purchase by email: ${latestPurchase.session_id}`);
                
                // Return download info for latest purchase
                const downloadInfo = latestPurchase.purchased_items.map(item => {
                    const downloadCount = latestPurchase.download_count[item.productId] || 0;
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
                        downloadUrl: `/api/download-file?session_id=${encodeURIComponent(latestPurchase.session_id)}&productId=${encodeURIComponent(item.productId)}`
                    };
                });

                return res.status(200).json({
                    sessionId: latestPurchase.session_id,
                    customerEmail: latestPurchase.customer_email,
                    purchaseDate: latestPurchase.timestamp,
                    items: downloadInfo,
                    totalItems: latestPurchase.purchased_items.length
                });
            }
        }

        // Validate session_id if provided
        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required (or email for fallback)'
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
            console.log(`Purchase not found for session: ${sessionId}`);
            
            // Log database contents for debugging
            const allPurchases = db.readDB();
            const keys = Object.keys(allPurchases);
            console.log(`Total purchases in database: ${keys.length}`);
            if (keys.length > 0) {
                console.log(`Sample session IDs: ${keys.slice(0, 3).join(', ')}`);
            }
            
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID. The purchase may not have been processed yet, or the session ID is invalid.'
            });
        }
        
        console.log(`Purchase found for session: ${sessionId}`, {
            itemsCount: purchase.purchased_items?.length || 0,
            customerEmail: purchase.customer_email
        });

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
