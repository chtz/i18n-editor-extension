# Language Configuration Change

## Problem

The extension was attempting to auto-detect the current language from the page using:
1. `window.i18next.language` or `window.i18next.resolvedLanguage`
2. `document.documentElement.lang`
3. `navigator.language`
4. Fallback to configured default

**Issue:** When the page language was `de` but the detection returned `en`, the wrong language files were updated.

## Root Cause

The i18n-dom-tagger approach doesn't require `window.i18next` to be exposed, so the extension couldn't reliably detect the current language from the page context.

## Solution

**The extension now always uses the configured language from the extension settings**, with no auto-detection.

## Changes Made

### 1. Extension Settings (UI)

**popup.html:**
- Renamed label from "Default Language Code" to **"Language Code"**
- Updated hint text to clarify this is the active working language

### 2. Background Script

**background.js:**
```javascript
// Before
const targetLang = request.language || config.lang || 'de';

// After
const targetLang = config.lang || 'de';
```

The `request.language` parameter is no longer used.

### 3. Content Script

**content-script.js:**
- **Removed** `getCurrentLanguage()` helper function
- **Removed** language parameter from both commit functions:
  - `makeFloatingEditor` → `commit()`
  - `makeInlineEditor` → `commit()`
- No longer sends `language` field in update messages

### 4. Bridge Script

**bridge.js:**
```javascript
// Before
chrome.runtime.sendMessage({
    type: 'UPDATE_TRANSLATION',
    payload: event.data.payload,
    language: event.data.language  // ❌ Removed
}, ...);

// After
chrome.runtime.sendMessage({
    type: 'UPDATE_TRANSLATION',
    payload: event.data.payload  // ✅ No language field
}, ...);
```

## Usage

### Setting the Language

1. Click the extension icon
2. Click "Settings"
3. Set "Language Code" to your working language (e.g., `de`, `fr`, `en`)
4. Click "Save Settings"

### Switching Languages

When you want to edit a different language:

1. **Update extension settings:**
   - Click extension icon → Settings
   - Change "Language Code" to the new language
   - Save

2. **Continue editing:**
   - All subsequent edits will update the new language folder
   - No need to reload the page

### Example Workflow

**Editing German translations:**
```
Extension Settings: Language Code = "de"
Edits save to: /path/to/locales/de/reviewed.json
```

**Switch to French translations:**
```
Extension Settings: Language Code = "fr"
Edits save to: /path/to/locales/fr/reviewed.json
```

## Benefits

### 1. Reliability
- No dependency on page-side i18n exposure
- No risk of incorrect auto-detection
- Consistent behavior across all pages

### 2. Simplicity
- Single source of truth
- Clear and explicit configuration
- No complex fallback logic

### 3. Control
- User explicitly chooses which language to edit
- Easy to verify current language (check extension settings)
- No surprises from auto-detection

### 4. Multi-language Workflow
- Quick switching between languages
- Edit German, then French, then English
- No need to change page language or reload

## Migration

### For Existing Users

**No action required** if you're happy with your current language setting.

**If experiencing wrong language updates:**
1. Check your current setting: Extension icon → Settings → "Language Code"
2. Update to match your desired working language
3. Save and continue

### For New Installations

During setup, explicitly set the "Language Code" to your primary working language.

## Troubleshooting

### Wrong Language Files Updated

**Symptom:** Edits are saved to `en/` folder but you want `de/`

**Solution:**
1. Open extension settings
2. Check "Language Code" field
3. Change to `de`
4. Save
5. Try editing again

### How to Verify Current Language

**Option 1: Check extension settings**
- Click extension icon
- See "Language Code" field

**Option 2: Check native host logs**
```bash
# Run Chrome from terminal
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Look for debug output:
# [DEBUG] Sending to native host: {"root":"...","lang":"de",...}
```

### Multi-tab Scenario

Each tab uses the same configured language. If you:
- Open tab 1 with German content
- Open tab 2 with French content
- Both tabs will edit files in the configured language folder

To work with multiple languages simultaneously, you would need multiple browser profiles (not currently supported).

## Testing Checklist

✅ **Basic functionality:**
- [x] Set language to `de`, edit text, verify `de/reviewed.json` updated
- [x] Change language to `fr`, edit text, verify `fr/reviewed.json` updated
- [x] Change language to `en`, edit text, verify `en/reviewed.json` updated

✅ **Edge cases:**
- [x] No language set (uses default `de`)
- [x] Invalid language code (still attempts to use it)
- [x] Language folder doesn't exist (native host errors appropriately)

✅ **UI:**
- [x] Label updated to "Language Code"
- [x] Hint text clarifies purpose
- [x] Settings persist across reloads

## Technical Details

### Message Flow (Before)

```
Content Script:
  ↓ window.i18next.language = 'en' (detected)
  ↓
Bridge:
  ↓ forwards language = 'en'
  ↓
Background:
  ↓ uses request.language || config.lang
  ↓ sends lang = 'en' to native host
  ↓
Native Host:
  ↓ updates /path/to/locales/en/*.json
```

### Message Flow (After)

```
Content Script:
  ↓ (no language detection)
  ↓
Bridge:
  ↓ (no language parameter)
  ↓
Background:
  ↓ reads config.lang from settings
  ↓ sends lang = 'de' to native host
  ↓
Native Host:
  ↓ updates /path/to/locales/de/*.json
```

### Configuration Storage

Language setting is stored in `chrome.storage.sync`:

```javascript
{
  root: "/abs/path/to/locales",
  lang: "de",
  force: false
}
```

Accessed via:
```javascript
chrome.storage.sync.get(['root', 'lang', 'force'], (config) => {
  const targetLang = config.lang || 'de';
  // ...
});
```

## Related Files

- `src/popup/popup.html` - UI label updated
- `src/popup/popup.js` - No changes (already uses `config.lang`)
- `src/background/background.js` - Removed `request.language` fallback
- `src/content/content-script.js` - Removed language detection
- `src/content/bridge.js` - Removed language forwarding
- `README.md` - Updated documentation
- `QUICK_REFERENCE.md` - Updated quick guide
- `INTEGRATION_SUMMARY.md` - Added change log

## Future Enhancements

1. **Per-tab language override**: Allow different tabs to work with different languages
2. **Language indicator**: Show current language in extension badge
3. **Quick language switcher**: Dropdown in popup for fast switching
4. **Warning on mismatch**: Warn if page language doesn't match configured language
5. **Auto-detect on first install**: Pre-fill language based on browser locale

## Conclusion

The extension now has a simpler, more reliable language configuration system. Users explicitly set their working language, and all edits consistently update that language's files.

