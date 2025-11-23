# Webhook Debugging Guide

## Issue: Purchase Not Found After Checkout

If you're seeing "Purchase not found" errors after completing a checkout, follow these steps:

## Step 1: Check Vercel Function Logs

1. Go to your Vercel dashboard
2. Navigate to your project
3. Click on "Functions" tab
4. Look for `/api/webhook` function calls
5. Check for these log messages:

### Expected Logs (Success):
```
✅ Webhook received for session ID: cs_live_...
📦 Event type: checkout.session.completed
🔍 Session details: {...}
💾 Attempting to save purchase for session: cs_live_...
✅ Saved purchase to Redis for: cs_live_...
🔑 Redis key: purchase:cs_live_...
```

### Error Logs to Look For:
```
❌ CRITICAL: Failed to save purchase for session cs_live_... - Redis write failed
❌ Error saving purchase to Redis for cs_live_...
⚠️ WARNING: No purchased items found for session cs_live_...
```

## Step 2: Check Webhook Configuration in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Find your webhook endpoint
3. Verify:
   - **Endpoint URL**: `https://your-domain.com/api/webhook`
   - **Events**: `checkout.session.completed` is enabled
   - **Status**: Active (green)
   - **Recent events**: Check if events are being received

## Step 3: Test Webhook Manually

Use the debug endpoint to check if a purchase was saved:

```
GET https://your-domain.com/api/check-webhook?session_id=cs_live_...
```

This will return:
```json
{
  "sessionId": "cs_live_...",
  "found": true/false,
  "purchase": {...} or null,
  "redisKey": "purchase:cs_live_..."
}
```

## Step 4: Check Environment Variables

Verify these are set in Vercel:

### Required:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY` (or `STRIPE_SECRET_KEY_TEST` if using test mode)
- `USE_TEST_STRIPE` (set to `true` for test mode)

## Step 5: Common Issues and Fixes

### Issue 1: Webhook Not Being Called
**Symptoms:**
- No logs in Vercel for `/api/webhook`
- No events in Stripe webhook dashboard

**Fix:**
- Verify webhook endpoint URL in Stripe matches your Vercel deployment URL
- Check that `checkout.session.completed` event is enabled
- Ensure webhook secret is set correctly in Vercel

### Issue 2: Redis Connection Failed
**Symptoms:**
- Logs show: `❌ Failed to initialize Upstash Redis`
- Logs show: `❌ Error saving purchase to Redis`

**Fix:**
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel
- Check that Upstash Redis database is active
- Verify credentials are correct

### Issue 3: No Purchased Items Found
**Symptoms:**
- Logs show: `⚠️ WARNING: No purchased items found for session`
- Purchase saved but `purchasedItemsCount: 0`

**Fix:**
- Check that `cart_items` metadata is being sent in checkout session
- Verify `create-checkout-session.js` includes metadata with cart items
- Check that line items are being retrieved from Stripe

### Issue 4: Purchase Saved But Not Found
**Symptoms:**
- Webhook logs show purchase saved successfully
- But `/api/get-download-links` returns 404

**Fix:**
- Check Redis key format matches exactly: `purchase:{sessionId}`
- Verify session ID is the same in webhook and success page
- Check for typos or extra characters in session ID

## Step 6: Manual Testing

1. **Complete a test purchase**
2. **Immediately check Vercel logs** for webhook call
3. **Use debug endpoint** to verify purchase was saved:
   ```
   https://your-domain.com/api/check-webhook?session_id=YOUR_SESSION_ID
   ```
4. **Check success page** - should show download links

## Step 7: Enable Detailed Logging

The webhook now logs:
- Session details (payment status, email, metadata)
- Item counts (line items, cart items, purchased items)
- Redis save attempts and results
- Verification of saved data

Check Vercel logs for these detailed messages to diagnose issues.

## Quick Fix Checklist

- [ ] Webhook endpoint URL correct in Stripe
- [ ] `checkout.session.completed` event enabled
- [ ] Webhook secret set in Vercel
- [ ] Upstash Redis credentials set in Vercel
- [ ] Webhook being called (check Vercel logs)
- [ ] Purchase being saved (check logs for `✅ Saved purchase`)
- [ ] Session ID matches between webhook and success page

## Still Not Working?

1. Check Vercel Function Logs for detailed error messages
2. Use `/api/check-webhook` endpoint to verify purchase exists
3. Check Stripe webhook dashboard for event delivery status
4. Verify all environment variables are set correctly
5. Test with a new purchase and monitor logs in real-time

---

**Last Updated:** 2025-01-27

