/**
 * Vercel Serverless Function
 * GET /api/download-file
 * Secure file download endpoint with download limit enforcement
 * Validates session_id and productId, checks download limits in Redis, and serves file
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');

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
        // Get parameters
        const sessionId = req.query.session_id;
        const productId = req.query.productId;

        if (!sessionId || !productId) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both session_id and productId are required'
            });
        }

        // Validate session_id format
        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format'
            });
        }

        // Get purchase from Upstash Redis
        const purchase = await db.getPurchase(sessionId);

        if (!purchase) {
            console.error(`❌ Purchase not found in Redis for session: ${sessionId}`);
            console.error(`🔑 Redis key checked: purchase:${sessionId}`);
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID'
            });
        }

        console.log(`🔍 Download request for session: ${sessionId}, product: ${productId}`);
        console.log(`🔑 Redis key: purchase:${sessionId}`);

        // Find the purchased item (check both products and purchased_items arrays)
        const items = purchase.products || purchase.purchased_items || [];
        const purchasedItem = items.find(item => item.productId === productId);

        if (!purchasedItem) {
            console.error(`❌ Product ${productId} not found in purchase ${sessionId}`);
            return res.status(403).json({
                error: 'Product not found',
                message: 'This product was not part of your purchase'
            });
        }

        // Check download limit BEFORE incrementing
        const currentDownloadCount = purchase.download_count?.[purchasedItem.productId] || 0;
        const maxDownloads = purchasedItem.maxDownloads || purchasedItem.max_downloads || purchasedItem.quantity || 1;

        if (currentDownloadCount >= maxDownloads) {
            console.warn(`⚠️ Download limit reached for session ${sessionId}, product ${productId}: ${currentDownloadCount}/${maxDownloads}`);
            return res.status(403).json({
                error: 'Download limit reached',
                message: `Download limit reached for this item. You have downloaded this item ${currentDownloadCount} time(s) out of ${maxDownloads} allowed.`,
                downloadCount: currentDownloadCount,
                maxDownloads: maxDownloads
            });
        }

        // Increment download count in Redis BEFORE serving file (atomic operation)
        const incremented = await db.incrementDownloadCount(sessionId, productId);
        if (!incremented) {
            console.error(`❌ Failed to increment download count for session ${sessionId}, product ${productId}`);
            console.error(`🔑 Redis key: purchase:${sessionId}`);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to update download count'
            });
        }

        console.log(`✅ Download count incremented in Redis: ${currentDownloadCount + 1}/${maxDownloads} for ${productId}`);
        console.log(`🔑 Redis key: purchase:${sessionId}`);
        console.log(`📥 Download occurred for session: ${sessionId}, product: ${productId}`);

        // Get file path
        const imageSrc = purchasedItem.imageSrc;
        if (!imageSrc) {
            return res.status(404).json({
                error: 'File not found',
                message: 'File path not available for this product'
            });
        }

        // Construct full file path
        const cleanPath = imageSrc.startsWith('/') ? imageSrc.substring(1) : imageSrc;
        const filePath = path.join(process.cwd(), cleanPath);

        // Security: Prevent directory traversal attacks
        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(projectRoot)) {
            console.error(`🚫 Directory traversal attempt detected: ${filePath}`);
            return res.status(403).json({
                error: 'Access denied',
                message: 'Invalid file path'
            });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            return res.status(404).json({
                error: 'File not found',
                message: 'The requested file could not be found on the server'
            });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({
                error: 'Not a file',
                message: 'The requested path is not a file'
            });
        }

        // Set headers for file download (no compression, high quality)
        const fileName = purchasedItem.fileName || path.basename(filePath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Stream the file (no compression, full quality)
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (error) => {
            console.error('❌ Error streaming file:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Download failed',
                    message: 'Error reading file'
                });
            }
        });

        fileStream.pipe(res);

        // Log successful download
        console.log(`✅ File downloaded successfully: ${fileName}`);
        console.log(`📊 Session: ${sessionId}, Product: ${productId}, Count: ${currentDownloadCount + 1}/${maxDownloads}`);
        console.log(`🔑 Redis key: purchase:${sessionId}`);

    } catch (error) {
        console.error('❌ Error downloading file:', error);
        
        // Don't send error if response already started (file streaming)
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while downloading the file.'
            });
        }
    }
}

module.exports = handler;
