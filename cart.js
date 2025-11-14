// Simple Cart System - Clean Implementation
const CART_STORAGE_KEY = 'shoppingCart';
const ITEM_PRICE = 0.99; // Price per photo

// Cart Utilities
const CartUtils = {
    // Get cart from localStorage
    getCart() {
        try {
            const cart = localStorage.getItem(CART_STORAGE_KEY);
            return cart ? JSON.parse(cart) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    },

    // Save cart to localStorage
    saveCart(cart) {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    },

    // Format currency
    formatPrice(price) {
        return `$${price.toFixed(2)}`;
    },

    // Generate UUID v4
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Generate unique ID for item (fallback if no UUID provided)
    generateItemId(imageSrc, title) {
        return `${imageSrc}_${title}`.replace(/[^a-zA-Z0-9]/g, '_');
    },

    // Normalize image path (remove ../ for root-relative paths)
    normalizeImagePath(path) {
        if (path.startsWith('../')) {
            return path.replace(/^\.\.\//, '');
        }
        if (path.startsWith('./')) {
            return path.replace(/^\.\//, '');
        }
        return path;
    }
};

// Cart Operations
const Cart = {
    // Add item to cart
    addItem(imageSrc, title, price = ITEM_PRICE, productId = null) {
        const cart = CartUtils.getCart();
        const normalizedPath = CartUtils.normalizeImagePath(imageSrc);
        // Use provided productId (UUID) or generate one
        const itemId = productId || CartUtils.generateUUID();
        
        const existingItem = cart.find(item => item.id === itemId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: itemId,
                imageSrc: normalizedPath,
                title: title,
                price: price,
                quantity: 1
            });
        }
        
        CartUtils.saveCart(cart);
        Cart.updateBadge();
        return cart;
    },

    // Remove item from cart
    removeItem(itemId) {
        const cart = CartUtils.getCart();
        const filtered = cart.filter(item => item.id !== itemId);
        CartUtils.saveCart(filtered);
        Cart.updateBadge();
        return filtered;
    },

    // Update item quantity
    updateQuantity(itemId, quantity) {
        const cart = CartUtils.getCart();
        const item = cart.find(item => item.id === itemId);
        
        if (item) {
            if (quantity <= 0) {
                return Cart.removeItem(itemId);
            }
            item.quantity = Math.min(10, Math.max(1, quantity));
            CartUtils.saveCart(cart);
            Cart.updateBadge();
        }
        
        return cart;
    },

    // Get total items count
    getTotalItems() {
        const cart = CartUtils.getCart();
        return cart.reduce((total, item) => total + item.quantity, 0);
    },

    // Get total price
    getTotalPrice() {
        const cart = CartUtils.getCart();
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

    // Clear cart
    clear() {
        localStorage.removeItem(CART_STORAGE_KEY);
        Cart.updateBadge();
    },

    // Update cart badge in navigation
    updateBadge() {
        const badge = document.getElementById('cartBadge');
        if (badge) {
            const count = Cart.getTotalItems();
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }
};

// Initialize cart badge on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Cart.updateBadge());
} else {
    Cart.updateBadge();
}

// Make Cart available globally
window.Cart = Cart;
window.CartUtils = CartUtils;
