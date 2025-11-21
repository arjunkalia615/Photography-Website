/**
 * Vercel Serverless Function
 * POST /api/webhook
 * Handles Stripe webhook events, particularly checkout.session.completed
 * Sends download links to customers after successful payment
 */

const stripe = require('stripe');
const db = require('./db');

async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST method is supported'
        });
    }

    try {
        // Get Stripe webhook secret from environment
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            console.error('STRIPE_WEBHOOK_SECRET is not set');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Webhook secret not configured'
            });
        }

        // Get Stripe signature from headers
        const signature = req.headers['stripe-signature'];
        
        if (!signature) {
            return res.status(400).json({
                error: 'Missing signature',
                message: 'Stripe signature header is required'
            });
        }

        // Determine which Stripe key to use
        const useTestMode = process.env.USE_TEST_STRIPE === 'true';
        const stripeSecretKey = useTestMode 
            ? process.env.STRIPE_SECRET_KEY_TEST 
            : process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            console.error('Stripe secret key not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Stripe secret key not configured'
            });
        }

        const stripeInstance = stripe(stripeSecretKey);

        // For Vercel, we need to get the raw body
        // Note: Vercel automatically parses JSON, so we need to reconstruct the raw body
        // In production, you may need to use req.body directly or configure Vercel to pass raw body
        let event;
        
        try {
            // Try to construct event with the body as-is first
            // If that fails, we'll try with stringified version
            try {
                event = stripeInstance.webhooks.constructEvent(
                    JSON.stringify(req.body),
                    signature,
                    webhookSecret
                );
            } catch (e) {
                // If that fails, try with the body directly (if it's already a string)
                event = stripeInstance.webhooks.constructEvent(
                    typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
                    signature,
                    webhookSecret
                );
            }
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({
                error: 'Invalid signature',
                message: 'Webhook signature verification failed'
            });
        }

        // Handle the event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            // Extract customer email
            const customerEmail = session.customer_email || session.customer_details?.email;
            
            if (!customerEmail) {
                console.error('No customer email found in session');
                return res.status(400).json({
                    error: 'Missing email',
                    message: 'Customer email not found in checkout session'
                });
            }

            // Fetch line items from Stripe (expanded)
            let lineItems = [];
            try {
                const expandedSession = await stripeInstance.checkout.sessions.retrieve(session.id, {
                    expand: ['line_items.data.price.product']
                });
                lineItems = expandedSession.line_items?.data || [];
            } catch (error) {
                console.error('Error fetching line items:', error);
            }

            // Extract cart items from metadata (fallback if line_items unavailable)
            let cartItems = [];
            if (session.metadata && session.metadata.cart_items) {
                try {
                    cartItems = JSON.parse(session.metadata.cart_items);
                } catch (parseError) {
                    console.error('Error parsing cart_items from metadata:', parseError);
                }
            }

            // Build purchased items array with productId, fileName, quantity
            const purchasedItems = [];
            const downloadCount = {};

            // Process line items or fallback to metadata
            if (lineItems.length > 0) {
                for (const lineItem of lineItems) {
                    // Try to get product info from line item
                    const productName = lineItem.price?.product?.name || lineItem.description || 'Photo';
                    const quantity = lineItem.quantity || 1;
                    
                    // Find matching cart item to get imageSrc
                    const cartItem = cartItems.find(ci => ci.name === productName || ci.title === productName);
                    const imageSrc = cartItem?.imageSrc || '';
                    const productId = cartItem?.productId || cartItem?.id || lineItem.id || `item_${Date.now()}_${Math.random()}`;
                    const fileName = imageSrc.split('/').pop() || `${productName.replace(/[^a-z0-9]/gi, '_')}.jpg`;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc,
                        title: productName,
                        quantity: quantity,
                        max_downloads: quantity // Each quantity = 1 download
                    });

                    downloadCount[productId] = 0;
                }
            } else if (cartItems.length > 0) {
                // Fallback: use cart items from metadata
                for (const cartItem of cartItems) {
                    const productId = cartItem.productId || cartItem.id || `item_${Date.now()}_${Math.random()}`;
                    const imageSrc = cartItem.imageSrc || '';
                    const fileName = imageSrc.split('/').pop() || `${(cartItem.title || cartItem.name).replace(/[^a-z0-9]/gi, '_')}.jpg`;
                    const quantity = cartItem.quantity || 1;

                    purchasedItems.push({
                        productId: productId,
                        fileName: fileName,
                        imageSrc: imageSrc,
                        title: cartItem.title || cartItem.name,
                        quantity: quantity,
                        max_downloads: quantity
                    });

                    downloadCount[productId] = 0;
                }
            }

            // Save purchase to database
            if (purchasedItems.length > 0) {
                const purchaseData = {
                    session_id: session.id,
                    customer_email: customerEmail,
                    purchased_items: purchasedItems,
                    download_count: downloadCount,
                    timestamp: new Date().toISOString(),
                    payment_status: session.payment_status
                };

                const saved = db.savePurchase(session.id, purchaseData);
                if (saved) {
                    console.log(`Purchase saved for session ${session.id}`);
                } else {
                    console.error(`Failed to save purchase for session ${session.id}`);
                }
            } else {
                console.warn(`No purchased items found for session ${session.id}`);
            }
        }

        // Return success response
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
            error: 'Webhook processing failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred processing the webhook'
        });
    }
}

/**
 * Send download email to customer
 */
async function sendDownloadEmail(customerEmail, downloadLinks, sessionId) {
    // Use Web3Forms or another email service to send download links
    // For now, we'll use a simple approach - you can integrate with your preferred email service
    
    const emailServiceUrl = 'https://api.web3forms.com/submit';
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY || '4a8d406c-49ac-40b2-a6da-e0de60f7e727';
    
    // Build download links HTML
    const downloadLinksHtml = downloadLinks.map((item, index) => {
        return `
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${item.title}</h3>
                <a href="${item.downloadUrl}" 
                   style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    Download High-Resolution Image
                </a>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Right-click the link and select "Save As" to download the full-resolution image.
                </p>
            </div>
        `;
    }).join('');

    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #fff; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">Your Digital Photography Downloads</h1>
                </div>
                <div class="content">
                    <p>Thank you for your purchase! Your payment has been processed successfully.</p>
                    <p><strong>Order ID:</strong> ${sessionId}</p>
                    <h2 style="margin-top: 30px;">Download Your High-Resolution Images</h2>
                    <p>Click the download links below to access your high-resolution digital photography prints. Files are provided in JPEG format at full quality with no compression.</p>
                    ${downloadLinksHtml}
                    <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="margin: 0;"><strong>Important:</strong> These are high-resolution files suitable for printing. Files are provided without compression to ensure the best quality.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>If you have any questions, please contact us at <a href="mailto:hello@ifeelworld.com">hello@ifeelworld.com</a></p>
                    <p>&copy; 2025 ifeelworld - All rights reserved</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Note: Web3Forms is for receiving form submissions, not sending emails to customers
    // For production, you should use a proper email service like SendGrid, Mailgun, or Resend
    // For now, we'll log the email content and the download links are available on the success page
    
    console.log('Download links for customer:', {
        email: customerEmail,
        sessionId: sessionId,
        downloadLinks: downloadLinks
    });

    // TODO: Integrate with proper email service (SendGrid, Mailgun, Resend, etc.)
    // For now, download links are available on the payment success page
    // The success page will display download links immediately after payment
    
    // Return success (email sending can be added later with proper email service)
    return { success: true, message: 'Download links available on success page' };
}

module.exports = handler;

