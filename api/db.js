/**
 * Database utility for storing purchase data
 * Uses Vercel KV for persistent storage
 */

// Vercel KV client
let kv = null;

// Initialize KV client
function initKV() {
    if (kv) return kv;
    
    try {
        // Vercel KV is available via @vercel/kv package
        const { kv: vercelKV } = require('@vercel/kv');
        kv = vercelKV;
        console.log('✅ Vercel KV initialized');
        return vercelKV;
    } catch (error) {
        console.error('❌ Failed to initialize Vercel KV:', error);
        console.error('Make sure @vercel/kv is installed and KV_REST_API_URL is set');
        throw error;
    }
}

// Get KV client (lazy initialization)
function getKV() {
    if (!kv) {
        initKV();
    }
    return kv;
}

// Get purchase by session ID
async function getPurchase(sessionId) {
    try {
        const kvClient = getKV();
        const key = `purchases:${sessionId}`;
        const purchase = await kvClient.get(key);
        
        if (purchase) {
            console.log(`✅ Purchase found in KV for session: ${sessionId}`);
        } else {
            console.log(`⚠️ Purchase not found in KV for session: ${sessionId}`);
        }
        
        return purchase;
    } catch (error) {
        console.error(`Error getting purchase from KV for ${sessionId}:`, error);
        return null;
    }
}

// Save purchase
async function savePurchase(sessionId, purchaseData) {
    try {
        const kvClient = getKV();
        const key = `purchases:${sessionId}`;
        
        // Store purchase data
        await kvClient.set(key, purchaseData);
        
        console.log(`✅ Purchase saved to KV: ${key}`, {
            itemsCount: purchaseData.purchased_items?.length || 0,
            email: purchaseData.customer_email
        });
        
        return true;
    } catch (error) {
        console.error(`❌ Error saving purchase to KV for ${sessionId}:`, error);
        return false;
    }
}

// Update purchase (for download tracking)
async function updatePurchase(sessionId, updates) {
    try {
        const kvClient = getKV();
        const key = `purchases:${sessionId}`;
        
        const purchase = await kvClient.get(key);
        if (purchase) {
            const updated = { ...purchase, ...updates };
            await kvClient.set(key, updated);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error updating purchase in KV for ${sessionId}:`, error);
        return false;
    }
}

// Increment download count for a product
async function incrementDownloadCount(sessionId, productId) {
    try {
        const kvClient = getKV();
        const key = `purchases:${sessionId}`;
        
        const purchase = await kvClient.get(key);
        if (purchase && purchase.download_count) {
            if (!purchase.download_count[productId]) {
                purchase.download_count[productId] = 0;
            }
            purchase.download_count[productId] += 1;
            
            await kvClient.set(key, purchase);
            
            console.log(`✅ Download count incremented for ${productId}: ${purchase.download_count[productId]}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error incrementing download count in KV for ${sessionId}/${productId}:`, error);
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
        console.error(`Error getting download count for ${sessionId}/${productId}:`, error);
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
        console.error(`Error checking download permission for ${sessionId}/${productId}:`, error);
        return false;
    }
}

// Get all purchases (for debugging - optional)
async function getAllPurchases() {
    try {
        const kvClient = getKV();
        // Note: KV doesn't support listing all keys easily
        // This is mainly for debugging
        return {};
    } catch (error) {
        console.error('Error getting all purchases:', error);
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
