const formatCurrency = (value) => {
    const number = Number.isFinite(value) ? value : 0;
    return `$${number.toFixed(2)}`;
};

const waitForCartInstance = () => {
    return new Promise((resolve) => {
        // Check if cart is already available
        if (window.cart) {
            resolve(window.cart);
            return;
        }

        // Wait for cart:ready event
        const handleReady = (event) => {
            document.removeEventListener('cart:ready', handleReady);
            resolve(event.detail.cart);
        };

        // If event already fired, check again after a short delay
        const checkCart = () => {
            if (window.cart) {
                resolve(window.cart);
            } else {
                document.addEventListener('cart:ready', handleReady);
                // Fallback: resolve after timeout if cart still not ready
                setTimeout(() => {
                    if (window.cart) {
                        document.removeEventListener('cart:ready', handleReady);
                        resolve(window.cart);
                    }
                }, 1000);
            }
        };

        // Check immediately and also listen for event
        checkCart();
    });
};

const renderCartPage = (cartInstance) => {
    const itemsList = document.getElementById('cartItemsList');
    const emptyState = document.getElementById('cartEmpty');
    const itemCountEl = document.getElementById('cartItemCount');
    const summaryItemCount = document.getElementById('summaryItemCount');
    const summarySubtotal = document.getElementById('summarySubtotal');
    const summaryTotal = document.getElementById('summaryTotal');
    const proceedBtn = document.getElementById('proceedToCheckout');

    if (!itemsList || !emptyState) {
        console.error('Cart page elements not found:', { itemsList, emptyState });
        return;
    }

    const items = cartInstance.getItems();
    const totalItems = cartInstance.getTotalItems();
    const totalPrice = cartInstance.getTotalPrice();

    // Debug logging
    console.log('Rendering cart page:', {
        itemsCount: items.length,
        totalItems,
        totalPrice,
        items: items
    });

    // Update item count
    if (itemCountEl) {
        itemCountEl.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;
    }

    if (!items.length) {
        itemsList.style.display = 'none';
        emptyState.style.display = 'block';
        if (proceedBtn) {
            proceedBtn.disabled = true;
        }
        if (summaryItemCount) summaryItemCount.textContent = '0';
        if (summarySubtotal) summarySubtotal.textContent = '$0.00';
        if (summaryTotal) summaryTotal.textContent = '$0.00';
        return;
    }

    itemsList.style.display = 'block';
    emptyState.style.display = 'none';
    if (proceedBtn) {
        proceedBtn.disabled = false;
    }

    // Render items
    itemsList.innerHTML = items.map(item => {
        const itemPrice = cartInstance.getDimensionPrice(item.dimension);
        const itemTotal = itemPrice * item.quantity;
        const dimensionLabel = cartInstance.getDimensionLabel(item.dimension);

        return `
            <div class="cart-page-item" data-item-id="${item.id}">
                <div class="cart-page-item-checkbox">
                    <input type="checkbox" class="cart-item-checkbox" data-item-id="${item.id}" checked>
                </div>
                <div class="cart-page-item-thumbnail">
                    <img src="${item.imageSrc}" alt="${item.title || 'Photo'}" loading="lazy">
                </div>
                <div class="cart-page-item-details">
                    <h3 class="cart-page-item-title">${item.title || 'Untitled Photo'}</h3>
                    <p class="cart-page-item-dimension">${dimensionLabel}</p>
                    <div class="cart-page-item-quantity-controls">
                        <button class="cart-qty-btn cart-qty-decrease" data-item-id="${item.id}" aria-label="Decrease quantity">
                            ${item.quantity === 1 ? '🗑️' : '−'}
                        </button>
                        <input type="number" class="cart-qty-input" value="${item.quantity}" min="1" max="10" data-item-id="${item.id}" readonly>
                        <button class="cart-qty-btn cart-qty-increase" data-item-id="${item.id}" aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <div class="cart-page-item-price-section">
                    <div class="cart-page-item-unit-price">${formatCurrency(itemPrice)}</div>
                    <div class="cart-page-item-total-price">${formatCurrency(itemTotal)}</div>
                </div>
            </div>
        `;
    }).join('');

    // Update summary - show totals for ALL items in cart
    updateSummary(cartInstance);
};

const setupCartPageInteractions = (cartInstance) => {
    const itemsList = document.getElementById('cartItemsList');
    const proceedBtn = document.getElementById('proceedToCheckout');

    if (!itemsList) return;

    // Quantity controls
    itemsList.addEventListener('click', (e) => {
        const target = e.target;
        const itemId = target.getAttribute('data-item-id');
        if (!itemId) return;

        if (target.classList.contains('cart-qty-decrease')) {
            const item = cartInstance.getItems().find(i => i.id === itemId);
            if (item && item.quantity === 1) {
                cartInstance.removeItem(itemId);
            } else {
                cartInstance.adjustQuantity(itemId, -1);
            }
        } else if (target.classList.contains('cart-qty-increase')) {
            cartInstance.adjustQuantity(itemId, 1);
        }
    });

    // Checkbox changes - only affect checkout selection, not summary totals
    // Summary always shows all items, so we don't need to update it here
    itemsList.addEventListener('change', (e) => {
        if (e.target.classList.contains('cart-item-checkbox')) {
            // Checkboxes are for checkout selection only
            // Summary totals remain for all items
        }
    });

    // Proceed to checkout
    if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
            const selectedItems = getSelectedItems(cartInstance);
            if (selectedItems.length === 0) return;
            
            // Store selected items for checkout
            localStorage.setItem('ifeelworld_checkout_items', JSON.stringify(selectedItems));
            const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            window.location.href = basePath ? `${basePath}/payment.html` : 'payment.html';
        });
    }
};

const getSelectedItems = (cartInstance) => {
    const checkboxes = document.querySelectorAll('.cart-item-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-item-id'));
    return cartInstance.getItems().filter(item => selectedIds.includes(item.id));
};

const updateSummary = (cartInstance) => {
    // Calculate totals for ALL items in cart (not just selected)
    const allItems = cartInstance.getItems();
    const totalItems = cartInstance.getTotalItems();
    const totalPrice = cartInstance.getTotalPrice();

    const summaryItemCount = document.getElementById('summaryItemCount');
    const summarySubtotal = document.getElementById('summarySubtotal');
    const summaryTotal = document.getElementById('summaryTotal');
    const proceedBtn = document.getElementById('proceedToCheckout');

    if (summaryItemCount) summaryItemCount.textContent = totalItems;
    if (summarySubtotal) summarySubtotal.textContent = formatCurrency(totalPrice);
    if (summaryTotal) summaryTotal.textContent = formatCurrency(totalPrice);
    if (proceedBtn) {
        // Disable proceed button only if cart is empty
        proceedBtn.disabled = allItems.length === 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Cart page DOM loaded, waiting for cart instance...');
    
    waitForCartInstance().then((cartInstance) => {
        console.log('Cart instance received:', cartInstance);
        console.log('Cart items from instance:', cartInstance.getItems());
        console.log('Total items:', cartInstance.getTotalItems());
        
        // Initial render
        renderCartPage(cartInstance);
        setupCartPageInteractions(cartInstance);
        
        // Listen for cart updates (when items are added/removed/quantity changed)
        // Event delegation means we don't need to re-setup interactions after re-render
        document.addEventListener('cart:updated', () => {
            console.log('Cart updated event received, re-rendering...');
            renderCartPage(cartInstance);
            updateSummary(cartInstance);
        });
    }).catch((error) => {
        console.error('Error waiting for cart instance:', error);
        // Fallback: try to render with window.cart if available
        if (window.cart) {
            console.log('Using window.cart as fallback');
            renderCartPage(window.cart);
            setupCartPageInteractions(window.cart);
        } else {
            console.error('No cart instance available');
        }
    });
});

