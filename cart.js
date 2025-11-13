const CART_DIMENSION_OPTIONS = [
    { value: '4x6', label: 'Classic 4" × 6"', price: 0.99, featured: true },
    { value: '5x7', label: 'Art Print 5" × 7"', price: 0.99, featured: false },
    { value: '8x10', label: 'Gallery 8" × 10"', price: 0.99, featured: true },
    { value: '11x14', label: 'Statement 11" × 14"', price: 0.99, featured: true }
];

const DIMENSION_PRICE_MAP = CART_DIMENSION_OPTIONS.reduce((map, option) => {
    map[option.value] = option.price;
    return map;
}, {});

const STORAGE_KEY = 'ifeelworld_cart';

const clampQuantity = (quantity) => {
    return Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));
};

const getDimensionPriceValue = (dimension) => {
    return DIMENSION_PRICE_MAP[dimension] ?? CART_DIMENSION_OPTIONS[0].price;
};

const formatCurrency = (value) => {
    const number = Number.isFinite(value) ? value : 0;
    return `$${number.toFixed(2)}`;
};

class Cart {
    constructor() {
        this.items = this.loadCart();
        this.elements = {
            navContainer: null,
            cartWrapper: null,
            cartIcon: null,
            cartBadge: null,
            cartDropdown: null,
            cartItemsContainer: null,
            cartTotal: null,
            cartCheckout: null
        };
        this.listenersAttached = {
            icon: false,
            dropdownClick: false,
            dropdownChange: false,
            checkout: false,
            document: false
        };

        this.handleCartIconClick = this.handleCartIconClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleCartDropdownClick = this.handleCartDropdownClick.bind(this);
        this.handleCartDropdownChange = this.handleCartDropdownChange.bind(this);
        this.navigateToCheckout = this.navigateToCheckout.bind(this);

        this.init();
    }

    init() {
        this.ensureCartStructure();
        this.attachUIEventListeners();
        this.renderCart();
        this.dispatchCartEvent('cart:updated');
        this.dispatchCartEvent('cart:ready');
    }

    loadCart() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return [];
            return parsed.map(item => this.normalizeItem(item)).filter(Boolean);
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    saveCart() {
        try {
            const payload = this.items.map(item => this.serializeItem(item));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    normalizeItem(item) {
        if (!item || !item.imageSrc) return null;

        const dimension = DIMENSION_PRICE_MAP[item.dimension]
            ? item.dimension
            : CART_DIMENSION_OPTIONS[0].value;

        const id = typeof item.id === 'string' && item.id.trim().length
            ? item.id
            : this.generateItemId(item.imageSrc, dimension);

        return {
            id,
            imageSrc: item.imageSrc,
            title: typeof item.title === 'string' ? item.title : '',
            dimension,
            quantity: clampQuantity(item.quantity),
            price: getDimensionPriceValue(dimension)
        };
    }

    serializeItem(item) {
        return {
            id: item.id,
            imageSrc: item.imageSrc,
            title: item.title,
            dimension: item.dimension,
            quantity: item.quantity
        };
    }

    generateItemId(imageSrc, dimension) {
        return `${imageSrc}_${dimension}`;
    }

    ensureCartStructure() {
        const navContainer = document.querySelector('.nav-container');
        if (!navContainer) return;
        this.elements.navContainer = navContainer;

        let cartWrapper = navContainer.querySelector('.cart-icon-wrapper');
        if (!cartWrapper) {
            cartWrapper = this.createCartIconMarkup();
            const mobileToggle = navContainer.querySelector('.mobile-menu-toggle');
            if (mobileToggle) {
                mobileToggle.insertAdjacentElement('afterend', cartWrapper);
            } else {
                navContainer.appendChild(cartWrapper);
            }
        }

        this.elements.cartWrapper = cartWrapper;
        this.elements.cartIcon = cartWrapper.querySelector('#cartIcon');
        this.elements.cartBadge = cartWrapper.querySelector('#cartBadge');

        const dropdown = document.getElementById('cartDropdown');
        if (dropdown) {
            if (dropdown.parentNode !== cartWrapper) {
                cartWrapper.appendChild(dropdown);
            }
            this.elements.cartDropdown = dropdown;
            this.elements.cartItemsContainer = dropdown.querySelector('#cartItems');
            this.elements.cartTotal = dropdown.querySelector('#cartTotal');
            this.elements.cartCheckout = dropdown.querySelector('#cartCheckout');
        }
    }

    createCartIconMarkup() {
        const wrapper = document.createElement('div');
        wrapper.className = 'cart-icon-wrapper';
        wrapper.innerHTML = `
            <button class="cart-icon" id="cartIcon" type="button" aria-label="Shopping Cart">
                <span class="cart-icon-graphic" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                </span>
                <span class="cart-icon-label">Cart</span>
                <span class="cart-badge" id="cartBadge" aria-live="polite">0</span>
            </button>
        `;
        return wrapper;
    }

    attachUIEventListeners() {
        if (this.elements.cartIcon && !this.listenersAttached.icon) {
            this.elements.cartIcon.addEventListener('click', this.handleCartIconClick);
            this.listenersAttached.icon = true;
        }

        if (!this.listenersAttached.document) {
            document.addEventListener('click', this.handleDocumentClick);
            this.listenersAttached.document = true;
        }

        if (this.elements.cartDropdown && !this.listenersAttached.dropdownClick) {
            this.elements.cartDropdown.addEventListener('click', this.handleCartDropdownClick);
            this.listenersAttached.dropdownClick = true;
        }

        if (this.elements.cartDropdown && !this.listenersAttached.dropdownChange) {
            this.elements.cartDropdown.addEventListener('change', this.handleCartDropdownChange);
            this.listenersAttached.dropdownChange = true;
        }

        if (this.elements.cartCheckout && !this.listenersAttached.checkout) {
            this.elements.cartCheckout.addEventListener('click', this.navigateToCheckout);
            this.listenersAttached.checkout = true;
        }
    }

    handleCartIconClick(event) {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = `${window.location.origin}/Photography-Website/cart.html`;
    }

    handleDocumentClick(event) {
        if (!this.elements.cartDropdown || !this.elements.cartIcon) return;
        const isIcon = this.elements.cartIcon.contains(event.target);
        const isDropdown = this.elements.cartDropdown.contains(event.target);
        if (!isIcon && !isDropdown) {
            this.toggleCartDropdown(false);
        }
    }

    handleCartDropdownClick(event) {
        const target = event.target;
        if (!target) return;

        const quantityBtn = target.closest('.quantity-btn');
        if (quantityBtn) {
            event.preventDefault();
            event.stopPropagation();
            const itemId = quantityBtn.dataset.itemId;
            const action = quantityBtn.dataset.action;
            if (itemId) {
                const delta = action === 'increase' ? 1 : -1;
                this.adjustQuantity(itemId, delta);
            }
            return;
        }

        if (target.classList.contains('cart-item-remove')) {
            event.preventDefault();
            event.stopPropagation();
            const itemId = target.dataset.itemId;
            if (itemId) {
                this.removeItem(itemId);
            }
        }
    }

    handleCartDropdownChange(event) {
        const target = event.target;
        if (!target) return;

        if (target.classList.contains('quantity-input')) {
            const itemId = target.dataset.itemId;
            const quantity = target.value;
            if (itemId) {
                this.updateQuantity(itemId, quantity);
            }
        }
    }

    toggleCartDropdown(forceState) {
        if (!this.elements.cartDropdown) return;
        const shouldActivate = typeof forceState === 'boolean'
            ? forceState
            : !this.elements.cartDropdown.classList.contains('active');
        if (shouldActivate) {
            this.elements.cartDropdown.classList.add('active');
        } else {
            this.elements.cartDropdown.classList.remove('active');
        }
    }

    renderCart() {
        this.ensureCartStructure();
        this.attachUIEventListeners();

        const {
            cartItemsContainer,
            cartTotal,
            cartCheckout,
            cartBadge
        } = this.elements;

        if (!cartItemsContainer || !cartTotal || !cartBadge) {
            return;
        }

        const totalItems = this.getTotalItems();
        if (totalItems > 0) {
            cartBadge.textContent = totalItems;
            cartBadge.style.display = 'flex';
        } else {
            cartBadge.style.display = 'none';
        }

        if (!this.items.length) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <p>Your cart is empty</p>
                </div>
            `;
            cartTotal.textContent = '$0.00';
            if (cartCheckout) {
                cartCheckout.style.display = 'none';
            }
            return;
        }

        cartItemsContainer.innerHTML = this.items.map(item => {
            const dimensionLabel = this.getDimensionLabel(item.dimension);
            const ariaTitle = item.title || 'Photo';

            return `
                <div class="cart-item" data-item-id="${item.id}">
                    <div class="cart-item-image">
                        <img src="${item.imageSrc}" alt="${ariaTitle}" loading="lazy">
                    </div>
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title || 'Untitled Photo'}</div>
                        <p class="cart-item-dimension-note">${dimensionLabel}</p>
                        <div class="cart-item-controls">
                            <div class="cart-item-quantity">
                                <button class="quantity-btn minus" data-item-id="${item.id}" data-action="decrease" aria-label="Decrease quantity for ${ariaTitle}">−</button>
                                <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="10" data-item-id="${item.id}" aria-label="Quantity for ${ariaTitle}">
                                <button class="quantity-btn plus" data-item-id="${item.id}" data-action="increase" aria-label="Increase quantity for ${ariaTitle}">+</button>
                            </div>
                            <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
                        </div>
                    </div>
                    <button class="cart-item-remove" data-item-id="${item.id}" aria-label="Remove ${ariaTitle}">×</button>
                </div>
            `;
        }).join('');

        cartTotal.textContent = formatCurrency(this.getTotalPrice());
        if (cartCheckout) {
            cartCheckout.style.display = 'block';
        }
    }

    addItem(imageSrc, title, dimension = '4x6', quantity = 1) {
        const validDimension = DIMENSION_PRICE_MAP[dimension]
            ? dimension
            : CART_DIMENSION_OPTIONS[0].value;
        const itemId = this.generateItemId(imageSrc, validDimension);
        const existingItem = this.items.find(item => item.id === itemId);

        if (existingItem) {
            const nextQuantity = clampQuantity(existingItem.quantity + quantity);
            if (nextQuantity !== existingItem.quantity) {
                existingItem.quantity = nextQuantity;
            }
            existingItem.price = getDimensionPriceValue(existingItem.dimension);
        } else {
            this.items.push({
                id: itemId,
                imageSrc,
                title,
                dimension: validDimension,
                quantity: clampQuantity(quantity),
                price: getDimensionPriceValue(validDimension)
            });
        }

        this.persistAndUpdate();
        this.showAddToCartNotification();
    }

    removeItem(itemId) {
        const nextItems = this.items.filter(item => item.id !== itemId);
        if (nextItems.length === this.items.length) return;
        this.items = nextItems;
        this.persistAndUpdate();
    }

    adjustQuantity(itemId, delta) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        const nextQuantity = clampQuantity(item.quantity + delta);
        this.updateQuantity(itemId, nextQuantity);
    }

    updateQuantity(itemId, quantity) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        const normalizedQuantity = clampQuantity(quantity);
        if (normalizedQuantity <= 0) {
            this.removeItem(itemId);
            return;
        }

        if (normalizedQuantity === item.quantity) return;

        item.quantity = normalizedQuantity;
        item.price = getDimensionPriceValue(item.dimension);
        this.persistAndUpdate();
    }

    updateDimension(itemId, dimension) {
        if (!DIMENSION_PRICE_MAP[dimension]) return;
        const item = this.items.find(i => i.id === itemId);
        if (!item || item.dimension === dimension) return;

        const newItemId = this.generateItemId(item.imageSrc, dimension);
        const existingItem = this.items.find(i => i.id === newItemId);

        if (existingItem) {
            existingItem.quantity = clampQuantity(existingItem.quantity + item.quantity);
            existingItem.price = getDimensionPriceValue(existingItem.dimension);
            this.items = this.items.filter(i => i.id !== itemId);
        } else {
            item.id = newItemId;
            item.dimension = dimension;
            item.price = getDimensionPriceValue(dimension);
        }

        this.persistAndUpdate();
    }

    persistAndUpdate() {
        this.items = this.items.map(item => this.normalizeItem(item)).filter(Boolean);
        this.saveCart();
        this.renderCart();
        this.dispatchCartEvent('cart:updated');
    }

    getTotalPrice() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getTotalItems() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    getItems() {
        return this.items.map(item => ({ ...item }));
    }

    getDimensionOptions({ includeAll = false } = {}) {
        const source = includeAll
            ? CART_DIMENSION_OPTIONS
            : CART_DIMENSION_OPTIONS.filter(option => option.featured !== false);
        return source.map(option => ({ ...option }));
    }

    getDimensionPrice(dimension) {
        return getDimensionPriceValue(dimension);
    }

    getDimensionLabel(dimension) {
        const option = CART_DIMENSION_OPTIONS.find(opt => opt.value === dimension);
        return option ? option.label : dimension;
    }

    dispatchCartEvent(name) {
        document.dispatchEvent(new CustomEvent(name, { detail: { cart: this } }));
    }

    showAddToCartNotification(message = 'Added to cart!') {
        let notification = document.getElementById('cartNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'cartNotification';
            notification.className = 'cart-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }

    navigateToCheckout(event) {
        if (event) {
            event.preventDefault();
        }
        window.location.href = `${window.location.origin}/Photography-Website/cart.html`;
    }
}

let cart;
const initializeCart = () => {
    cart = new Cart();
    if (typeof window !== 'undefined') {
        window.cart = cart;
        window.CART_DIMENSION_OPTIONS = CART_DIMENSION_OPTIONS;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCart);
} else {
    initializeCart();
}

