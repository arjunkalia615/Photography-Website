/**
 * Vercel Serverless Function
 * GET /api/check-purchase-final
 * Checks if a purchase is final (quantities cannot be modified)
 */

const db = require('./db');

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
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'session_id is required'
            });
        }

        // Validate session_id format
        if (!sessionId.startsWith('cs_')) {
            return res.status(400).json({
                error: 'Invalid session ID',
                message: 'Invalid session ID format'
            });
        }

        // Get purchase from Redis
        const purchase = await db.getPurchase(sessionId);

        if (!purchase) {
            return res.status(404).json({
                error: 'Purchase not found',
                message: 'No purchase found for this session ID',
                isFinal: false
            });
        }

        // Check if purchase is marked as final
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

module.exports = handler;

