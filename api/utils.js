/**
 * Unified Utility Functions
 * Combines database, image mapping, photo titles, and photo listing functionality
 * 
 * Usage:
 * - GET /api/utils?action=getPhotos
 * 
 * Also exports helper functions for use in other API files:
 * - db: Database functions (getPurchase, savePurchase, etc.)
 * - IMAGE_MAPPING: Image ID to file path mapping
 * - getPhotoTitle: Get title from photo filename
 */

const fs = require('fs');
const path = require('path');

// Import database functions
const db = require('./db');

// Import image mapping
const IMAGE_MAPPING = require('./image-mapping');

// Import photo title helper
const { getPhotoTitle } = require('./photo-titles');

// Helper: Get action from query or body
function getAction(req) {
    // Try query parameter first
    if (req.query && req.query.action) {
        return req.query.action;
    }
    // Try body
    if (req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (body.action) {
            return body.action;
        }
    }
    return null;
}

// Helper: Parse request body
function parseBody(req) {
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (e) {
            return {};
        }
    }
    return req.body || {};
}

// Action: Get all photos from high-quality photos folder
async function handleGetPhotos(req, res) {
    try {
        // Try multiple possible folder names (handle typos and variations)
        const possibleFolders = [
            path.join(process.cwd(), 'Images', 'High-Quality Photos'), // Correct spelling
            path.join(process.cwd(), 'Images', 'high_quality_photos'), // Alternative spelling
            path.join(process.cwd(), 'Images', 'High-Qaulity Photos'), // Common typo
        ];
        
        let photosFolder = null;
        for (const folder of possibleFolders) {
            if (fs.existsSync(folder)) {
                photosFolder = folder;
                console.log(`✅ Found photos folder: ${folder}`);
                break;
            }
        }
        
        if (!photosFolder) {
            console.warn(`⚠️ Photos folder not found. Tried: Images/High-Quality Photos, Images/high_quality_photos, and Images/High-Qaulity Photos`);
            return res.status(404).json({
                error: 'Photos folder not found',
                message: 'The photos folder could not be located on the server.'
            });
        }

        // Read all files from the folder
        const files = fs.readdirSync(photosFolder);
        
        // Filter for image files only
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const photos = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            })
            .map(file => {
                const filePath = path.join(photosFolder, file);
                const stats = fs.statSync(filePath);
                
                // Only include actual files (not directories)
                if (!stats.isFile()) {
                    return null;
                }

                // Use the actual folder name found (could be high_quality_photos or High-Qaulity Photos)
                const folderName = path.basename(photosFolder);
                const highQualityPath = `Images/${folderName}/${file}`;
                
                // Normalize extension to lowercase for low-res path (handles .JPG vs .jpg)
                const ext = path.extname(file);
                const baseFileName = path.basename(file, ext);
                const normalizedFileName = baseFileName + ext.toLowerCase();
                const lowResPath = `Images/LowResImages/${normalizedFileName}`;
                
                const baseName = path.basename(file, ext);
                
                // Generate a product ID from the filename (unchanged - based on filename)
                const productId = baseName.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                
                // Get descriptive title from mapping or generate from filename
                const title = getPhotoTitle(file, baseName);

                // Use placeholder URLs instead of local paths (images will be served from BunnyCDN)
                const placeholderLowRes = `https://via.placeholder.com/800?text=${encodeURIComponent(title)}`;
                const placeholderHighRes = `https://via.placeholder.com/2000?text=${encodeURIComponent(title)}`;
                
                return {
                    productId: productId || `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    imageSrc: placeholderLowRes,              // Placeholder for gallery thumbnails
                    imageThumb: placeholderLowRes,            // Placeholder thumbnail
                    imageHQ: placeholderHighRes,          // Placeholder for product page
                    title: title,
                    filename: file,
                    category: 'Photography' // Default category, can be enhanced later
                };
            })
            .filter(photo => photo !== null) // Remove null entries
            .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title

        console.log(`✅ Found ${photos.length} photos in high_quality_photos folder`);
        
        return res.status(200).json({
            success: true,
            photos: photos,
            count: photos.length
        });
    } catch (error) {
        console.error('❌ Error getting photos:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({
            error: 'Failed to get photos',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching photos.',
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack
            } : undefined
        });
    }
}

// Main handler - routes to appropriate action
async function handler(req, res) {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get action from query or body
        const action = getAction(req);

        if (!action) {
            return res.status(400).json({
                error: 'Missing action',
                message: 'action parameter is required. Use ?action=getPhotos'
            });
        }

        // Route to appropriate handler
        switch (action) {
            case 'getPhotos':
                return await handleGetPhotos(req, res);
            default:
                return res.status(400).json({
                    error: 'Invalid action',
                    message: `Unknown action: ${action}. Supported actions: getPhotos`
                });
        }
    } catch (error) {
        console.error('❌ Error in utils function:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

// Export handler and utility functions
module.exports = handler;
module.exports.db = db;
module.exports.IMAGE_MAPPING = IMAGE_MAPPING;
module.exports.getPhotoTitle = getPhotoTitle;

