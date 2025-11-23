# Vercel KV Setup Guide

**Date:** 2025-01-27  
**Purpose:** Configure Vercel KV for persistent purchase storage

## Overview

The system now uses **Vercel KV** (Redis) for persistent storage of purchase data. This replaces the temporary file-based storage and ensures purchases are saved reliably.

## Setup Steps

### 1. Install Vercel KV Package

The package is already added to `package.json`:
```json
"@vercel/kv": "^0.2.1"
```

### 2. Create Vercel KV Database

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click **"Storage"** tab
   - Or go to: https://vercel.com/dashboard/stores

3. **Create KV Database**
   - Click **"Create Database"**
   - Select **"KV"** (Redis)
   - Choose a name (e.g., `ifeelworld-kv`)
   - Select a region (closest to your users)
   - Click **"Create"**

4. **Link to Project**
   - After creating, click **"Link to Project"**
   - Select your **ifeelworld** project
   - Click **"Link"**

### 3. Environment Variables (Auto-Configured)

Vercel automatically adds these environment variables when you link KV:
- `KV_REST_API_URL` - KV REST API endpoint
- `KV_REST_API_TOKEN` - KV REST API token
- `KV_REST_API_READ_ONLY_TOKEN` - Read-only token (optional)

**Note:** These are automatically set - you don't need to add them manually!

### 4. Verify Configuration

1. **Check Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are present
   - They should be automatically added

2. **Redeploy Project**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on latest deployment
   - Or push a new commit

### 5. Test the System

1. **Make a test purchase**
2. **Check Vercel Logs**
   - Go to **Functions** → `api/webhook`
   - Look for: `✅ Webhook received for session ID: ...`
   - Look for: `✅ Saved purchase for: ...`
3. **Check success page** - Download links should appear

## KV Data Structure

Purchases are stored with key: `purchases:{session_id}`

**Example:**
```json
{
  "session_id": "cs_live_...",
  "customer_email": "user@example.com",
  "purchased_items": [
    {
      "productId": "uuid",
      "fileName": "photo.jpg",
      "imageSrc": "Images/...",
      "title": "Photo Title",
      "quantity": 2,
      "max_downloads": 2
    }
  ],
  "download_count": {
    "productId": 0
  },
  "timestamp": "2025-01-27T...",
  "payment_status": "paid",
  "allowedDownloads": 2,
  "downloadsUsed": 0
}
```

## Troubleshooting

### KV Not Working?

1. **Check Package Installation**
   ```bash
   npm install @vercel/kv
   ```

2. **Verify Environment Variables**
   - `KV_REST_API_URL` must be set
   - `KV_REST_API_TOKEN` must be set

3. **Check Vercel Logs**
   - Look for: `✅ Vercel KV initialized`
   - Or: `❌ Failed to initialize Vercel KV`

4. **Verify KV Database is Linked**
   - Go to **Storage** → Your KV database
   - Check it's linked to your project

### Purchase Not Found?

1. **Check Webhook Logs**
   - Verify webhook received event
   - Verify purchase was saved

2. **Check KV Database**
   - Go to **Storage** → Your KV database
   - Click **"Data"** tab
   - Look for keys starting with `purchases:`

3. **Verify Session ID**
   - Check URL parameter: `?session_id=cs_...`
   - Must start with `cs_`

## Important Notes

- ✅ **Persistent Storage** - Data persists across deployments
- ✅ **Fast Access** - Redis is very fast
- ✅ **Automatic Scaling** - Vercel handles scaling
- ✅ **Free Tier** - Includes free tier for development

## Migration from File Storage

The system automatically migrated from file storage to KV. Old file-based purchases won't be accessible, but new purchases will be stored in KV.

## Summary

✅ **KV Database Created**  
✅ **Environment Variables Auto-Configured**  
✅ **Package Installed**  
✅ **System Ready**  

After creating the KV database and linking it to your project, the system will automatically use it for all purchase storage.

---

**Report Generated:** 2025-01-27

