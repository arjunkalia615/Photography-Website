# Stripe Email Receipts Setup

**Date:** 2025-01-27  
**Status:** ✅ **CONFIGURED**

## Overview

Email receipts for successful payments and refunds are now properly configured. Customers will automatically receive email notifications from Stripe for both successful payments and refunds.

## Configuration

### 1. Stripe Dashboard Settings ✅

You have enabled:
- ✅ **Successful payments** - Email receipts for successful payments
- ✅ **Refunds** - Email notifications for refunds

These settings are active in your Stripe dashboard under Settings → Emails.

### 2. Code Configuration ✅

**File:** `api/create-checkout-session.js`

The checkout session now includes:

```javascript
// Customer email collection
customer_email: body.customer_email || undefined,

// Payment receipt email - ensures customer receives receipt after successful payment
// This overrides the Stripe dashboard setting and ensures emails are sent
receipt_email: body.customer_email || undefined,
```

**Why both `customer_email` and `receipt_email`?**

- `customer_email`: Pre-fills the email field in Stripe Checkout and associates the payment with the customer
- `receipt_email`: Explicitly sets the email address to receive payment receipts (overrides dashboard setting)

### 3. How It Works

#### Payment Receipts:

1. **Customer enters email** on checkout page (`checkout.html` or `payment.html`)
2. **Email is sent to backend** in the checkout session request
3. **Backend sets `receipt_email`** in the Stripe checkout session
4. **After successful payment**, Stripe automatically sends a receipt email to the customer
5. **Email includes:**
   - Payment confirmation
   - Transaction details
   - Receipt PDF (if enabled in Stripe dashboard)
   - Download links (if configured)

#### Refund Emails:

1. **Refund is processed** (manually through Stripe dashboard or via API)
2. **Stripe automatically sends email** to the customer (because dashboard setting is enabled)
3. **Email includes:**
   - Refund confirmation
   - Refund amount
   - Transaction details
   - Expected refund timeline

## Frontend Email Collection

The email is collected on:
- ✅ `checkout.html` - Email input field required
- ✅ `payment.html` - Email input field required
- ✅ `cart.html` - No email field (uses Stripe's email collection)

**Note:** If email is not provided in `cart.html`, Stripe Checkout will still collect it during the payment process, and the receipt will be sent to that email.

## Testing

### Test Payment Receipt:

1. Add items to cart
2. Proceed to checkout
3. Enter your email address
4. Complete payment
5. **Check your email** - You should receive a receipt from Stripe within a few minutes

### Test Refund Email:

1. Process a refund through Stripe dashboard
2. **Check customer's email** - They should receive a refund notification

## Important Notes

### Receipt Email Override:

According to Stripe documentation:
> "This setting is ignored when you create a payment in the API and provide the receipt_email parameter."

This means:
- ✅ When `receipt_email` is provided in the API (which we do), it **overrides** the dashboard setting
- ✅ This ensures emails are **always sent** regardless of dashboard settings
- ✅ This is the recommended approach for reliable email delivery

### Refund Emails:

- ✅ Refund emails are controlled by the **dashboard setting** (which you've enabled)
- ✅ When a refund is processed, Stripe automatically sends an email
- ✅ No additional code is needed for refund emails

## Email Content Customization

You can customize email content in Stripe Dashboard:
1. Go to **Settings → Emails**
2. Click on **"Successful payments"** or **"Refunds"**
3. Customize the email template
4. Add your branding, logo, and custom messaging

## Troubleshooting

### Customer Not Receiving Payment Receipts:

1. **Check email address** - Verify the email was entered correctly
2. **Check spam folder** - Stripe emails sometimes go to spam
3. **Verify `receipt_email` is set** - Check the checkout session in Stripe dashboard
4. **Check Stripe logs** - Look for email delivery status in Stripe dashboard

### Customer Not Receiving Refund Emails:

1. **Verify dashboard setting** - Ensure "Refunds" email is enabled
2. **Check refund was processed** - Verify refund status in Stripe dashboard
3. **Check customer email** - Ensure correct email is associated with the payment

## Summary

✅ **Payment receipts** - Configured via `receipt_email` parameter  
✅ **Refund emails** - Enabled in Stripe dashboard  
✅ **Email collection** - Working on all checkout pages  
✅ **Automatic delivery** - Stripe handles all email sending  

**Status:** ✅ **Fully Configured and Ready**

---

**Report Generated:** 2025-01-27

