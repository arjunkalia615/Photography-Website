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
        // Determine which Stripe publishable key to use based on USE_TEST_STRIPE flag
        // USE_TEST_STRIPE='true' → use test key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST)
        // USE_TEST_STRIPE='false' or not set → use live key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
        const useTestMode = process.env.USE_TEST_STRIPE === 'true';
        const publishableKey = useTestMode 
            ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST 
            : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        
        const mode = useTestMode ? 'TEST' : 'LIVE';
        const expectedKey = useTestMode 
            ? 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST' 
            : 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';
        
        console.log('Stripe Publishable Key Configuration:', {
            mode: mode,
            useTestMode: useTestMode,
            hasTestKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST,
            hasLiveKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            keyPrefix: publishableKey ? publishableKey.substring(0, 7) : 'none',
            keyLength: publishableKey ? publishableKey.length : 0
        });

        if (!publishableKey) {
            console.error(`${expectedKey} environment variable is not set`);
            const availableVars = Object.keys(process.env).filter(k => k.includes('STRIPE'));
            console.error('Available Stripe environment variables:', availableVars);
            
            return res.status(500).json({
                error: 'Server configuration error',
                message: `Stripe publishable key not configured. Please set ${expectedKey} environment variable in Vercel.`,
                debug: {
                    mode: mode,
                    expectedKey: expectedKey,
                    availableStripeVars: availableVars,
                    useTestMode: useTestMode
                }
            });
        }

        // Validate key format
        if (typeof publishableKey !== 'string' || publishableKey.length < 10) {
            console.error('Invalid publishable key format:', {
                type: typeof publishableKey,
                length: publishableKey?.length
            });
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Invalid Stripe publishable key format. Please check your environment variable.',
                debug: {
                    mode: mode,
                    expectedKey: expectedKey
                }
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

