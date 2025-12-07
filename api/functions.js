/**
 * Unified Vercel Serverless Function
 * Handles all API endpoints via action-based routing
 * 
 * Usage:
 * - GET/POST /api/functions?action=<actionName>
 * - Or POST with { action: "<actionName>", ... } in body
 * 
 * Supported actions:
 * - createSession: Create Stripe checkout session (LIVE MODE ONLY)
 * - getStripeKey: Get Stripe publishable key (LIVE MODE ONLY)
 * - getSessionDetails: Get Stripe session details
 * - getDownloadLinks: Get download links for purchased items (requires valid purchase)
 * - downloadFile: Download file for purchased items (requires valid purchase)
 * - generatePurchaseDownload: Generate ZIP immediately for purchased items (no verification delay)
 * - checkPurchaseFinal: Check if purchase is final
 * - checkWebhook: Debug endpoint to check webhook
 * - webhook: Stripe webhook handler (LIVE MODE ONLY)
 * - getPhotos: Get all photos from high_quality_photos folder (dynamic listing)
 */

const stripe = require('stripe');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const db = require('./db');
const IMAGE_MAPPING = require('./image-mapping');
const { getPhotoTitle } = require('./photo-titles');

// Load LQIP data if available
let LQIP_DATA = {};
let LQIP_LOAD_ERROR = null;
try {
    const lqipPath = path.join(__dirname, 'lqip-data.js');
    if (fs.existsSync(lqipPath)) {
        try {
            LQIP_DATA = require('./lqip-data');
            console.log(`✅ Loaded LQIP data: ${Object.keys(LQIP_DATA).length} placeholders`);
        } catch (requireError) {
            // If require fails, try reading as JSON instead
            console.warn('⚠️ require() failed for lqip-data.js, trying alternative method:', requireError.message);
            try {
                const lqipContent = fs.readFileSync(lqipPath, 'utf8');
                // Extract the JSON object from the file
                const jsonMatch = lqipContent.match(/const LQIP_DATA = ({[\s\S]*});/);
                if (jsonMatch) {
                    LQIP_DATA = JSON.parse(jsonMatch[1]);
                    console.log(`✅ Loaded LQIP data (alternative method): ${Object.keys(LQIP_DATA).length} placeholders`);
                } else {
                    throw new Error('Could not parse LQIP data from file');
                }
            } catch (parseError) {
                LQIP_LOAD_ERROR = parseError.message;
                console.error('❌ Failed to load LQIP data:', parseError.message);
                LQIP_DATA = {};
            }
        }
    } else {
        console.log('⚠️ LQIP data not found. Run generate-lqip.js to generate placeholders.');
    }
} catch (error) {
    LQIP_LOAD_ERROR = error.message;
    console.error('❌ Error loading LQIP data:', error.message);
    console.error('Stack:', error.stack);
    LQIP_DATA = {};
}

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

// Helper: Get Stripe instance (LIVE MODE ONLY)
function getStripeInstance() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
        throw new Error('Stripe secret key not configured. Please set STRIPE_SECRET_KEY environment variable.');
    }
    
    // Validate it's a live key (starts with sk_live_)
    if (!stripeSecretKey.startsWith('sk_live_')) {
        throw new Error('Invalid Stripe secret key. Only live keys (sk_live_...) are allowed in production.');
    }
    
    return stripe(stripeSecretKey);
}

// Helper: Get Stripe publishable key (LIVE MODE ONLY)
function getStripePublishableKey() {
    const expectedKey = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';
    const publishableKey = process.env[expectedKey];
    
    if (!publishableKey) {
        throw new Error(`Stripe publishable key not configured. Please set ${expectedKey} environment variable.`);
    }
    
    // Validate it's a live key (starts with pk_live_)
    if (!publishableKey.startsWith('pk_live_')) {
        throw new Error('Invalid Stripe publishable key. Only live keys (pk_live_...) are allowed in production.');
    }
    
    return publishableKey;
}

// Action: Create Stripe checkout session
async function handleCreateSession(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST method is supported' });
    }

    try {
        const stripeInstance = getStripeInstance();
        const body = parseBody(req);

        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return res.status(400).json({ error: 'Invalid request', message: 'Items array is required' });
        }

        for (const item of body.items) {
            if (!item.name || typeof item.price !== 'number' || item.price < 0) {
                return res.status(400).json({ error: 'Invalid request', message: 'Each item must have a name and valid price' });
            }
        }

        const productionDomain = 'https://www.ifeelworld.com';
        const successUrl = body.success_url || `${productionDomain}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = body.cancel_url || `${productionDomain}/payment-cancel.html`;
        const finalSuccessUrl = successUrl.includes('{CHECKOUT_SESSION_ID}') 
            ? successUrl 
            : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

        const lineItems = body.items.map(item => ({
            price_data: {
                currency: 'aud',
                product_data: {
                    name: item.name,
                    description: item.description || 'High-resolution digital photography print',
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity || 1,
        }));

        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: finalSuccessUrl,
            cancel_url: cancelUrl,
            locale: 'en',
            metadata: {
                order_type: 'digital_photo_download',
                website: 'ifeelworld.com',
                item_count: body.items.length.toString(),
                cart_items: JSON.stringify(body.items.map(item => ({
                    name: item.name,
                    title: item.title || item.name,
                    imageSrc: item.imageSrc || '',
                    productId: item.productId || item.id || null,
                    quantity: item.quantity || 1
                })))
            },
            customer_email: body.customer_email || undefined,
            receipt_email: body.customer_email || undefined,
            allow_promotion_codes: true,
            billing_address_collection: 'auto',
            payment_intent_data: {
                setup_future_usage: 'off_session'
            },
        });

        return res.status(200).json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

// Action: Get Stripe publishable key
async function handleGetStripeKey(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const publishableKey = getStripePublishableKey();
        return res.status(200).json({ publishableKey });
    } catch (error) {
        console.error('Error getting Stripe publishable key:', error);
        return res.status(500).json({
            error: 'Failed to get Stripe publishable key',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

// Action: Get session details
async function handleGetSessionDetails(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
            return res.status(400).json({ error: 'Missing parameter', message: 'session_id is required' });
        }

        const stripeInstance = getStripeInstance();
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items']
        });

        const customerEmail = session.customer_email || session.customer_details?.email;
        let cartItems = [];
        if (session.metadata && session.metadata.cart_items) {
            try {
                cartItems = JSON.parse(session.metadata.cart_items);
            } catch (parseError) {
                console.error('Error parsing cart_items:', parseError);
            }
        }

        const baseUrl = process.env.SITE_URL || 'https://www.ifeelworld.com';
        const downloadLinks = cartItems.map(item => {
            const imagePath = item.imageSrc || '';
            const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            const downloadUrl = `${baseUrl}/${cleanPath}`;
            
            return {
                title: item.title || item.name,
                downloadUrl: downloadUrl,
                imageSrc: imagePath
            };
        }).filter(item => item.downloadUrl && item.imageSrc);

        return res.status(200).json({
            sessionId: session.id,
            customerEmail: customerEmail,
            paymentStatus: session.payment_status,
            downloadLinks: downloadLinks,
            items: cartItems
        });
    } catch (error) {
        console.error('Error retrieving session details:', error);
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({ error: 'Invalid session', message: 'Session not found or invalid' });
        }
        return res.status(500).json({
            error: 'Failed to retrieve session details',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your order details.'
        });
    }
}

// Action: Get download links
async function handleGetDownloadLinks(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const sessionId = req.query.session_id;
        if (!sessionId) {
            return res.status(400).json({ error: 'Missing parameter', message: 'session_id is required' });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({ error: 'Invalid session ID', message: 'Invalid session ID format' });
        }

        const purchase = await db.getPurchase(sessionId);
        if (!purchase) {
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID.'
            });
        }

        const items = purchase.products || purchase.purchased_items || [];
        const downloads = await Promise.all(items.map(async (item) => {
            const productId = item.productId;
            const quantityPurchased = item.quantityPurchased || item.quantity || item.maxDownloads || item.max_downloads || 1;
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
                downloadUrl: `/api/functions?action=downloadFile&session_id=${encodeURIComponent(sessionId)}&productId=${encodeURIComponent(productId)}`
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
        console.error('Error getting download links:', error);
        return res.status(500).json({
            error: 'Failed to get download links',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your download links.'
        });
    }
}

// Action: Download file (purchased items)
async function handleDownloadFile(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const sessionId = req.query.session_id;
        const productId = req.query.productId;

        if (!sessionId || !productId) {
            return res.status(400).json({ error: 'Missing parameters', message: 'Both session_id and productId are required' });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({ error: 'Invalid session ID', message: 'Invalid session ID format' });
        }

        const purchase = await db.getPurchase(sessionId);
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found', message: 'No purchase found for this session ID' });
        }

        const items = purchase.products || purchase.purchased_items || [];
        const purchasedItem = items.find(item => item.productId === productId);
        if (!purchasedItem) {
            return res.status(403).json({ error: 'Product not found', message: 'This product was not part of your purchase' });
        }

        const isDownloaded = await db.isItemDownloaded(sessionId, productId);
        const quantityPurchased = purchasedItem.quantityPurchased || purchasedItem.quantity || purchasedItem.maxDownloads || purchasedItem.max_downloads || 1;

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
            return res.status(500).json({ error: 'Database error', message: 'Failed to update download status' });
        }

        const imageSrc = purchasedItem.imageSrc;
        if (!imageSrc) {
            return res.status(404).json({ error: 'File not found', message: 'File path not available for this product' });
        }

        const cleanPath = imageSrc.startsWith('/') ? imageSrc.substring(1) : imageSrc;
        const filePath = path.join(process.cwd(), cleanPath);

        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(projectRoot)) {
            return res.status(403).json({ error: 'Access denied', message: 'Invalid file path' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found', message: 'The requested file could not be found' });
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({ error: 'Not a file', message: 'The requested path is not a file' });
        }

        const baseFileName = purchasedItem.fileName || path.basename(filePath);
        const fileExtension = path.extname(baseFileName);
        const fileNameWithoutExt = path.basename(baseFileName, fileExtension);

        // Always serve as ZIP file
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

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', (error) => {
            console.error('❌ Error creating ZIP archive:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed', message: 'Error creating archive' });
            }
        });

        archive.pipe(res);

        for (let i = 1; i <= quantityPurchased; i++) {
            const copyFileName = `${fileNameWithoutExt}_copy_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        await archive.finalize();
        console.log(`✅ ZIP archive created with ${quantityPurchased} copies: ${baseFileName}`);
    } catch (error) {
        console.error('❌ Error downloading file:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while downloading the file.'
            });
        }
    }
}

// Action: Generate purchase download (immediate ZIP for purchased items)
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

        // Check if already downloaded using sessionId+productId as key
        const downloadKey = `purchase_download:${sessionId}:${productId}`;
        try {
            const redisClient = db.getRedis();
            const downloaded = await redisClient.get(downloadKey);
            
            if (downloaded === true || downloaded === 'true') {
                return res.status(403).json({
                    error: 'Already downloaded',
                    message: 'This item has already been downloaded. You can only download it once.'
                });
            }
        } catch (redisError) {
            console.error('❌ Redis error checking download status:', redisError);
            // Continue with download even if Redis check fails
        }

        // Determine file path
        let decodedPath = decodeURIComponent(imageSrc);
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
        
        // Security: Only allow downloads from High-Quality Photos folder
        if (!normalizedPath.includes('High-Quality Photos') && !normalizedPath.includes('high_quality_photos') && !normalizedPath.includes('High-Qaulity Photos')) {
            return res.status(403).json({ 
                error: 'Access denied', 
                message: 'Only photos from the High-Quality Photos folder can be downloaded' 
            });
        }
        
        const filePath = path.join(process.cwd(), normalizedPath);

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

        const fileExtension = path.extname(filePath);
        const baseFileName = path.basename(filePath, fileExtension);
        const fileNameWithoutExt = path.basename(filePath, fileExtension);

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

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', (error) => {
            console.error('❌ Error creating ZIP archive:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed', message: 'Error creating archive' });
            }
        });

        archive.pipe(res);

        // Add the file for each purchased copy
        for (let i = 1; i <= quantity; i++) {
            const copyFileName = `${fileNameWithoutExt}_copy_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        await archive.finalize();

        // Mark as downloaded in Redis using sessionId+productId
        try {
            const redisClient = db.getRedis();
            await redisClient.set(downloadKey, true);
            console.log(`✅ Marked purchase download in Redis: ${downloadKey}`);
        } catch (redisError) {
            console.error('❌ Error marking download in Redis:', redisError);
            // Don't fail the download if Redis fails
        }

        console.log(`✅ ZIP archive created with ${quantity} copies: ${baseFileName}`);
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

// REMOVED: Test download action - only live purchases allowed
// Action: Generate download (cart items - testing) - REMOVED
async function handleGenerateDownload_REMOVED(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST method is supported' });
    }

    try {
        const body = parseBody(req);
        const { itemId, quantity, imageSrc, title, userId } = body;

        if (!itemId) {
            return res.status(400).json({ error: 'Missing parameter', message: 'itemId is required' });
        }

        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Invalid quantity', message: 'quantity must be at least 1' });
        }

        // Check if already downloaded (if userId provided)
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

        // Determine file path
        let filePath = null;
        let mappedPath = null;

        if (imageSrc) {
            let decodedPath = decodeURIComponent(imageSrc);
            const cleanPath = decodedPath.startsWith('/') 
                ? decodedPath.substring(1) 
                : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');
            const normalizedPath = cleanPath.replace(/\\/g, '/');
            filePath = path.join(process.cwd(), normalizedPath);
            mappedPath = normalizedPath;
        } else if (IMAGE_MAPPING[itemId]) {
            mappedPath = IMAGE_MAPPING[itemId];
            filePath = path.join(process.cwd(), mappedPath);
        } else {
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

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({
                error: 'File not found',
                message: `No image found for itemId: ${itemId}`
            });
        }

        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(projectRoot)) {
            return res.status(403).json({ error: 'Access denied', message: 'Invalid file path' });
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({ error: 'Not a file', message: 'The requested path is not a file' });
        }

        const fileExtension = path.extname(filePath);
        const baseFileName = path.basename(filePath, fileExtension);
        const fileNameWithoutExt = path.basename(filePath, fileExtension);

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

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', (error) => {
            console.error('❌ Error creating ZIP archive:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed', message: 'Error creating archive' });
            }
        });

        archive.pipe(res);

        for (let i = 1; i <= quantity; i++) {
            const copyFileName = `${fileNameWithoutExt}_${i}${fileExtension}`;
            archive.file(filePath, { name: copyFileName });
        }

        await archive.finalize();

        // Mark as downloaded in Redis (if userId provided)
        if (userId) {
            try {
                const redisClient = db.getRedis();
                const redisKey = `cart_download:${userId}:${itemId}`;
                await redisClient.set(redisKey, true);
                console.log(`✅ Marked item as downloaded in Redis: ${redisKey}`);
            } catch (redisError) {
                console.error('❌ Error marking download in Redis:', redisError);
            }
        }

        console.log(`✅ ZIP archive created with ${quantity} copies: ${baseFileName}`);
    } catch (error) {
        console.error('❌ Error generating download:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while generating the download.'
            });
        }
    }
}

// REMOVED: Test cart download status - only live purchases allowed
// Action: Check cart download status - REMOVED
async function handleCheckCartDownloadStatus_REMOVED(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const { userId, itemId } = req.query;

        if (!userId || !itemId) {
            return res.status(400).json({ error: 'Missing parameters', message: 'Both userId and itemId are required' });
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

// Action: Check purchase final status
async function handleCheckPurchaseFinal(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({ error: 'Missing parameter', message: 'session_id is required' });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({ error: 'Invalid session ID', message: 'Invalid session ID format' });
        }

        const purchase = await db.getPurchase(sessionId);

        if (!purchase) {
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID',
                isFinal: false
            });
        }

        const isFinal = purchase.isFinal === true;

        return res.status(200).json({
            sessionId: sessionId,
            isFinal: isFinal,
            finalizedAt: purchase.finalizedAt || null,
            message: isFinal 
                ? 'Purchase is final - quantities cannot be modified'
                : 'Purchase is not final'
        });
    } catch (error) {
        console.error('❌ Error checking purchase final status:', error);
        return res.status(500).json({
            error: 'Check failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while checking purchase status.'
        });
    }
}

// Action: Check webhook (debug)
async function handleCheckWebhook(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({ error: 'session_id required' });
        }

        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({ error: 'Invalid session ID format' });
        }

        const purchase = await db.getPurchase(sessionId);

        return res.status(200).json({
            sessionId: sessionId,
            found: !!purchase,
            purchase: purchase || null,
            redisKey: `purchase:${sessionId}`
        });
    } catch (error) {
        console.error('Error checking webhook:', error);
        return res.status(500).json({
            error: 'Failed to check webhook',
            message: error.message
        });
    }
}

// Action: Get download link (test)
async function handleGetDownloadLink(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
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

        let filePath = null;
        let mappedPath = null;
        
        if (itemId) {
            mappedPath = IMAGE_MAPPING[itemId];
            if (!mappedPath) {
                return res.status(404).json({
                    error: 'Image not found',
                    message: `No image found for itemId: ${itemId}`
                });
            }
            filePath = path.join(process.cwd(), mappedPath);
        } else if (imageSrc) {
            let decodedPath = decodeURIComponent(imageSrc);
            const cleanPath = decodedPath.startsWith('/') 
                ? decodedPath.substring(1) 
                : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');
            const normalizedPath = cleanPath.replace(/\\/g, '/');
            filePath = path.join(process.cwd(), normalizedPath);
            mappedPath = normalizedPath;
        }

        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(process.cwd());
        if (!resolvedPath.startsWith(projectRoot)) {
            return res.status(403).json({ error: 'Access denied', message: 'Invalid file path' });
        }

        let finalFilePath = filePath;
        let fileFound = fs.existsSync(finalFilePath);
        
        if (!fileFound && mappedPath) {
            const alternatives = [
                filePath,
                path.join(process.cwd(), mappedPath.replace(/\//g, path.sep)),
                path.join(process.cwd(), mappedPath.replace(/\\/g, path.sep)),
                path.join(process.cwd(), mappedPath.replace(/^\//, '')),
                mappedPath.replace(/\//g, '\\'),
                mappedPath
            ];
            
            for (const altPath of alternatives) {
                if (fs.existsSync(altPath)) {
                    finalFilePath = altPath;
                    fileFound = true;
                    break;
                }
            }
        }
        
        if (!fileFound) {
            return res.status(404).json({
                error: 'File not found',
                message: 'The requested file could not be found on the server'
            });
        }

        filePath = finalFilePath;
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(404).json({ error: 'Not a file', message: 'The requested path is not a file' });
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (['.jpg', '.jpeg'].includes(ext)) {
            contentType = 'image/jpeg';
        } else if (ext === '.png') {
            contentType = 'image/png';
        } else if (ext === '.gif') {
            contentType = 'image/gif';
        }

        const fileName = path.basename(filePath);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (error) => {
            console.error('❌ Error streaming file:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed', message: 'Error reading file' });
            }
        });

        fileStream.pipe(res);
        console.log(`✅ Test download served: ${fileName}`);
    } catch (error) {
        console.error('❌ Error serving download link:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Download failed',
                message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while serving the file.'
            });
        }
    }
}

// Action: Webhook handler
async function handleWebhook(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only POST method is supported' });
    }

    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Webhook secret not configured'
            });
        }

        const signature = req.headers['stripe-signature'];
        if (!signature) {
            return res.status(400).json({
                error: 'Missing signature',
                message: 'Stripe signature header is required'
            });
        }

        const stripeInstance = getStripeInstance();

        let rawBody;
        if (typeof req.body === 'string') {
            rawBody = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
        } else {
            rawBody = JSON.stringify(req.body);
        }

        let event;
        try {
            event = stripeInstance.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err) {
            console.error('❌ Webhook signature verification failed:', err.message);
            return res.status(400).json({
                error: 'Invalid signature',
                message: 'Webhook signature verification failed'
            });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const sessionId = session.id;

            console.log(`✅ Webhook received for session ID: ${sessionId}`);

            const customerEmail = session.customer_email || session.customer_details?.email;
            
            if (!customerEmail) {
                return res.status(400).json({
                    error: 'Missing email',
                    message: 'Customer email not found in checkout session'
                });
            }

            let lineItems = [];
            try {
                const expandedSession = await stripeInstance.checkout.sessions.retrieve(sessionId, {
                    expand: ['line_items.data.price.product']
                });
                lineItems = expandedSession.line_items?.data || [];
            } catch (error) {
                console.error('❌ Error fetching line items:', error);
            }

            let cartItems = [];
            if (session.metadata && session.metadata.cart_items) {
                try {
                    cartItems = JSON.parse(session.metadata.cart_items);
                } catch (parseError) {
                    console.error('❌ Error parsing cart_items:', parseError);
                }
            }

            const purchasedItems = [];
            const downloadCount = {};

            if (lineItems.length > 0) {
                for (const lineItem of lineItems) {
                    const productName = lineItem.price?.product?.name || lineItem.description || 'Photo';
                    const quantity = lineItem.quantity || 1;
                    
                    const cartItem = cartItems.find(ci => 
                        ci.name === productName || 
                        ci.title === productName ||
                        (lineItem.price?.product?.metadata?.productId && ci.productId === lineItem.price.product.metadata.productId)
                    );
                    
                    const imageSrc = cartItem?.imageSrc || '';
                    const productId = cartItem?.productId || cartItem?.id || lineItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const fileName = imageSrc.split('/').pop() || `${productName.replace(/[^a-z0-9]/gi, '_')}.jpg`;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc,
                        title: productName,
                        quantity: quantity,
                        quantityPurchased: quantity,
                        max_downloads: quantity,
                        maxDownloads: quantity
                    });

                    downloadCount[productId] = 0;
                }
            } else if (cartItems.length > 0) {
                for (const cartItem of cartItems) {
                    const productId = cartItem.productId || cartItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const imageSrc = cartItem.imageSrc || '';
                    const fileName = imageSrc.split('/').pop() || `${(cartItem.title || cartItem.name).replace(/[^a-z0-9]/gi, '_')}.jpg`;
                    const quantity = cartItem.quantity || 1;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc,
                        title: cartItem.title || cartItem.name,
                        quantity: quantity,
                        quantityPurchased: quantity,
                        max_downloads: quantity,
                        maxDownloads: quantity
                    });

                    downloadCount[productId] = 0;
                }
            }

            const totalAllowedDownloads = purchasedItems.reduce((sum, item) => sum + item.max_downloads, 0);
            
            const purchaseData = {
                session_id: sessionId,
                email: customerEmail,
                customer_email: customerEmail,
                products: purchasedItems.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    fileName: item.fileName,
                    imageSrc: item.imageSrc,
                    quantity: item.quantity,
                    quantityPurchased: item.quantity,
                    maxDownloads: item.max_downloads,
                    max_downloads: item.max_downloads
                })),
                purchased_items: purchasedItems,
                quantity: purchasedItems.reduce((sum, item) => sum + item.quantity, 0),
                download_count: downloadCount,
                quantity_downloaded: {},
                downloaded: {},
                downloadsUsed: 0,
                maxDownloads: totalAllowedDownloads,
                allowedDownloads: totalAllowedDownloads,
                createdAt: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                payment_status: session.payment_status,
                isFinal: true,
                finalizedAt: new Date().toISOString(),
                lineItemsCount: lineItems.length,
                cartItemsCount: cartItems.length,
                purchasedItemsCount: purchasedItems.length
            };

            const saved = await db.savePurchase(sessionId, purchaseData);
            
            if (saved) {
                console.log(`✅ Saved purchase to Redis for: ${sessionId}`);
            } else {
                console.error(`❌ CRITICAL: Failed to save purchase for session ${sessionId}`);
            }

            return res.status(200).json({ received: true });
        }

        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('❌ Webhook error:', error);
        return res.status(500).json({
            error: 'Webhook processing failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred processing the webhook'
        });
    }
}

// Action: Get all photos from high_quality_photos folder
async function handleGetPhotos(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: 'Only GET method is supported' });
    }

    try {
        // Log LQIP status for debugging
        if (LQIP_LOAD_ERROR) {
            console.warn('⚠️ LQIP data had loading errors, continuing without placeholders:', LQIP_LOAD_ERROR);
        }
        // Try multiple folder name variations
        const possibleFolders = [
            path.join(process.cwd(), 'Images', 'High-Quality Photos'), // Correct spelling
            path.join(process.cwd(), 'Images', 'high_quality_photos'), // Underscore version
            path.join(process.cwd(), 'Images', 'High-Qaulity Photos') // Old typo version (backward compatibility)
        ];
        
        let photosFolder = null;
        for (const folder of possibleFolders) {
            if (fs.existsSync(folder)) {
                photosFolder = folder;
                break;
            }
        }
        
        // Check if folder exists
        if (!photosFolder) {
            console.warn(`⚠️ Photos folder not found. Tried: Images/High-Quality Photos, Images/high_quality_photos, and Images/High-Qaulity Photos`);
            return res.status(200).json({ success: false, photos: [], message: 'Photos folder not found' });
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

                // Get LQIP placeholder if available
                const placeholder = LQIP_DATA[lowResPath] || null;

                return {
                    productId: productId || `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    imageSrc: lowResPath,              // Low-res for gallery thumbnails
                    imageThumb: lowResPath,            // Low-res thumbnail
                    imageHQ: highQualityPath,          // High-quality for product page
                    placeholder: placeholder,         // LQIP base64 data URL (2-5 KB)
                    title: title,
                    filename: file,
                    category: 'Photography' // Default category, can be enhanced later
                };
            })
            .filter(photo => photo !== null) // Remove null entries
            .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title

        console.log(`✅ Found ${photos.length} photos in high_quality_photos folder`);
        
        // Count photos with placeholders
        const photosWithPlaceholders = photos.filter(p => p.placeholder).length;
        console.log(`📊 LQIP Status: ${photosWithPlaceholders}/${photos.length} photos have placeholders`);
        
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
                stack: error.stack,
                lqipError: LQIP_LOAD_ERROR
            } : undefined
        });
    }
}

// Main handler - routes to appropriate action
async function handler(req, res) {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

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
                message: 'action parameter is required. Use ?action=<actionName> or { action: "<actionName>" } in body.'
            });
        }

        // Route to appropriate handler
        switch (action) {
            case 'createSession':
                return await handleCreateSession(req, res);
            case 'getStripeKey':
                return await handleGetStripeKey(req, res);
            case 'getSessionDetails':
                return await handleGetSessionDetails(req, res);
            case 'getDownloadLinks':
                return await handleGetDownloadLinks(req, res);
            case 'downloadFile':
                return await handleDownloadFile(req, res);
            case 'generatePurchaseDownload':
                return await handleGeneratePurchaseDownload(req, res);
            case 'checkPurchaseFinal':
                return await handleCheckPurchaseFinal(req, res);
            case 'checkWebhook':
                return await handleCheckWebhook(req, res);
            case 'webhook':
                return await handleWebhook(req, res);
            case 'getPhotos':
                return await handleGetPhotos(req, res);
            default:
                return res.status(400).json({
                    error: 'Invalid action',
                    message: `Unknown action: ${action}. Supported actions: createSession, getStripeKey, getSessionDetails, getDownloadLinks, downloadFile, generatePurchaseDownload, checkPurchaseFinal, checkWebhook, webhook, getPhotos`
                });
        }
    } catch (error) {
        console.error('❌ Error in unified function:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

module.exports = handler;

