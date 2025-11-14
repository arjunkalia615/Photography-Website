// Watermark Protection - Disable right-click and image saving
(function() {
    'use strict';
    
    // Function to protect an image element
    function protectImage(img) {
        if (!img || img.dataset.protected === 'true') return;
        
        // Disable right-click
        img.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { passive: false });
        
        // Disable drag and drop
        img.addEventListener('dragstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { passive: false });
        
        // Disable image selection
        img.setAttribute('draggable', 'false');
        img.dataset.protected = 'true';
    }
    
    // Function to protect image wrapper
    function protectImageWrapper(wrapper) {
        if (!wrapper || wrapper.dataset.protected === 'true') return;
        
        wrapper.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { passive: false });
        
        wrapper.dataset.protected = 'true';
    }
    
    // Initialize protection on page load
    function initProtection() {
        // Protect gallery images
        const galleryImages = document.querySelectorAll('.photo-item-image-wrapper img');
        galleryImages.forEach(protectImage);
        
        // Protect image wrappers
        const imageWrappers = document.querySelectorAll('.photo-item-image-wrapper');
        imageWrappers.forEach(protectImageWrapper);
        
        // Protect lightbox images
        const lightboxImages = document.querySelectorAll('.lightbox-image');
        lightboxImages.forEach(protectImage);
    }
    
    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProtection);
    } else {
        initProtection();
    }
    
    // Re-apply protection when lightbox opens (for dynamically loaded images)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.classList && node.classList.contains('lightbox-image')) {
                        protectImage(node);
                    }
                    // Check for images within added nodes
                    const images = node.querySelectorAll ? node.querySelectorAll('.lightbox-image, .photo-item-image-wrapper img') : [];
                    images.forEach(protectImage);
                }
            });
        });
    });
    
    // Observe the document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also protect lightbox when it opens
    document.addEventListener('click', function(e) {
        if (e.target.closest('.photo-item-image-wrapper')) {
            setTimeout(function() {
                const lightboxImg = document.querySelector('.lightbox-image');
                if (lightboxImg) {
                    protectImage(lightboxImg);
                }
            }, 100);
        }
    });
    
    // Prevent image saving via browser's "Save Image As" when right-clicking
    document.addEventListener('selectstart', function(e) {
        if (e.target.tagName === 'IMG' && 
            (e.target.closest('.photo-item-image-wrapper') || 
             e.target.classList.contains('lightbox-image'))) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });
})();

