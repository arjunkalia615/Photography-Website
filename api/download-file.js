/**
 * Vercel Serverless Function
 * GET /api/download-file
 * Secure file download endpoint with download limit enforcement
 * Validates session_id and productId, checks download limits in Redis, and serves file
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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

        // Check if item has already been downloaded (boolean check)
        const isDownloaded = await db.isItemDownloaded(sessionId, productId);
        const quantityPurchased = purchasedItem.quantityPurchased || purchasedItem.quantity || purchasedItem.maxDownloads || purchasedItem.max_downloads || 1;

        // If item has already been downloaded, prevent further downloads
        if (isDownloaded) {
            console.warn(`⚠️ Item already downloaded for session ${sessionId}, product ${productId}`);
            console.log(`🔑 Redis key: purchase:${sessionId}`);
            return res.status(403).json({
                error: 'Item already downloaded',
                message: `This item has already been downloaded. You purchased ${quantityPurchased} copy/copies and they have been delivered.`,
                quantityPurchased: quantityPurchased,
                downloaded: true
            });
        }

        // Mark item as downloaded BEFORE serving file (atomic operation)
        // This ensures user can only download once
        const marked = await db.markItemAsDownloaded(sessionId, productId);
        if (!marked) {
            console.error(`❌ Failed to mark item as downloaded for session ${sessionId}, product ${productId}`);
            console.error(`🔑 Redis key: purchase:${sessionId}`);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to update download status'
            });
        }

        console.log(`✅ Item marked as downloaded for ${productId}`);
        console.log(`📥 Download serving ${quantityPurchased} copy/copies for session: ${sessionId}, product: ${productId}`);
        console.log(`🔑 Redis key: purchase:${sessionId}`);

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

        const baseFileName = purchasedItem.fileName || path.basename(filePath);
        const fileExtension = path.extname(baseFileName);
        const fileNameWithoutExt = path.basename(baseFileName, fileExtension);

        // Always serve as ZIP file (even for quantity = 1) for consistency
        // ZIP contains exact number of copies based on purchased quantity
        const sanitizedTitle = purchasedItem.title 
            ? purchasedItem.title
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '')
                .substring(0, 100)
            : fileNameWithoutExt;
        
        const zipFilename = quantityPurchased > 1 
            ? `${sanitizedTitle}_x${quantityPurchased}.zip`
            : `${sanitizedTitle}.zip`;
        
        // Create ZIP file with all purchased copies
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Create ZIP archive with no compression for maximum quality
        const archive = archiver('zip', {
            zlib: { level: 0 } // No compression - store files as-is
        });

        archive.on('error', (error) => {
            console.error('❌ Error creating ZIP archive:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Download failed',
                    message: 'Error creating archive'
                });
            }
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add the file for each purchased copy
        for (let i = 1; i <= quantityPurchased; i++) {
            const copyFileName = `${fileNameWithoutExt}_copy_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        // Finalize the archive
        await archive.finalize();

            console.log(`✅ ZIP archive created with ${quantityPurchased} copies: ${baseFileName}`);
            console.log(`📊 Session: ${sessionId}, Product: ${productId}, All ${quantityPurchased} copies served in ZIP`);

        // Log successful download
        console.log(`📊 Session: ${sessionId}, Product: ${productId}, Item marked as downloaded (${quantityPurchased} copy/copies served)`);
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
