# Download Link Fix

**Date:** 2025-01-27  
**Issue:** "File not found" error when downloading images

## Problem

Users were getting `{"error":"File not found","message":"The requested file could not be found on the server"}` when trying to download images.

## Root Causes

1. **Path Encoding Issues:** URL-encoded paths not being decoded properly
2. **Path Separator Issues:** Windows vs Unix path separators
3. **Path Resolution:** File paths not resolving correctly from `process.cwd()`
4. **Missing Error Details:** Insufficient logging to diagnose issues

## Fixes Applied

### 1. ✅ Improved Path Decoding
- Added `decodeURIComponent()` for URL-encoded paths
- Handles both encoded and unencoded paths

### 2. ✅ Multiple Path Format Attempts
- Tries original path first
- Falls back to normalized separators
- Tries Windows-style paths
- Tries Unix-style paths
- Tries direct paths

### 3. ✅ Enhanced Logging
- Logs all path resolution attempts
- Shows `cwd`, `mappedPath`, `itemId`, `imageSrc`
- Logs which alternative path worked (if any)
- Checks if Images folder exists

### 4. ✅ Better Error Messages
- More descriptive error messages
- Debug info in development mode
- Shows all attempted paths

## Code Changes

### `api/get-download-link.js`

**Before:**
```javascript
const cleanPath = imageSrc.startsWith('/') 
    ? imageSrc.substring(1) 
    : imageSrc.replace(/^\.\.\//, '').replace(/^\.\//, '');
filePath = path.join(process.cwd(), cleanPath);
```

**After:**
```javascript
// Decode URL-encoded path
let decodedPath = decodeURIComponent(imageSrc);

// Normalize path (remove ../ and ./)
const cleanPath = decodedPath.startsWith('/') 
    ? decodedPath.substring(1) 
    : decodedPath.replace(/^\.\.\//, '').replace(/^\.\//, '');

// Normalize path separators (handle both / and \)
const normalizedPath = cleanPath.replace(/\\/g, '/');

filePath = path.join(process.cwd(), normalizedPath);
```

**File Existence Check:**
- Now tries multiple path formats before failing
- Logs all attempts for debugging
- Provides detailed error messages

## Testing

### Test Cases:
1. ✅ URL-encoded paths: `Images/Australia%20Photos/...`
2. ✅ Direct paths: `Images/Australia Photos/...`
3. ✅ Windows paths: `Images\Australia Photos\...`
4. ✅ Unix paths: `Images/Australia Photos/...`
5. ✅ ItemId lookup: `?itemId=coastal-nature-1`
6. ✅ ImageSrc lookup: `?imageSrc=Images/...`

## Usage

### Using itemId (Recommended):
```
GET /api/get-download-link?itemId=coastal-nature-1
```

### Using imageSrc:
```
GET /api/get-download-link?imageSrc=Images/Australia%20Photos/Sub-categories/Costal%20%26%20Nature/Beach.jpg
```

## Debugging

If files still aren't found, check Vercel logs for:
- `🔍 Download request:` - Shows all parameters
- `❌ File not found after trying all alternatives` - Shows all attempted paths
- `📊 Debug info:` - Shows cwd, paths, and folder existence

## Next Steps

If issues persist:
1. Check Vercel Function Logs for detailed path information
2. Verify `Images` folder exists in deployment
3. Check file paths match exactly (case-sensitive on Linux)
4. Verify image files are included in deployment

---

**Fixed:** 2025-01-27

