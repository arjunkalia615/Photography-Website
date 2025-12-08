/**
 * Unified Vercel Serverless Function for Download Operations
 * Handles all download-related endpoints via action-based routing
 * 
 * Usage:
 * - GET/POST /api/download?action=<actionName>
 * 
 * Supported actions:
 * - status: Check cart download status (GET)
 * - file: Download file for purchased items (GET)
 * - generate: Generate ZIP for cart items (POST)
 * - link: Get single download link (GET)
 * - links: Get all download links for a session (GET)
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const IMAGE_MAPPING = require('./image-mapping');

// Helper: Get action from query or body
function getAction(req) {
    if (req.query && req.query.action) {
        return req.query.action;
    }
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

// Action: Check cart download status
async function handleStatus(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    try {
        const { userId, itemId } = req.query;

        if (!userId || !itemId) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both userId and itemId are required'
            });
        }

        const redisKey = `cart_download:${userId}:${itemId}`;
        
        try {
            const redisClient = db.getRedis();
            const downloaded = await redisClient.get(redisKey);
            
            return res.status(200).json({
                itemId: itemId,
                userId: userId,
                downloaded: downloaded === true || downloaded === 'true',
                timestamp: downloaded ? new Date().toISOString() : null
            });
        } catch (redisError) {
            console.error('❌ Redis error checking download status:', redisError);
            return res.status(200).json({
                itemId: itemId,
                userId: userId,
                downloaded: false,
                error: 'Redis unavailable, allowing download'
            });
        }
    } catch (error) {
        console.error('❌ Error checking cart download status:', error);
        return res.status(500).json({
            error: 'Check failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while checking download status.'
        });
    }
}

// Action: Download file for purchased items
async function handleFile(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    try {
        const sessionId = req.query.session_id;
        const productId = req.query.productId;

        if (!sessionId || !productId) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both session_id and productId are required'
            });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format'
            });
        }

        const purchase = await db.getPurchase(sessionId);

        if (!purchase) {
            console.error(`❌ Purchase not found in Redis for session: ${sessionId}`);
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID'
            });
        }

        const items = purchase.products || purchase.purchased_items || [];
        const purchasedItem = items.find(item => item.productId === productId);

        if (!purchasedItem) {
            return res.status(403).json({
                error: 'Product not found',
                message: 'This product was not part of your purchase'
            });
        }

        const isDownloaded = await db.isItemDownloaded(sessionId, productId);
        const quantityPurchased = purchasedItem.quantityPurchased || purchasedItem.quantity || 1;

        if (isDownloaded) {
            return res.status(403).json({
                error: 'Item already downloaded',
                message: `This item has already been downloaded. You purchased ${quantityPurchased} copy/copies and they have been delivered.`,
                quantityPurchased: quantityPurchased,
                downloaded: true
            });
        }

        const marked = await db.markItemAsDownloaded(sessionId, productId);
        if (!marked) {
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to update download status'
            });
        }

        // Note: File serving logic removed - images now served from BunnyCDN
        // This endpoint now returns download information instead of serving files
        return res.status(200).json({
            success: true,
            message: 'Download authorized',
            productId: productId,
            imageSrc: purchasedItem.imageSrc,
            title: purchasedItem.title,
            quantityPurchased: quantityPurchased,
            note: 'Images are served from BunnyCDN. Use the imageSrc URL to download.'
        });
    } catch (error) {
        console.error('❌ Error downloading file:', error);
        return res.status(500).json({
            error: 'Download failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while downloading the file.'
        });
    }
}

// Action: Generate ZIP for cart items
async function handleGenerate(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST method is supported'
        });
    }

    try {
        const body = parseBody(req);
        const { itemId, quantity, imageSrc, title, userId } = body;

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

        if (userId) {
            try {
                const redisClient = db.getRedis();
                const redisKey = `cart_download:${userId}:${itemId}`;
                const downloaded = await redisClient.get(redisKey);
                
                if (downloaded === true || downloaded === 'true') {
                    return res.status(403).json({
                        error: 'Already downloaded',
                        message: 'This item has already been downloaded. You can only download it once.'
                    });
                }
            } catch (redisError) {
                console.error('❌ Redis error checking download status:', redisError);
            }
        }

        // Note: File generation removed - images now served from BunnyCDN
        // This endpoint now returns download information
        return res.status(200).json({
            success: true,
            message: 'Download information',
            itemId: itemId,
            quantity: quantity,
            imageSrc: imageSrc,
            title: title,
            note: 'Images are served from BunnyCDN. Use the imageSrc URL to download.'
        });
    } catch (error) {
        console.error('❌ Error generating download:', error);
        return res.status(500).json({
            error: 'Download failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while generating the download.'
        });
    }
}

// Action: Get single download link
async function handleLink(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    try {
        const itemId = req.query.itemId;
        const imageSrc = req.query.imageSrc;

        if (!itemId && !imageSrc) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'itemId or imageSrc query parameter is required'
            });
        }

        // Note: File serving removed - images now served from BunnyCDN
        let downloadUrl = null;
        if (imageSrc) {
            downloadUrl = imageSrc.startsWith('http') ? imageSrc : `https://cdn.example.com/${imageSrc}`;
        } else if (itemId && IMAGE_MAPPING[itemId]) {
            const mappedPath = IMAGE_MAPPING[itemId];
            downloadUrl = `https://cdn.example.com/${mappedPath}`;
        }

        if (!downloadUrl) {
            return res.status(404).json({
                error: 'Image not found',
                message: `No image found for itemId: ${itemId || 'N/A'}`
            });
        }

        return res.status(200).json({
            itemId: itemId,
            downloadUrl: downloadUrl,
            note: 'Images are served from BunnyCDN. Update the CDN URL in the code.'
        });
    } catch (error) {
        console.error('❌ Error serving download link:', error);
        return res.status(500).json({
            error: 'Download failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while serving the file.'
        });
    }
}

// Action: Get all download links for a session
async function handleLinks(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    try {
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required'
            });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format. Session ID must start with "cs_"'
            });
        }

        const purchase = await db.getPurchase(sessionId);

        if (!purchase) {
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID. The purchase may not have been processed yet, or the session ID is invalid.'
            });
        }

        const items = purchase.products || purchase.purchased_items || [];
        
        const downloads = await Promise.all(items.map(async (item) => {
            const productId = item.productId;
            const quantityPurchased = item.quantityPurchased || item.quantity || 1;
            const downloaded = purchase.downloaded?.[productId] === true;
            const canDownload = !downloaded;

            return {
                productId: productId,
                title: item.title,
                fileName: item.fileName,
                quantity: item.quantity || 1,
                quantityPurchased: quantityPurchased,
                downloaded: downloaded,
                canDownload: canDownload,
                maxDownloads: quantityPurchased,
                downloadCount: downloaded ? quantityPurchased : 0,
                remainingDownloads: downloaded ? 0 : quantityPurchased,
                downloadUrl: `/api/download?action=file&session_id=${encodeURIComponent(sessionId)}&productId=${encodeURIComponent(productId)}`,
                imageSrc: item.imageSrc // BunnyCDN URL
            };
        }));

        return res.status(200).json({
            purchase: {
                sessionId: sessionId,
                email: purchase.customer_email || purchase.email,
                purchaseDate: purchase.timestamp || purchase.createdAt,
                paymentStatus: purchase.payment_status
            },
            downloads: downloads,
            quantity: purchase.quantity || items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        });
    } catch (error) {
        console.error('❌ Error getting download links:', error);
        return res.status(500).json({
            error: 'Failed to get download links',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your download links.'
        });
    }
}

// Main handler
async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const action = getAction(req);

        if (!action) {
            return res.status(400).json({
                error: 'Missing action',
                message: 'action parameter is required. Use ?action=<actionName> or { action: "<actionName>" } in body.'
            });
        }

        switch (action) {
            case 'status':
                return await handleStatus(req, res);
            case 'file':
                return await handleFile(req, res);
            case 'generate':
            case 'generatePurchaseDownload':
                return await handleGenerate(req, res);
            case 'link':
                return await handleLink(req, res);
            case 'links':
                return await handleLinks(req, res);
            default:
                return res.status(400).json({
                    error: 'Invalid action',
                    message: `Unknown action: ${action}. Supported actions: status, file, generate, link, links`
                });
        }
    } catch (error) {
        console.error('❌ Error in download handler:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

module.exports = handler;

