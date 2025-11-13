const CHECKOUT_MAX_QUANTITY = 10;

const formatCurrency = (value) => {
    const number = Number.isFinite(value) ? value : 0;
    return `$${number.toFixed(2)}`;
};

const clampQuantityValue = (value) => {
    return Math.max(1, Math.min(CHECKOUT_MAX_QUANTITY, parseInt(value, 10) || 1));
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

const buildQuantityOptions = (selected) => {
    let options = '';
    for (let i = 1; i <= CHECKOUT_MAX_QUANTITY; i += 1) {
        options += `<option value="${i}" ${i === selected ? 'selected' : ''}>${i}</option>`;
    }
    return options;
};

const createDimensionOptionsMarkup = (cartInstance, itemDimension) => {
    const featuredOptions = cartInstance.getDimensionOptions({ includeAll: false });
    const allOptions = cartInstance.getDimensionOptions({ includeAll: true });
    const hasFeaturedMatch = featuredOptions.some(option => option.value === itemDimension);

    const optionsSource = hasFeaturedMatch
        ? featuredOptions
        : [...featuredOptions, ...allOptions.filter(option => option.value === itemDimension)];

    return optionsSource.map(option => {
        const price = cartInstance.getDimensionPrice(option.value);
        return `<option value="${option.value}" ${option.value === itemDimension ? 'selected' : ''}>
            ${option.label} — ${formatCurrency(price)}
        </option>`;
    }).join('');
};

const renderCheckout = (cartInstance) => {
    const itemsContainer = document.getElementById('checkoutItems');
    const totalElement = document.getElementById('checkoutTotal');
    const buyNowButton = document.getElementById('buyNowButton');

    if (!itemsContainer || !totalElement || !buyNowButton) {
        return;
    }

    const items = cartInstance.getItems();

    if (!items.length) {
        itemsContainer.innerHTML = `
            <div class="checkout-empty">
                <p>Your cart is empty.</p>
                <a href="gallery.html" class="checkout-empty-link">Explore the gallery</a>
            </div>
        `;
        totalElement.textContent = '$0.00';
        buyNowButton.disabled = true;
        buyNowButton.classList.add('disabled');
        return;
    }

    const markup = items.map(item => {
        const itemPrice = cartInstance.getDimensionPrice(item.dimension);
        const itemTotal = itemPrice * item.quantity;
        const dimensionLabel = cartInstance.getDimensionLabel(item.dimension);

        return `
            <article class="checkout-item" data-item-id="${item.id}">
                <div class="checkout-item-thumbnail">
                    <img src="${item.imageSrc}" alt="${item.title || 'Selected photo'}" loading="lazy">
                </div>
                <div class="checkout-item-details">
                    <div class="checkout-item-header">
                        <h3 class="checkout-item-title">${item.title || 'Untitled Photo'}</h3>
                        <button class="checkout-item-remove" type="button" data-item-id="${item.id}" aria-label="Remove ${item.title || 'item'} from cart">Remove</button>
                    </div>
                    <div class="checkout-item-controls">
                        <label class="checkout-control">
                            <span class="checkout-control-label">Dimension</span>
                            <select class="checkout-item-dimension" data-item-id="${item.id}">
                                ${createDimensionOptionsMarkup(cartInstance, item.dimension)}
                            </select>
                        </label>
                        <label class="checkout-control">
                            <span class="checkout-control-label">Quantity</span>
                            <select class="checkout-item-quantity" data-item-id="${item.id}">
                                ${buildQuantityOptions(item.quantity)}
                            </select>
                        </label>
                    </div>
                    <div class="checkout-item-pricing">
                        <div class="checkout-item-price">
                            <span class="checkout-meta-label">Unit price</span>
                            <span>${formatCurrency(itemPrice)}</span>
                        </div>
                        <div class="checkout-item-total">
                            <span class="checkout-meta-label">Item total</span>
                            <span>${formatCurrency(itemTotal)}</span>
                        </div>
                    </div>
                    <p class="checkout-item-dimension-note">${dimensionLabel}</p>
                </div>
            </article>
        `;
    }).join('');

    itemsContainer.innerHTML = markup;

    const grandTotal = items.reduce((total, item) => {
        return total + (cartInstance.getDimensionPrice(item.dimension) * item.quantity);
    }, 0);

    totalElement.textContent = formatCurrency(grandTotal);
    buyNowButton.disabled = false;
    buyNowButton.classList.remove('disabled');
};

const setupCheckoutInteractions = (cartInstance) => {
    const itemsContainer = document.getElementById('checkoutItems');
    const buyNowButton = document.getElementById('buyNowButton');

    if (!itemsContainer || !buyNowButton) {
        return;
    }

    itemsContainer.addEventListener('change', (event) => {
        const target = event.target;
        const itemId = target.getAttribute('data-item-id');

        if (!itemId) return;

        if (target.classList.contains('checkout-item-dimension')) {
            cartInstance.updateDimension(itemId, target.value);
        }

        if (target.classList.contains('checkout-item-quantity')) {
            const quantity = clampQuantityValue(target.value);
            cartInstance.updateQuantity(itemId, quantity);
        }
    });

    itemsContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('checkout-item-remove')) {
            const itemId = target.getAttribute('data-item-id');
            if (itemId) {
                cartInstance.removeItem(itemId);
            }
        }
    });

    buyNowButton.addEventListener('click', () => {
        if (buyNowButton.disabled) return;
        window.location.href = `${window.location.origin}/Photography-Website/payment.html`;
    });
};

document.addEventListener('DOMContentLoaded', () => {
    waitForCartInstance().then((cartInstance) => {
        renderCheckout(cartInstance);
        setupCheckoutInteractions(cartInstance);
        document.addEventListener('cart:updated', () => renderCheckout(cartInstance));
    });
});

