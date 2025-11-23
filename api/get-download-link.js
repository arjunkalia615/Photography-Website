/**
 * Vercel Serverless Function
 * GET /api/get-download-link
 * Serves files directly for testing purposes (bypasses Stripe checkout)
 * Accepts itemId or imageSrc as query parameter and serves the file from Images folder
 */

const fs = require('fs');
const path = require('path');
const IMAGE_MAPPING = require('./image-mapping');

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
        // Get itemId or imageSrc from query parameters
        const itemId = req.query.itemId;
        const imageSrc = req.query.imageSrc; // Optional: direct image path

        if (!itemId && !imageSrc) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'itemId or imageSrc query parameter is required'
            });
        }

        // Determine file path
        let filePath;
        let mappedPath = null;
        
        if (itemId) {
            // Look up file path from mapping using itemId
            mappedPath = IMAGE_MAPPING[itemId];
            if (!mappedPath) {
                console.error(`❌ Item ID not found in mapping: ${itemId}`);
                return res.status(404).json({
                    error: 'Image not found',
                    message: `No image found for itemId: ${itemId}`
                });
            }
            filePath = path.join(process.cwd(), mappedPath);
        } else if (imageSrc) {
            // Decode URL-encoded path
            let decodedPath = decodeURIComponent(imageSrc);
            
            // Normalize path (remove ../ and ./)
            const cleanPath = decodedPath.startsWith('/') 
                ? decodedPath.substring(1) 
                : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');
            
            // Normalize path separators (handle both / and \)
            const normalizedPath = cleanPath.replace(/\\/g, '/');
            
            filePath = path.join(process.cwd(), normalizedPath);
            mappedPath = normalizedPath;
        }
        
        // Log the path resolution for debugging
        console.log(`🔍 Download request:`, {
            itemId: itemId || 'none',
            imageSrc: imageSrc || 'none',
            mappedPath: mappedPath,
            resolvedPath: filePath,
            cwd: process.cwd()
        });

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

        // Check if file exists - try multiple path formats
        let finalFilePath = filePath;
        let fileFound = fs.existsSync(finalFilePath);
        
        if (!fileFound && mappedPath) {
            // Try different path formats
            const alternatives = [
                // Original path
                filePath,
                // Normalize separators
                path.join(process.cwd(), mappedPath.replace(/\//g, path.sep)),
                path.join(process.cwd(), mappedPath.replace(/\\/g, path.sep)),
                // Try with leading slash removed
                path.join(process.cwd(), mappedPath.replace(/^\//, '')),
                // Try with Windows-style path
                mappedPath.replace(/\//g, '\\'),
                // Try direct path
                mappedPath
            ];
            
            for (const altPath of alternatives) {
                if (fs.existsSync(altPath)) {
                    finalFilePath = altPath;
                    fileFound = true;
                    console.log(`✅ Found file at alternative path: ${altPath}`);
                    break;
                }
            }
        }
        
        if (!fileFound) {
            console.error(`❌ File not found after trying all alternatives`);
            console.error(`📊 Debug info:`, {
                originalPath: filePath,
                mappedPath: mappedPath,
                itemId: itemId,
                imageSrc: imageSrc,
                cwd: process.cwd(),
                resolvedAbsolute: path.resolve(filePath),
                // Check if Images folder exists
                imagesFolderExists: fs.existsSync(path.join(process.cwd(), 'Images'))
            });
            
            return res.status(404).json({
                error: 'File not found',
                message: 'The requested file could not be found on the server',
                debug: process.env.NODE_ENV === 'development' ? {
                    requestedPath: filePath,
                    mappedPath: mappedPath,
                    cwd: process.cwd(),
                    itemId: itemId,
                    imageSrc: imageSrc
                } : undefined
            });
        }
        
        filePath = finalFilePath;

        // Get file stats
        let stats;
        try {
            stats = fs.statSync(filePath);
        } catch (statError) {
            console.error(`❌ Error getting file stats: ${statError.message}`);
            return res.status(404).json({
                error: 'File not accessible',
                message: 'The requested file could not be accessed',
                debug: process.env.NODE_ENV === 'development' ? statError.message : undefined
            });
        }
        
        if (!stats.isFile()) {
            console.error(`❌ Path is not a file: ${filePath}`);
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

