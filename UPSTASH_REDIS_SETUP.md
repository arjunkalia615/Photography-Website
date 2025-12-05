# Upstash Redis Setup Guide

**Date:** 2025-01-27  
**Purpose:** Configure Upstash Redis for persistent purchase storage

## Overview

The system uses **Upstash Redis** for persistent storage of purchase data. This ensures purchases are saved reliably and can be accessed immediately after payment.

## Setup Steps

### 1. Install Upstash Redis Package

The package is already added to `package.json`:
```json
"@upstash/redis": "^1.35.6"
```

Install dependencies:
```bash
npm install
```

### 2. Create Upstash Redis Database

1. **Go to Upstash Console**
   - https://console.upstash.com
   - Sign up or log in

2. **Create Redis Database**
   - Click **"Create Database"**
   - Choose a name (e.g., `ifeelworld-redis`)
   - Select a region (closest to your users)
   - Choose **"Regional"** for better performance
   - Click **"Create"**

3. **Get Connection Details**
   - After creating, click on your database
   - Find **"REST API"** section
   - Copy **"UPSTASH_REDIS_REST_URL"**
   - Copy **"UPSTASH_REDIS_REST_TOKEN"**

### 3. Add Environment Variables to Vercel

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your project

2. **Add Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - Click **"Add New"**
   - Add:
     - **Name:** `UPSTASH_REDIS_REST_URL`
     - **Value:** Paste the URL from Upstash
     - **Environments:** Production, Preview, Development
   - Click **"Save"**
   - Add:
     - **Name:** `UPSTASH_REDIS_REST_TOKEN`
     - **Value:** Paste the token from Upstash
     - **Environments:** Production, Preview, Development
   - Click **"Save"**

### 4. Redeploy Project

1. **Redeploy**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on latest deployment
   - Or push a new commit

### 5. Test the System

1. **Make a test purchase**
2. **Check Vercel Logs**
   - Go to **Functions** → `api/webhook`
   - Look for: `✅ Webhook received for session ID: ...`
   - Look for: `✅ Saved purchase to Redis for: ...`
   - Look for: `🔑 Redis key: purchase:...`
3. **Check success page** - Download links should appear

## Redis Data Structure

Purchases are stored with key: `purchase:{session_id}`

**Example:**
```json
{
  "session_id": "cs_live_...",
  "email": "user@example.com",
  "customer_email": "user@example.com",
  "products": [
    {
      "productId": "uuid",
      "title": "Photo Title",
      "fileName": "photo.jpg",
      "imageSrc": "Images/...",
      "quantity": 2,
      "maxDownloads": 2
    }
  ],
  "quantity": 2,
  "download_count": {
    "productId": 0
  },
  "downloadsUsed": 0,
  "maxDownloads": 2,
  "allowedDownloads": 2,
  "createdAt": "2025-01-27T...",
  "timestamp": "2025-01-27T...",
  "payment_status": "paid"
}
```

## Environment Variables Required

- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token

**Note:** The SDK automatically reads these from environment variables using `Redis.fromEnv()`

## Troubleshooting

### Redis Not Working?

1. **Check Package Installation**
   ```bash
   npm install @upstash/redis
   ```

2. **Verify Environment Variables**
   - `UPSTASH_REDIS_REST_URL` must be set
   - `UPSTASH_REDIS_REST_TOKEN` must be set
   - Check in Vercel Dashboard → Settings → Environment Variables

3. **Check Vercel Logs**
   - Look for: `✅ Upstash Redis initialized`
   - Or: `❌ Failed to initialize Upstash Redis`
   - Check for Redis key logs: `🔑 Redis key: purchase:...`

4. **Verify Upstash Database**
   - Go to Upstash Console → Your database
   - Check it's active and running
   - Verify connection details are correct

### Purchase Not Found?

1. **Check Webhook Logs**
   - Verify webhook received event
   - Verify purchase was saved: `✅ Saved purchase to Redis for: ...`
   - Check Redis key: `🔑 Redis key: purchase:...`

2. **Check Upstash Console**
   - Go to Upstash Console → Your database
   - Click **"Data Browser"**
   - Look for keys starting with `purchase:`

3. **Verify Session ID**
   - Check URL parameter: `?session_id=cs_...`
   - Must start with `cs_`
   - Check logs for: `🔑 Redis key checked: purchase:...`

## Important Notes

- ✅ **Persistent Storage** - Data persists across deployments
- ✅ **Fast Access** - Redis is very fast
- ✅ **Automatic Scaling** - Upstash handles scaling
- ✅ **Free Tier** - Includes free tier for development
- ✅ **Global Edge Network** - Fast access worldwide

## Key Format

All purchases are stored with the key format:
```
purchase:{session_id}
```

Example: `purchase:cs_live_b1ATSbIzrrWnJLzCwjjfz9wm47UmpwoLhRgJQfRXQXUEORelx6m5SPHo5b`

## Summary

✅ **Upstash Redis Database Created**  
✅ **Environment Variables Configured**  
✅ **Package Installed**  
✅ **System Ready**  

After creating the Upstash Redis database and adding environment variables to Vercel, the system will automatically use it for all purchase storage.

---

**Report Generated:** 2025-01-27

