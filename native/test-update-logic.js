#!/usr/bin/env node
// Test script for the new namespace resolution logic

const { updateI18n } = require('./update-i18n');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create temporary test directory
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-'));
const langDir = path.join(testDir, 'de');
fs.mkdirSync(langDir);

console.log('Test directory:', testDir);

// Create test JSON files
const reviewedJson = {
    common: {
        logout: "Abmelden",
        login: "Anmelden"
    },
    buttons: {
        save: "Speichern"
    }
};

const oldJson = {
    legacy: {
        button: {
            text: "Alter Button"
        }
    },
    common: {
        cancel: "Abbrechen"
    }
};

fs.writeFileSync(
    path.join(langDir, 'reviewed.json'),
    JSON.stringify(reviewedJson, null, 4)
);
fs.writeFileSync(
    path.join(langDir, 'old.json'),
    JSON.stringify(oldJson, null, 4)
);

console.log('\n=== Test Files Created ===');
console.log('reviewed.json:', JSON.stringify(reviewedJson, null, 2));
console.log('old.json:', JSON.stringify(oldJson, null, 2));

// Test 1: Update key in reviewed.json
console.log('\n=== Test 1: Update key in reviewed.json ===');
const test1 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [{
        key: 'common.logout',
        old: 'Abmelden',
        new: 'Abmelden (neu)'
    }]
});
console.log('Result:', test1);
const reviewed1 = JSON.parse(fs.readFileSync(path.join(langDir, 'reviewed.json'), 'utf-8'));
console.log('Updated value:', reviewed1.common.logout);
console.log('✓ Expected: "Abmelden (neu)"');

// Test 2: Update key in old.json
console.log('\n=== Test 2: Update key in old.json ===');
const test2 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [{
        key: 'legacy.button.text',
        old: 'Alter Button',
        new: 'Neuer Button'
    }]
});
console.log('Result:', test2);
const old2 = JSON.parse(fs.readFileSync(path.join(langDir, 'old.json'), 'utf-8'));
console.log('Updated value:', old2.legacy.button.text);
console.log('✓ Expected: "Neuer Button"');

// Test 3: Key exists in both files (should update reviewed.json first)
console.log('\n=== Test 3: Key exists in both files (priority: reviewed) ===');
const test3 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [{
        key: 'common.cancel',
        old: 'Abbrechen',
        new: 'Abbrechen (updated)'
    }]
});
console.log('Result:', test3);
// Should NOT find in reviewed, should find in old
const old3 = JSON.parse(fs.readFileSync(path.join(langDir, 'old.json'), 'utf-8'));
console.log('Updated in old.json:', old3.common.cancel);
console.log('✓ Expected: "Abbrechen (updated)" (because key only exists in old.json)');

// Test 4: Key not found anywhere
console.log('\n=== Test 4: Key not found in any namespace ===');
const test4 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [{
        key: 'missing.key',
        old: 'old value',
        new: 'new value'
    }]
});
console.log('Result:', test4);
console.log('✓ Expected error:', test4.errors[0]);

// Test 5: Value mismatch (with force: false)
console.log('\n=== Test 5: Value mismatch (force: false) ===');
const test5 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [{
        key: 'buttons.save',
        old: 'Wrong Value',
        new: 'Speichern (neu)'
    }]
});
console.log('Result:', test5);
console.log('✓ Expected error about mismatch:', test5.errors[0]);

// Test 6: Value mismatch (with force: true)
console.log('\n=== Test 6: Value mismatch (force: true) ===');
const test6 = updateI18n({
    root: testDir,
    lang: 'de',
    force: true,
    payload: [{
        key: 'buttons.save',
        old: 'Wrong Value',
        new: 'Speichern (forced)'
    }]
});
console.log('Result:', test6);
const reviewed6 = JSON.parse(fs.readFileSync(path.join(langDir, 'reviewed.json'), 'utf-8'));
console.log('Updated value:', reviewed6.buttons.save);
console.log('✓ Expected: "Speichern (forced)" (force bypassed check)');

// Test 7: Multiple updates in one call
console.log('\n=== Test 7: Multiple updates (batch) ===');
const test7 = updateI18n({
    root: testDir,
    lang: 'de',
    force: false,
    payload: [
        {
            key: 'common.login',
            old: 'Anmelden',
            new: 'Anmelden (batch)'
        },
        {
            key: 'legacy.button.text',
            old: 'Neuer Button',
            new: 'Batch Button'
        }
    ]
});
console.log('Result:', test7);
const reviewed7 = JSON.parse(fs.readFileSync(path.join(langDir, 'reviewed.json'), 'utf-8'));
const old7 = JSON.parse(fs.readFileSync(path.join(langDir, 'old.json'), 'utf-8'));
console.log('Updated in reviewed:', reviewed7.common.login);
console.log('Updated in old:', old7.legacy.button.text);
console.log('✓ Expected: both updated correctly');

console.log('\n=== All Tests Complete ===');
console.log('Backups created:');
const backups = fs.readdirSync(langDir).filter(f => f.includes('.backup-'));
backups.forEach(b => console.log('  -', b));

console.log('\nTest directory not cleaned up:', testDir);
console.log('Review files manually or delete with: rm -rf', testDir);

