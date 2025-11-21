// Explicitly set Node.js runtime (required for accessing environment variables)
// Edge runtime cannot access secure environment variables like STRIPE_SECRET_KEY

// Note: Stripe instance is initialized inside the handler function
// to dynamically select the correct key based on USE_TEST_STRIPE flag
const stripe = require('stripe');

/**
 * Vercel Serverless Function
 * POST /api/create-checkout-session
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
 *   "customer_email": "customer@example.com",
 *   "success_url": "https://www.ifeelworld.com/payment-success.html",
 *   "cancel_url": "https://www.ifeelworld.com/payment-cancel.html"
 * }
 */

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        // Determine which Stripe key to use based on USE_TEST_STRIPE flag
        const useTestMode = process.env.USE_TEST_STRIPE === 'true';
        const stripeSecretKey = useTestMode 
            ? process.env.STRIPE_SECRET_KEY_TEST 
            : process.env.STRIPE_SECRET_KEY;
        
        const mode = useTestMode ? 'TEST' : 'LIVE';

        // Validate Stripe secret key is set
        if (!stripeSecretKey) {
            const expectedKey = useTestMode ? 'STRIPE_SECRET_KEY_TEST' : 'STRIPE_SECRET_KEY';
            console.error(`${expectedKey} environment variable is not set`);
            console.error('Available environment variables with "STRIPE":', 
                Object.keys(process.env).filter(k => k.includes('STRIPE')));
            return res.status(500).json({
                error: 'Server configuration error',
                message: `Stripe secret key not configured. Please set ${expectedKey} environment variable in Vercel.`,
                debug: {
                    mode: mode,
                    expectedKey: expectedKey,
                    hint: `Check that the variable name is exactly "${expectedKey}" (case-sensitive, no spaces)`,
                    availableStripeVars: Object.keys(process.env).filter(k => k.includes('STRIPE'))
                }
            });
        }
        
        // Initialize Stripe with the correct key based on USE_TEST_STRIPE flag
        const stripeInstance = stripe(stripeSecretKey);

        // Parse request body
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseError) {
            console.error('Error parsing request body:', parseError);
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Request body must be valid JSON'
            });
        }

        // Validate items array
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Items array is required and must not be empty'
            });
        }

        // Validate each item
        for (const item of body.items) {
            if (!item.name || typeof item.price !== 'number' || item.price <= 0) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Each item must have a name and a valid price greater than 0'
                });
            }
        }

        // Get success and cancel URLs (use production domain by default)
        const productionDomain = 'https://www.ifeelworld.com';
        const successUrl = body.success_url || `${productionDomain}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = body.cancel_url || `${productionDomain}/payment-cancel.html`;

        // Ensure success_url includes the session_id placeholder
        const finalSuccessUrl = successUrl.includes('{CHECKOUT_SESSION_ID}') 
            ? successUrl 
            : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

        // Convert items to Stripe line_items format
        const lineItems = body.items.map(item => ({
            price_data: {
                currency: 'aud', // Australian Dollars
                product_data: {
                    name: item.name,
                    description: item.description || 'High-resolution digital photography print',
                },
                unit_amount: Math.round(item.price * 100), // Convert to cents
            },
            quantity: item.quantity || 1,
        }));

        // Create Stripe Checkout Session
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment', // For one-time payments
            
            // Success and cancel URLs
            success_url: finalSuccessUrl,
            cancel_url: cancelUrl,
            
            // Locale setting - prevents "Cannot find module './en'" error
            // Explicitly set to 'en' to avoid locale detection issues
            locale: 'en',
            
            // Metadata (useful for tracking)
            metadata: {
                order_type: 'digital_photo_download',
                website: 'ifeelworld.com',
                item_count: body.items.length.toString()
            },
            
            // Customer email collection (if provided)
            customer_email: body.customer_email || undefined,
            
            // Allow promotion codes
            allow_promotion_codes: true,
            
            // Billing address collection
            billing_address_collection: 'auto',
        });

        // Return the session ID for redirect
        return res.status(200).json({
            id: session.id
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        
        // Handle Stripe-specific errors
        if (error.type === 'StripeCardError') {
            return res.status(400).json({
                error: 'Payment error',
                message: error.message
            });
        }
        
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                error: 'Invalid request',
                message: error.message
            });
        }

        // Generic error response
        return res.status(500).json({
            error: 'Failed to create checkout session',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request. Please try again.'
        });
    }
}

// Export the handler function
module.exports = handler;

