/**
 * Debug endpoint to check if webhook was called for a session
 * GET /api/check-webhook?session_id=cs_...
 */

const db = require('./db');

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

module.exports = handler;

