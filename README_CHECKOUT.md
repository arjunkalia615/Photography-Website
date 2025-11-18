# Stripe Checkout Integration for ifeelworld

This setup provides a complete Stripe Checkout integration for selling digital photography downloads.

## Files Created

1. **checkout.js** - Express backend server with Stripe Checkout endpoint
2. **checkout.html** - Frontend checkout page with Stripe.js integration
3. **package.json** - Node.js dependencies
4. **.env.example** - Environment variables template

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Stripe secret key:

```
STRIPE_SECRET_KEY=sk_live_your_actual_secret_key_here
PORT=3000
BACKEND_URL=http://localhost:3000
```

**Important:** Never commit your `.env` file to version control. Add it to `.gitignore`.

### 3. Get Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret key** (starts with `sk_live_` for production or `sk_test_` for testing)
3. Add it to your `.env` file

**Publishable Key:** `pk_live_51SUISK2cmeiwN9KC1HMjyswAEDlAyQvn4mqB7DU37ZQRx1xJAtP6a7wDrFgRez0M0T499VhCcHYwAnuiba8uQixK00K82cy4wy`
(This is already set in `checkout.html`)

### 4. Start the Backend Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will run on `http://localhost:3000` (or the PORT you specified).

### 5. Update Frontend Backend URL

In `checkout.html`, update the `BACKEND_URL` constant to match your deployed backend:

```javascript
const BACKEND_URL = 'https://your-backend-domain.com';
```

Or set it via environment variable if using a build process.

## API Endpoints

### POST `/create-checkout-session`

Creates a Stripe Checkout session and returns the checkout URL.

**Request Body:**
```json
{
  "items": [
    {
      "name": "Digital Photography Print - Beach",
      "description": "High-resolution digital photography print",
      "price": 0.99,
      "quantity": 1
    }
  ],
  "customer_email": "customer@example.com",
  "success_url": "https://www.ifeelworld.com/payment-success.html",
  "cancel_url": "https://www.ifeelworld.com/payment-cancel.html"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

### GET `/checkout-session/:sessionId`

Retrieves checkout session details (optional, for verification).

### GET `/health`

Health check endpoint.

## Frontend Integration

The `checkout.html` page:

1. Loads items from the shopping cart (using `cart.js`)
2. Collects customer email
3. Sends POST request to `/create-checkout-session`
4. Redirects to Stripe's hosted checkout page
5. After payment, redirects to success/cancel URLs

## Customizing Line Items

In `checkout.js`, the `lineItems` array is built from the request body. You can:

1. **Use cart data** (current implementation) - Items come from the frontend cart
2. **Use fixed products** - Replace the example items with your actual products
3. **Use Stripe Price IDs** - If you create prices in Stripe Dashboard, use `price: 'price_xxx'` instead of `price_data`

Example with Price IDs:
```javascript
const lineItems = items.map(item => ({
    price: item.stripe_price_id, // e.g., 'price_1234567890'
    quantity: item.quantity || 1,
}));
```

## Success and Cancel Pages

Create these pages:

- `payment-success.html` - Shown after successful payment
- `payment-cancel.html` - Shown if user cancels checkout

You can retrieve the session ID from the URL parameter:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
```

## Security Notes

1. **Never expose your secret key** - Only use it in the backend
2. **Use HTTPS in production** - Stripe requires HTTPS for live mode
3. **Validate input** - Add validation for items, prices, quantities
4. **Set CORS properly** - Configure CORS to only allow your frontend domain
5. **Use environment variables** - Never hardcode keys in code

## Testing

For testing, use Stripe test mode:

1. Get test keys from Stripe Dashboard (toggle "Test mode")
2. Use test publishable key: `pk_test_...`
3. Use test secret key: `sk_test_...`
4. Use test card numbers from [Stripe Testing](https://stripe.com/docs/testing)

## Deployment

1. Deploy backend to a Node.js hosting service (Heroku, Railway, Render, etc.)
2. Set environment variables in your hosting platform
3. Update `BACKEND_URL` in `checkout.html` to your deployed backend URL
4. Ensure HTTPS is enabled (required for Stripe live mode)

## Support

For issues or questions:
- Stripe Documentation: https://stripe.com/docs/checkout
- Stripe Support: https://support.stripe.com

