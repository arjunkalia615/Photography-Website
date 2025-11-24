// Add to Cart Button Handler - Simple Implementation
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Cart to be available
    function initAddToCart() {
        if (!window.Cart) {
            setTimeout(initAddToCart, 100);
            return;
        }

        // Remove any existing test download links container if it exists
        const existingContainer = document.getElementById('test-download-links-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Find all Add to Cart buttons
        const addToCartButtons = document.querySelectorAll('.photo-item-add-to-cart-btn');
        
        addToCartButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                const imageSrc = button.getAttribute('data-image-src');
                const title = button.getAttribute('data-title') || 'Photo';
                const productId = button.getAttribute('data-product-id');
                
                if (imageSrc && title) {
                    // Add item to cart with product ID (UUID)
                    Cart.addItem(imageSrc, title, undefined, productId);
                    
                    // Show visual feedback
                    button.textContent = 'Added!';
                    button.style.backgroundColor = '#4CAF50';
                    
                    setTimeout(() => {
                        button.textContent = 'Add to Cart';
                        button.style.backgroundColor = '';
                    }, 1000);
                }
            });
        });
    }

    initAddToCart();
});

