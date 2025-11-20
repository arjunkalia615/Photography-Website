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
        
        // Check what keys are available
        const hasTestKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST;
        const hasLiveKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        
        // Determine which key to use
        let publishableKey;
        let mode;
        let expectedKey;
        
        if (useTestMode) {
            mode = 'TEST';
            expectedKey = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST';
            publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST;
            
            // Fallback: if test key not found but live key exists, use live key
            if (!publishableKey && hasLiveKey) {
                publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
            }
        } else {
            mode = 'LIVE';
            expectedKey = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';
            publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
            
            // Fallback: if live key not found but test key exists, use test key
            if (!publishableKey && hasTestKey) {
                publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST;
            }
        }
        
        // Get Vercel environment info
        const vercelEnv = process.env.VERCEL_ENV || 'unknown';
        const allStripeVars = Object.keys(process.env).filter(k => k.includes('STRIPE'));

        if (!publishableKey) {
            console.error(`${expectedKey} environment variable is not set`);
            console.error('Vercel Environment:', vercelEnv);
            console.error('Available Stripe environment variables:', allStripeVars);
            
            // Provide helpful error message based on Vercel environment
            let envHint = '';
            if (vercelEnv === 'preview' || vercelEnv === 'development') {
                envHint = '\n\nNOTE: You are in a PREVIEW/DEVELOPMENT environment. Make sure the environment variable is set for "Preview" or "Development" scope in Vercel, not just "Production".';
            } else if (vercelEnv === 'production') {
                envHint = '\n\nNOTE: You are in PRODUCTION. Make sure the environment variable is set for "Production" scope in Vercel.';
            }
            
            return res.status(500).json({
                error: 'Server configuration error',
                message: `Stripe publishable key not configured. Please set ${expectedKey} environment variable in Vercel.${envHint}\n\nCurrent Vercel Environment: ${vercelEnv}\nAvailable Stripe Variables: ${allStripeVars.join(', ') || 'None'}`,
                debug: {
                    mode: mode,
                    expectedKey: expectedKey,
                    vercelEnv: vercelEnv,
                    availableStripeVars: allStripeVars,
                    useTestMode: useTestMode,
                    hasTestKey: hasTestKey,
                    hasLiveKey: hasLiveKey
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

