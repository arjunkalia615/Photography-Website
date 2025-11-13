const formatCurrency = (value) => {
    const number = Number.isFinite(value) ? value : 0;
    return `$${number.toFixed(2)}`;
};

const waitForCartInstance = () => {
    return new Promise((resolve) => {
        if (window.cart) {
            resolve(window.cart);
            return;
        }

        const handleReady = (event) => {
            document.removeEventListener('cart:ready', handleReady);
            resolve(event.detail.cart);
        };

        document.addEventListener('cart:ready', handleReady);
    });
};

const renderPaymentItems = (cartInstance) => {
    const itemsContainer = document.getElementById('paymentItems');
    const totalElement = document.getElementById('paymentTotal');

    if (!itemsContainer || !totalElement) {
        return;
    }

    // Get selected items from checkout (stored in localStorage)
    let items = [];
    try {
        const selectedItemsData = localStorage.getItem('ifeelworld_checkout_items');
        if (selectedItemsData) {
            const selectedItems = JSON.parse(selectedItemsData);
            // Match with current cart items to get full data
            const allCartItems = cartInstance.getItems();
            const selectedIds = selectedItems.map(item => item.id);
            items = allCartItems.filter(item => selectedIds.includes(item.id));
        } else {
            // Fallback to all items if no selection stored
            items = cartInstance.getItems();
        }
    } catch (error) {
        console.error('Error loading selected items:', error);
        items = cartInstance.getItems();
    }

    if (!items.length) {
        itemsContainer.innerHTML = `
            <div class="payment-empty">
                <p>Your cart is empty.</p>
                <a href="gallery.html" class="payment-empty-link">Explore the gallery</a>
            </div>
        `;
        totalElement.textContent = '$0.00';
        return;
    }

    const markup = items.map(item => {
        const itemPrice = cartInstance.getDimensionPrice(item.dimension);
        const itemTotal = itemPrice * item.quantity;
        const dimensionLabel = cartInstance.getDimensionLabel(item.dimension);

        return `
            <div class="payment-item" data-item-id="${item.id}">
                <div class="payment-item-thumbnail">
                    <img src="${item.imageSrc}" alt="${item.title || 'Selected photo'}" loading="lazy">
                </div>
                <div class="payment-item-info">
                    <h3 class="payment-item-title">${item.title || 'Untitled Photo'}</h3>
                    <p class="payment-item-dimension">${dimensionLabel}</p>
                    <div class="payment-item-details">
                        <span class="payment-item-quantity">Quantity: ${item.quantity}</span>
                        <span class="payment-item-price">${formatCurrency(itemTotal)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    itemsContainer.innerHTML = markup;

    const grandTotal = items.reduce((total, item) => {
        return total + (cartInstance.getDimensionPrice(item.dimension) * item.quantity);
    }, 0);

    totalElement.textContent = formatCurrency(grandTotal);
};

document.addEventListener('DOMContentLoaded', () => {
    waitForCartInstance().then((cartInstance) => {
        renderPaymentItems(cartInstance);
        document.addEventListener('cart:updated', () => renderPaymentItems(cartInstance));
    });
});

