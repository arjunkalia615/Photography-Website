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

// Action: Get all photos from images.json (BunnyCDN URLs)
async function handleGetPhotos(req, res) {
    try {
        // Load images from JSON file
        // Try multiple possible paths (Vercel deployment vs local development)
        const possiblePaths = [
            path.join(process.cwd(), 'data', 'images.json'),
            path.join(__dirname, '..', 'data', 'images.json'),
            path.join(process.cwd(), '..', 'data', 'images.json')
        ];
        
        let imagesJsonPath = null;
        for (const jsonPath of possiblePaths) {
            if (fs.existsSync(jsonPath)) {
                imagesJsonPath = jsonPath;
                console.log(`✅ Found images.json at: ${jsonPath}`);
                break;
            }
        }
        
        if (!imagesJsonPath) {
            console.error(`❌ images.json not found. Tried: ${possiblePaths.join(', ')}`);
            console.error(`Current working directory: ${process.cwd()}`);
            console.error(`__dirname: ${__dirname}`);
            return res.status(404).json({
                error: 'Images data not found',
                message: 'The images data file could not be located on the server.'
            });
        }

        // Read and parse JSON file
        const imagesData = JSON.parse(fs.readFileSync(imagesJsonPath, 'utf8'));
        console.log(`✅ Loaded ${Object.keys(imagesData).length} images from JSON`);
        
        // Convert JSON structure to photo array format
        const photos = Object.entries(imagesData).map(([productId, imageData]) => {
            // Extract title from productId (convert kebab-case to Title Case)
            const title = productId
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            // Get original filename from productId (for backward compatibility)
            const filename = `${productId}.jpg`;
            
            return {
                productId: productId,
                imageSrc: imageData.low,              // Low-res for gallery thumbnails
                imageThumb: imageData.low,            // Low-res thumbnail
                imageHQ: imageData.hq,                // High-quality for product page
                title: title,
                filename: filename,
                category: 'Photography'
            };
        }).sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title

        console.log(`✅ Loaded ${photos.length} photos from images.json`);
        
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

