/**
 * Generate WebP Preview Images for Gallery
 * Resizes images to 1500px max width and converts to WebP format
 * Run: node generate-webp-previews.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    sourceDir: 'Images/High-Quality Photos',
    outputDir: 'Images/Web-Optimized-Previews',
    maxWidth: 1500,
    quality: 85,
    format: 'webp'
};

/**
 * Ensure output directory exists
 */
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`✅ Created directory: ${directory}`);
    }
}

/**
 * Get all image files from source directory
 */
function getImageFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png'].includes(ext);
    });
}

/**
 * Convert image to WebP preview
 */
async function convertToWebP(inputPath, outputPath) {
    try {
        const metadata = await sharp(inputPath).metadata();
        
        await sharp(inputPath)
            .resize({
                width: CONFIG.maxWidth,
                height: null,
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({
                quality: CONFIG.quality,
                effort: 6
            })
            .toFile(outputPath);
        
        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(outputPath);
        const savings = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
        
        console.log(`✅ ${path.basename(inputPath)}`);
        console.log(`   Original: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Preview: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Savings: ${savings}%`);
        
        return {
            original: path.basename(inputPath),
            preview: path.basename(outputPath),
            originalSize: inputStats.size,
            previewSize: outputStats.size,
            savings: parseFloat(savings)
        };
    } catch (error) {
        console.error(`❌ Error processing ${inputPath}:`, error.message);
        return null;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting WebP preview generation...\n');
    
    // Ensure output directory exists
    ensureDirectoryExists(CONFIG.outputDir);
    
    // Get all image files
    const imageFiles = getImageFiles(CONFIG.sourceDir);
    console.log(`📁 Found ${imageFiles.length} images to process\n`);
    
    // Process each image
    const results = [];
    let totalOriginalSize = 0;
    let totalPreviewSize = 0;
    
    for (const file of imageFiles) {
        const inputPath = path.join(CONFIG.sourceDir, file);
        const outputFilename = path.parse(file).name + '.webp';
        const outputPath = path.join(CONFIG.outputDir, outputFilename);
        
        const result = await convertToWebP(inputPath, outputPath);
        if (result) {
            results.push(result);
            totalOriginalSize += result.originalSize;
            totalPreviewSize += result.previewSize;
        }
        console.log('');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total images processed: ${results.length}`);
    console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total preview size: ${(totalPreviewSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total savings: ${((1 - totalPreviewSize / totalOriginalSize) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════');
    
    // Generate mapping file
    const mapping = {};
    results.forEach(result => {
        const originalName = path.parse(result.original).name;
        mapping[originalName] = {
            original: `Images/High-Quality Photos/${result.original}`,
            preview: `Images/Web-Optimized-Previews/${result.preview}`,
            lowRes: `Low-Res Images/${result.original}`
        };
    });
    
    const mappingPath = 'image-preview-mapping.json';
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\n✅ Image mapping saved to: ${mappingPath}`);
    
    console.log('\n🎉 WebP preview generation complete!');
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { convertToWebP, CONFIG };

