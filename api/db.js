/**
 * Database utility for storing purchase data
 * Uses JSON file storage (works on Vercel)
 * Can be upgraded to Vercel KV or Supabase later
 */

const fs = require('fs');
const path = require('path');

// Database file path
// On Vercel, use /tmp for writes (ephemeral but writable)
// For production, consider upgrading to Vercel KV or Supabase
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const DB_PATH = isVercel 
    ? path.join('/tmp', 'purchases.json')
    : path.join(process.cwd(), 'data', 'purchases.json');

// Ensure data directory exists (only for non-Vercel)
function ensureDataDir() {
    if (!isVercel) {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
            } catch (error) {
                console.error('Error creating data directory:', error);
            }
        }
    }
    // On Vercel, /tmp always exists, no need to create
}

// Read database
function readDB() {
    try {
        ensureDataDir();
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading database:', error);
    }
    return {};
}

// Write database
function writeDB(data) {
    try {
        ensureDataDir();
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Get purchase by session ID
function getPurchase(sessionId) {
    const db = readDB();
    return db[sessionId] || null;
}

// Save purchase
function savePurchase(sessionId, purchaseData) {
    const db = readDB();
    db[sessionId] = purchaseData;
    return writeDB(db);
}

// Update purchase (for download tracking)
function updatePurchase(sessionId, updates) {
    const db = readDB();
    if (db[sessionId]) {
        db[sessionId] = { ...db[sessionId], ...updates };
        return writeDB(db);
    }
    return false;
}

// Increment download count for a product
function incrementDownloadCount(sessionId, productId) {
    const db = readDB();
    if (db[sessionId] && db[sessionId].download_count) {
        if (!db[sessionId].download_count[productId]) {
            db[sessionId].download_count[productId] = 0;
        }
        db[sessionId].download_count[productId] += 1;
        return writeDB(db);
    }
    return false;
}

// Get download count for a product
function getDownloadCount(sessionId, productId) {
    const purchase = getPurchase(sessionId);
    if (purchase && purchase.download_count) {
        return purchase.download_count[productId] || 0;
    }
    return 0;
}

// Check if download is allowed
function canDownload(sessionId, productId) {
    const purchase = getPurchase(sessionId);
    if (!purchase) return false;
    
    const item = purchase.purchased_items.find(item => item.productId === productId);
    if (!item) return false;
    
    const downloadCount = getDownloadCount(sessionId, productId);
    return downloadCount < item.max_downloads;
}

module.exports = {
    getPurchase,
    savePurchase,
    updatePurchase,
    incrementDownloadCount,
    getDownloadCount,
    canDownload,
    readDB,
    writeDB
};

