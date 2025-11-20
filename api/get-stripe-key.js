/**
 * Vercel Serverless Function
 * GET /api/get-stripe-key
 * Returns the Stripe publishable key from environment variables
 * This endpoint is safe to expose as it only returns the publishable key (not the secret key)
 */

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
        // Get publishable key from environment variable
        // Vercel will automatically use the correct key based on environment:
        // - Preview/Development: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (test key)
        // - Production: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (live key)
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

        if (!publishableKey) {
            console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is not set');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Stripe publishable key not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable in Vercel.'
            });
        }

        // Return the publishable key
        return res.status(200).json({
            publishableKey: publishableKey
        });

    } catch (error) {
        console.error('Error getting Stripe publishable key:', error);
        return res.status(500).json({
            error: 'Failed to get Stripe publishable key',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request.'
        });
    }
}

// Export the handler function
module.exports = handler;

