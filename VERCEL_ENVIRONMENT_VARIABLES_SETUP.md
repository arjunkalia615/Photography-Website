# Vercel Environment Variables Setup Guide

**Important:** This guide explains how to properly configure Stripe environment variables in Vercel for different environments.

---

## The Problem

If you're seeing errors like:
- "Stripe publishable key not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST"
- Even though you've added the variables in Vercel

This usually means the variables are set for the wrong **environment scope** in Vercel.

---

## Understanding Vercel Environment Scopes

Vercel has three environment scopes:

1. **Production** - Only used when deploying to your production domain
2. **Preview** - Used for all preview deployments (pull requests, branches)
3. **Development** - Used for local development with `vercel dev`

**Important:** When you add an environment variable, you must select which scope(s) it applies to!

---

## How to Set Environment Variables Correctly

### Step 1: Go to Vercel Dashboard

1. Go to your project in Vercel: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Each Variable with Correct Scope

For each environment variable, you need to:

1. **Click "Add New"**
2. **Enter the variable name** (exactly as shown below)
3. **Enter the value**
4. **Select the environment scope(s)** - THIS IS CRITICAL!

---

## Required Environment Variables

### For Production Environment

Set these variables with **Production** scope:

| Variable Name | Value | Scope |
|--------------|------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | ✅ Production |
| `STRIPE_SECRET_KEY_TEST` | `sk_test_...` | ✅ Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` | `pk_test_...` | ✅ Production |
| `USE_TEST_STRIPE` | `false` | ✅ Production |

### For Preview/Development Environments

Set these variables with **Preview** and/or **Development** scope:

| Variable Name | Value | Scope |
|--------------|------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ Preview, ✅ Development |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | ✅ Preview, ✅ Development |
| `STRIPE_SECRET_KEY_TEST` | `sk_test_...` | ✅ Preview, ✅ Development |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` | `pk_test_...` | ✅ Preview, ✅ Development |
| `USE_TEST_STRIPE` | `true` | ✅ Preview, ✅ Development |

---

## Common Mistakes

### ❌ Mistake 1: Only Setting for Production

**Problem:** You set variables only for "Production" scope, but you're testing in a Preview deployment.

**Solution:** Also set the variables for "Preview" scope.

### ❌ Mistake 2: Wrong Variable Name

**Problem:** Typo in variable name (e.g., `STRIPE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)

**Solution:** Copy-paste the exact variable names from this guide.

### ❌ Mistake 3: Extra Spaces

**Problem:** Extra spaces before/after the key value.

**Solution:** Make sure there are no leading or trailing spaces when pasting the key.

### ❌ Mistake 4: Wrong USE_TEST_STRIPE Value

**Problem:** Setting `USE_TEST_STRIPE=true` in production (should be `false`)

**Solution:** 
- Production: `USE_TEST_STRIPE=false`
- Preview/Development: `USE_TEST_STRIPE=true`

---

## Step-by-Step: Setting Variables for Preview Environment

Since you're getting the error about `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`, you're likely testing in a Preview environment. Here's how to fix it:

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **For each variable, check if it exists for Preview scope:**
   - Look for the variable in the list
   - Check the "Environments" column
   - If it only shows "Production", you need to add it for Preview too

3. **To add/update for Preview:**
   - Click on the variable (or "Add New" if it doesn't exist)
   - Make sure **"Preview"** checkbox is checked
   - Enter the value
   - Click "Save"

4. **Verify all 5 variables are set for Preview:**
   - ✅ `STRIPE_SECRET_KEY` (can use test key: `sk_test_...`)
   - ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (can use test key: `pk_test_...`)
   - ✅ `STRIPE_SECRET_KEY_TEST` (`sk_test_...`)
   - ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` (`pk_test_...`)
   - ✅ `USE_TEST_STRIPE` (`true`)

5. **Redeploy:**
   - After adding variables, Vercel will automatically redeploy
   - Or trigger a new deployment manually

---

## How to Verify Variables Are Set Correctly

### Method 1: Check Vercel Dashboard

1. Go to **Settings** → **Environment Variables**
2. Look at each variable
3. Check the "Environments" column shows the correct scope(s)

### Method 2: Check Function Logs

1. Go to your deployment in Vercel
2. Click on **Functions** tab
3. Click on a function (e.g., `api/get-stripe-key`)
4. Check the logs - you should see:
   ```
   Stripe Publishable Key Configuration: {
     mode: 'TEST' or 'LIVE',
     vercelEnv: 'preview' or 'production',
     hasTestKey: true,
     hasLiveKey: true,
     ...
   }
   ```

### Method 3: Check Browser Console

1. Open your site
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for logs starting with "Stripe key response"
5. If you see an error, it will show which variables are available

---

## Quick Fix Checklist

If you're getting the error right now:

- [ ] Go to Vercel Dashboard → Settings → Environment Variables
- [ ] For each of the 5 variables, verify:
  - [ ] Variable name is exactly correct (no typos)
  - [ ] Value is correct (no extra spaces)
  - [ ] **Preview** checkbox is checked (if testing in preview)
  - [ ] **Production** checkbox is checked (for production)
- [ ] Set `USE_TEST_STRIPE=true` for Preview
- [ ] Set `USE_TEST_STRIPE=false` for Production
- [ ] Redeploy your site
- [ ] Check browser console for initialization logs

---

## Still Having Issues?

If you've verified all variables are set correctly but still getting errors:

1. **Check the exact error message** - it will tell you which variable is missing
2. **Check Vercel function logs** - they show which variables are available
3. **Verify you're looking at the right deployment** - Preview vs Production
4. **Try redeploying** - sometimes Vercel needs a fresh deployment to pick up new variables

---

## Summary

**The key issue:** Environment variables in Vercel are scoped to specific environments (Production, Preview, Development). If you're testing in a Preview deployment but only set variables for Production, they won't be available.

**The solution:** Make sure all 5 Stripe environment variables are set for **both** Production and Preview scopes (with appropriate values for each).

---

**Last Updated:** 2025-01-27

