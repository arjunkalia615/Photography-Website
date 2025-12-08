/**
 * Utility Functions Module
 * Exports database utilities, image mapping, photo titles, and photo listing functions
 * Used by other API endpoints
 */

// Re-export database utilities
const db = require('./db');
module.exports.db = db;

// Re-export image mapping
const IMAGE_MAPPING = require('./image-mapping');
module.exports.IMAGE_MAPPING = IMAGE_MAPPING;

// Re-export photo title helper
const { getPhotoTitle } = require('./photo-titles');
module.exports.getPhotoTitle = getPhotoTitle;

// Photo listing function (extracted from functions.js)
const fs = require('fs');
const path = require('path');

/**
 * Get all photos from high-quality photos folder
 * Returns array of photo objects with placeholder URLs (ready for BunnyCDN)
 */
async function getPhotos() {
    try {
        // Try multiple folder name variations
        const possibleFolders = [
            path.join(process.cwd(), 'Images', 'High-Quality Photos'), // Correct spelling
            path.join(process.cwd(), 'Images', 'high_quality_photos'), // Underscore version
            path.join(process.cwd(), 'Images', 'High-Qaulity Photos') // Old typo version (backward compatibility)
        ];
        
        let photosFolder = null;
        for (const folder of possibleFolders) {
            if (fs.existsSync(folder)) {
                photosFolder = folder;
                break;
            }
        }
        
        if (!photosFolder) {
            console.warn(`⚠️ Photos folder not found. Tried: Images/High-Quality Photos, Images/high_quality_photos, and Images/High-Qaulity Photos`);
            return { success: false, photos: [], message: 'Photos folder not found' };
        }

        // Read all files from the folder
        const files = fs.readdirSync(photosFolder);
        
        // Filter for image files only
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const photos = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            })
            .map(file => {
                const filePath = path.join(photosFolder, file);
                const stats = fs.statSync(filePath);
                
                // Only include actual files (not directories)
                if (!stats.isFile()) {
                    return null;
                }

                // Use the actual folder name found
                const folderName = path.basename(photosFolder);
                const highQualityPath = `Images/${folderName}/${file}`;
                
                // Normalize extension to lowercase for low-res path
                const ext = path.extname(file);
                const baseFileName = path.basename(file, ext);
                const normalizedFileName = baseFileName + ext.toLowerCase();
                const lowResPath = `Images/LowResImages/${normalizedFileName}`;
                
                const baseName = path.basename(file, ext);
                
                // Generate a product ID from the filename
                const productId = baseName.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
                
                // Get descriptive title
                const title = getPhotoTitle(file, baseName);

                // Use placeholder URLs instead of local paths (images will be served from BunnyCDN)
                const placeholderLowRes = `https://via.placeholder.com/800?text=${encodeURIComponent(title)}`;
                const placeholderHighRes = `https://via.placeholder.com/2000?text=${encodeURIComponent(title)}`;
                
                return {
                    productId: productId || `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    imageSrc: placeholderLowRes,              // Placeholder for gallery thumbnails
                    imageThumb: placeholderLowRes,            // Placeholder thumbnail
                    imageHQ: placeholderHighRes,              // Placeholder for product page
                    title: title,
                    filename: file,
                    category: 'Photography'
                };
            })
            .filter(photo => photo !== null) // Remove null entries
            .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title

        console.log(`✅ Found ${photos.length} photos in high_quality_photos folder`);
        
        return {
            success: true,
            photos: photos,
            count: photos.length
        };
    } catch (error) {
        console.error('❌ Error getting photos:', error);
        console.error('Error stack:', error.stack);
        return {
            success: false,
            photos: [],
            error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching photos.'
        };
    }
}

module.exports.getPhotos = getPhotos;

