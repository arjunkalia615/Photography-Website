/**
 * Vercel Serverless Function
 * POST /api/webhook
 * Handles Stripe webhook events, particularly checkout.session.completed
 * Saves purchase data to Upstash Redis for download tracking
 */

const stripe = require('stripe');
const db = require('./db');

// Helper: Check webhook status (debug endpoint)
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

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Support both GET (check webhook) and POST (webhook handler)
    if (req.method === 'GET') {
        // Check if this is a webhook check request
        if (req.query && req.query.action === 'check' || req.query.session_id) {
            return await handleCheckWebhook(req, res);
        }
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'GET method only supported for webhook check. Use ?action=check&session_id=...'
        });
    }

    // Only allow POST method for webhook events
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST method is supported for webhook events'
        });
    }

    try {
        // Get Stripe webhook secret from environment
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            console.error('❌ STRIPE_WEBHOOK_SECRET is not set');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Webhook secret not configured'
            });
        }

        // Get Stripe signature from headers
        const signature = req.headers['stripe-signature'];
        
        if (!signature) {
            return res.status(400).json({
                error: 'Missing signature',
                message: 'Stripe signature header is required'
            });
        }

        // Determine which Stripe key to use (LIVE or TEST)
        const useTestMode = process.env.USE_TEST_STRIPE === 'true';
        const stripeSecretKey = useTestMode 
            ? process.env.STRIPE_SECRET_KEY_TEST 
            : process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            console.error(`❌ Stripe secret key not configured (mode: ${useTestMode ? 'TEST' : 'LIVE'})`);
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Stripe secret key not configured'
            });
        }

        const stripeInstance = stripe(stripeSecretKey);

        // For Vercel, get raw body from request
        let rawBody;
        if (typeof req.body === 'string') {
            rawBody = req.body;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
        } else {
            rawBody = JSON.stringify(req.body);
        }

        // Verify webhook signature
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

        // Handle checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const sessionId = session.id; // Exact session ID from Stripe

            console.log(`✅ Webhook received for session ID: ${sessionId}`);
            console.log(`📦 Event type: ${event.type}`);
            console.log(`🔍 Session details:`, {
                id: sessionId,
                payment_status: session.payment_status,
                customer_email: session.customer_email || session.customer_details?.email,
                has_metadata: !!session.metadata,
                metadata_keys: session.metadata ? Object.keys(session.metadata) : []
            });

            // Extract customer email (REQUIRED)
            const customerEmail = session.customer_email || session.customer_details?.email;
            
            if (!customerEmail) {
                console.error(`❌ No customer email found in session ${sessionId}`);
                return res.status(400).json({
                    error: 'Missing email',
                    message: 'Customer email not found in checkout session'
                });
            }

            // Fetch line items from Stripe (expanded to get full product details)
            let lineItems = [];
            try {
                const expandedSession = await stripeInstance.checkout.sessions.retrieve(sessionId, {
                    expand: ['line_items.data.price.product']
                });
                lineItems = expandedSession.line_items?.data || [];
                console.log(`📋 Retrieved ${lineItems.length} line items for session ${sessionId}`);
            } catch (error) {
                console.error('❌ Error fetching line items:', error);
            }

            // Extract cart items from Redis (using temp_cart_key from metadata)
            // This avoids Stripe's 500-character metadata limit
            let cartItems = [];
            
            // Try session-based key first
            if (session.metadata && session.metadata.temp_cart_key) {
                try {
                    const tempCartData = await db.getPurchase(session.metadata.temp_cart_key);
                    if (tempCartData && tempCartData.cartItems) {
                        cartItems = tempCartData.cartItems;
                        console.log(`📋 Retrieved ${cartItems.length} cart items from Redis (key: ${session.metadata.temp_cart_key})`);
                    }
                } catch (redisError) {
                    console.warn('⚠️ Could not retrieve cart items from Redis:', redisError);
                }
            }
            
            // Fallback: Try session ID directly
            if (cartItems.length === 0) {
                try {
                    const sessionCartData = await db.getPurchase(`temp_cart:${sessionId}`);
                    if (sessionCartData && sessionCartData.cartItems) {
                        cartItems = sessionCartData.cartItems;
                        console.log(`📋 Retrieved ${cartItems.length} cart items from Redis (session key)`);
                    }
                } catch (redisError) {
                    // Ignore
                }
            }
            
            // Fallback: Try to parse from old metadata format (for backward compatibility)
            if (cartItems.length === 0 && session.metadata && session.metadata.cart_items) {
                try {
                    cartItems = JSON.parse(session.metadata.cart_items);
                    console.log(`📋 Retrieved ${cartItems.length} cart items from metadata (legacy format)`);
                } catch (parseError) {
                    console.error('❌ Error parsing cart_items from metadata:', parseError);
                }
            }

            // Build purchased items array with productId, fileName, quantity
            const purchasedItems = [];
            const downloadCount = {};

            // Process line items or fallback to metadata
            if (lineItems.length > 0) {
                // Use line items from Stripe (more reliable)
                for (const lineItem of lineItems) {
                    const productName = lineItem.price?.product?.name || lineItem.description || 'Photo';
                    const quantity = lineItem.quantity || 1;
                    
                    // Find matching cart item to get imageSrc and productId
                    const cartItem = cartItems.find(ci => 
                        ci.name === productName || 
                        ci.title === productName ||
                        (lineItem.price?.product?.metadata?.productId && ci.productId === lineItem.price.product.metadata.productId)
                    );
                    
                    const imageSrc = cartItem?.imageSrc || '';
                    const imageHQ = cartItem?.imageHQ || imageSrc || ''; // Use HQ URL for downloads
                    const productId = cartItem?.productId || cartItem?.id || lineItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const fileName = (imageHQ || imageSrc).split('/').pop() || `${productName.replace(/[^a-z0-9]/gi, '_')}.jpg`;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc, // Low-res for display
                        imageHQ: imageHQ, // High-quality for downloads
                        title: productName,
                        quantity: quantity,
                        quantityPurchased: quantity, // Explicit quantity purchased
                        max_downloads: quantity, // Each quantity = 1 download
                        maxDownloads: quantity // Backward compatibility
                    });

                    downloadCount[productId] = 0;
                }
            } else if (cartItems.length > 0) {
                // Fallback: use cart items from metadata
                for (const cartItem of cartItems) {
                    const productId = cartItem.productId || cartItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const imageSrc = cartItem.imageSrc || '';
                    const imageHQ = cartItem.imageHQ || imageSrc || ''; // Use HQ URL for downloads
                    const fileName = (imageHQ || imageSrc).split('/').pop() || `${(cartItem.title || cartItem.name).replace(/[^a-z0-9]/gi, '_')}.jpg`;
                    const quantity = cartItem.quantity || 1;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc, // Low-res for display
                        imageHQ: imageHQ, // High-quality for downloads
                        title: cartItem.title || cartItem.name,
                        quantity: quantity,
                        quantityPurchased: quantity, // Explicit quantity purchased
                        max_downloads: quantity,
                        maxDownloads: quantity // Backward compatibility
                    });

                    downloadCount[productId] = 0;
                }
            }

            // ALWAYS save purchase to Upstash Redis, even if items are empty
            // This ensures the purchase record exists for the success page
            const totalAllowedDownloads = purchasedItems.reduce((sum, item) => sum + item.max_downloads, 0);
            
            const purchaseData = {
                session_id: sessionId, // Exact session ID
                email: customerEmail,
                customer_email: customerEmail, // Backward compatibility
                products: purchasedItems.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    fileName: item.fileName,
                    imageSrc: item.imageSrc, // Low-res for display
                    imageHQ: item.imageHQ, // High-quality for downloads
                    quantity: item.quantity,
                    quantityPurchased: item.quantity, // Explicit quantity purchased
                    maxDownloads: item.max_downloads,
                    max_downloads: item.max_downloads // Backward compatibility
                })),
                purchased_items: purchasedItems, // Backward compatibility
                quantity: purchasedItems.reduce((sum, item) => sum + item.quantity, 0),
                download_count: downloadCount, // Backward compatibility
                quantity_downloaded: {}, // Backward compatibility
                downloaded: {}, // New: simple boolean tracking per product (productId -> true/false)
                downloadsUsed: 0, // Total downloads used across all products
                maxDownloads: totalAllowedDownloads,
                allowedDownloads: totalAllowedDownloads,
                createdAt: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                payment_status: session.payment_status,
                // Debug info
                lineItemsCount: lineItems.length,
                cartItemsCount: cartItems.length,
                purchasedItemsCount: purchasedItems.length
            };

            // Log before saving
            console.log(`💾 Attempting to save purchase for session: ${sessionId}`, {
                purchasedItemsCount: purchasedItems.length,
                lineItemsCount: lineItems.length,
                cartItemsCount: cartItems.length,
                customerEmail: customerEmail,
                redisKey: `purchase:${sessionId}`
            });

            // AWAIT the Redis write to guarantee it completes
            const saved = await db.savePurchase(sessionId, purchaseData);
            
            if (saved) {
                console.log(`✅ Saved purchase to Redis for: ${sessionId}`, {
                    itemsCount: purchasedItems.length,
                    customerEmail: customerEmail,
                    mode: useTestMode ? 'TEST' : 'LIVE',
                    redisKey: `purchase:${sessionId}`
                });
                console.log(`🔑 Redis key: purchase:${sessionId}`);
            } else {
                console.error(`❌ CRITICAL: Failed to save purchase for session ${sessionId} - Redis write failed`);
                console.error(`🔑 Redis key attempted: purchase:${sessionId}`);
                console.error(`📊 Purchase data:`, JSON.stringify(purchaseData, null, 2));
                // Still return success to Stripe, but log the error
            }

            if (purchasedItems.length === 0) {
                console.warn(`⚠️ WARNING: No purchased items found for session ${sessionId}`, {
                    lineItemsCount: lineItems.length,
                    cartItemsCount: cartItems.length,
                    hasMetadata: !!session.metadata,
                    metadataKeys: session.metadata ? Object.keys(session.metadata) : []
                });
            }

            // Return success to Stripe
            return res.status(200).json({ received: true });
        }

        // Handle other event types (log but don't error)
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

module.exports = handler;
