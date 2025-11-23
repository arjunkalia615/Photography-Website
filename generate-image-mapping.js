/**
 * Image Mapping Generator
 * Scans Images folder and generates a mapping of item IDs to file paths
 */

const fs = require('fs');
const path = require('path');

// Sanitize function: lowercase, replace spaces with hyphens, remove special chars
function sanitize(str) {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Get base name without extension
function getBaseName(filename) {
    return path.basename(filename, path.extname(filename));
}

// Generate mapping
function generateMapping() {
    const mapping = {};
    const categoryCounters = {};

    // Helper to get or create counter for category
    function getCounter(category) {
        if (!categoryCounters[category]) {
            categoryCounters[category] = 0;
        }
        return ++categoryCounters[category];
    }

    // Australia Photos - Banner
    mapping['australia-banner-photo'] = 'Images/Australia Photos/Australia banner photo.jpg';

    // Australia Photos - Costal & Nature (40 images)
    const coastalNatureFiles = [
        '20250402_160309.jpg', '20250402_160454.jpg', '20250402_160755.jpg', '20250402_161710.jpg',
        '20250403_151512.jpg', '20250403_151645.jpg', '20250403_151656.jpg', '20250403_152310.jpg',
        '20250403_152843.jpg', '20250403_153143.jpg', '20250403_153455.jpg', '20250403_184010.jpg',
        '20250403_184155.jpg', '20250403_184708.jpg', '20250822_171224.jpg', '20250829_161449.jpg',
        'Beach.jpg', 'Blue Mountain1.jpg', 'Blue Mountain2.jpg', 'Blue Mountain3.jpg',
        'Blue Mountain4.jpg', 'DSCF0011.jpg', 'DSCF0027.jpg', 'DSCF0062.jpg',
        'DSCF0219.jpg', 'DSCF0243.jpg', 'DSCF0246.jpg', 'DSCF0251.jpg',
        'DSCF0254.jpg', 'DSCF0255.jpg', 'DSCF0273.jpg', 'DSCF0274.jpg',
        'DSCF0285.jpg', 'DSCF0286.jpg', 'DSCF0297.jpg', 'DSCF0301.jpg',
        'DSCF0304.jpg', 'DSCF0307.jpg', 'DSCF0308.jpg', 'DSCF0310.jpg',
        'DSCF0316.jpg', 'Waterfall1.jpg'
    ];

    coastalNatureFiles.forEach((file, index) => {
        const baseName = getBaseName(file);
        const sanitized = sanitize(baseName);
        const itemId = `coastal-nature-${index + 1}`;
        mapping[itemId] = `Images/Australia Photos/Sub-categories/Costal & Nature/${file}`;
    });

    // Australia Photos - Urban (17 images)
    const urbanFiles = [
        '20250901_154619.jpg', 'Sydney1.jpg', 'Sydney11.jpg', 'Sydney13.jpg',
        'Sydney15.jpg', 'Sydney16.jpg', 'Sydney17.jpg', 'Sydney18.jpg',
        'Sydney19.jpg', 'Sydney2.jpg', 'Sydney20.jpg', 'Sydney21.jpg',
        'Sydney3.jpg', 'Sydney4.jpg', 'Sydney5.jpg', 'Sydney6.jpg',
        'Sydney9.jpg'
    ];

    urbanFiles.forEach((file, index) => {
        const baseName = getBaseName(file);
        const sanitized = sanitize(baseName);
        const itemId = `urban-${index + 1}`;
        mapping[itemId] = `Images/Australia Photos/Sub-categories/Urban/${file}`;
    });

    // India Photos - Cultural Heritage (4 images)
    const culturalHeritageFiles = [
        'Qutab Minar1.jpg', 'Qutab Minar2.jpg', 'Qutab Minar5.jpg', 'Qutab Minar8.jpg'
    ];

    culturalHeritageFiles.forEach((file, index) => {
        const baseName = getBaseName(file);
        const sanitized = sanitize(baseName);
        const itemId = `cultural-heritage-${index + 1}`;
        mapping[itemId] = `Images/India Photos/Sub-categories/Cultural Heritage/${file}`;
    });

    // Banner Photo
    mapping['banner-sydney10'] = 'Images/Banner Photo/Sydney10.jpg';

    return mapping;
}

// Generate and output
const mapping = generateMapping();

// Output as JavaScript object
const jsOutput = `/**
 * Image ID to File Path Mapping
 * Generated automatically - DO NOT EDIT MANUALLY
 * 
 * Usage in API:
 * const imagePath = IMAGE_MAPPING[itemId];
 * if (!imagePath) return res.status(404).json({ error: 'Image not found' });
 */

const IMAGE_MAPPING = ${JSON.stringify(mapping, null, 2)};

module.exports = IMAGE_MAPPING;
`;

console.log(jsOutput);
console.log('\n// Total images mapped:', Object.keys(mapping).length);

// Also write to file
fs.writeFileSync('api/image-mapping.js', jsOutput);
console.log('\n✅ Mapping written to: api/image-mapping.js');

