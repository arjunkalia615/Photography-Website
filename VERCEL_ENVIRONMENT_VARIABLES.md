# Vercel Environment Variables Setup Guide

**Date:** 2025-01-27  
**Purpose:** Complete list of environment variables needed for ifeelworld.com

## Required Environment Variables

### Stripe Configuration

#### Production (Live Mode):
| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Stripe live secret key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe live publishable key | `pk_live_...` |
| `USE_TEST_STRIPE` | Test mode flag | `false` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |

#### Test Mode (Optional):
| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `STRIPE_SECRET_KEY_TEST` | Stripe test secret key | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` | Stripe test publishable key | `pk_test_...` |
| `USE_TEST_STRIPE` | Test mode flag | `true` |

### Optional Configuration

| Variable Name | Description | Default Value |
|---------------|-------------|---------------|
| `SITE_URL` | Your website URL | `https://www.ifeelworld.com` |

## How to Add Environment Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Navigate to https://vercel.com/dashboard
   - Select your project: **ifeelworld-checkout** (or your project name)

2. **Open Project Settings**
   - Click on your project
   - Go to **Settings** tab
   - Click on **Environment Variables** in the left sidebar

3. **Add Each Variable**
   - Click **"Add New"** button
   - Enter the **Variable Name** (exactly as shown above)
   - Enter the **Value**
   - Select **Environments** where it applies:
     - ✅ **Production** (for live mode)
     - ✅ **Preview** (optional, for test deployments)
     - ✅ **Development** (optional, for local testing)
   - Click **"Save"**

4. **Repeat for All Variables**
   - Add all required variables listed above
   - Make sure `USE_TEST_STRIPE` is set to `false` for Production

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Add environment variables
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add USE_TEST_STRIPE production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add SITE_URL production
```

## Getting Your Stripe Keys

### 1. Stripe Secret Keys

1. **Go to Stripe Dashboard**
   - https://dashboard.stripe.com
   - Log in to your account

2. **Navigate to API Keys**
   - Click **"Developers"** in the left sidebar
   - Click **"API keys"**

3. **Get Secret Key**
   - **Live mode:** Copy **"Secret key"** (starts with `sk_live_...`)
   - **Test mode:** Toggle to **"Test mode"**, copy **"Secret key"** (starts with `sk_test_...`)

### 2. Stripe Publishable Keys

1. **Same page as above** (Developers → API keys)
2. **Get Publishable Key**
   - **Live mode:** Copy **"Publishable key"** (starts with `pk_live_...`)
   - **Test mode:** Toggle to **"Test mode"**, copy **"Publishable key"** (starts with `pk_test_...`)

### 3. Stripe Webhook Secret

1. **Go to Stripe Dashboard**
   - Navigate to **Developers** → **Webhooks**

2. **Create or Select Webhook Endpoint**
   - Click **"Add endpoint"** (if creating new)
   - Or click on existing endpoint

3. **Set Endpoint URL**
   - **URL:** `https://www.ifeelworld.com/api/webhook`
   - **Description:** "Purchase tracking and download links"
   - **Events to send:** Select `checkout.session.completed`
   - Click **"Add endpoint"**

4. **Copy Signing Secret**
   - After creating, click on the endpoint
   - Find **"Signing secret"** (starts with `whsec_...`)
   - Click **"Reveal"** and copy

## Environment-Specific Configuration

### Production Environment

**Required Variables:**
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
USE_TEST_STRIPE=false
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://www.ifeelworld.com
```

### Preview/Development Environment (Optional)

**For Testing:**
```
STRIPE_SECRET_KEY_TEST=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
USE_TEST_STRIPE=true
STRIPE_WEBHOOK_SECRET=whsec_... (test webhook secret)
SITE_URL=https://your-preview-url.vercel.app
```

## Verification

### After Adding Variables:

1. **Redeploy Your Project**
   - Go to **Deployments** tab in Vercel
   - Click **"Redeploy"** on latest deployment
   - Or push a new commit to trigger deployment

2. **Check Function Logs**
   - Go to **Functions** tab in Vercel
   - Check logs for any environment variable errors

3. **Test Checkout**
   - Make a test purchase
   - Verify webhook receives events
   - Check that download links work

## Important Notes

### Security:
- ✅ **Never commit** environment variables to Git
- ✅ **Never share** secret keys publicly
- ✅ **Use different keys** for test and production
- ✅ **Rotate keys** if compromised

### Variable Names:
- ⚠️ **Case-sensitive** - Use exact names as shown
- ⚠️ **No spaces** - Use underscores for separation
- ⚠️ **No quotes** - Don't wrap values in quotes (Vercel handles this)

### Stripe Keys:
- ✅ **Secret keys** start with `sk_live_` or `sk_test_`
- ✅ **Publishable keys** start with `pk_live_` or `pk_test_`
- ✅ **Webhook secrets** start with `whsec_`

## Troubleshooting

### Variables Not Working:

1. **Check Variable Names**
   - Ensure exact match (case-sensitive)
   - No typos or extra spaces

2. **Check Environment Selection**
   - Ensure variables are set for correct environment (Production/Preview/Development)

3. **Redeploy After Changes**
   - Environment variables require redeployment
   - Push new commit or manually redeploy

4. **Check Function Logs**
   - Look for "undefined" or "missing" errors
   - Verify variables are accessible in functions

### Webhook Not Working:

1. **Verify Webhook Secret**
   - Check it matches in Stripe Dashboard
   - Ensure it's set in Vercel

2. **Check Webhook URL**
   - Must be: `https://www.ifeelworld.com/api/webhook`
   - Must be accessible (not blocked by firewall)

3. **Check Stripe Dashboard**
   - Go to **Webhooks** → Your endpoint
   - Check for failed deliveries
   - Review error messages

## Summary

✅ **All required variables listed**  
✅ **Step-by-step setup instructions**  
✅ **Stripe key retrieval guide**  
✅ **Troubleshooting tips**  

**Next Steps:**
1. Add all environment variables to Vercel
2. Redeploy your project
3. Test checkout flow
4. Verify webhook receives events

---

**Report Generated:** 2025-01-27



