# Image ID to File Path Mapping

**Date:** 2025-01-27  
**Status:** ✅ **GENERATED**

## Overview

Complete mapping of all images in the `Images` folder to unique item IDs for use in the download API endpoint.

## Total Images Mapped

**65 images** across all categories

## Mapping Structure

### Categories:

1. **Australia Photos - Banner** (1 image)
   - `australia-banner-photo`

2. **Australia Photos - Coastal & Nature** (42 images)
   - `coastal-nature-1` through `coastal-nature-42`

3. **Australia Photos - Urban** (17 images)
   - `urban-1` through `urban-17`

4. **India Photos - Cultural Heritage** (4 images)
   - `cultural-heritage-1` through `cultural-heritage-4`

5. **Banner Photo** (1 image)
   - `banner-sydney10`

## ID Naming Convention

- **Format:** `{category}-{sequential-number}`
- **Sanitization:** 
  - Lowercase
  - Spaces replaced with hyphens
  - Special characters removed
  - Sequential numbering for multiple images in same category

## Usage in API

### Example 1: Using itemId
```javascript
// GET /api/get-download-link?itemId=coastal-nature-1
const itemId = req.query.itemId;
const imagePath = IMAGE_MAPPING[itemId];
// Returns: "Images/Australia Photos/Sub-categories/Costal & Nature/20250402_160309.jpg"
```

### Example 2: Using imageSrc (fallback)
```javascript
// GET /api/get-download-link?imageSrc=Images/Australia%20Photos/...
const imageSrc = req.query.imageSrc;
// Direct path access (for backward compatibility)
```

## File Location

The mapping is stored in: `api/image-mapping.js`

## Regenerating the Mapping

If images are added or removed, regenerate the mapping:

```bash
node generate-image-mapping.js
```

This will:
1. Scan all images in the `Images` folder
2. Generate unique IDs based on category
3. Create sequential numbering
4. Output to `api/image-mapping.js`

## Complete Mapping

### Australia Photos - Banner
- `australia-banner-photo` → `Images/Australia Photos/Australia banner photo.jpg`

### Australia Photos - Coastal & Nature (42 images)
- `coastal-nature-1` → `Images/Australia Photos/Sub-categories/Costal & Nature/20250402_160309.jpg`
- `coastal-nature-2` → `Images/Australia Photos/Sub-categories/Costal & Nature/20250402_160454.jpg`
- ... (40 more images)
- `coastal-nature-42` → `Images/Australia Photos/Sub-categories/Costal & Nature/Waterfall1.jpg`

### Australia Photos - Urban (17 images)
- `urban-1` → `Images/Australia Photos/Sub-categories/Urban/20250901_154619.jpg`
- `urban-2` → `Images/Australia Photos/Sub-categories/Urban/Sydney1.jpg`
- ... (15 more images)
- `urban-17` → `Images/Australia Photos/Sub-categories/Urban/Sydney9.jpg`

### India Photos - Cultural Heritage (4 images)
- `cultural-heritage-1` → `Images/India Photos/Sub-categories/Cultural Heritage/Qutab Minar1.jpg`
- `cultural-heritage-2` → `Images/India Photos/Sub-categories/Cultural Heritage/Qutab Minar2.jpg`
- `cultural-heritage-3` → `Images/India Photos/Sub-categories/Cultural Heritage/Qutab Minar5.jpg`
- `cultural-heritage-4` → `Images/India Photos/Sub-categories/Cultural Heritage/Qutab Minar8.jpg`

### Banner Photo (1 image)
- `banner-sydney10` → `Images/Banner Photo/Sydney10.jpg`

## API Endpoint Integration

The `/api/get-download-link` endpoint now supports both:

1. **itemId lookup** (recommended):
   ```
   GET /api/get-download-link?itemId=coastal-nature-1
   ```

2. **Direct imageSrc** (backward compatible):
   ```
   GET /api/get-download-link?imageSrc=Images/Australia%20Photos/...
   ```

## Benefits

✅ **Unique IDs:** Each image has a unique, predictable ID  
✅ **Category-based:** IDs reflect the image category  
✅ **Sequential numbering:** Easy to reference multiple images  
✅ **Sanitized:** Safe for URLs and API calls  
✅ **Type-safe:** Direct mapping lookup in code  
✅ **Maintainable:** Easy to regenerate when images change  

---

**Generated:** 2025-01-27  
**Total Images:** 65

