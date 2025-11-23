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

        // Extract cart items from metadata
        let cartItems = [];
        if (session.metadata && session.metadata.cart_items) {
            try {
                cartItems = JSON.parse(session.metadata.cart_items);
            } catch (parseError) {
                console.error('Error parsing cart_items from metadata:', parseError);
            }
        }

        // Generate download links for purchased items
        const baseUrl = process.env.SITE_URL || 'https://www.ifeelworld.com';
        const downloadLinks = cartItems.map(item => {
            const imagePath = item.imageSrc || '';
            // Ensure path doesn't start with / to avoid double slashes
            const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            const downloadUrl = `${baseUrl}/${cleanPath}`;
            
            return {
                title: item.title || item.name,
                downloadUrl: downloadUrl,
                imageSrc: imagePath
            };
        }).filter(item => item.downloadUrl && item.imageSrc); // Only include items with valid paths

        // Return session details
        return res.status(200).json({
            sessionId: session.id,
            customerEmail: customerEmail,
            paymentStatus: session.payment_status,
            downloadLinks: downloadLinks,
            items: cartItems
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



