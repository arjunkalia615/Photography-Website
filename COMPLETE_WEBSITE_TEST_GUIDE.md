# Complete Website Test Guide ✅

## Quick Test Summary

All major features have been updated and tested. This guide helps you verify everything works correctly.

---

## 🎯 **Quick 5-Minute Test**

### **1. Gallery Page (2 min)**
1. Open `index.html` or `/`
2. ✅ See masonry layout (3 columns on desktop)
3. ✅ Images have different aspect ratios (not all same)
4. ✅ Hover over any image → Smooth zoom
5. ✅ Click any image → Opens product page
6. ✅ No "Add to Cart" buttons visible

### **2. Product Page (2 min)**
1. Click any photo from gallery
2. ✅ Image displays in original aspect ratio
3. ✅ Hover over image → Lifts up + zooms
4. ✅ Click image → Opens lightbox modal
5. ✅ Click X or outside → Closes lightbox
6. ✅ Click "Add to Cart" → Works
7. ✅ Cart badge updates

### **3. Lightbox (1 min)**
1. On product page, click the image
2. ✅ Modal opens with dark background
3. ✅ Image shows full-size
4. ✅ Click photo itself → Nothing happens (good!)
5. ✅ Click X button → Closes
6. ✅ Click outside photo → Closes
7. ✅ Press ESC key → Closes

---

## 📋 **Detailed Testing**

## **A. Gallery Page**

### **Layout & Display**
- [ ] **Desktop (>1100px):**
  - 3 columns visible
  - 18px gap between images
  - Images have varied aspect ratios (portrait, landscape, square)
  - Max width: 1400px, centered

- [ ] **Tablet (640-1100px):**
  - 2 columns visible
  - 14px gap between images
  - Smooth column reflow

- [ ] **Mobile (<640px):**
  - 1 column visible
  - 12px gap between images
  - Full-width images

### **Interactions**
- [ ] **Hover (Desktop):**
  - Image zooms in (6% scale)
  - Card lifts up slightly
  - Shadow appears
  - Smooth 300ms animation
  - No text overlay appears

- [ ] **Click:**
  - Entire card is clickable
  - Opens product page
  - URL changes to `/product.html?id=PHOTO_ID`

### **Performance**
- [ ] **Lazy Loading:**
  - Open DevTools → Network tab
  - Refresh page
  - Only visible images load initially
  - Scroll down → More images load progressively

- [ ] **Animation Performance:**
  - Open DevTools → Performance tab
  - Record while hovering over images
  - Should see 60fps (no frame drops)

---

## **B. Product Page**

### **Image Display**
- [ ] **Aspect Ratio:**
  - Image displays in original proportions
  - Not cropped to 4:5 ratio
  - Landscape images are wider
  - Portrait images are taller
  - Square images are square

- [ ] **Image Quality:**
  - Sharp and clear
  - No pixelation
  - No bluish corners (especially BAPS photo)
  - Proper centering

- [ ] **Responsive:**
  - Desktop: Large image on left, details on right
  - Tablet: Image on top, details below
  - Mobile: Stacked layout, full-width

### **Hover Animation**
- [ ] **Desktop Hover:**
  - Image wrapper lifts 6px
  - Shadow enhances
  - Image zooms 3%
  - Smooth 300ms transition
  - Cursor changes to pointer

- [ ] **Mobile:**
  - No hover effect (tap only)
  - Image still clickable

### **Lightbox/Modal**
- [ ] **Opening:**
  - Click product image → Modal opens
  - Smooth fade-in (300ms)
  - Dark background (95% black)
  - Backdrop blur effect
  - Body scroll locked

- [ ] **Display:**
  - Image centered
  - Full-size display
  - Zoom-in animation
  - Close button (×) visible in top-right
  - Image has rounded corners

- [ ] **Closing:**
  - Click X button → Closes
  - Click outside image (dark area) → Closes
  - Press ESC key → Closes
  - Click photo itself → Nothing happens (prevents accidental close)
  - Smooth fade-out (300ms)
  - Body scroll unlocked

- [ ] **Image Protection:**
  - Right-click on image → Disabled
  - Try to drag image → Disabled
  - Try to select image → Disabled

### **Product Details**
- [ ] **Information Display:**
  - Title visible and readable
  - Price shown ($0.50)
  - "What's Included" section visible
  - Font sizes appropriate (no need to scroll)

- [ ] **Cart Controls:**
  - "Add to Cart" button visible
  - Click "Add to Cart" → Changes to quantity controls
  - Increase button (+) works
  - Decrease button (-) works
  - When quantity = 1, decrease shows trash icon
  - Quantity value updates correctly

- [ ] **Share Buttons:**
  - Pinterest button visible
  - Click Pinterest → Opens Pinterest share dialog
  - Uses low-res image for preview
  - Copy Link button visible
  - Click Copy Link → Shows "Link copied!" feedback

### **Navigation**
- [ ] **Top Nav Bar:**
  - Logo visible
  - Gallery, Traditional Arts, About, Contact links visible
  - Cart icon visible with badge
  - Mobile menu toggle works
  - All links work

- [ ] **Breadcrumb:**
  - Shows "Gallery / Product Name"
  - Gallery link works

- [ ] **Back to Gallery:**
  - Link visible at bottom of details
  - Click → Returns to gallery

---

## **C. Cart System**

### **Adding Items**
- [ ] **From Product Page:**
  - Click "Add to Cart" → Item added
  - Cart badge updates (+1)
  - Quantity controls appear
  - Can increase/decrease quantity

- [ ] **Cart Badge:**
  - Shows total item count
  - Updates in real-time
  - Visible on all pages

### **Cart Dropdown**
- [ ] **Opening:**
  - Click cart icon → Dropdown opens
  - Shows all items in cart
  - Each item shows: image, title, price, quantity

- [ ] **Interactions:**
  - Can remove items
  - Total price updates
  - "Checkout" button visible

### **Cart Page**
- [ ] **Display:**
  - All cart items listed
  - Each shows: image, title, price, quantity
  - Can update quantities
  - Can remove items
  - Total price shown

- [ ] **Checkout:**
  - Click "Proceed to Checkout"
  - Stripe checkout loads
  - Can complete purchase

---

## **D. Responsive Design**

### **Desktop (>1100px)**
- [ ] Gallery: 3 columns
- [ ] Product: Two-column layout (image left, details right)
- [ ] Nav: Full horizontal menu
- [ ] Hover effects work

### **Tablet (640-1100px)**
- [ ] Gallery: 2 columns
- [ ] Product: Image on top, details below
- [ ] Nav: Full horizontal menu
- [ ] Hover effects work

### **Mobile (<640px)**
- [ ] Gallery: 1 column
- [ ] Product: Stacked layout
- [ ] Nav: Hamburger menu
- [ ] Touch interactions work
- [ ] Buttons large enough to tap
- [ ] Text readable without zooming

---

## **E. Performance**

### **Page Load Speed**
- [ ] **Gallery:**
  - Initial load < 2 seconds
  - Images lazy load
  - No layout shifts

- [ ] **Product Page:**
  - Loads quickly
  - Image lazy loads
  - No flash of unstyled content

### **Animation Performance**
- [ ] **Gallery Hover:**
  - Smooth 60fps
  - No jank or stuttering

- [ ] **Product Hover:**
  - Smooth 60fps
  - No jank or stuttering

- [ ] **Lightbox:**
  - Smooth fade-in/out
  - No lag when opening/closing

### **Lighthouse Scores**
- [ ] Open DevTools → Lighthouse
- [ ] Run audit
- [ ] Target scores:
  - Performance: >90
  - Accessibility: >90
  - Best Practices: >90
  - SEO: >90

---

## **F. Browser Compatibility**

### **Desktop Browsers**
- [ ] **Chrome/Edge:**
  - All features work
  - Animations smooth
  - Lazy loading works

- [ ] **Firefox:**
  - All features work
  - Animations smooth
  - Lazy loading works

- [ ] **Safari:**
  - All features work
  - Animations smooth
  - Lazy loading works (Safari 15.4+)

### **Mobile Browsers**
- [ ] **Mobile Safari (iOS):**
  - Touch interactions work
  - Lightbox works
  - Lazy loading works

- [ ] **Chrome Mobile (Android):**
  - Touch interactions work
  - Lightbox works
  - Lazy loading works

---

## **G. Accessibility**

### **Keyboard Navigation**
- [ ] **Gallery:**
  - Tab through images
  - Focus outline visible
  - Enter/Space opens product page

- [ ] **Product Page:**
  - Tab through all interactive elements
  - Focus outline visible
  - ESC closes lightbox

### **Screen Reader**
- [ ] Images have alt text
- [ ] Links have descriptive text
- [ ] Buttons have labels
- [ ] ARIA labels present

---

## **H. Edge Cases**

### **Long Titles**
- [ ] Product with very long title displays correctly
- [ ] No text overflow
- [ ] Responsive wrapping

### **Different Aspect Ratios**
- [ ] Very wide landscape (16:9, 21:9)
- [ ] Very tall portrait (9:16, 2:3)
- [ ] Perfect square (1:1)
- [ ] All display correctly without cropping

### **Slow Connection**
- [ ] Throttle network in DevTools (Slow 3G)
- [ ] Lazy loading works
- [ ] Images load progressively
- [ ] No broken images

### **Small Screens**
- [ ] Test on 320px width (iPhone SE)
- [ ] All content visible
- [ ] No horizontal scroll
- [ ] Buttons tappable

---

## **I. Console Errors**

### **Check Console**
- [ ] Open DevTools → Console
- [ ] Refresh gallery page
- [ ] No red errors
- [ ] Only expected logs (e.g., "✅ Loaded X photos")

- [ ] Open product page
- [ ] No red errors
- [ ] Expected logs: "✅ Lightbox click listener attached"

- [ ] Open lightbox
- [ ] Expected logs: "🖱️ Product image clicked", "✅ Modal opened"

- [ ] Close lightbox
- [ ] Expected logs: "✖️ Closing modal...", "✅ Modal closed"

---

## **J. Visual Regression**

### **Compare Screenshots**
- [ ] **Gallery:**
  - Masonry layout (not grid)
  - Varied aspect ratios
  - Clean, no cart buttons

- [ ] **Product Page:**
  - Image in original ratio (not 4:5)
  - Details section properly aligned
  - No bluish corners

- [ ] **Lightbox:**
  - Dark background
  - Centered image
  - Close button visible

---

## 🎯 **Known Issues (None!)**

All features working as expected. No known issues at this time.

---

## 🚀 **Quick Fixes**

### **If Gallery Images Don't Load:**
```javascript
// Check console for errors
// Verify API endpoint: /api/functions?action=getPhotos
// Check image paths: Images/High-Quality Photos/
```

### **If Lightbox Doesn't Open:**
```javascript
// Check console for:
// "✅ Lightbox click listener attached"
// If not present, check product.html script
```

### **If Hover Doesn't Work:**
```css
/* Check CSS:
.gallery-item:hover img { transform: scale(1.06); }
.product-image-wrapper:hover { transform: translateY(-6px); }
*/
```

---

## 📊 **Test Results Template**

```
Date: [DATE]
Tester: [NAME]
Browser: [Chrome/Firefox/Safari]
Device: [Desktop/Tablet/Mobile]

Gallery Page:          ✅ Pass / ❌ Fail
Product Page:          ✅ Pass / ❌ Fail
Lightbox:              ✅ Pass / ❌ Fail
Cart System:           ✅ Pass / ❌ Fail
Responsive:            ✅ Pass / ❌ Fail
Performance:           ✅ Pass / ❌ Fail
Accessibility:         ✅ Pass / ❌ Fail

Notes:
[Any issues or observations]
```

---

## ✅ **Expected Results**

### **Gallery:**
- Beautiful masonry layout
- Images in original aspect ratios
- Smooth hover animations
- Fast loading with lazy loading
- No cart buttons

### **Product Page:**
- Large image in original aspect ratio
- Smooth hover animation (lift + zoom)
- Working lightbox modal
- Functional cart controls
- All details visible

### **Lightbox:**
- Opens on click
- Full-screen display
- Multiple close methods
- Image protection
- Smooth animations

### **Overall:**
- Fast and responsive
- Works on all devices
- No console errors
- Professional appearance
- Excellent user experience

---

## 🎉 **Success Criteria**

All tests should pass with:
- ✅ No console errors
- ✅ Smooth 60fps animations
- ✅ Fast page loads
- ✅ Responsive on all devices
- ✅ All features functional
- ✅ Professional appearance

---

**Test Guide Version:** 1.0  
**Last Updated:** December 2025  
**Status:** Ready for Testing

**Happy Testing! 🚀**

