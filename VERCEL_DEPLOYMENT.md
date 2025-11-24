# Vercel Hobby Plan Deployment Guide

## Overview
This project has been optimized for Vercel Hobby plan with **ONE unified serverless function** (`api/functions.js`) that handles all API endpoints.

## Serverless Functions
- **Total Functions**: 1
- **Function File**: `api/functions.js`
- **Action-Based Routing**: All endpoints use `?action=<actionName>` parameter

## Supported Actions
1. `createSession` - Create Stripe checkout session
2. `getStripeKey` - Get Stripe publishable key
3. `getSessionDetails` - Get Stripe session details
4. `getDownloadLinks` - Get download links for purchased items
5. `downloadFile` - Download file for purchased items (ZIP)
6. `generateDownload` - Generate ZIP for cart items (testing)
7. `checkCartDownloadStatus` - Check cart download status
8. `checkPurchaseFinal` - Check if purchase is final
9. `checkWebhook` - Debug endpoint
10. `getDownloadLink` - Test download link
11. `webhook` - Stripe webhook handler

## Environment Variables Required

### Stripe Configuration
- `STRIPE_SECRET_KEY` - Live Stripe secret key
- `STRIPE_SECRET_KEY_TEST` - Test Stripe secret key (optional)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Live Stripe publishable key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` - Test Stripe publishable key (optional)
- `USE_TEST_STRIPE` - Set to `true` to use test keys, `false` or unset for live
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### Upstash Redis Configuration
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token

### Optional
- `SITE_URL` - Site URL (defaults to https://www.ifeelworld.com)
- `NODE_ENV` - Environment (development/production)

## Deployment Steps

### 1. Connect to Vercel
```bash
vercel login
vercel link
```

### 2. Set Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:

**Production:**
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `USE_TEST_STRIPE` = `false` (or leave unset)
- `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Preview/Development:**
- `STRIPE_SECRET_KEY_TEST`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`
- `USE_TEST_STRIPE` = `true`
- `STRIPE_WEBHOOK_SECRET` (test webhook secret)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 3. Configure Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://www.ifeelworld.com/api/functions?action=webhook`
3. Select events: `checkout.session.completed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Deploy
```bash
vercel --prod
```

Or push to main branch (if connected to Git):
```bash
git push origin main
```

## API Endpoint Mapping

### Old Endpoints (Removed)
- `/api/create-checkout-session` → `/api/functions?action=createSession`
- `/api/get-stripe-key` → `/api/functions?action=getStripeKey`
- `/api/get-download-links` → `/api/functions?action=getDownloadLinks`
- `/api/download-file` → `/api/functions?action=downloadFile`
- `/api/webhook` → `/api/functions?action=webhook`

### Frontend Usage
All frontend files have been updated to use the unified endpoint:
- `cart.html` ✅
- `checkout.html` ✅
- `payment.html` ✅
- `payment-success.html` ✅

## Features Preserved

✅ Stripe checkout session creation (test & live modes)
✅ ZIP generation with quantity copies
✅ Purchase verification and Redis storage
✅ Download button disabling after first download
✅ Read-only quantities after purchase
✅ Server-side validation prevents quantity modifications
✅ All Redis/Upstash tracking intact

## Testing

### Test Mode
1. Set `USE_TEST_STRIPE=true` in environment variables
2. Use test Stripe keys
3. Test checkout flow with test card: `4242 4242 4242 4242`

### Preview Deployment
1. Deploy to preview: `vercel`
2. Test all functionality in preview URL
3. Verify webhook works (use Stripe CLI for local testing)

## Troubleshooting

### Function Not Found
- Ensure `api/functions.js` exists
- Check `.vercelignore` doesn't exclude it
- Verify file is committed to Git

### Environment Variables Not Working
- Check variable names are exact (case-sensitive)
- Verify scope (Production/Preview/Development)
- Check Vercel logs for errors

### Webhook Not Working
- Verify webhook URL: `https://www.ifeelworld.com/api/functions?action=webhook`
- Check `STRIPE_WEBHOOK_SECRET` is set correctly
- Verify webhook events include `checkout.session.completed`

### Redis Errors
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- Check Upstash dashboard for connection status
- Verify Redis database is active

## Project Structure

```
Photography-Website/
├── api/
│   ├── functions.js          # ✅ Unified serverless function
│   ├── db.js                 # ✅ Redis/Upstash utilities
│   └── image-mapping.js      # ✅ Image path mapping
├── cart.html                 # ✅ Updated to use unified endpoint
├── checkout.html             # ✅ Updated to use unified endpoint
├── payment.html              # ✅ Updated to use unified endpoint
├── payment-success.html      # ✅ Updated to use unified endpoint
├── .vercelignore             # ✅ Excludes old API files
└── VERCEL_DEPLOYMENT.md      # ✅ This file
```

## Notes

- Old API files are excluded from deployment via `.vercelignore`
- All functionality consolidated into single function
- Meets Vercel Hobby plan limit (1 function instead of 12+)
- Ready for production deployment

