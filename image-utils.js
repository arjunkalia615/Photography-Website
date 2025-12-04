/**
 * Image Utilities for Web-Optimized Previews
 * Handles conversion between preview and original image paths
 */

/**
 * Image path configuration
 */
const IMAGE_PATHS = {
    HIGH_RES: 'Images/High-Quality Photos',
    PREVIEW: 'Images/Web-Optimized-Previews',
    LOW_RES: 'Low-Res Images'
};

/**
 * Get web-optimized preview path from original path
 * @param {string} originalPath - Original high-res image path
 * @returns {string} - Web-optimized preview path
 */
function getPreviewPath(originalPath) {
    if (!originalPath) return originalPath;
    
    // Extract filename
    const filename = originalPath.split('/').pop();
    const basename = filename.replace(/\.(jpg|jpeg|png)$/i, '');
    
    // Return WebP preview path
    return `${IMAGE_PATHS.PREVIEW}/${basename}.webp`;
}

/**
 * Get original high-res path from preview path
 * @param {string} previewPath - Preview image path
 * @returns {string} - Original high-res path
 */
function getOriginalPath(previewPath) {
    if (!previewPath) return previewPath;
    
    // Extract filename without extension
    const filename = previewPath.split('/').pop();
    const basename = filename.replace(/\.webp$/i, '');
    
    // Return original JPG path
    return `${IMAGE_PATHS.HIGH_RES}/${basename}.jpg`;
}

/**
 * Get low-res watermarked path from original path
 * @param {string} originalPath - Original high-res image path
 * @returns {string} - Low-res watermarked path
 */
function getLowResPath(originalPath) {
    if (!originalPath) return originalPath;
    
    // Extract filename
    const filename = originalPath.split('/').pop();
    
    // Return low-res path
    return `${IMAGE_PATHS.LOW_RES}/${filename}`;
}

/**
 * Check if browser supports WebP
 * @returns {Promise<boolean>}
 */
async function supportsWebP() {
    if (typeof window === 'undefined') return false;
    
    if ('createImageBitmap' in window) {
        const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
        const blob = await fetch(webpData).then(r => r.blob());
        return await createImageBitmap(blob).then(() => true, () => false);
    }
    
    return false;
}

/**
 * Get appropriate image path based on context
 * @param {string} originalPath - Original high-res path
 * @param {string} context - Context: 'display', 'download', 'social'
 * @returns {string}
 */
function getImagePathForContext(originalPath, context = 'display') {
    switch (context) {
        case 'display':
            // Use web-optimized preview for display
            return getPreviewPath(originalPath);
        
        case 'download':
            // Use original high-res for downloads
            return originalPath;
        
        case 'social':
            // Use low-res watermarked for social sharing
            return getLowResPath(originalPath);
        
        default:
            return originalPath;
    }
}

/**
 * Lazy load image with intersection observer
 * @param {HTMLImageElement} img - Image element
 */
function lazyLoadImage(img) {
    const loadImage = () => {
        const src = img.getAttribute('data-src');
        if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('lazy-loaded');
        }
    };
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadImage();
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });
        
        observer.observe(img);
    } else {
        // Fallback for browsers without IntersectionObserver
        loadImage();
    }
}

/**
 * Initialize lazy loading for all images with data-src
 */
function initLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => lazyLoadImage(img));
}

// Browser environment
if (typeof window !== 'undefined') {
    // Auto-initialize lazy loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLazyLoading);
    } else {
        initLazyLoading();
    }
    
    // Re-initialize when new images are added
    const observer = new MutationObserver(() => {
        initLazyLoading();
    });
    
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IMAGE_PATHS,
        getPreviewPath,
        getOriginalPath,
        getLowResPath,
        getImagePathForContext,
        supportsWebP,
        lazyLoadImage,
        initLazyLoading
    };
}

