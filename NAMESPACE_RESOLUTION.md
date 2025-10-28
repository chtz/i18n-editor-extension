# Namespace Resolution Strategy

## Overview

The extension uses a **smart namespace resolution strategy** that automatically finds the correct JSON file for each translation key, regardless of the namespace attribute sent by the client.

## How It Works

When an update request is received, the system:

1. **Searches `reviewed.json` first** - Checks if the key exists in the reviewed namespace
2. **Falls back to `old.json`** - If not found in reviewed, checks the old namespace
3. **Updates the correct file** - Performs the update in whichever file contains the key
4. **Returns an error** - If the key is not found in any namespace

## Priority Order

```
reviewed.json → old.json → ERROR (key not found)
```

This priority order is hardcoded in `update-i18n.js`:

```javascript
const namespacePriority = ['reviewed', 'old'];
```

## Benefits

### 1. Gradual Migration Support

You can move translations from `old.json` to `reviewed.json` at your own pace:

```
Initial state:
  old.json: { "legacy.button": "Click" }
  reviewed.json: {}

After review:
  old.json: {}
  reviewed.json: { "legacy.button": "Click Here" }
```

The extension automatically finds the key in either location.

### 2. No Namespace Confusion

Users don't need to remember or specify which namespace contains which key:

```javascript
// Both work - extension finds the right file
payload: { key: "common.logout", old: "...", new: "..." }
payload: { key: "legacy.button.text", old: "...", new: "..." }
```

### 3. Prevents Duplicates

If the same key exists in both files, `reviewed.json` takes priority:

```
reviewed.json: { "common.button": "New Button" }
old.json: { "common.button": "Old Button" }

Update request for "common.button" → Updates reviewed.json
```

## Implementation Details

### File Search Algorithm

```javascript
function findKeyInNamespaces(key, lang, root) {
    for (const ns of ['reviewed', 'old']) {
        const filePath = path.join(root, lang, `${ns}.json`);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath));
            if (keyExists(data, key)) {
                return { ns, filePath, data };
            }
        }
    }
    return null; // Not found
}
```

### Key Existence Check

The `keyExists()` function traverses nested objects:

```javascript
keyExists(data, "a.b.c")
// Checks: data.a?.b?.c !== undefined
```

### Value Matching

Value matching (old value verification) is still enforced unless `force: true`:

```javascript
if (!force && currentValue !== expectedOldValue) {
    throw new Error("Value mismatch");
}
```

## Test Results

All test scenarios pass successfully:

| Test | Scenario | Result |
|------|----------|--------|
| 1 | Key in reviewed.json | ✅ Updated reviewed.json |
| 2 | Key in old.json only | ✅ Updated old.json |
| 3 | Key in old.json (not in reviewed) | ✅ Updated old.json |
| 4 | Key not found anywhere | ✅ Error returned |
| 5 | Value mismatch (force: false) | ✅ Error returned |
| 6 | Value mismatch (force: true) | ✅ Update forced |
| 7 | Batch update (both files) | ✅ Both files updated |

Run tests: `node native/test-update-logic.js`

## API Changes

### Before

```javascript
// Namespace was required and directly used
{
    key: "common.logout",
    ns: "reviewed",  // Required, used to determine file
    old: "Abmelden",
    new: "Logout"
}
```

### After

```javascript
// Namespace is optional (ignored for file selection)
{
    key: "common.logout",
    ns: "reviewed",  // Optional, only used for logging
    old: "Abmelden",
    new: "Logout"
}
```

The `ns` field is still accepted and logged for debugging, but the actual file selection is based on key search.

## Error Messages

### Key Not Found

```
Key not found in any namespace: missing.key (searched: reviewed, old)
```

### Value Mismatch

```
Mismatch for reviewed.buttons.save: current="Speichern", expected="Wrong Value"
```

### File Not Found

```
File not found: /path/to/locales/de/reviewed.json
```

## Configuration

### Custom Namespace Priority (Future Enhancement)

Currently hardcoded. Could be made configurable:

```javascript
// Future: Load from config
const namespacePriority = config.namespacePriority || ['reviewed', 'old'];
```

### Adding More Namespaces

To add support for additional namespaces:

1. Update the priority list in `update-i18n.js`:
   ```javascript
   const namespacePriority = ['reviewed', 'common', 'old'];
   ```

2. Ensure files exist in your locales directory:
   ```
   /path/to/locales/de/
     ├── reviewed.json
     ├── common.json
     └── old.json
   ```

## Best Practices

### 1. Keep Keys Unique Across Namespaces

Avoid having the same key in multiple files:

❌ **Bad:**
```
reviewed.json: { "button.text": "New" }
old.json: { "button.text": "Old" }
```

✅ **Good:**
```
reviewed.json: { "button.text": "Click Here" }
old.json: { "legacy.button.text": "Click" }
```

### 2. Migrate Keys Gradually

Move keys from `old` to `reviewed` as you review them:

```bash
# 1. Copy key to reviewed.json with updated translation
# 2. Test the app
# 3. Remove key from old.json
# 4. Commit changes
```

### 3. Use Descriptive Key Names

Make keys self-documenting:

❌ **Bad:** `"btn1"`, `"txt2"`

✅ **Good:** `"common.logout"`, `"myCasesPage.searchPlaceholder"`

### 4. Group Related Keys

Use nested objects for organization:

```json
{
    "myCasesPage": {
        "title": "Meine Fälle",
        "searchPlaceholder": "Suchen...",
        "filters": {
            "status": "Status",
            "date": "Datum"
        }
    }
}
```

## Troubleshooting

### "Key not found" but key exists

- Check for typos in the key path
- Verify JSON structure (nested correctly?)
- Ensure file is readable by Node.js
- Check file permissions

### Wrong file updated

- Verify namespace priority in `update-i18n.js`
- Check if key exists in both files (reviewed takes priority)
- Look at debug logs in stderr

### Backup files accumulating

Backups are created for every update session. Clean up old backups:

```bash
# Delete backups older than 7 days
find /path/to/locales -name "*.backup-*.json" -mtime +7 -delete
```

## Debugging

Enable debug logging by running Chrome from terminal:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Then check stderr output for:
[DEBUG] Key common.logout found in reviewed.json
[DEBUG] Backup created: ...
[DEBUG] Updated reviewed.common.logout: "old" -> "new"
```

## Future Enhancements

1. **Configurable namespace priority** - Allow users to define custom search order
2. **Auto-migration** - Automatically move keys from old to reviewed on update
3. **Duplicate detection** - Warn if same key exists in multiple files
4. **Namespace hints** - Use `ns` attribute as a hint to speed up search
5. **Cache** - Cache file contents to avoid re-reading on batch updates

## Related Files

- `native/update-i18n.js` - Main update logic
- `native/test-update-logic.js` - Test suite
- `native/host/native-messaging-host.js` - Chrome extension bridge
- `README.md` - Main documentation
- `INTEGRATION_SUMMARY.md` - Full change log

