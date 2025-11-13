// Gallery inline quantity controls
document.addEventListener('DOMContentLoaded', () => {
    const waitForCart = () => {
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

    waitForCart().then((cartInstance) => {
        // Convert all "Add to Cart" buttons to quantity controls
        document.querySelectorAll('.photo-item-add-to-cart-btn').forEach(btn => {
            const imageSrc = btn.getAttribute('data-image-src');
            const title = btn.getAttribute('data-title') || 'Photo';
            // Generate item ID the same way cart does
            const itemId = `${imageSrc}_4x6`;
            const existingItem = cartInstance.getItems().find(item => item.id === itemId);
            const currentQty = existingItem ? existingItem.quantity : 0;

            // Replace button with quantity controls
            const controlsHTML = `
                <div class="gallery-qty-controls" data-image-src="${imageSrc}" data-title="${title}">
                    <button class="gallery-qty-btn gallery-qty-decrease" ${currentQty === 0 ? 'style="display:none;"' : ''}>
                        ${currentQty === 1 ? '🗑️' : '−'}
                    </button>
                    <input type="number" class="gallery-qty-input" value="${currentQty}" min="0" max="10" readonly ${currentQty === 0 ? 'style="display:none;"' : ''}>
                    <button class="gallery-qty-btn gallery-qty-increase">+</button>
                </div>
            `;
            btn.outerHTML = controlsHTML;
        });

        // Add event listeners to quantity controls
        document.querySelectorAll('.gallery-qty-controls').forEach(controls => {
            const imageSrc = controls.getAttribute('data-image-src');
            const title = controls.getAttribute('data-title');
            const decreaseBtn = controls.querySelector('.gallery-qty-decrease');
            const increaseBtn = controls.querySelector('.gallery-qty-increase');
            const qtyInput = controls.querySelector('.gallery-qty-input');
            const itemId = `${imageSrc}_4x6`;

            increaseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentQty = parseInt(qtyInput.value) || 0;
                if (currentQty === 0) {
                    // Show controls
                    decreaseBtn.style.display = 'block';
                    qtyInput.style.display = 'block';
                }
                cartInstance.addItem(imageSrc, title, '4x6', 1);
                updateControls(controls, cartInstance, itemId);
            });

            decreaseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentQty = parseInt(qtyInput.value) || 0;
                if (currentQty === 1) {
                    cartInstance.removeItem(itemId);
                    // Hide controls
                    decreaseBtn.style.display = 'none';
                    qtyInput.style.display = 'none';
                } else if (currentQty > 1) {
                    cartInstance.adjustQuantity(itemId, -1);
                }
                updateControls(controls, cartInstance, itemId);
            });
        });

        // Listen for cart updates
        document.addEventListener('cart:updated', () => {
            document.querySelectorAll('.gallery-qty-controls').forEach(controls => {
                const imageSrc = controls.getAttribute('data-image-src');
                const itemId = `${imageSrc}_4x6`;
                updateControls(controls, cartInstance, itemId);
            });
        });
    });

    function updateControls(controls, cartInstance, itemId) {
        const existingItem = cartInstance.getItems().find(item => item.id === itemId);
        const currentQty = existingItem ? existingItem.quantity : 0;
        const decreaseBtn = controls.querySelector('.gallery-qty-decrease');
        const increaseBtn = controls.querySelector('.gallery-qty-increase');
        const qtyInput = controls.querySelector('.gallery-qty-input');

        qtyInput.value = currentQty;
        
        if (currentQty === 0) {
            decreaseBtn.style.display = 'none';
            qtyInput.style.display = 'none';
            decreaseBtn.textContent = '−';
        } else {
            decreaseBtn.style.display = 'block';
            qtyInput.style.display = 'block';
            decreaseBtn.textContent = currentQty === 1 ? '🗑️' : '−';
        }
    }
});

