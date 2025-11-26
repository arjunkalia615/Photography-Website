/**
 * Photo Title Helper
 * Uses the actual filename (without extension) as the title
 * Matches exactly what's in the folder
 */

/**
 * Get title from photo filename
 * Uses the filename (without extension) as-is, matching the folder name exactly
 * @param {string} filename - The image filename
 * @param {string} baseName - The base name without extension
 * @returns {string} - Title matching the filename
 */
function getPhotoTitle(filename, baseName) {
    // Use the baseName (filename without extension) as the title
    // This matches exactly what's in the folder
    return baseName || 'Photography';
}

module.exports = {
    getPhotoTitle
};

