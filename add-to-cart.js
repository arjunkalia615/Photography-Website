// Add to Cart Button Handler - Simple Implementation
// Includes immediate download link display for testing purposes
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Cart to be available
    function initAddToCart() {
        if (!window.Cart) {
            setTimeout(initAddToCart, 100);
            return;
        }

        // Create or get download links container
        function getDownloadLinksContainer() {
            let container = document.getElementById('test-download-links-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'test-download-links-container';
                container.style.cssText = `
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    width: 320px;
                    max-height: 70vh;
                    overflow-y: auto;
                    background: rgba(0, 0, 0, 0.9);
                    border: 2px solid #51cf66;
                    border-radius: 8px;
                    padding: 15px;
                    z-index: 10000;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                `;
                
                const header = document.createElement('div');
                header.style.cssText = 'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #51cf66;';
                header.innerHTML = `
                    <h3 style="margin: 0; color: #51cf66; font-size: 1rem; font-weight: 600;">🧪 Test Download Links</h3>
                    <p style="margin: 5px 0 0 0; color: #888; font-size: 0.85rem;">Click to download immediately</p>
                `;
                container.appendChild(header);
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    width: 30px;
                    height: 30px;
                    line-height: 1;
                `;
                closeBtn.onclick = () => container.style.display = 'none';
                container.appendChild(closeBtn);
                
                document.body.appendChild(container);
            }
            return container;
        }

        // Add download link to container
        function addDownloadLink(imageSrc, title, itemId) {
            const container = getDownloadLinksContainer();
            const linksList = container.querySelector('.download-links-list') || (() => {
                const list = document.createElement('div');
                list.className = 'download-links-list';
                list.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
                container.appendChild(list);
                return list;
            })();
            
            // Check if link already exists for this item
            const existingLink = linksList.querySelector(`[data-item-id="${itemId}"]`);
            if (existingLink) {
                // Update existing link
                existingLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
            
            // Create download link element
            const linkItem = document.createElement('div');
            linkItem.setAttribute('data-item-id', itemId);
            linkItem.style.cssText = `
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
            
            const linkTitle = document.createElement('div');
            linkTitle.textContent = title;
            linkTitle.style.cssText = 'color: #fff; font-size: 0.9rem; margin-bottom: 8px; font-weight: 500;';
            linkItem.appendChild(linkTitle);
            
            const downloadBtn = document.createElement('a');
            const downloadUrl = `/api/get-download-link?imageSrc=${encodeURIComponent(imageSrc)}`;
            downloadBtn.href = downloadUrl;
            downloadBtn.target = '_blank';
            downloadBtn.textContent = '⬇ Download High-Resolution Image';
            downloadBtn.style.cssText = `
                display: inline-block;
                padding: 8px 16px;
                background: #51cf66;
                color: #000;
                text-decoration: none;
                border-radius: 4px;
                font-size: 0.85rem;
                font-weight: 500;
                transition: background 0.3s;
            `;
            downloadBtn.onmouseover = () => downloadBtn.style.background = '#45b85a';
            downloadBtn.onmouseout = () => downloadBtn.style.background = '#51cf66';
            linkItem.appendChild(downloadBtn);
            
            linksList.appendChild(linkItem);
            container.style.display = 'block';
            
            // Scroll to new link
            linkItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
                    const cart = Cart.addItem(imageSrc, title, undefined, productId);
                    
                    // Get the item ID (use productId or find in cart)
                    const itemId = productId || cart.find(item => 
                        item.imageSrc === CartUtils.normalizeImagePath(imageSrc) && 
                        item.title === title
                    )?.id;
                    
                    // Generate immediate download link for testing
                    addDownloadLink(imageSrc, title, itemId);
                    
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

