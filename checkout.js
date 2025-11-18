const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files if needed

/**
 * POST /create-checkout-session
 * Creates a Stripe Checkout session for digital photo downloads
 * 
 * Expected request body:
 * {
 *   "items": [
 *     {
 *       "name": "Product Name",
 *       "description": "Product Description",
 *       "price": 0.99, // Price in AUD
 *       "quantity": 1
 *     }
 *   ],
 *   "success_url": "https://www.ifeelworld.com/payment-success.html",
 *   "cancel_url": "https://www.ifeelworld.com/payment-cancel.html"
 * }
 */
app.post('/create-checkout-session', async (req, res) => {
    try {
        // Validate Stripe secret key is set
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                error: 'Stripe secret key not configured. Please set STRIPE_SECRET_KEY environment variable.'
            });
        }

        // Get items from request body or use example items
        const items = req.body.items || [
            {
                name: 'Digital Photography Print - Beach',
                description: 'High-resolution digital photography print',
                price: 0.99,
                quantity: 1
            },
            {
                name: 'Digital Photography Print - Mountain Vista',
                description: 'High-resolution digital photography print',
                price: 0.99,
                quantity: 1
            }
        ];

        // Get success and cancel URLs from request or use defaults
        const successUrl = req.body.success_url || 'https://www.ifeelworld.com/payment-success.html';
        const cancelUrl = req.body.cancel_url || 'https://www.ifeelworld.com/payment-cancel.html';

        // Convert items to Stripe line_items format
        // Note: For digital products, we use price_data since we're creating the price on-the-fly
        // Alternatively, you can create Price objects in Stripe Dashboard and use price IDs
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'aud', // Australian Dollars
                product_data: {
                    name: item.name,
                    description: item.description || 'Digital photography print',
                    // Optional: Add images array if you have product images
                    // images: [item.image_url]
                },
                unit_amount: Math.round(item.price * 100), // Convert to cents
            },
            quantity: item.quantity || 1,
        }));

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment', // For one-time payments
            // For subscriptions, use 'subscription' mode
            
            // Success and cancel URLs
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl,
            
            // Metadata (optional - useful for tracking)
            metadata: {
                order_type: 'digital_photo_download',
                website: 'ifeelworld.com'
            },
            
            // Customer email collection
            customer_email: req.body.customer_email || undefined,
            
            // Shipping (not needed for digital products, but can be included if needed)
            // shipping_address_collection: {
            //     allowed_countries: ['AU', 'US', 'GB'],
            // },
            
            // Allow promotion codes
            allow_promotion_codes: true,
            
            // Billing address collection (optional)
            billing_address_collection: 'auto', // 'auto', 'required', or 'auto'
        });

        // Return the session URL for redirect
        res.json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
});

/**
 * GET /checkout-session/:sessionId
 * Retrieve checkout session details (optional - for verification)
 */
app.get('/checkout-session/:sessionId', async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({
                error: 'Stripe secret key not configured.'
            });
        }

        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        res.json(session);
    } catch (error) {
        console.error('Error retrieving checkout session:', error);
        res.status(500).json({
            error: 'Failed to retrieve checkout session',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Stripe Checkout endpoint: http://localhost:${PORT}/create-checkout-session`);
});

module.exports = app;

