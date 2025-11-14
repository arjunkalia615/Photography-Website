// Blur-up Animation Effect - Instagram-style image loading
(function() {
    'use strict';

    // Function to create a low-quality placeholder from an image
    function createPlaceholder(img) {
        return new Promise((resolve) => {
            // For better performance and to avoid CORS issues, we'll use the same image source
            // The CSS blur filter will create the low-quality appearance
            // This is more reliable and works with all images
            
            // If it's a data URI or already loaded, use it directly
            if (img.src.startsWith('data:') || (img.complete && img.naturalWidth > 0)) {
                resolve(img.src);
                return;
            }

            // Try to create a tiny version using canvas (only if CORS allows)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const tempImg = new Image();
            
            // Try with CORS first
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = function() {
                try {
                    // Create a very small version (20px wide) for the placeholder
                    const maxSize = 20;
                    const ratio = Math.min(maxSize / tempImg.width, maxSize / tempImg.height);
                    canvas.width = Math.max(1, tempImg.width * ratio);
                    canvas.height = Math.max(1, tempImg.height * ratio);
                    
                    // Draw the small version
                    ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.1);
                    resolve(dataUrl);
                } catch (e) {
                    // Fallback to original src if canvas fails (CORS issue)
                    resolve(img.src);
                }
            };
            
            tempImg.onerror = function() {
                // Fallback to original src
                resolve(img.src);
            };
            
            // Set src last to trigger load
            tempImg.src = img.src;
            
            // Timeout fallback (in case image takes too long)
            setTimeout(() => {
                if (!tempImg.complete) {
                    resolve(img.src);
                }
            }, 1000);
        });
    }

    // Function to initialize blur-up for a single image
    function initBlurUp(img) {
        // Skip if already processed
        if (img.dataset.blurUpInitialized === 'true') {
            return;
        }
        img.dataset.blurUpInitialized = 'true';

        const wrapper = img.closest('.photo-item-image-wrapper') || 
                       img.closest('.country-card') || 
                       img.closest('.hero-content') ||
                       img.closest('.cart-page-item-thumbnail') ||
                       img.closest('.payment-item-thumbnail') ||
                       img.parentElement;

        if (!wrapper) return;

        // Create placeholder
        createPlaceholder(img).then(placeholderSrc => {
            // Set placeholder as background on wrapper's ::before pseudo-element
            // We'll use a CSS custom property
            if (wrapper) {
                wrapper.style.setProperty('--placeholder-url', `url(${placeholderSrc})`);
            }
        });

        // Handle image load
        if (img.complete && img.naturalWidth > 0) {
            // Image already loaded
            img.classList.add('image-loaded');
            wrapper.classList.add('image-loaded');
        } else {
            // Wait for image to load
            img.addEventListener('load', function() {
                img.classList.add('image-loaded');
                wrapper.classList.add('image-loaded');
            }, { once: true });

            // Handle load errors
            img.addEventListener('error', function() {
                // Show image anyway if it fails to load
                img.classList.add('image-loaded');
                wrapper.classList.add('image-loaded');
            }, { once: true });
        }
    }

    // Initialize all images on page load
    function initAllImages() {
        // Photo grid images
        const photoImages = document.querySelectorAll('.photo-item-image-wrapper img');
        photoImages.forEach(initBlurUp);

        // Country card images
        const countryImages = document.querySelectorAll('.country-image');
        countryImages.forEach(initBlurUp);

        // Hero banner
        const heroBanner = document.querySelector('.hero-banner');
        if (heroBanner) {
            initBlurUp(heroBanner);
        }

        // Cart and payment page images
        const cartImages = document.querySelectorAll('.cart-page-item-thumbnail img, .payment-item-thumbnail img');
        cartImages.forEach(initBlurUp);
    }

    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllImages);
    } else {
        initAllImages();
    }

    // Watch for dynamically added images (e.g., cart items, payment items)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Check if the added node is an image
                    if (node.tagName === 'IMG') {
                        initBlurUp(node);
                    }
                    // Check for images within added nodes
                    const images = node.querySelectorAll ? node.querySelectorAll('img') : [];
                    images.forEach(initBlurUp);
                }
            });
        });
    });

    // Observe the document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

