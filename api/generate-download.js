/**
 * Vercel Serverless Function
 * POST /api/generate-download
 * Generates a ZIP file containing duplicated images based on quantity
 * For testing immediate downloads without Stripe/PayPal
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const IMAGE_MAPPING = require('./image-mapping');

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST method is supported'
        });
    }

    try {
        // Parse request body
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseError) {
            return res.status(400).json({
                error: 'Invalid JSON',
                message: 'Request body must be valid JSON'
            });
        }

        const { itemId, quantity, imageSrc } = body;

        // Validate required parameters
        if (!itemId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'itemId is required'
            });
        }

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                error: 'Invalid quantity',
                message: 'quantity must be at least 1'
            });
        }

        // Determine file path from itemId or imageSrc
        let filePath = null;
        let mappedPath = null;

        // Priority 1: If imageSrc is provided, use it directly
        if (imageSrc) {
            let decodedPath = decodeURIComponent(imageSrc);
            const cleanPath = decodedPath.startsWith('/') 
                ? decodedPath.substring(1) 
                : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');
            const normalizedPath = cleanPath.replace(/\\/g, '/');
            filePath = path.join(process.cwd(), normalizedPath);
            mappedPath = normalizedPath;
        }
        // Priority 2: Try to find in image mapping using itemId
        else if (IMAGE_MAPPING[itemId]) {
            mappedPath = IMAGE_MAPPING[itemId];
            filePath = path.join(process.cwd(), mappedPath);
        }
        // Priority 3: Try to construct path from itemId as filename
        else {
            // User mentioned /public/photos/<itemId>.jpg, but images are in /Images/
            // Try multiple possible locations
            const possiblePaths = [
                path.join(process.cwd(), 'public', 'photos', `${itemId}.jpg`),
                path.join(process.cwd(), 'public', 'photos', `${itemId}.jpeg`),
                path.join(process.cwd(), 'Images', `${itemId}.jpg`),
                path.join(process.cwd(), 'Images', `${itemId}.jpeg`),
            ];

            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    filePath = possiblePath;
                    mappedPath = path.relative(process.cwd(), possiblePath);
                    break;
                }
            }
        }

        // If still not found, return error
        if (!filePath || !fs.existsSync(filePath)) {
            console.error(`❌ File not found for itemId: ${itemId}`);
            console.error(`📊 Debug info:`, {
                itemId: itemId,
                mappedPath: mappedPath,
                cwd: process.cwd(),
                checkedPaths: [
                    mappedPath ? path.join(process.cwd(), mappedPath) : 'N/A',
                    path.join(process.cwd(), 'public', 'photos', `${itemId}.jpg`),
                    path.join(process.cwd(), 'Images', `${itemId}.jpg`),
                ]
            });

            return res.status(404).json({
                error: 'File not found',
                message: `No image found for itemId: ${itemId}. Please ensure the image exists in /public/photos/ or is mapped in the image mapping.`,
                debug: process.env.NODE_ENV === 'development' ? {
                    itemId: itemId,
                    mappedPath: mappedPath,
                    cwd: process.cwd()
                } : undefined
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

        // Verify it's a file
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({
                error: 'Not a file',
                message: 'The requested path is not a file'
            });
        }

        // Get file extension and base name
        const fileExtension = path.extname(filePath);
        const baseFileName = path.basename(filePath, fileExtension);
        const fileNameWithoutExt = path.basename(filePath, fileExtension);

        // Create ZIP file with duplicated images
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${itemId}_x${quantity}.zip"`);
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

        // Add the file for each quantity (duplicate by quantity)
        for (let i = 1; i <= quantity; i++) {
            const copyFileName = `${fileNameWithoutExt}_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        // Finalize the archive
        await archive.finalize();

        console.log(`✅ ZIP archive created with ${quantity} copies: ${baseFileName}`);
        console.log(`📊 ItemId: ${itemId}, Quantity: ${quantity}, File: ${filePath}`);

    } catch (error) {
        console.error('❌ Error generating download:', error);
        
        // Don't send error if response already started (ZIP streaming)
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while generating the download.'
            });
        }
    }
}

module.exports = handler;

