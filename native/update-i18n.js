#!/usr/bin/env node
// update-i18n.js - Node.js port of update_i18n.rb
// Updates translation values from JSON payload received via native messaging

const fs = require('fs');
const path = require('path');

/**
 * Updates i18n translation files based on payload
 * Strategy: Check reviewed.json first, then fall back to old.json
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
    
    // Validate required fields (ns is optional now - we'll search for the key)
    items.forEach((item, idx) => {
        if (!item.key || !item.old) {
            throw new Error(`Item ${idx}: missing required field (key or old)`);
        }
    });
    
    const updatedFiles = [];
    const errors = [];
    
    // Define namespace priority: reviewed.json first, then old.json
    const namespacePriority = ['reviewed', 'old'];
    
    // Process each item
    items.forEach(item => {
        if (!item.new) {
            errors.push(`Skipping item without 'new' value: ${item.key}`);
            return;
        }
        
        let foundInNamespace = null;
        let foundData = null;
        let foundFilePath = null;
        
        // Search for key in namespaces (priority order)
        for (const ns of namespacePriority) {
            const filePath = path.join(root, lang, `${ns}.json`);
            
            if (!fs.existsSync(filePath)) {
                console.error(`[DEBUG] File not found: ${filePath}`);
                continue;
            }
            
            try {
                const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                
                // Check if key exists in this namespace
                if (keyExists(jsonData, item.key)) {
                    foundInNamespace = ns;
                    foundData = jsonData;
                    foundFilePath = filePath;
                    console.error(`[DEBUG] Key ${item.key} found in ${ns}.json`);
                    break;
                }
            } catch (error) {
                console.error(`[DEBUG] Error reading ${filePath}: ${error.message}`);
                continue;
            }
        }
        
        // If key not found in any namespace, error
        if (!foundInNamespace) {
            errors.push(`Key not found in any namespace: ${item.key} (searched: ${namespacePriority.join(', ')})`);
            return;
        }
        
        // Perform the update
        try {
            // Create backup if this is the first change to this file
            if (!updatedFiles.includes(foundFilePath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `${foundFilePath}.backup-${timestamp}.json`;
                fs.copyFileSync(foundFilePath, backupPath);
                console.error(`[DEBUG] Backup created: ${backupPath}`);
            }
            
            const cursor = traversePath(foundData, item.key);
            const currentValue = cursor.value;
            const currentStr = typeof currentValue === 'string' ? currentValue : String(currentValue);
            
            // Value matching logic (if not forced)
            if (!force && currentStr !== item.old) {
                errors.push(`Mismatch for ${foundInNamespace}.${item.key}: current="${currentStr}", expected="${item.old}"`);
                return;
            }
            
            // Update the value
            cursor.value = item.new;
            console.error(`[DEBUG] Updated ${foundInNamespace}.${item.key}: "${item.old}" -> "${item.new}"`);
            
            // Write updated JSON
            const pretty = JSON.stringify(foundData, null, 4);
            fs.writeFileSync(foundFilePath, pretty, 'utf-8');
            
            // Track updated file
            if (!updatedFiles.includes(foundFilePath)) {
                updatedFiles.push(foundFilePath);
            }
            
        } catch (error) {
            errors.push(`Error updating ${foundInNamespace}.${item.key}: ${error.message}`);
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
 * Check if a key exists in JSON data (supports dot notation)
 * @param {Object} jsonData - JSON object to search
 * @param {string} keyPath - Dot-separated path (e.g., "a.b.c")
 * @returns {boolean} True if key exists
 */
function keyExists(jsonData, keyPath) {
    const segments = keyPath.split('.');
    let cursor = jsonData;
    
    for (let i = 0; i < segments.length; i++) {
        if (!cursor || typeof cursor !== 'object' || !cursor.hasOwnProperty(segments[i])) {
            return false;
        }
        cursor = cursor[segments[i]];
    }
    
    return true;
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
