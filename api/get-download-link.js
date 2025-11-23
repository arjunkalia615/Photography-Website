/**
 * Vercel Serverless Function
 * GET /api/get-download-link
 * Serves files directly for testing purposes (bypasses Stripe checkout)
 * Accepts itemId as query parameter and serves the file from Images folder
 */

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
        // Get itemId from query parameters
        const itemId = req.query.itemId;
        const imageSrc = req.query.imageSrc; // Optional: direct image path

        if (!itemId && !imageSrc) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'itemId or imageSrc query parameter is required'
            });
        }

        // If imageSrc is provided, use it directly
        let filePath;
        if (imageSrc) {
            // Normalize path (remove ../ and ./)
            const cleanPath = imageSrc.startsWith('/') 
                ? imageSrc.substring(1) 
                : imageSrc.replace(/^\.\.\//, '').replace(/^\.\//, '');
            filePath = path.join(process.cwd(), cleanPath);
        } else {
            // For itemId, we'd need to look up the item from cart
            // For now, return error - imageSrc is preferred
            return res.status(400).json({
                error: 'Invalid parameter',
                message: 'imageSrc parameter is required for direct file access'
            });
        }

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

        // Determine content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (['.jpg', '.jpeg'].includes(ext)) {
            contentType = 'image/jpeg';
        } else if (ext === '.png') {
            contentType = 'image/png';
        } else if (ext === '.gif') {
            contentType = 'image/gif';
        }

        // Get filename for download
        const fileName = path.basename(filePath);

        // Set headers for file download (no compression, high quality)
        res.setHeader('Content-Type', contentType);
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
        console.log(`✅ Test download served: ${fileName}`);
        console.log(`📁 File path: ${filePath}`);

    } catch (error) {
        console.error('❌ Error serving download link:', error);
        
        // Don't send error if response already started (file streaming)
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while serving the file.'
            });
        }
    }
}

module.exports = handler;

