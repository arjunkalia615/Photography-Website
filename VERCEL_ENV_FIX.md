# Vercel Environment Variable Fix

## Issues Found and Fixed

### 1. ✅ **Runtime Configuration** (FIXED)
**Problem**: The API route didn't explicitly specify Node.js runtime, which could cause Vercel to use Edge runtime by default. Edge runtime cannot access secure environment variables.

**Fix Applied**:
- Added explicit `runtime: "nodejs22.x"` in `vercel.json`
- This ensures the function uses Node.js runtime which can access `process.env.STRIPE_SECRET_KEY`

### 2. ✅ **Variable Name Verification** (ENHANCED)
**Problem**: No way to debug if the variable name doesn't match exactly.

**Fix Applied**:
- Added debug logging to show available environment variables
- Error response now includes available Stripe-related env vars
- This helps identify if the variable name is misspelled

### 3. ✅ **Export Format** (FIXED)
**Problem**: Function export format needed to be standard Vercel format.

**Fix Applied**:
- Changed to standard `module.exports = handler` format
- Runtime is now specified in `vercel.json` (more reliable)

## Files Modified

### `api/create-checkout-session.js`
- ✅ Removed `module.exports.config` (runtime now in vercel.json)
- ✅ Added debug logging for environment variables
- ✅ Enhanced error messages with available env vars

### `vercel.json`
- ✅ Added explicit `"runtime": "nodejs22.x"` to function config
- ✅ This ensures Node.js runtime (not Edge) is used

## Verification Steps

After deploying, check the following:

### 1. Verify Environment Variable in Vercel
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Verify:
   - **Name**: `STRIPE_SECRET_KEY` (exact, case-sensitive, no spaces)
   - **Value**: Your Stripe secret key (starts with `sk_live_`)
   - **Environment**: Must include **Production** (check all: Production, Preview, Development)

### 2. Check Function Logs
After deploying, if you still get the error:
1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `api/create-checkout-session`
3. Check the logs - you should see:
   - `Environment check:` with debug info
   - `hasStripeKey: true` if the variable is found
   - `availableStripeVars:` showing all Stripe-related env vars

### 3. Common Issues to Check

#### Issue: Variable name mismatch
- ❌ Wrong: `STRIPE_SECRET_KEY ` (trailing space)
- ❌ Wrong: `stripe_secret_key` (lowercase)
- ❌ Wrong: `STRIPE_SECRET_KEY_` (trailing underscore)
- ✅ Correct: `STRIPE_SECRET_KEY` (exact match)

#### Issue: Environment not selected
- Make sure **Production** environment is checked
- Also check Preview and Development if you want to test those

#### Issue: Not redeployed after adding variable
- After adding/changing env vars, you MUST redeploy
- Vercel doesn't automatically redeploy when env vars change
- Go to Deployments → Click "..." → Redeploy

## Testing

1. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```
   Or push to GitHub (if auto-deploy is enabled)

2. **Test the endpoint**:
   - Visit your site
   - Add items to cart
   - Click checkout
   - Check Vercel function logs for debug output

3. **Check logs for debug info**:
   The function now logs:
   ```json
   {
     "hasStripeKey": true,
     "keyLength": 32,
     "keyPrefix": "sk_live...",
     "allEnvKeys": "STRIPE_SECRET_KEY"
   }
   ```

## If Still Not Working

If you still get the error after these fixes:

1. **Check Vercel Function Logs**:
   - The debug output will show what env vars are available
   - Look for `availableStripeVars` in the error response

2. **Verify Variable Name**:
   - Copy the exact name from Vercel dashboard
   - Compare with `STRIPE_SECRET_KEY` in code (should match exactly)

3. **Redeploy After Adding Variable**:
   - Environment variables only apply to NEW deployments
   - You must redeploy after adding/changing env vars

4. **Check Runtime**:
   - In Vercel Dashboard → Functions → `api/create-checkout-session`
   - Verify it shows "Node.js 22.x" runtime (not Edge)

## Summary

✅ **Runtime**: Now explicitly set to `nodejs22.x` in `vercel.json`
✅ **Export Format**: Standard Vercel format
✅ **Debug Logging**: Added to help identify issues
✅ **Error Messages**: Enhanced with available env vars

The code is now properly configured for Vercel. The most common remaining issue would be:
- Variable name mismatch (check exact spelling)
- Environment not selected (must include Production)
- Not redeployed after adding variable

