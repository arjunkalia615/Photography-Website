/**
 * Unified Download Functions
 * Handles all download-related operations via action-based routing
 * 
 * Usage:
 * - GET /api/download?action=checkCartDownloadStatus&userId=...&itemId=...
 * - GET /api/download?action=downloadFile&session_id=...&productId=...
 * - GET /api/download?action=getDownloadLink&itemId=... or &imageSrc=...
 * - GET /api/download?action=getDownloadLinks&session_id=...
 * - POST /api/download?action=generateDownload (body: { itemId, quantity, imageSrc, title, userId })
 * 
 * Supported actions:
 * - checkCartDownloadStatus: Check if a cart item has been downloaded
 * - downloadFile: Download file for purchased items (requires valid purchase)
 * - generateDownload: Generate ZIP immediately for testing (bypasses Stripe)
 * - getDownloadLink: Get download link for testing (bypasses Stripe)
 * - getDownloadLinks: Get download links for purchased items (requires valid purchase)
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const IMAGE_MAPPING = require('./image-mapping');

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

// Action: Check cart download status
async function handleCheckCartDownloadStatus(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const { userId, itemId } = req.query;

        if (!userId || !itemId) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Both userId and itemId are required'
            });
        }

        // Check download status in Redis
        // Key format: cart_download:{userId}:{itemId}
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
            // If Redis fails, assume not downloaded (allow download)
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
async function handleDownloadFile(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
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

        // Get file path - handle both local paths and external URLs (BunnyCDN)
        // Prefer imageHQ (high-quality) for downloads, fallback to imageSrc
        let imageSrc = purchasedItem.imageHQ || purchasedItem.imageSrc;
        if (!imageSrc) {
            return res.status(404).json({
                error: 'File not found',
                message: 'File path not available for this product'
            });
        }

        // If imageSrc is an external URL (BunnyCDN), redirect to it
        if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
            // Redirect to external URL for download (HQ image from BunnyCDN)
            res.setHeader('Location', imageSrc);
            return res.status(302).end();
        }

        // Legacy local path handling
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

        // Serve all purchased copies at once
        // If quantityPurchased > 1, create ZIP with all copies
        // If quantityPurchased = 1, serve single file
        if (quantityPurchased > 1) {
            // Create ZIP file with all purchased copies
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fileNameWithoutExt}_${quantityPurchased}_copies.zip"`);
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
        } else {
            // Single file download
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', `attachment; filename="${baseFileName}"`);
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

            console.log(`✅ File downloaded successfully: ${baseFileName}`);
        }

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

// Action: Get download link (for testing - bypasses Stripe)
async function handleGetDownloadLink(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
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

        // If imageSrc is an external URL (BunnyCDN), redirect to it
        if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'))) {
            res.setHeader('Location', imageSrc);
            return res.status(302).end();
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

// Action: Get download links for purchased items
async function handleGetDownloadLinks(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        // Get session ID from query parameters (exact session ID from Stripe)
        const sessionId = req.query.session_id;

        // Validate session_id is provided
        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required'
            });
        }

        // Validate session_id format (Stripe session IDs start with cs_)
        if (!sessionId.startsWith('cs_')) {
            console.error(`❌ Invalid session ID format: ${sessionId}`);
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format. Session ID must start with "cs_"'
            });
        }

        // Fetch purchase from Redis using exact session ID
        const purchase = await db.getPurchase(sessionId);

        // Return 404 only if purchase truly does not exist
        if (!purchase) {
            console.log(`⚠️ Purchase not found in Redis for session: ${sessionId}`);
            console.log(`🔑 Redis key checked: purchase:${sessionId}`);
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID. The purchase may not have been processed yet, or the session ID is invalid.'
            });
        }
        
        console.log(`✅ Purchase found in Redis for session: ${sessionId}`, {
            itemsCount: purchase.purchased_items?.length || purchase.products?.length || 0,
            customerEmail: purchase.customer_email || purchase.email,
            redisKey: `purchase:${sessionId}`
        });

        // Use products array if available, fallback to purchased_items
        const items = purchase.products || purchase.purchased_items || [];
        
        // Build download information for each purchased item (boolean downloaded flag)
        const downloads = await Promise.all(items.map(async (item) => {
            const productId = item.productId;
            const quantityPurchased = item.quantityPurchased || item.quantity || item.maxDownloads || item.max_downloads || 1;
            
            // Check if item has been downloaded (boolean flag)
            const downloaded = purchase.downloaded?.[productId] === true;
            
            // Can download only if not already downloaded
            const canDownload = !downloaded;

            return {
                productId: productId,
                title: item.title,
                fileName: item.fileName,
                quantity: item.quantity || 1,
                quantityPurchased: quantityPurchased, // Quantity purchased
                downloaded: downloaded, // Boolean: has item been downloaded?
                canDownload: canDownload, // Can download if not downloaded
                // Backward compatibility
                maxDownloads: quantityPurchased,
                downloadCount: downloaded ? quantityPurchased : 0,
                remainingDownloads: downloaded ? 0 : quantityPurchased,
                // Secure download URL (points to download endpoint)
                downloadUrl: `/api/download?action=downloadFile&session_id=${encodeURIComponent(sessionId)}&productId=${encodeURIComponent(productId)}`
            };
        }));

        // Return JSON with purchase, downloads, and quantity
        const response = {
            purchase: {
                sessionId: sessionId,
                email: purchase.customer_email || purchase.email,
                purchaseDate: purchase.timestamp || purchase.createdAt,
                paymentStatus: purchase.payment_status
            },
            downloads: downloads,
            quantity: purchase.quantity || items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        };

        console.log(`✅ Download links returned for session: ${sessionId}`, {
            downloadsCount: downloads.length,
            redisKey: `purchase:${sessionId}`
        });

        return res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error getting download links:', error);
        return res.status(500).json({
            error: 'Failed to get download links',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your download links.'
        });
    }
}

// Action: Generate purchase download (for purchased items - immediate ZIP)
async function handleGeneratePurchaseDownload(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST method is supported' });
    }

    try {
        const body = parseBody(req);
        const { sessionId, productId, imageSrc, title, quantity } = body;

        if (!sessionId || !productId || !imageSrc || !quantity) {
            return res.status(400).json({ 
                error: 'Missing parameters', 
                message: 'sessionId, productId, imageSrc, and quantity are required' 
            });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({ error: 'Invalid session ID', message: 'Invalid session ID format' });
        }

        // Verify purchase exists and item is in purchase
        // Note: db.getPurchase() already adds 'purchase:' prefix, so pass sessionId directly
        try {
            const purchase = await db.getPurchase(sessionId);
            if (!purchase) {
                console.error(`❌ Purchase not found for session: ${sessionId}`);
                console.error(`🔑 Redis key checked: purchase:${sessionId}`);
                return res.status(404).json({
                    error: 'Purchase not found',
                    message: 'No purchase found for this session. Please contact support.'
                });
            }
            
            // Parse purchase data (Upstash Redis returns objects directly, but handle string case)
            let purchaseData;
            if (typeof purchase === 'string') {
                try {
                    purchaseData = JSON.parse(purchase);
                } catch (parseError) {
                    console.error('❌ Error parsing purchase data:', parseError);
                    return res.status(500).json({
                        error: 'Data format error',
                        message: 'Purchase data format is invalid.'
                    });
                }
            } else {
                purchaseData = purchase;
            }
            
            // Debug: Log purchase structure
            console.log(`🔍 Purchase data structure:`, {
                hasProducts: !!purchaseData.products,
                hasPurchasedItems: !!purchaseData.purchased_items,
                productsCount: purchaseData.products?.length || 0,
                purchasedItemsCount: purchaseData.purchased_items?.length || 0,
                sessionId: purchaseData.session_id,
                email: purchaseData.email || purchaseData.customer_email
            });
            
            const items = purchaseData.products || purchaseData.purchased_items || [];
            console.log(`🔍 Looking for productId: ${productId} in ${items.length} items`);
            
            const purchasedItem = items.find(item => {
                const itemProductId = item.productId || item.id;
                console.log(`  - Comparing: ${itemProductId} === ${productId}? ${itemProductId === productId}`);
                return itemProductId === productId;
            });
            
            if (!purchasedItem) {
                console.error(`❌ Product ${productId} not found in purchase. Available productIds:`, 
                    items.map(item => item.productId || item.id));
                return res.status(403).json({
                    error: 'Item not in purchase',
                    message: 'This item was not found in your purchase.'
                });
            }
            
            console.log(`✅ Found purchased item:`, {
                productId: purchasedItem.productId,
                title: purchasedItem.title,
                imageHQ: purchasedItem.imageHQ ? 'present' : 'missing',
                quantity: purchasedItem.quantity
            });
            
            // Check if already downloaded
            const downloadKey = `purchase_download:${sessionId}:${productId}`;
            const redisClient = db.getRedis();
            const downloaded = await redisClient.get(downloadKey);
            
            if (downloaded === 'true' || (purchaseData.downloaded && purchaseData.downloaded[productId])) {
                console.warn(`⚠️ Item already downloaded: ${productId}`);
                return res.status(403).json({
                    error: 'Already downloaded',
                    message: 'This item has already been downloaded. You can only download it once.'
                });
            }
        } catch (redisError) {
            console.error('❌ Redis error checking download status:', redisError);
            // Continue with download even if Redis check fails (fail open for better UX)
        }

        // If imageSrc is an external URL (BunnyCDN), fetch it and create ZIP
        let imageBuffer = null;
        let imageFileName = null;
        
        if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'))) {
            // Fetch image from BunnyCDN
            try {
                console.log(`📥 Fetching image from BunnyCDN: ${imageUrl}`);
                const https = require('https');
                const http = require('http');
                const url = require('url');
                
                const parsedUrl = new URL(imageUrl);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                
                imageBuffer = await new Promise((resolve, reject) => {
                    const request = client.get(imageUrl, (response) => {
                        if (response.statusCode !== 200) {
                            reject(new Error(`Failed to fetch image: ${response.statusCode}`));
                            return;
                        }
                        
                        const chunks = [];
                        response.on('data', (chunk) => chunks.push(chunk));
                        response.on('end', () => resolve(Buffer.concat(chunks)));
                        response.on('error', reject);
                    });
                    request.on('error', reject);
                    request.setTimeout(30000, () => {
                        request.destroy();
                        reject(new Error('Request timeout'));
                    });
                    });
                    request.on('error', reject);
                    request.setTimeout(30000, () => {
                        request.destroy();
                        reject(new Error('Request timeout'));
                    });
                });
                
                // Extract filename from URL
                const urlPath = parsedUrl.pathname;
                imageFileName = decodeURIComponent(urlPath.split('/').pop() || `${productId}.jpg`);
                console.log(`✅ Fetched image from BunnyCDN: ${imageFileName} (${imageBuffer.length} bytes)`);
            } catch (fetchError) {
                console.error('❌ Error fetching image from BunnyCDN:', fetchError);
                return res.status(500).json({
                    error: 'Failed to fetch image',
                    message: 'Could not download image from CDN. Please try again later.'
                });
            }
        }

        // Determine file path or use fetched image
        let filePath = null;
        let fileExtension = '.jpg';
        let baseFileName = null;
        let fileNameWithoutExt = null;
        
        if (imageBuffer) {
            // Use fetched image from BunnyCDN
            fileExtension = path.extname(imageFileName) || '.jpg';
            baseFileName = path.basename(imageFileName, fileExtension);
            fileNameWithoutExt = baseFileName;
        } else {
            // Local file path (fallback - should not happen with BunnyCDN)
            let decodedPath = decodeURIComponent(imageUrl);
            const cleanPath = decodedPath.startsWith('/') 
                ? decodedPath.substring(1) 
                : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');
            const normalizedPath = cleanPath.replace(/\\/g, '/');
            
            // Security: Prevent downloading banner photos
            if (normalizedPath.includes('banner_photos') || normalizedPath.includes('Banner Photo')) {
                return res.status(403).json({ 
                    error: 'Access denied', 
                    message: 'Banner photos are not available for download' 
                });
            }
            
            // Security: Only allow downloads from High-Quality Photos folder (legacy local paths)
            if (!normalizedPath.includes('High-Quality Photos') && !normalizedPath.includes('high_quality_photos') && !normalizedPath.includes('High-Qaulity Photos')) {
                return res.status(403).json({ 
                    error: 'Access denied', 
                    message: 'Only photos from the High-Quality Photos folder can be downloaded' 
                });
            }
            
            filePath = path.join(process.cwd(), normalizedPath);

            const resolvedPath = path.resolve(filePath);
            const projectRoot = path.resolve(process.cwd());
            if (!resolvedPath.startsWith(projectRoot)) {
                return res.status(403).json({ error: 'Access denied', message: 'Invalid file path' });
            }

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'File not found',
                    message: `No image found for the purchased item`
                });
            }

            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                return res.status(404).json({ error: 'Not a file', message: 'The requested path is not a file' });
            }

            fileExtension = path.extname(filePath);
            baseFileName = path.basename(filePath, fileExtension);
            fileNameWithoutExt = path.basename(filePath, fileExtension);
        }

        function sanitizeFilename(filename) {
            if (!filename) return 'Photo';
            return filename
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '')
                .substring(0, 100);
        }

        const sanitizedTitle = sanitizeFilename(title || baseFileName);
        const zipFilename = quantity > 1 
            ? `${sanitizedTitle}_x${quantity}.zip`
            : `${sanitizedTitle}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const archive = archiver('zip', {
            zlib: { level: 0 }
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

        archive.pipe(res);

        // Add images to ZIP (quantity copies)
        for (let i = 1; i <= quantity; i++) {
            const copyFileName = `${fileNameWithoutExt}_${i}${fileExtension}`;
            
            if (imageBuffer) {
                // Add fetched image buffer to ZIP
                archive.append(imageBuffer, { name: copyFileName });
            } else {
                // Add local file to ZIP
                archive.file(filePath, { name: copyFileName });
            }
        }

        await archive.finalize();

        // Mark item as downloaded in Redis (after successful ZIP creation)
        try {
            const redisClient = db.getRedis();
            await redisClient.set(downloadKey, 'true', { EX: 86400 * 365 }); // Expire after 1 year
            console.log(`✅ Marked purchase download in Redis: ${downloadKey}`);
            
            // Also update purchase record to mark item as downloaded
            const purchaseKey = `purchase:${sessionId}`;
            const purchase = await redisClient.get(purchaseKey);
            if (purchase) {
                const purchaseData = typeof purchase === 'string' ? JSON.parse(purchase) : purchase;
                if (!purchaseData.downloaded) {
                    purchaseData.downloaded = {};
                }
                purchaseData.downloaded[productId] = true;
                await redisClient.set(purchaseKey, JSON.stringify(purchaseData), { EX: 86400 * 365 });
                console.log(`✅ Updated purchase record: ${productId} marked as downloaded`);
            }
        } catch (redisError) {
            console.error('❌ Error marking download in Redis:', redisError);
        }

        console.log(`✅ ZIP archive created with ${quantity} copies: ${baseFileName || imageFileName}`);
        console.log(`📊 Session: ${sessionId}, Product: ${productId}, Source: ${imageBuffer ? 'BunnyCDN' : 'Local'}`);

    } catch (error) {
        console.error('❌ Error generating purchase download:', error);
        
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while generating the download.'
            });
        }
    }
}

// Action: Generate download (for testing - bypasses Stripe)
async function handleGenerateDownload(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST method is supported' });
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

        const { itemId, quantity, imageSrc, title, userId } = body;

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

        // Check if item has already been downloaded (if userId provided)
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
                // Continue with download if Redis check fails (fail open)
            }
        }

        // If imageSrc is an external URL (BunnyCDN), we can't generate ZIP from it
        // Return error or redirect to the URL
        if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'))) {
            return res.status(400).json({
                error: 'External URL not supported',
                message: 'Cannot generate ZIP from external URLs. Use direct download instead.'
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

        // Sanitize title for filename
        function sanitizeFilename(filename) {
            if (!filename) return 'Photo';
            return filename
                .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
                .substring(0, 100); // Limit length
        }

        const sanitizedTitle = sanitizeFilename(title || baseFileName);
        const zipFilename = quantity > 1 
            ? `${sanitizedTitle}_x${quantity}.zip`
            : `${sanitizedTitle}.zip`;

        // Create ZIP file with duplicated images
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

        // Add the file for each quantity (duplicate by quantity)
        for (let i = 1; i <= quantity; i++) {
            const copyFileName = `${fileNameWithoutExt}_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        // Finalize the archive
        await archive.finalize();

        // Mark item as downloaded in Redis (if userId provided)
        if (userId) {
            try {
                const redisClient = db.getRedis();
                const redisKey = `cart_download:${userId}:${itemId}`;
                // Set with no expiration (persists indefinitely)
                await redisClient.set(redisKey, true);
                console.log(`✅ Marked item as downloaded in Redis: ${redisKey}`);
            } catch (redisError) {
                console.error('❌ Error marking download in Redis:', redisError);
                // Don't fail the download if Redis fails
            }
        }

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
                message: 'action parameter is required. Use ?action=<actionName>'
            });
        }

        // Route to appropriate handler
        switch (action) {
            case 'checkCartDownloadStatus':
                return await handleCheckCartDownloadStatus(req, res);
            case 'downloadFile':
                return await handleDownloadFile(req, res);
            case 'generateDownload':
                return await handleGenerateDownload(req, res);
            case 'generatePurchaseDownload':
                return await handleGeneratePurchaseDownload(req, res);
            case 'getDownloadLink':
                return await handleGetDownloadLink(req, res);
            case 'getDownloadLinks':
                return await handleGetDownloadLinks(req, res);
            default:
                return res.status(400).json({
                    error: 'Invalid action',
                    message: `Unknown action: ${action}. Supported actions: checkCartDownloadStatus, downloadFile, generateDownload, generatePurchaseDownload, getDownloadLink, getDownloadLinks`
                });
        }
    } catch (error) {
        console.error('❌ Error in download function:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

module.exports = handler;

