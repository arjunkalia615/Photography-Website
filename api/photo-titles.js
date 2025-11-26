/**
 * Photo Title Mapping
 * Maps non-descriptive filenames to high-quality, descriptive titles
 * Only letters are used in titles (no numbers)
 */

const PHOTO_TITLE_MAPPING = {
    // Date-based filenames (2025 format)
    '20250822_171224.jpg': 'Sydney Harbour Evening Light',
    '20250829_161449.jpg': 'Coastal Sunset Golden Hour',
    '20250901_154619.jpg': 'Urban Cityscape Afternoon',
    
    // Camera default filenames (DSCF series)
    'DSCF0011.jpg': 'Mountain Vista Panoramic View',
    'DSCF0027.jpg': 'Coastal Cliffs Natural Beauty',
    'DSCF0062.jpg': 'Forest Trail Serene Landscape',
    
    // Sydney series - Generic numbered files
    'Sydney1.jpg': 'Sydney Harbour Bridge Sunrise',
    'Sydney2.jpg': 'Sydney Opera House Waterfront',
    'Sydney3.jpg': 'Sydney Skyline Urban Panorama',
    'Sydney4.jpg': 'Sydney Harbour Morning Mist',
    'Sydney5.jpg': 'Sydney Cityscape Evening Glow',
    'Sydney6.jpg': 'Sydney Harbour Bridge Perspective',
    'Sydney7.jpg': 'Sydney Opera House Architecture',
    'Sydney9.jpg': 'Sydney Harbour Sunset Reflection',
    'Sydney11.jpg': 'Sydney Urban Landscape Aerial',
    'Sydney15.jpg': 'Sydney Harbour Bridge Golden Hour',
    'Sydney16.jpg': 'Sydney Streets Urban Life',
    'Sydney17.jpg': 'Sydney Harbour Evening Skyline',
    'Sydney19.jpg': 'Sydney Opera House Waterfront View',
    
    // Blue Mountain series
    'Blue Mountain1.jpg': 'Blue Mountains Valley Panorama',
    'Blue Mountain2.jpg': 'Blue Mountains Misty Peaks',
    'Blue Mountain4.jpg': 'Blue Mountains Eucalyptus Forest',
    
    // Qutab Minar series (India Cultural Heritage)
    'Qutab Minar1.jpg': 'Qutab Minar Ancient Architecture',
    'Qutab Minar2.jpg': 'Qutab Minar Historical Monument',
    'Qutab Minar4.jpg': 'Qutab Minar Stone Carvings',
    'Qutab Minar5.jpg': 'Qutab Minar Tower Details',
    'Qutab Minar6.jpg': 'Qutab Minar Heritage Site',
    'Qutab Minar7.jpg': 'Qutab Minar Architectural Heritage',
    'Qutab Minar8.jpg': 'Qutab Minar Monumental Tower',
    
    // Waterfall series
    'Waterfall1.jpg': 'Mountain Waterfall Cascading Flow',
    'Waterfall2.jpg': 'Natural Waterfall Forest Setting',
    'Waterfall4.jpg': 'Waterfall Stream Rocky Landscape',
    
    // Temple series
    'Temple1.jpg': 'Ancient Temple Architecture Heritage',
    
    // Moon series
    'newmoon-3.jpg': 'New Moon Night Sky Silhouette'
};

/**
 * Get descriptive title for a photo filename
 * @param {string} filename - The image filename
 * @param {string} baseName - The base name without extension
 * @returns {string} - Descriptive title
 */
function getPhotoTitle(filename, baseName) {
    // Check if we have a mapping for this exact filename
    if (PHOTO_TITLE_MAPPING[filename]) {
        return PHOTO_TITLE_MAPPING[filename];
    }
    
    // Check if we have a mapping for the base name (case-insensitive)
    const lowerFilename = filename.toLowerCase();
    for (const [key, value] of Object.entries(PHOTO_TITLE_MAPPING)) {
        if (key.toLowerCase() === lowerFilename) {
            return value;
        }
    }
    
    // If no mapping found, generate a readable title from the base name
    // This handles files that already have descriptive names
    let title = baseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    
    // Remove trailing numbers and common patterns
    title = title
        .replace(/\s+\d+$/, '') // Remove trailing numbers (e.g., "Sydney 1" -> "Sydney")
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    
    // If title is empty or only numbers, use a generic fallback
    if (!title || /^\d+$/.test(title)) {
        return 'Photography';
    }
    
    return title;
}

module.exports = {
    PHOTO_TITLE_MAPPING,
    getPhotoTitle
};

