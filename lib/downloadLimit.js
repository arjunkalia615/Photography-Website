/**
 * Client-side Download Limit Utility
 * Manages download limits per item using localStorage
 */

const DOWNLOAD_LIMIT_STORAGE_KEY = 'downloadLimits';

/**
 * Get download limit data for an item
 * @param {string} itemId - The item ID
 * @returns {Object|null} - { allowed: number, used: number } or null if not found
 */
function getLimit(itemId) {
    try {
        const limits = JSON.parse(localStorage.getItem(DOWNLOAD_LIMIT_STORAGE_KEY) || '{}');
        return limits[itemId] || null;
    } catch (error) {
        console.error('Error reading download limits:', error);
        return null;
    }
}

/**
 * Check if item has remaining downloads
 * @param {string} itemId - The item ID
 * @returns {boolean} - true if used < allowed, false otherwise
 */
function hasRemainingDownloads(itemId) {
    const limit = getLimit(itemId);
    if (!limit) {
        // No limit set - allow downloads (will be set when item is in cart)
        return true;
    }
    return limit.used < limit.allowed;
}

/**
 * Increment download count for an item
 * @param {string} itemId - The item ID
 * @param {number} amount - Amount to increment by (default: 1). When quantity > 1, all files are downloaded at once, so increment by quantity
 * @returns {boolean} - true if successful, false otherwise
 */
function incrementDownload(itemId, amount = 1) {
    try {
        const limits = JSON.parse(localStorage.getItem(DOWNLOAD_LIMIT_STORAGE_KEY) || '{}');
        
        if (!limits[itemId]) {
            console.warn(`No download limit set for itemId: ${itemId}`);
            return false;
        }
        
        // Increment by the specified amount (typically the quantity)
        // This ensures that when quantity > 1, all downloads are marked as used in one go
        limits[itemId].used = Math.min(
            (limits[itemId].used || 0) + amount,
            limits[itemId].allowed // Cap at allowed amount
        );
        localStorage.setItem(DOWNLOAD_LIMIT_STORAGE_KEY, JSON.stringify(limits));
        return true;
    } catch (error) {
        console.error('Error incrementing download count:', error);
        return false;
    }
}

/**
 * Set download limit for an item
 * @param {string} itemId - The item ID
 * @param {number} allowed - Number of allowed downloads
 * @param {boolean} resetUsed - If true, reset used count to 0. If false, only update if quantity increased
 */
function setLimit(itemId, allowed, resetUsed = false) {
    try {
        const limits = JSON.parse(localStorage.getItem(DOWNLOAD_LIMIT_STORAGE_KEY) || '{}');
        const existing = limits[itemId];
        
        if (!existing) {
            // New item - always set limit with used = 0
            limits[itemId] = {
                allowed: allowed,
                used: 0
            };
        } else {
            // Existing item - update limit
            const oldAllowed = existing.allowed;
            limits[itemId].allowed = allowed;
            
            // Reset used if explicitly requested or if quantity increased
            if (resetUsed || allowed > oldAllowed) {
                limits[itemId].used = 0;
            }
            // If quantity decreased, keep used count but cap it at new allowed
            else if (allowed < oldAllowed) {
                limits[itemId].used = Math.min(limits[itemId].used, allowed);
            }
            // If quantity is the same, keep used count as-is (even if used >= allowed)
            // This preserves the download state after page refresh
        }
        
        localStorage.setItem(DOWNLOAD_LIMIT_STORAGE_KEY, JSON.stringify(limits));
        return true;
    } catch (error) {
        console.error('Error setting download limit:', error);
        return false;
    }
}

/**
 * Get remaining download count for an item
 * @param {string} itemId - The item ID
 * @returns {number} - Remaining downloads (allowed - used), or 0 if no limit set
 */
function getRemainingDownloads(itemId) {
    const limit = getLimit(itemId);
    if (!limit) {
        return 0;
    }
    return Math.max(0, limit.allowed - limit.used);
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    // Node.js/CommonJS
    module.exports = {
        getLimit,
        hasRemainingDownloads,
        incrementDownload,
        setLimit,
        getRemainingDownloads
    };
} else {
    // Browser/Global
    window.DownloadLimit = {
        getLimit,
        hasRemainingDownloads,
        incrementDownload,
        setLimit,
        getRemainingDownloads
    };
}

