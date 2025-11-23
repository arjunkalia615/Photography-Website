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
            return purchase;
        } else {
            console.log(`⚠️ Purchase not found in Redis for session: ${sessionId}`);
            console.log(`🔑 Redis key checked: ${key}`);
        }
        
        return null;
    } catch (error) {
        console.error(`❌ Error getting purchase from Redis for ${sessionId}:`, error);
        console.error('Error details:', error.message);
        return null;
    }
}

// Save purchase
async function savePurchase(sessionId, purchaseData) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`; // Exact session ID as Redis key
        
        console.log(`💾 Saving to Redis: ${key}`, {
            sessionId: sessionId,
            itemsCount: purchaseData.purchased_items?.length || purchaseData.products?.length || 0,
            email: purchaseData.customer_email || purchaseData.email
        });
        
        // Store purchase data in Redis - AWAIT to guarantee it completes
        // Upstash Redis handles object serialization automatically
        const result = await redisClient.set(key, purchaseData);
        
        console.log(`📝 Redis SET result:`, result);
        
        // Verify the write succeeded by reading it back
        const verify = await redisClient.get(key);
        if (!verify) {
            console.error(`❌ Purchase write verification failed for ${sessionId}`);
            console.error(`🔑 Redis key: ${key}`);
            console.error(`📊 SET result was:`, result);
            return false;
        }
        
        console.log(`✅ Purchase saved to Redis: ${key}`, {
            itemsCount: verify.purchased_items?.length || verify.products?.length || 0,
            email: verify.customer_email || verify.email,
            sessionId: sessionId,
            verified: true
        });
        console.log(`🔑 Redis key: ${key}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error saving purchase to Redis for ${sessionId}:`, error);
        console.error(`🔑 Redis key attempted: purchase:${sessionId}`);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
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

// Mark item as downloaded (boolean flag - simple quantity-based tracking)
// When user clicks download, item is marked as downloaded (downloaded = true)
async function markItemAsDownloaded(sessionId, productId) {
    try {
        const redisClient = getRedis();
        const key = `purchase:${sessionId}`;
        
        const purchase = await redisClient.get(key);
        if (purchase) {
            // Initialize download tracking if it doesn't exist
            if (!purchase.downloaded) {
                purchase.downloaded = {}; // Map of productId -> boolean
            }
            
            // Check if item exists in purchase
            const items = purchase.products || purchase.purchased_items || [];
            const item = items.find(item => item.productId === productId);
            if (!item) {
                console.error(`❌ Item not found for productId: ${productId}`);
                return false;
            }
            
            // Mark item as downloaded
            purchase.downloaded[productId] = true;
            
            // Also update backward compatibility fields
            if (!purchase.download_count) {
                purchase.download_count = {};
            }
            if (!purchase.quantity_downloaded) {
                purchase.quantity_downloaded = {};
            }
            const quantityPurchased = item.quantityPurchased || item.quantity || 1;
            purchase.download_count[productId] = quantityPurchased;
            purchase.quantity_downloaded[productId] = quantityPurchased;
            
            // Update downloadsUsed
            if (purchase.downloadsUsed !== undefined) {
                purchase.downloadsUsed = Object.values(purchase.downloaded).filter(Boolean).length;
            }
            
            await redisClient.set(key, purchase);
            
            console.log(`✅ Item marked as downloaded for ${productId}`);
            console.log(`🔑 Redis key: ${key}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error marking item as downloaded for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Check if item has been downloaded (boolean check)
async function isItemDownloaded(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (!purchase) return false;
        
        // Check downloaded flag (new simple tracking)
        if (purchase.downloaded && purchase.downloaded[productId] === true) {
            return true;
        }
        
        // Backward compatibility: check if quantity_downloaded >= quantityPurchased
        const items = purchase.products || purchase.purchased_items || [];
        const item = items.find(item => item.productId === productId);
        if (item) {
            const quantityPurchased = item.quantityPurchased || item.quantity || 1;
            const quantityDownloaded = purchase.quantity_downloaded?.[productId] || purchase.download_count?.[productId] || 0;
            return quantityDownloaded >= quantityPurchased;
        }
        
        return false;
    } catch (error) {
        console.error(`❌ Error checking if item is downloaded for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Mark all remaining copies as downloaded (DEPRECATED - use markItemAsDownloaded)
async function markAllCopiesDownloaded(sessionId, productId) {
    return await markItemAsDownloaded(sessionId, productId);
}

// Increment download count (DEPRECATED - use markItemAsDownloaded)
async function incrementDownloadCount(sessionId, productId) {
    return await markItemAsDownloaded(sessionId, productId);
}

// Get download count for a product (quantityDownloaded)
async function getDownloadCount(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (purchase) {
            // Prefer quantity_downloaded, fallback to download_count for backward compatibility
            if (purchase.quantity_downloaded && purchase.quantity_downloaded[productId] !== undefined) {
                return purchase.quantity_downloaded[productId];
            }
            if (purchase.download_count && purchase.download_count[productId] !== undefined) {
                return purchase.download_count[productId];
            }
        }
        return 0;
    } catch (error) {
        console.error(`❌ Error getting download count for ${sessionId}/${productId}:`, error);
        return 0;
    }
}

// Get quantity purchased for a product
async function getQuantityPurchased(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (!purchase) return 0;
        
        const items = purchase.products || purchase.purchased_items || [];
        const item = items.find(item => item.productId === productId);
        if (!item) return 0;
        
        // Return quantityPurchased (explicit) or quantity (fallback)
        return item.quantityPurchased || item.quantity || item.maxDownloads || item.max_downloads || 1;
    } catch (error) {
        console.error(`❌ Error getting quantity purchased for ${sessionId}/${productId}:`, error);
        return 0;
    }
}

// Check if download is allowed (quantity-based)
async function canDownload(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (!purchase) return false;
        
        // Check both products and purchased_items arrays for backward compatibility
        const items = purchase.products || purchase.purchased_items || [];
        const item = items.find(item => item.productId === productId);
        if (!item) return false;
        
        const quantityDownloaded = await getDownloadCount(sessionId, productId);
        const quantityPurchased = item.quantityPurchased || item.quantity || item.maxDownloads || item.max_downloads || 1;
        
        return quantityDownloaded < quantityPurchased;
    } catch (error) {
        console.error(`❌ Error checking download permission for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Get download status for a product (quantityPurchased, quantityDownloaded, remaining)
async function getDownloadStatus(sessionId, productId) {
    try {
        const purchase = await getPurchase(sessionId);
        if (!purchase) {
            return {
                quantityPurchased: 0,
                quantityDownloaded: 0,
                remaining: 0,
                canDownload: false
            };
        }
        
        const items = purchase.products || purchase.purchased_items || [];
        const item = items.find(item => item.productId === productId);
        if (!item) {
            return {
                quantityPurchased: 0,
                quantityDownloaded: 0,
                remaining: 0,
                canDownload: false
            };
        }
        
        const quantityPurchased = item.quantityPurchased || item.quantity || item.maxDownloads || item.max_downloads || 1;
        const quantityDownloaded = await getDownloadCount(sessionId, productId);
        const remaining = Math.max(0, quantityPurchased - quantityDownloaded);
        
        return {
            quantityPurchased: quantityPurchased,
            quantityDownloaded: quantityDownloaded,
            remaining: remaining,
            canDownload: remaining > 0
        };
    } catch (error) {
        console.error(`❌ Error getting download status for ${sessionId}/${productId}:`, error);
        return {
            quantityPurchased: 0,
            quantityDownloaded: 0,
            remaining: 0,
            canDownload: false
        };
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
    markItemAsDownloaded,
    isItemDownloaded,
    markAllCopiesDownloaded, // Deprecated: use markItemAsDownloaded
    incrementDownloadCount, // Deprecated: use markItemAsDownloaded
    getDownloadCount,
    getQuantityPurchased,
    canDownload,
    getDownloadStatus,
    getAllPurchases
};
