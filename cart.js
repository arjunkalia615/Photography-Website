// Cart Management System
class Cart {
    constructor() {
        this.items = this.loadCart();
        this.init();
    }

    init() {
        this.renderCartIcon();
        this.setupEventListeners();
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const cartData = localStorage.getItem('ifeelworld_cart');
            return cartData ? JSON.parse(cartData) : [];
        } catch (e) {
            console.error('Error loading cart:', e);
            return [];
        }
    }

    // Save cart to localStorage
    saveCart() {
        try {
            localStorage.setItem('ifeelworld_cart', JSON.stringify(this.items));
            this.updateCartIcon();
            this.renderCart();
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    }

    // Generate unique ID for cart item
    generateItemId(imageSrc, dimension) {
        return `${imageSrc}_${dimension}`;
    }

    // Add item to cart
    addItem(imageSrc, title, dimension = '4x6', quantity = 1) {
        const itemId = this.generateItemId(imageSrc, dimension);
        const existingItem = this.items.find(item => item.id === itemId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                id: itemId,
                imageSrc: imageSrc,
                title: title,
                dimension: dimension,
                quantity: quantity,
                price: 0.99
            });
        }

        this.saveCart();
        this.showAddToCartNotification();
    }

    // Remove item from cart
    removeItem(itemId) {
        this.items = this.items.filter(item => item.id !== itemId);
        this.saveCart();
    }

    // Update item quantity
    updateQuantity(itemId, quantity) {
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            if (quantity <= 0) {
                this.removeItem(itemId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
        }
    }

    // Update item dimension
    updateDimension(itemId, dimension) {
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            // If dimension changes, we need to create a new item and remove old one
            if (item.dimension !== dimension) {
                const newItemId = this.generateItemId(item.imageSrc, dimension);
                const existingItem = this.items.find(i => i.id === newItemId);
                
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    this.items.push({
                        id: newItemId,
                        imageSrc: item.imageSrc,
                        title: item.title,
                        dimension: dimension,
                        quantity: item.quantity,
                        price: 0.99
                    });
                }
                this.removeItem(itemId);
            }
        }
    }

    // Calculate total price
    getTotalPrice() {
        return this.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
    }

    // Get total items count
    getTotalItems() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    // Update cart icon badge
    updateCartIcon() {
        const cartIcon = document.getElementById('cartIcon');
        const cartBadge = document.getElementById('cartBadge');
        
        if (cartIcon && cartBadge) {
            const totalItems = this.getTotalItems();
            if (totalItems > 0) {
                cartBadge.textContent = totalItems;
                cartBadge.style.display = 'flex';
            } else {
                cartBadge.style.display = 'none';
            }
        }
    }

    // Render cart icon
    renderCartIcon() {
        const navContainer = document.querySelector('.nav-container');
        if (!navContainer) return;

        // Check if cart icon already exists
        if (document.getElementById('cartIcon')) {
            this.updateCartIcon();
            return;
        }

        const cartIconWrapper = document.createElement('div');
        cartIconWrapper.className = 'cart-icon-wrapper';
        cartIconWrapper.innerHTML = `
            <button class="cart-icon" id="cartIcon" aria-label="Shopping Cart">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span class="cart-badge" id="cartBadge">0</span>
            </button>
        `;

        // Insert before mobile menu toggle
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileToggle) {
            navContainer.insertBefore(cartIconWrapper, mobileToggle);
        } else {
            navContainer.appendChild(cartIconWrapper);
        }

        // Move cart dropdown into cart icon wrapper if it exists
        const existingCartDropdown = document.getElementById('cartDropdown');
        if (existingCartDropdown && existingCartDropdown.parentNode !== cartIconWrapper) {
            cartIconWrapper.appendChild(existingCartDropdown);
        }

        this.updateCartIcon();
    }

    // Render cart dropdown
    renderCart() {
        const cartDropdown = document.getElementById('cartDropdown');
        if (!cartDropdown) return;

        const cartItemsContainer = document.getElementById('cartItems');
        if (!cartItemsContainer) return;

        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <p>Your cart is empty</p>
                </div>
            `;
            document.getElementById('cartTotal').textContent = '$0.00';
            document.getElementById('cartCheckout').style.display = 'none';
            return;
        }

        document.getElementById('cartCheckout').style.display = 'block';
        
        cartItemsContainer.innerHTML = this.items.map(item => `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-image">
                    <img src="${item.imageSrc}" alt="${item.title}" loading="lazy">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-controls">
                        <select class="cart-item-dimension" data-item-id="${item.id}">
                            <option value="4x6" ${item.dimension === '4x6' ? 'selected' : ''}>4x6</option>
                            <option value="5x7" ${item.dimension === '5x7' ? 'selected' : ''}>5x7</option>
                            <option value="8x10" ${item.dimension === '8x10' ? 'selected' : ''}>8x10</option>
                            <option value="11x14" ${item.dimension === '11x14' ? 'selected' : ''}>11x14</option>
                        </select>
                        <div class="cart-item-quantity">
                            <button class="quantity-btn minus" data-item-id="${item.id}">−</button>
                            <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-item-id="${item.id}">
                            <button class="quantity-btn plus" data-item-id="${item.id}">+</button>
                        </div>
                    </div>
                    <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <button class="cart-item-remove" data-item-id="${item.id}" aria-label="Remove item">×</button>
            </div>
        `).join('');

        // Update total
        document.getElementById('cartTotal').textContent = `$${this.getTotalPrice().toFixed(2)}`;

        // Attach event listeners to cart items
        this.attachCartItemListeners();
    }

    // Attach event listeners to cart items
    attachCartItemListeners() {
        // Quantity controls
        document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const item = this.items.find(i => i.id === itemId);
                if (item) {
                    this.updateQuantity(itemId, item.quantity - 1);
                }
            });
        });

        document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const item = this.items.find(i => i.id === itemId);
                if (item) {
                    this.updateQuantity(itemId, item.quantity + 1);
                }
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const quantity = parseInt(e.target.value) || 1;
                this.updateQuantity(itemId, quantity);
            });
        });

        // Dimension select
        document.querySelectorAll('.cart-item-dimension').forEach(select => {
            select.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                const dimension = e.target.value;
                this.updateDimension(itemId, dimension);
            });
        });

        // Remove buttons
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.removeItem(itemId);
            });
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Cart icon click
        document.addEventListener('click', (e) => {
            const cartIcon = document.getElementById('cartIcon');
            const cartDropdown = document.getElementById('cartDropdown');
            
            if (cartIcon && cartDropdown) {
                if (cartIcon.contains(e.target) || cartIcon === e.target) {
                    e.stopPropagation();
                    cartDropdown.classList.toggle('active');
                } else if (!cartDropdown.contains(e.target)) {
                    cartDropdown.classList.remove('active');
                }
            }
        });

        // Checkout button
        const checkoutBtn = document.getElementById('cartCheckout');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                alert('Checkout functionality coming soon!');
            });
        }
    }

    // Show add to cart notification
    showAddToCartNotification() {
        // Create notification if it doesn't exist
        let notification = document.getElementById('cartNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'cartNotification';
            notification.className = 'cart-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = 'Added to cart!';
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }

    // Get current image data from lightbox
    getCurrentLightboxImage() {
        const lightboxImage = document.getElementById('lightboxImage');
        if (lightboxImage && lightboxImage.src) {
            return {
                src: lightboxImage.src,
                alt: lightboxImage.alt || 'Photo'
            };
        }
        return null;
    }
}

// Initialize cart when DOM is ready
let cart;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cart = new Cart();
    });
} else {
    cart = new Cart();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.cart = cart;
}

