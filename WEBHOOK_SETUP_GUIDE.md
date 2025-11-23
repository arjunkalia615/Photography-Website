# Stripe Webhook Setup Guide

**Date:** 2025-01-27  
**Purpose:** Configure Stripe webhook to send download links to customers after successful payment

## Overview

The webhook handler (`api/webhook.js`) automatically sends download links via email to customers after they complete a successful payment. The email includes high-quality, uncompressed download links for all purchased items.

## Setup Steps

### 1. Get Webhook Secret from Stripe

1. **Log into Stripe Dashboard**
   - Go to https://dashboard.stripe.com
   - Navigate to **Developers** → **Webhooks**

2. **Create New Webhook Endpoint**
   - Click **"Add endpoint"**
   - **Endpoint URL:** `https://www.ifeelworld.com/api/webhook`
   - **Description:** "Send download links after payment"
   - **Events to send:** Select `checkout.session.completed`
   - Click **"Add endpoint"**

3. **Copy Webhook Signing Secret**
   - After creating the endpoint, click on it
   - Find **"Signing secret"** (starts with `whsec_...`)
   - Click **"Reveal"** and copy the secret

### 2. Add Webhook Secret to Vercel

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Go to **Settings** → **Environment Variables**

2. **Add Environment Variable**
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Paste the webhook signing secret (starts with `whsec_...`)
   - **Environment:** Production (and Preview if needed)
   - Click **"Save"**

### 3. Optional: Add Site URL

If your site URL is different from `https://www.ifeelworld.com`, add:

- **Name:** `SITE_URL`
- **Value:** Your actual site URL (e.g., `https://www.ifeelworld.com`)
- **Environment:** Production

### 4. Test the Webhook

1. **Make a test purchase** on your site
2. **Complete the payment** (even with $0.50 test amount)
3. **Check Stripe Dashboard** → **Webhooks** → Your endpoint
   - You should see a successful event delivery
4. **Check customer email** - They should receive download links

## How It Works

### Flow:

1. **Customer completes payment** on Stripe Checkout
2. **Stripe sends webhook** to `/api/webhook` with `checkout.session.completed` event
3. **Webhook handler:**
   - Verifies webhook signature (security)
   - Extracts customer email from session
   - Extracts cart items from session metadata
   - Generates download links for each purchased item
   - Sends email with download links via Web3Forms

### Email Content:

- **Subject:** "Your Digital Photography Downloads - ifeelworld"
- **Content:**
  - Order confirmation
  - Order ID (Stripe session ID)
  - Download links for each purchased item
  - Instructions for downloading high-quality files
  - Contact information

### Download Links:

- **Format:** Direct links to high-resolution images
- **Quality:** Full quality, no compression
- **File Type:** JPEG format
- **Access:** Links are active immediately after payment

## File Structure

The webhook expects image paths in the format stored in cart items:
- Cart items include `imageSrc` property
- Example: `Images/Australia Photos/Sub-categories/Costal & Nature/Beach.jpg`
- Webhook constructs full URL: `https://www.ifeelworld.com/Images/...`

## Troubleshooting

### Webhook Not Receiving Events:

1. **Check Stripe Dashboard** → **Webhooks** → Your endpoint
   - Look for failed deliveries
   - Check error messages

2. **Verify Webhook Secret:**
   - Ensure `STRIPE_WEBHOOK_SECRET` is set in Vercel
   - Verify it matches the secret in Stripe Dashboard

3. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your project → **Functions**
   - Click on `api/webhook`
   - Check for errors in logs

### Email Not Sending:

1. **Check Web3Forms Access Key:**
   - Verify `WEB3FORMS_ACCESS_KEY` is set (or using default)
   - Check Web3Forms dashboard for delivery status

2. **Verify Customer Email:**
   - Ensure email is collected during checkout
   - Check that email is valid format

3. **Check Webhook Logs:**
   - Look for email sending errors in Vercel function logs

### Download Links Not Working:

1. **Verify Image Paths:**
   - Check that `imageSrc` is correctly stored in cart items
   - Verify image files exist at the specified paths

2. **Check File Permissions:**
   - Ensure image files are accessible via web
   - Verify no authentication required for downloads

## Security Notes

- ✅ **Webhook signature verification** - Prevents unauthorized requests
- ✅ **Email validation** - Ensures valid email addresses
- ✅ **Error handling** - Graceful failure with logging
- ✅ **No sensitive data** - Only sends download links, not payment info

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_SECRET_KEY` | Stripe secret key (live) | `sk_live_...` |
| `STRIPE_SECRET_KEY_TEST` | Stripe secret key (test) | `sk_test_...` |
| `USE_TEST_STRIPE` | Test mode flag | `false` |
| `SITE_URL` | Your website URL (optional) | `https://www.ifeelworld.com` |
| `WEB3FORMS_ACCESS_KEY` | Web3Forms access key (optional) | `4a8d406c-...` |

## Summary

✅ **Webhook endpoint created** - `/api/webhook`  
✅ **Email delivery configured** - Via Web3Forms  
✅ **Download links generated** - High-quality, uncompressed  
✅ **Security implemented** - Signature verification  
✅ **Error handling** - Comprehensive logging  

**Status:** ✅ **Ready for Configuration**

After setting up the webhook secret in Vercel and configuring the endpoint in Stripe, the system will automatically send download links to customers after successful payment.

---

**Report Generated:** 2025-01-27



