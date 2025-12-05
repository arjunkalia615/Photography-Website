# Stripe Webhook Quick Setup - Fix "No purchase found" Error

**Issue:** You're seeing "No purchase found for this session ID" after payment.

**Cause:** The Stripe webhook isn't configured, so purchases aren't being saved to the database.

## Quick Fix - 3 Steps

### Step 1: Create Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard**
   - https://dashboard.stripe.com
   - Make sure you're in **Live mode** (toggle in top right)

2. **Navigate to Webhooks**
   - Click **"Developers"** in left sidebar
   - Click **"Webhooks"**

3. **Add New Endpoint**
   - Click **"Add endpoint"** button
   - **Endpoint URL:** `https://www.ifeelworld.com/api/webhook`
   - **Description:** "Save purchases and track downloads"
   - **Events to send:** 
     - Click **"Select events"**
     - Check **"checkout.session.completed"**
     - Click **"Add events"**
   - Click **"Add endpoint"**

4. **Copy Signing Secret**
   - After creating, click on your new endpoint
   - Find **"Signing secret"** (starts with `whsec_...`)
   - Click **"Reveal"** button
   - **Copy the entire secret** (starts with `whsec_`)

### Step 2: Add Secret to Vercel

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your **ifeelworld** project

2. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Click **"Add New"**
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Paste the secret you copied (starts with `whsec_...`)
   - **Environments:** 
     - ✅ Check **Production**
     - ✅ Check **Preview** (optional)
   - Click **"Save"**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger redeploy

### Step 3: Test

1. **Make a test purchase** ($0.00)
2. **Check Stripe Dashboard** → **Webhooks** → Your endpoint
   - You should see a successful event delivery
   - Click on it to see details
3. **Check success page** - Download links should appear!

## Troubleshooting

### Webhook Not Receiving Events?

1. **Check Webhook URL**
   - Must be exactly: `https://www.ifeelworld.com/api/webhook`
   - No trailing slash
   - Must be HTTPS

2. **Check Stripe Dashboard**
   - Go to **Webhooks** → Your endpoint
   - Look for failed deliveries
   - Click on failed delivery to see error

3. **Check Vercel Logs**
   - Go to Vercel → Your project → **Functions**
   - Click on `api/webhook`
   - Check for errors in logs

### Still Getting "No purchase found"?

1. **Wait a few seconds** - Webhook might be processing
2. **Refresh the page** - The retry mechanism should work
3. **Check browser console** (F12) - Look for error messages
4. **Check Vercel function logs** - See if webhook is receiving events

### Database Issue?

On Vercel, the database uses `/tmp` which is ephemeral. For production, consider:
- **Vercel KV** (Redis) - Recommended
- **Supabase** - Free tier available

But for testing, `/tmp` should work fine.

## Verification Checklist

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Endpoint URL is correct: `https://www.ifeelworld.com/api/webhook`
- [ ] Event `checkout.session.completed` is selected
- [ ] Webhook secret copied (starts with `whsec_`)
- [ ] `STRIPE_WEBHOOK_SECRET` added to Vercel
- [ ] Vercel project redeployed
- [ ] Test purchase made
- [ ] Webhook shows successful delivery in Stripe Dashboard

## Important Notes

- **Live vs Test Mode:** Make sure webhook is created in the same mode (Live/Test) as your checkout
- **Webhook Secret:** Each webhook endpoint has its own secret - use the one for your endpoint
- **Redeploy Required:** After adding environment variable, you must redeploy for it to take effect

---

**After setup, the webhook will automatically save all purchases and download links will appear on the success page!**

