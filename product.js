/**
 * Product Page Dynamic Loader
 * Loads product details from the API and displays them
 * Integrates with existing cart system
 */

(function() {
    'use strict';

    // Configuration
    const ITEM_PRICE = 0.50;

    // State
    let currentProduct = null;

    // DOM Elements
    const elements = {
        loading: document.getElementById('productLoading'),
        error: document.getElementById('productError'),
        content: document.getElementById('productContent'),
        image: document.getElementById('productImage'),
        imageWrapper: document.getElementById('productImageWrapper'),
        title: document.getElementById('productTitle'),
        breadcrumbTitle: document.getElementById('breadcrumbTitle'),
        cartControlWrapper: document.getElementById('productCartControlWrapper'),
        addToCartBtn: document.getElementById('addToCartBtn'),
        quantityControl: document.getElementById('quantityControl'),
        quantityValue: document.getElementById('quantityValue'),
        decreaseBtn: document.getElementById('decreaseBtn'),
        increaseBtn: document.getElementById('increaseBtn'),
        pinterestBtn: document.getElementById('pinterestShareBtn'),
        copyLinkBtn: document.getElementById('copyLinkBtn'),
        copyFeedback: document.getElementById('copyLinkFeedback'),
        lightbox: document.getElementById('productLightbox'),
        lightboxImage: document.getElementById('lightboxImage'),
        closeLightboxBtn: document.getElementById('closeLightbox')
    };

    /**
     * Get product ID from URL query parameter
     */
    function getProductIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    /**
     * Convert high-res image path to low-res watermarked version
     * High-res: Images/High-Quality Photos/[filename].jpg
     * Low-res: Low-Res Images/[filename].jpg
     */
    function getLoResImagePath(highResPath) {
        if (!highResPath) return highResPath;
        
        // Extract filename from high-res path
        const filename = highResPath.split('/').pop();
        
        // Construct low-res path
        const lowResPath = `Low-Res Images/${filename}`;
        
        console.log(`🔄 Image path conversion: ${highResPath} → ${lowResPath}`);
        
        return lowResPath;
    }

    /**
     * Fetch product data from API
     */
    async function fetchProductData(productId) {
        try {
            const response = await fetch('/api/functions?action=getPhotos');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch photos: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.photos || data.photos.length === 0) {
                throw new Error('No photos available');
            }

            // Find the product by ID
            const product = data.photos.find(p => p.productId === productId);
            
            if (!product) {
                throw new Error('Product not found');
            }

            return product;
        } catch (error) {
            console.error('Error fetching product data:', error);
            throw error;
        }
    }


    /**
     * Update meta tags for SEO and social sharing
     */
    function updateMetaTags(product) {
        const productUrl = window.location.href;
        
        // Use LOW-RES watermarked image for social sharing previews (Pinterest, Twitter, Facebook)
        const lowResPath = getLoResImagePath(product.imageSrc);
        const socialImageUrl = new URL(lowResPath, window.location.origin).href;
        
        const title = `${product.title} - ifeelworld Photography`;
        const description = `High-resolution digital photography print: ${product.title}. Available for instant download at $${ITEM_PRICE.toFixed(2)}.`;

        // Page title
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageDescription').setAttribute('content', description);

        // Open Graph (Facebook, Pinterest) - Use LOW-RES watermarked image
        document.getElementById('ogTitle').setAttribute('content', title);
        document.getElementById('ogDescription').setAttribute('content', description);
        document.getElementById('ogImage').setAttribute('content', socialImageUrl);
        document.getElementById('ogUrl').setAttribute('content', productUrl);

        // Twitter Card - Use LOW-RES watermarked image
        document.getElementById('twitterTitle').setAttribute('content', title);
        document.getElementById('twitterDescription').setAttribute('content', description);
        document.getElementById('twitterImage').setAttribute('content', socialImageUrl);

        // Update document title
        document.title = title;
        
        console.log('✅ Meta tags updated with LOW-RES images for social sharing');
        console.log(`   Social preview image: ${socialImageUrl}`);
    }

    /**
     * Display product on the page
     */
    async function displayProduct(product) {
        try {
            currentProduct = product;

            // Update meta tags
            updateMetaTags(product);

            // Set image with protection
            elements.image.src = product.imageSrc;
            elements.image.alt = product.title;
            
            // Disable right-click and image saving
            elements.image.addEventListener('contextmenu', (e) => e.preventDefault());
            elements.image.addEventListener('dragstart', (e) => e.preventDefault());
            elements.image.style.userSelect = 'none';
            elements.image.style.pointerEvents = 'auto';

            // Set title
            elements.title.textContent = product.title;
            elements.breadcrumbTitle.textContent = product.title;

            // Hide loading, show content
            elements.loading.style.display = 'none';
            elements.content.style.display = 'block';

            console.log('✅ Product loaded successfully:', product.title);
        } catch (error) {
            console.error('Error displaying product:', error);
            showError();
        }
    }

    /**
     * Show error state
     */
    function showError() {
        elements.loading.style.display = 'none';
        elements.content.style.display = 'none';
        elements.error.style.display = 'flex';
    }

    /**
     * Update cart control UI based on cart state
     */
    function updateCartControlUI() {
        if (!currentProduct || !window.Cart || !window.CartUtils) return;

        const cart = CartUtils.getCart();
        const cartItem = cart.find(item => item.id === currentProduct.productId);
        const quantity = cartItem ? cartItem.quantity : 0;

        if (quantity > 0) {
            // Show quantity control
            elements.addToCartBtn.classList.add('hide');
            elements.quantityControl.classList.add('show');
            elements.quantityValue.textContent = quantity;

            // Update decrease button icon based on quantity
            if (quantity === 1) {
                elements.decreaseBtn.classList.add('remove');
                elements.decreaseBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                `;
                elements.decreaseBtn.setAttribute('aria-label', 'Remove item');
            } else {
                elements.decreaseBtn.classList.remove('remove');
                elements.decreaseBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" />
                    </svg>
                `;
                elements.decreaseBtn.setAttribute('aria-label', 'Decrease quantity');
            }
        } else {
            // Show add to cart button
            elements.addToCartBtn.classList.remove('hide');
            elements.quantityControl.classList.remove('show');
        }
    }

    /**
     * Handle add to cart
     */
    function handleAddToCart() {
        if (!currentProduct || !window.Cart) {
            console.error('Product or Cart not available');
            return;
        }

        // Add item to cart using existing cart system
        Cart.addItem(
            currentProduct.imageSrc,
            currentProduct.title,
            ITEM_PRICE,
            currentProduct.productId
        );

        // Update UI to show quantity control
        setTimeout(() => {
            updateCartControlUI();
        }, 150);

        console.log(`✅ Added ${currentProduct.title} to cart`);
    }

    /**
     * Handle decrease quantity
     */
    function handleDecrease() {
        if (!currentProduct || !window.Cart) return;

        const cart = CartUtils.getCart();
        const cartItem = cart.find(item => item.id === currentProduct.productId);
        
        if (cartItem) {
            if (cartItem.quantity === 1) {
                // Remove item from cart
                Cart.removeItem(currentProduct.productId);
            } else {
                // Decrease quantity
                Cart.updateQuantity(currentProduct.productId, cartItem.quantity - 1);
            }
            
            updateCartControlUI();
        }
    }

    /**
     * Handle increase quantity
     */
    function handleIncrease() {
        if (!currentProduct || !window.Cart) return;

        const cart = CartUtils.getCart();
        const cartItem = cart.find(item => item.id === currentProduct.productId);
        
        if (cartItem && cartItem.quantity < 10) {
            Cart.updateQuantity(currentProduct.productId, cartItem.quantity + 1);
            updateCartControlUI();
        }
    }

    /**
     * Handle Pinterest share
     */
    function handlePinterestShare() {
        if (!currentProduct) return;

        const url = encodeURIComponent(window.location.href);
        
        // Use LOW-RES watermarked image for Pinterest preview
        const lowResPath = getLoResImagePath(currentProduct.imageSrc);
        const imageUrl = encodeURIComponent(new URL(lowResPath, window.location.origin).href);
        
        const description = encodeURIComponent(`${currentProduct.title} - High-resolution digital photography print from ifeelworld`);

        const pinterestUrl = `https://www.pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${description}`;
        
        window.open(pinterestUrl, 'pinterest-share', 'width=750,height=550');
        
        console.log('📌 Pinterest share opened with LOW-RES watermarked image');
        console.log(`   Image: ${decodeURIComponent(imageUrl)}`);
    }

    /**
     * Handle copy link
     */
    async function handleCopyLink() {
        const url = window.location.href;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            // Show feedback
            elements.copyFeedback.style.display = 'block';
            setTimeout(() => {
                elements.copyFeedback.style.display = 'none';
            }, 2000);

            console.log('✅ Link copied to clipboard');
        } catch (error) {
            console.error('Failed to copy link:', error);
            alert('Failed to copy link. Please copy manually: ' + url);
        }
    }

    /**
     * Open lightbox with full-size image
     */
    function openLightbox() {
        console.log('🔍 openLightbox() called');
        
        if (!currentProduct) {
            console.error('❌ No product loaded');
            return;
        }

        if (!elements.lightbox) {
            console.error('❌ Lightbox element not found!');
            return;
        }

        if (!elements.lightboxImage) {
            console.error('❌ Lightbox image element not found!');
            return;
        }

        console.log('✅ Opening lightbox for:', currentProduct.title);
        console.log('   Image source:', currentProduct.imageSrc);

        // Set image source
        elements.lightboxImage.src = currentProduct.imageSrc;
        elements.lightboxImage.alt = currentProduct.title;
        
        // Show lightbox with display first
        elements.lightbox.style.display = 'flex';
        console.log('   Display set to flex');
        
        // Force reflow to ensure display is applied before transition
        void elements.lightbox.offsetWidth;
        
        // Add active class for fade-in animation
        requestAnimationFrame(() => {
            elements.lightbox.classList.add('active');
            document.body.classList.add('lightbox-open');
            console.log('   Active class added');
            console.log('✅ Lightbox opened successfully');
        });
    }

    /**
     * Close lightbox
     */
    function closeLightbox() {
        console.log('✖️ Closing lightbox...');
        
        // Remove active class for fade-out animation
        elements.lightbox.classList.remove('active');
        document.body.classList.remove('lightbox-open');
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            elements.lightbox.style.display = 'none';
            elements.lightboxImage.src = ''; // Clear image
        }, 400); // Match CSS transition duration
        
        console.log('✅ Lightbox closed');
    }

    /**
     * Initialize event listeners
     */
    function initializeEventListeners() {
        // Add to cart
        elements.addToCartBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddToCart();
        });

        // Quantity controls
        elements.decreaseBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDecrease();
        });

        elements.increaseBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleIncrease();
        });

        // Share buttons
        elements.pinterestBtn?.addEventListener('click', handlePinterestShare);
        elements.copyLinkBtn?.addEventListener('click', handleCopyLink);

        // Lightbox controls
        console.log('📸 Registering lightbox event listeners...');
        console.log('   Image wrapper:', elements.imageWrapper ? '✓ Found' : '✗ Not found');
        console.log('   Lightbox:', elements.lightbox ? '✓ Found' : '✗ Not found');
        console.log('   Close button:', elements.closeLightboxBtn ? '✓ Found' : '✗ Not found');

        if (elements.imageWrapper) {
            elements.imageWrapper.addEventListener('click', (e) => {
                console.log('🖱️ Image wrapper clicked!');
                e.preventDefault();
                e.stopPropagation();
                openLightbox();
            });
            console.log('✅ Image wrapper click listener added');
        } else {
            console.error('❌ Image wrapper not found - lightbox won\'t work!');
        }

        if (elements.closeLightboxBtn) {
            elements.closeLightboxBtn.addEventListener('click', (e) => {
                console.log('🖱️ Close button clicked!');
                e.preventDefault();
                e.stopPropagation();
                closeLightbox();
            });
            console.log('✅ Close button listener added');
        }

        // Close lightbox on background click
        if (elements.lightbox) {
            elements.lightbox.addEventListener('click', (e) => {
                if (e.target === elements.lightbox) {
                    console.log('🖱️ Background clicked!');
                    closeLightbox();
                }
            });
            console.log('✅ Background click listener added');
        }

        // Close lightbox on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.lightbox?.classList.contains('active')) {
                console.log('⌨️ ESC key pressed!');
                closeLightbox();
            }
        });
        console.log('✅ ESC key listener added');
    }

    /**
     * Initialize the product page
     */
    async function init() {
        console.log('🚀 Initializing product page...');

        // Get product ID from URL
        const productId = getProductIdFromURL();

        if (!productId) {
            console.error('❌ No product ID in URL');
            showError();
            return;
        }

        console.log(`📦 Loading product: ${productId}`);

        try {
            // Fetch product data
            const product = await fetchProductData(productId);

            // Display product
            await displayProduct(product);

            // Initialize event listeners
            initializeEventListeners();

            // Initialize cart control UI
            updateCartControlUI();

        } catch (error) {
            console.error('❌ Failed to initialize product page:', error);
            showError();
        }
    }

    // Wait for DOM and Cart to be ready
    function waitForDependencies() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkDependencies);
        } else {
            checkDependencies();
        }
    }

    function checkDependencies() {
        if (window.Cart) {
            init();
        } else {
            console.log('⏳ Waiting for Cart to load...');
            setTimeout(checkDependencies, 100);
        }
    }

    // Start initialization
    waitForDependencies();

})();
