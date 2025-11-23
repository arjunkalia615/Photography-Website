/**
 * Database utility for storing purchase data
 * Uses Upstash Redis for persistent storage
 */

const { Redis } = require('@upstash/redis');

// Initialize Redis client (uses environment variables)
let redis = null;

// Initialize Redis client
function initRedis() {
    if (redis) return redis;
    
    try {
        // Initialize Redis from environment variables
        // Uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
        redis = Redis.fromEnv();
        console.log('✅ Upstash Redis initialized');
        return redis;
    } catch (error) {
        console.error('❌ Failed to initialize Upstash Redis:', error);
        console.error('Make sure @upstash/redis is installed and UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are set');
        throw error;
    }
}

// Get Redis client (lazy initialization)
function getRedis() {
    if (!redis) {
        initRedis();
    }
    return redis;
}

// Get purchase by session ID
async function getPurchase(sessionId) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`;
        const purchase = await redisClient.get(key);
        
        if (purchase) {
            console.log(`✅ Purchase found in Redis for session: ${sessionId}`);
            console.log(`🔑 Redis key: ${key}`);
        } else {
            console.log(`⚠️ Purchase not found in Redis for session: ${sessionId}`);
            console.log(`🔑 Redis key checked: ${key}`);
        }
        
        return purchase;
    } catch (error) {
        console.error(`❌ Error getting purchase from Redis for ${sessionId}:`, error);
        return null;
    }
}

// Save purchase
async function savePurchase(sessionId, purchaseData) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`; // Exact session ID as Redis key
        
        // Store purchase data in Redis - AWAIT to guarantee it completes
        await redisClient.set(key, purchaseData);
        
        // Verify the write succeeded by reading it back
        const verify = await redisClient.get(key);
        if (!verify) {
            console.error(`❌ Purchase write verification failed for ${sessionId}`);
            return false;
        }
        
        console.log(`✅ Purchase saved to Redis: ${key}`, {
            itemsCount: purchaseData.purchased_items?.length || purchaseData.products?.length || 0,
            email: purchaseData.customer_email || purchaseData.email,
            sessionId: sessionId
        });
        console.log(`🔑 Redis key: ${key}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error saving purchase to Redis for ${sessionId}:`, error);
        console.error(`🔑 Redis key attempted: purchase:${sessionId}`);
        console.error('Error details:', error.message);
        return false;
    }
}

// Update purchase (for download tracking)
async function updatePurchase(sessionId, updates) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`;
        
        const purchase = await redisClient.get(key);
        if (purchase) {
            const updated = { ...purchase, ...updates };
            await redisClient.set(key, updated);
            console.log(`✅ Purchase updated in Redis: ${key}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error updating purchase in Redis for ${sessionId}:`, error);
        return false;
    }
}

// Increment download count for a product
async function incrementDownloadCount(sessionId, productId) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`;
        
        const purchase = await redisClient.get(key);
        if (purchase && purchase.download_count) {
            if (!purchase.download_count[productId]) {
                purchase.download_count[productId] = 0;
            }
            purchase.download_count[productId] += 1;
            
            // Also update downloadsUsed if it exists
            if (purchase.downloadsUsed !== undefined) {
                purchase.downloadsUsed += 1;
            }
            
            await redisClient.set(key, purchase);
            
            console.log(`✅ Download count incremented for ${productId}: ${purchase.download_count[productId]}`);
            console.log(`🔑 Redis key: ${key}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error incrementing download count in Redis for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Get download count for a product
async function getDownloadCount(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (purchase && purchase.download_count) {
            return purchase.download_count[productId] || 0;
        }
        return 0;
    } catch (error) {
        console.error(`❌ Error getting download count for ${sessionId}/${productId}:`, error);
        return 0;
    }
}

// Check if download is allowed
async function canDownload(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (!purchase) return false;
        
        const item = purchase.purchased_items.find(item => item.productId === productId);
        if (!item) return false;
        
        const downloadCount = await getDownloadCount(sessionId, productId);
        return downloadCount < item.max_downloads;
    } catch (error) {
        console.error(`❌ Error checking download permission for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Get all purchases (for debugging - optional)
async function getAllPurchases() {
    try {
        // Note: Redis doesn't support listing all keys easily without scanning
        // This is mainly for debugging
        return {};
    } catch (error) {
        console.error('❌ Error getting all purchases:', error);
        return {};
    }
}

module.exports = {
    getPurchase,
    savePurchase,
    updatePurchase,
    incrementDownloadCount,
    getDownloadCount,
    canDownload,
    getAllPurchases
};
