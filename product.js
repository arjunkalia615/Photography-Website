/**
 * Product Page Dynamic Loader
 * Loads product details from the API and displays them
 * Integrates with existing cart system
 */

(function() {
    'use strict';

    // Configuration
    const ITEM_PRICE = 0.50;
    const DEFAULT_QUANTITY = 1;
    const MAX_QUANTITY = 10;

    // State
    let currentProduct = null;
    let currentQuantity = DEFAULT_QUANTITY;

    // DOM Elements
    const elements = {
        loading: document.getElementById('productLoading'),
        error: document.getElementById('productError'),
        content: document.getElementById('productContent'),
        image: document.getElementById('productImage'),
        title: document.getElementById('productTitle'),
        category: document.getElementById('productCategory'),
        breadcrumbTitle: document.getElementById('breadcrumbTitle'),
        resolution: document.getElementById('imageResolution'),
        quantityInput: document.getElementById('quantityInput'),
        decreaseBtn: document.getElementById('decreaseQty'),
        increaseBtn: document.getElementById('increaseQty'),
        addToCartBtn: document.getElementById('addToCartBtn'),
        pinterestBtn: document.getElementById('pinterestShareBtn'),
        copyLinkBtn: document.getElementById('copyLinkBtn'),
        copyFeedback: document.getElementById('copyLinkFeedback')
    };

    /**
     * Get product ID from URL query parameter
     */
    function getProductIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
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
     * Load image and get its dimensions
     */
    function loadImageDimensions(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                resolve({
                    width: this.naturalWidth,
                    height: this.naturalHeight
                });
            };
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            img.src = imageSrc;
        });
    }

    /**
     * Update meta tags for SEO and social sharing
     */
    function updateMetaTags(product) {
        const productUrl = window.location.href;
        const imageUrl = new URL(product.imageSrc, window.location.origin).href;
        const title = `${product.title} - ifeelworld Photography`;
        const description = `High-resolution digital photography print: ${product.title}. Available for instant download at $${ITEM_PRICE.toFixed(2)}.`;

        // Page title
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageDescription').setAttribute('content', description);

        // Open Graph
        document.getElementById('ogTitle').setAttribute('content', title);
        document.getElementById('ogDescription').setAttribute('content', description);
        document.getElementById('ogImage').setAttribute('content', imageUrl);
        document.getElementById('ogUrl').setAttribute('content', productUrl);

        // Twitter Card
        document.getElementById('twitterTitle').setAttribute('content', title);
        document.getElementById('twitterDescription').setAttribute('content', description);
        document.getElementById('twitterImage').setAttribute('content', imageUrl);

        // Update document title
        document.title = title;
    }

    /**
     * Display product on the page
     */
    async function displayProduct(product) {
        try {
            currentProduct = product;

            // Update meta tags
            updateMetaTags(product);

            // Set image
            elements.image.src = product.imageSrc;
            elements.image.alt = product.title;

            // Set title
            elements.title.textContent = product.title;
            elements.breadcrumbTitle.textContent = product.title;

            // Set category
            elements.category.textContent = product.category || 'Photography';

            // Load and display image dimensions
            try {
                const dimensions = await loadImageDimensions(product.imageSrc);
                elements.resolution.textContent = `${dimensions.width} × ${dimensions.height} pixels`;
            } catch (error) {
                console.warn('Could not load image dimensions:', error);
                elements.resolution.textContent = 'High Resolution';
            }

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
     * Update quantity display
     */
    function updateQuantity(newQuantity) {
        currentQuantity = Math.max(1, Math.min(MAX_QUANTITY, newQuantity));
        elements.quantityInput.value = currentQuantity;

        // Update button states
        elements.decreaseBtn.disabled = currentQuantity <= 1;
        elements.increaseBtn.disabled = currentQuantity >= MAX_QUANTITY;
    }

    /**
     * Handle add to cart
     */
    function handleAddToCart() {
        if (!currentProduct || !window.Cart) {
            console.error('Product or Cart not available');
            return;
        }

        const button = elements.addToCartBtn;
        const originalHTML = button.innerHTML;

        // Add items to cart (one at a time for the specified quantity)
        for (let i = 0; i < currentQuantity; i++) {
            Cart.addItem(
                currentProduct.imageSrc,
                currentProduct.title,
                ITEM_PRICE,
                currentProduct.productId
            );
        }

        // Visual feedback
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Added to Cart!</span>
        `;
        button.classList.add('added');

        // Reset after 2 seconds
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('added');
        }, 2000);

        console.log(`✅ Added ${currentQuantity} × ${currentProduct.title} to cart`);
    }

    /**
     * Handle Pinterest share
     */
    function handlePinterestShare() {
        if (!currentProduct) return;

        const url = encodeURIComponent(window.location.href);
        const imageUrl = encodeURIComponent(new URL(currentProduct.imageSrc, window.location.origin).href);
        const description = encodeURIComponent(`${currentProduct.title} - High-resolution digital photography print from ifeelworld`);

        const pinterestUrl = `https://www.pinterest.com/pin/create/button/?url=${url}&media=${imageUrl}&description=${description}`;
        
        window.open(pinterestUrl, 'pinterest-share', 'width=750,height=550');
        
        console.log('📌 Pinterest share opened');
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
     * Initialize event listeners
     */
    function initializeEventListeners() {
        // Quantity controls
        elements.decreaseBtn?.addEventListener('click', () => {
            updateQuantity(currentQuantity - 1);
        });

        elements.increaseBtn?.addEventListener('click', () => {
            updateQuantity(currentQuantity + 1);
        });

        elements.quantityInput?.addEventListener('change', (e) => {
            updateQuantity(parseInt(e.target.value) || 1);
        });

        // Add to cart
        elements.addToCartBtn?.addEventListener('click', handleAddToCart);

        // Share buttons
        elements.pinterestBtn?.addEventListener('click', handlePinterestShare);
        elements.copyLinkBtn?.addEventListener('click', handleCopyLink);
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

            // Set initial quantity
            updateQuantity(DEFAULT_QUANTITY);

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

