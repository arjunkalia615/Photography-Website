/**
 * Vercel Serverless Function
 * GET /api/get-session-details
 * Retrieves Stripe checkout session details including purchased items
 * Used to display download links on success page
 */

const stripe = require('stripe');

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
        // Get session ID from query parameters
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id query parameter is required'
            });
        }

        // Determine which Stripe key to use
        const useTestMode = process.env.USE_TEST_STRIPE === 'true';
        const stripeSecretKey = useTestMode 
            ? process.env.STRIPE_SECRET_KEY_TEST 
            : process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            console.error('Stripe secret key not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Stripe secret key not configured'
            });
        }

        const stripeInstance = stripe(stripeSecretKey);

        // Retrieve the checkout session
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items']
        });

        // Extract customer email
        const customerEmail = session.customer_email || session.customer_details?.email;

        // Extract cart items from Redis (using temp_cart_key from metadata)
        // This avoids Stripe's 500-character metadata limit
        const db = require('./db');
        let cartItems = [];
        
        // Try to get cart items from Redis first
        if (session.metadata && session.metadata.temp_cart_key) {
            try {
                const tempCartData = await db.getPurchase(session.metadata.temp_cart_key);
                if (tempCartData && tempCartData.cartItems) {
                    cartItems = tempCartData.cartItems;
                    console.log(`✅ Retrieved ${cartItems.length} cart items from Redis`);
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
                    console.log(`✅ Retrieved ${cartItems.length} cart items from Redis (session key)`);
                }
            } catch (redisError) {
                // Ignore
            }
        }
        
        // Fallback: Try to get from purchase data stored by webhook
        if (cartItems.length === 0) {
            try {
                const purchaseData = await db.getPurchase(`purchase:${sessionId}`);
                if (purchaseData && purchaseData.products) {
                    // Convert purchase products back to cart items format
                    cartItems = purchaseData.products.map(product => ({
                        name: product.title,
                        title: product.title,
                        imageSrc: product.imageSrc || '',
                        imageHQ: product.imageHQ || product.imageSrc || '',
                        productId: product.productId,
                        quantity: product.quantity || 1
                    }));
                    console.log(`✅ Retrieved ${cartItems.length} items from purchase data`);
                }
            } catch (purchaseError) {
                console.warn('⚠️ Could not retrieve purchase data:', purchaseError);
            }
        }
        
        // Fallback: Try to parse from old metadata format (for backward compatibility)
        if (cartItems.length === 0 && session.metadata && session.metadata.cart_items) {
            try {
                cartItems = JSON.parse(session.metadata.cart_items);
                console.log(`✅ Retrieved ${cartItems.length} cart items from metadata (legacy format)`);
            } catch (parseError) {
                console.error('❌ Error parsing cart_items from metadata:', parseError);
            }
        }
        
        // If still no items, try to reconstruct from product_ids in metadata
        if (cartItems.length === 0 && session.metadata && session.metadata.product_ids) {
            try {
                const productIds = session.metadata.product_ids.split(',').filter(id => id);
                const lineItems = session.line_items?.data || [];
                
                // Load images.json to get URLs
                const fs = require('fs');
                const path = require('path');
                const imagesJsonPath = path.join(process.cwd(), 'data', 'images.json');
                
                if (fs.existsSync(imagesJsonPath)) {
                    const imagesData = JSON.parse(fs.readFileSync(imagesJsonPath, 'utf8'));
                    
                    for (const productId of productIds) {
                        const imageData = imagesData[productId];
                        const lineItem = lineItems.find(li => 
                            li.price?.product?.metadata?.productId === productId ||
                            li.price?.product?.name?.toLowerCase().replace(/\s+/g, '-') === productId
                        );
                        
                        if (imageData || lineItem) {
                            const productName = lineItem?.price?.product?.name || lineItem?.description || productId;
                            cartItems.push({
                                name: productName,
                                title: productName,
                                imageSrc: imageData?.low || '',
                                imageHQ: imageData?.hq || '',
                                productId: productId,
                                quantity: lineItem?.quantity || 1
                            });
                        }
                    }
                    console.log(`✅ Reconstructed ${cartItems.length} items from product_ids`);
                }
            } catch (reconstructError) {
                console.error('❌ Error reconstructing items from product_ids:', reconstructError);
            }
        }

        // Generate download links for purchased items
        const baseUrl = process.env.SITE_URL || 'https://www.ifeelworld.com';
        const items = cartItems.map(item => {
            // Use HQ URL for downloads
            const downloadUrl = item.imageHQ || item.imageSrc || '';
            
            return {
                title: item.title || item.name,
                name: item.name || item.title,
                downloadUrl: downloadUrl,
                imageSrc: item.imageSrc || '', // Low-res for display
                imageHQ: item.imageHQ || item.imageSrc || '', // High-quality for downloads
                productId: item.productId || item.id || null,
                quantity: item.quantity || 1
            };
        }).filter(item => item.downloadUrl); // Only include items with valid download URLs

        // Return session details
        return res.status(200).json({
            sessionId: session.id,
            customerEmail: customerEmail,
            paymentStatus: session.payment_status,
            downloadLinks: items.map(item => ({
                title: item.title,
                downloadUrl: item.downloadUrl,
                imageSrc: item.imageSrc
            })),
            items: items // Full items with all data
        });

    } catch (error) {
        console.error('Error retrieving session details:', error);
        
        // Handle Stripe-specific errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                error: 'Invalid session',
                message: 'Session not found or invalid'
            });
        }

        return res.status(500).json({
            error: 'Failed to retrieve session details',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while retrieving your order details.'
        });
    }
}

module.exports = handler;



