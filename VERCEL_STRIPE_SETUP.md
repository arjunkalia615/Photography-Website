# Vercel Stripe Checkout Setup Guide

## ✅ Fixed Issues

All Stripe Checkout integration issues have been resolved for Vercel deployment.

## Files Created/Modified

### 1. **`api/create-checkout-session.js`** (NEW - Vercel Serverless Function)
- ✅ Created Vercel-compatible serverless function
- ✅ Uses `process.env.STRIPE_SECRET_KEY` (no hardcoded keys)
- ✅ Proper error handling and validation
- ✅ CORS headers configured
- ✅ Returns JSON with correct status codes
- ✅ Validates request body and items array
- ✅ Uses production domain URLs

### 2. **`vercel.json`** (NEW - Vercel Configuration)
- ✅ Configured function timeout (10 seconds)
- ✅ API route rewrite configured

### 3. **`cart.html`** (UPDATED)
- ✅ Updated success/cancel URLs to use production domain
- ✅ No secret keys exposed (only publishable key)

### 4. **`payment.html`** (UPDATED)
- ✅ Updated success/cancel URLs to use production domain
- ✅ No secret keys exposed (only publishable key)

## Environment Variables Required in Vercel

You **MUST** set the following environment variable in your Vercel project:

### Required:
- **`STRIPE_SECRET_KEY`** = `sk_live_...` (your Stripe secret key)

### How to Set in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: Your Stripe secret key (starts with `sk_live_` for production)
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**

## Security Checklist

✅ **No secret keys in code** - All secret keys use `process.env.STRIPE_SECRET_KEY`
✅ **No `NEXT_PUBLIC_` prefix for secrets** - Secret key is server-side only
✅ **Publishable key only on frontend** - `pk_live_...` is safe to expose
✅ **Proper error handling** - No sensitive info leaked in error messages
✅ **CORS configured** - Allows requests from your domain

## API Endpoint

**URL**: `https://www.ifeelworld.com/api/create-checkout-session`

**Method**: `POST`

**Request Body**:
```json
{
  "items": [
    {
      "name": "Product Name",
      "description": "Product Description",
      "price": 0.99,
      "quantity": 1
    }
  ],
  "customer_email": "customer@example.com",
  "success_url": "https://www.ifeelworld.com/payment-success.html?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://www.ifeelworld.com/payment-cancel.html"
}
```

**Response**:
```json
{
  "id": "cs_test_..."
}
```

## Testing

### Local Testing (Optional):
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel dev`
3. Test the endpoint: `http://localhost:3000/api/create-checkout-session`

### Production Testing:
1. Deploy to Vercel
2. Ensure `STRIPE_SECRET_KEY` is set in Vercel environment variables
3. Test checkout flow on `https://www.ifeelworld.com`
4. Check Vercel function logs for any errors

## Common Issues & Solutions

### Issue: "Stripe secret key not configured"
**Solution**: Set `STRIPE_SECRET_KEY` in Vercel environment variables

### Issue: "Method not allowed"
**Solution**: Ensure you're using POST method (already configured)

### Issue: "Invalid request - Items array is required"
**Solution**: Ensure cart has items before checkout (already validated in frontend)

### Issue: CORS errors
**Solution**: CORS headers are already configured in the serverless function

## Deployment Checklist

Before deploying to Vercel:

- [x] `api/create-checkout-session.js` exists
- [x] `vercel.json` exists
- [x] Frontend URLs use production domain
- [x] No secret keys in code
- [x] `package.json` includes `stripe` dependency
- [ ] Set `STRIPE_SECRET_KEY` in Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Test checkout flow

## Next Steps

1. **Set Environment Variable in Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `STRIPE_SECRET_KEY` with your Stripe secret key

2. **Deploy to Vercel**:
   - Push your code to GitHub/GitLab
   - Vercel will auto-deploy
   - Or use `vercel --prod` command

3. **Test the Integration**:
   - Visit `https://www.ifeelworld.com`
   - Add items to cart
   - Click "Checkout"
   - Should redirect to Stripe Checkout page

4. **Monitor Logs**:
   - Check Vercel function logs for any errors
   - Monitor Stripe Dashboard for successful payments

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify `STRIPE_SECRET_KEY` is set correctly
3. Ensure Stripe account is in live mode (not test mode)
4. Verify publishable key matches your Stripe account

