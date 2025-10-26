#!/usr/bin/env node
// update-i18n.js - Node.js port of update_i18n.rb
// Updates translation values from JSON payload received via native messaging

const fs = require('fs');
const path = require('path');

/**
 * Updates i18n translation files based on payload
 * @param {Object} config - Configuration object
 * @param {string} config.root - Root directory for locales (default: src/assets/locales)
 * @param {string} config.lang - Language code (default: de)
 * @param {boolean} config.force - Skip old value verification (default: false)
 * @param {Array|Object} config.payload - Translation updates array or single object
 * @returns {Object} Result object with success status and details
 */
function updateI18n(config) {
    const { root, lang, force, payload } = config;
    
    // Validate payload
    if (!payload) {
        throw new Error('No payload provided');
    }
    
    // Normalize to an array of items
    const items = Array.isArray(payload) ? payload : [payload];
    
    // Validate required fields
    items.forEach((item, idx) => {
        if (!item.key || !item.ns || !item.old) {
            throw new Error(`Item ${idx}: missing required field (key, ns, or old)`);
        }
    });
    
    // Group items by target file (namespace)
    const files = {};
    items.forEach(item => {
        if (!files[item.ns]) files[item.ns] = [];
        files[item.ns].push(item);
    });
    
    const updatedFiles = [];
    const errors = [];
    
    // Process each file
    Object.entries(files).forEach(([ns, list]) => {
        const filePath = path.join(root, lang, `${ns}.json`);
        
        if (!fs.existsSync(filePath)) {
            errors.push(`File not found: ${filePath}`);
            return;
        }
        
        try {
            // Read and parse JSON
            const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            
            // Create backup
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${filePath}.${timestamp}.bak`;
            fs.copyFileSync(filePath, backupPath);
            
            // Update values
            let changes = 0;
            list.forEach(item => {
                if (!item.new) {
                    errors.push(`Skipping item without 'new' value: ${ns}.${item.key}`);
                    return;
                }
                
                try {
                    const cursor = traversePath(jsonData, item.key);
                    const currentValue = cursor.value;
                    const currentStr = typeof currentValue === 'string' ? currentValue : String(currentValue);
                    
                    if (!force && currentStr !== item.old) {
                        errors.push(`Mismatch for ${ns}.${item.key}: current="${currentStr}", expected="${item.old}"`);
                        return;
                    }
                    
                    cursor.value = item.new;
                    changes++;
                    console.log(`Updated ${ns}.${item.key}: "${item.old}" -> "${item.new}"`);
                    
                } catch (error) {
                    errors.push(`Error updating ${ns}.${item.key}: ${error.message}`);
                }
            });
            
            // Write updated JSON if there were changes
            if (changes > 0) {
                const pretty = JSON.stringify(jsonData, null, 2);
                fs.writeFileSync(filePath, pretty, 'utf-8');
                updatedFiles.push(filePath);
                console.log(`Backup written: ${backupPath}`);
            } else {
                // Remove backup if no changes were made
                fs.unlinkSync(backupPath);
            }
            
        } catch (error) {
            errors.push(`Error processing ${filePath}: ${error.message}`);
        }
    });
    
    return {
        success: errors.length === 0,
        updatedFiles,
        errors,
        message: errors.length > 0 ? 
            `Completed with ${errors.length} error(s)` : 
            `Successfully updated ${updatedFiles.length} file(s)`
    };
}

/**
 * Traverse JSON object path and return cursor for modification
 * @param {Object} jsonData - JSON object to traverse
 * @param {string} keyPath - Dot-separated path (e.g., "a.b.c")
 * @returns {Object} Cursor object with parent, key, and value properties
 */
function traversePath(jsonData, keyPath) {
    const segments = keyPath.split('.');
    let cursor = jsonData;
    
    // Navigate to parent object
    for (let i = 0; i < segments.length - 1; i++) {
        if (!cursor || typeof cursor !== 'object' || !cursor.hasOwnProperty(segments[i])) {
            throw new Error(`Missing path segment '${segments[i]}' in path '${keyPath}'`);
        }
        cursor = cursor[segments[i]];
    }
    
    const lastKey = segments[segments.length - 1];
    if (!cursor || typeof cursor !== 'object' || !cursor.hasOwnProperty(lastKey)) {
        throw new Error(`Missing final key '${lastKey}' in path '${keyPath}'`);
    }
    
    return {
        parent: cursor,
        key: lastKey,
        get value() { return cursor[lastKey]; },
        set value(val) { cursor[lastKey] = val; }
    };
}

// Export for use in native messaging host
module.exports = { updateI18n };

// If run directly (for testing), read from stdin
if (require.main === module) {
    let input = '';
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
        const chunk = process.stdin.read();
        if (chunk !== null) {
            input += chunk;
        }
    });
    
    process.stdin.on('end', () => {
        try {
            const config = JSON.parse(input.trim());
            const result = updateI18n(config);
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error(JSON.stringify({
                success: false,
                error: error.message
            }, null, 2));
            process.exit(1);
        }
    });
}
