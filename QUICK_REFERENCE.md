# Quick Reference Card

## Setup (5 minutes)

### 1. Install Extension
```bash
cd i18n-editor-extension
./build/install-native.bash
# Load unpacked in chrome://extensions
# Copy extension ID and update native host config
```

### 2. Configure Extension
- Click extension icon → Settings
- Set absolute path: `/Users/you/project/src/assets/locales`
- Set language code: `de` (the language you want to edit)
- Save

**Important:** The extension uses the configured language, not auto-detection. Change this setting when switching between languages.

### 3. Integrate i18n-dom-tagger
```typescript
// i18n.ts - Add postProcessor BEFORE .init()
i18n.use({
    type: "postProcessor",
    name: "i18nmark",
    process(value: string, key: string, opts: any, translator: any) {
        if (process.env.NODE_ENV !== "development") return value;
        const ns = opts?.ns || "translation";
        return `[[i18n|${ns}|${key}]]${value}[[/i18n]]`;
    },
});

i18n.use(HttpApi).use(LanguageDetector).use(initReactI18next)
    .init({
        postProcess: ["i18nmark"], // Enable marker
        // ... your config
    });
```

```typescript
// main.tsx - Activate after i18n import
import "./i18n.ts";
import { installI18nDomTagger } from "./i18n-dom-tagger";

installI18nDomTagger(); // Dev mode only
```

## Usage

```javascript
// Enable in console
starti18ndebug()

// Or click extension icon → "Enable Editor"

// Click any text to edit
// Enter/Tab = Save
// Escape = Cancel

// Disable
stopi18ndebug()
```

## Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Save | Enter or Tab |
| Cancel | Escape |
| (Click to edit) | Mouse click |

## Visual Indicators

| Color | Meaning |
|-------|---------|
| 🟢 Green outline | Text content (inline editor) |
| 🔵 Blue outline | Attribute (modal editor) |

## File Structure Expected

```
/path/to/locales/
  ├── de/
  │   ├── reviewed.json  (checked first)
  │   └── old.json       (checked second)
  ├── fr/
  │   ├── reviewed.json
  │   └── old.json
  └── en/
      ├── reviewed.json
      └── old.json
```

**Namespace Resolution:**
When you edit a key, the extension searches:
1. `reviewed.json` first
2. `old.json` if not found in reviewed
3. Updates whichever file contains the key

## Data Attributes Generated

```html
<!-- Text content -->
<button 
  data-i18n-text-keys="common.logout"
  data-i18n-text-ns="reviewed"
>Abmelden</button>

<!-- Attribute -->
<input 
  placeholder="Suchen..."
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="reviewed"
  data-i18n-placeholder-key="search.placeholder"
/>

<!-- Multiple keys (edits first only) -->
<div 
  data-i18n-text-keys="key1,key2"
  data-i18n-text-ns="ns1,ns2"
>Text</div>
```

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "Element not editable" | Check DevTools → Elements for `data-i18n-*` attrs |
| Markers visible `[[i18n...]]` | i18n-dom-tagger not running, check console |
| Updates don't save | Use **absolute path** in settings |
| Wrong language updated | Check "Language Code" in extension settings |
| Native host error | Run Chrome from terminal to see stderr logs |

## Quick Debug

```bash
# Verify native host installed
ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Test native host
echo '{"root":"/abs/path","lang":"de","payload":[{"key":"test","ns":"common","old":"old","new":"new"}]}' | \
  node i18n-editor-extension/native/host/native-messaging-host.js

# View Chrome logs (macOS)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Check backups created
ls -la /path/to/locales/de/*.backup-*.json
```

## Console Commands

```javascript
// Check if active
window.__i18nDebugActive

// Check configured language (in extension settings, not console)
// Click extension icon → Settings → "Language Code"

// Manually trigger DOM processing (if using tagger)
// (Not normally needed, tagger auto-runs)
```

## Performance Tips

- Extension only active when enabled (no overhead otherwise)
- i18n-dom-tagger only runs in development mode
- MutationObserver is debounced (batched updates)
- Native host spawns only when saving (not persistent)

## Support

- Main docs: [README.md](README.md)
- Integration guide: [sample-integration/README.md](sample-integration/README.md)
- Architecture: [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)
- License: [LICENSE](LICENSE) (MIT)

---

**Remember:** This extension modifies your source files! Always use version control and review changes before committing. Backups are created automatically with `.backup-TIMESTAMP.json` suffix.

