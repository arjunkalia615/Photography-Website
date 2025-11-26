// Add to Cart Button Handler - Delegated to gallery.html for quantity control
// This file is kept for backward compatibility with other pages that might use it
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Cart to be available
    function initAddToCart() {
        if (!window.Cart) {
            setTimeout(initAddToCart, 100);
            return;
        }

        // Only handle buttons that are NOT inside photo-item-cart-control-wrapper
        // (those are handled by gallery.html's initializeCartControls)
        const addToCartButtons = document.querySelectorAll('.photo-item-add-to-cart-btn:not(.photo-item-cart-control-wrapper .photo-item-add-to-cart-btn)');
        
        addToCartButtons.forEach(button => {
            // Check if this button is already handled by gallery.html
            if (button.closest('.photo-item-cart-control-wrapper')) {
                return; // Skip - handled by gallery.html
            }
            
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

