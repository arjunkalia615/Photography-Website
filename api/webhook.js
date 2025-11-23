/**
 * Vercel Serverless Function
 * POST /api/webhook
 * Handles Stripe webhook events, particularly checkout.session.completed
 * Saves purchase data to Vercel KV for download tracking
 */

const stripe = require('stripe');
const db = require('./db');

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

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
            const sessionId = session.id;

            console.log(`✅ Webhook received for session ID: ${sessionId}`);
            console.log(`📦 Event type: ${event.type}`);

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

            // Extract cart items from metadata (fallback if line_items unavailable)
            let cartItems = [];
            if (session.metadata && session.metadata.cart_items) {
                try {
                    cartItems = JSON.parse(session.metadata.cart_items);
                    console.log(`📋 Retrieved ${cartItems.length} cart items from metadata`);
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
                    const productId = cartItem?.productId || cartItem?.id || lineItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const fileName = imageSrc.split('/').pop() || `${productName.replace(/[^a-z0-9]/gi, '_')}.jpg`;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc,
                        title: productName,
                        quantity: quantity,
                        max_downloads: quantity // Each quantity = 1 download
                    });

                    downloadCount[productId] = 0;
                }
            } else if (cartItems.length > 0) {
                // Fallback: use cart items from metadata
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
                        max_downloads: quantity
                    });

                    downloadCount[productId] = 0;
                }
            }

            // Save purchase to Vercel KV (REQUIRED for download system)
            if (purchasedItems.length > 0) {
                const purchaseData = {
                    session_id: sessionId,
                    customer_email: customerEmail,
                    purchased_items: purchasedItems,
                    download_count: downloadCount,
                    timestamp: new Date().toISOString(),
                    payment_status: session.payment_status,
                    // Additional fields for download tracking
                    allowedDownloads: purchasedItems.reduce((sum, item) => sum + item.max_downloads, 0),
                    downloadsUsed: 0
                };

                const saved = await db.savePurchase(sessionId, purchaseData);
                if (saved) {
                    console.log(`✅ Saved purchase for: ${sessionId}`, {
                        itemsCount: purchasedItems.length,
                        customerEmail: customerEmail,
                        mode: useTestMode ? 'TEST' : 'LIVE'
                    });
                } else {
                    console.error(`❌ Failed to save purchase for session ${sessionId} - KV write failed`);
                    // Still return success to Stripe, but log the error
                }
            } else {
                console.warn(`⚠️ No purchased items found for session ${sessionId}`);
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
