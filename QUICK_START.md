# Quick Start Guide

## 1. Install Extension (5 minutes)

```bash
cd i18n-editor-extension
./build/install-native.bash

# Load in Chrome (chrome://extensions)
# Copy Extension ID
# Update native host config with ID

# macOS:
sed -i '' 's/YOUR_EXTENSION_ID/your-id/' \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Configure extension:
# - Set absolute path: /Users/you/project/src/assets/locales
# - Set language: de
# - Save
```

## 2. Add Babel Plugin (2 minutes)

```bash
# Copy plugin to your React project
cp babel-plugin-i18n-debug.cjs /path/to/your/react/project/
```

**Edit `vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === "development"
          ? ["./babel-plugin-i18n-debug.cjs"]
          : []
      }
    })
  ]
});
```

**Restart dev server:**
```bash
npm run dev
```

## 3. Use Extension (30 seconds)

**In browser console:**
```javascript
starti18ndebug()
```

**Or click extension icon → "Enable Editor"**

**Then:**
- Click any translated text
- Edit in the input field
- Press Enter → JSON files update automatically!

---

## That's It! 🎉

### Check Coverage (Optional)

See how much of your app is wrapped:

```bash
I18N_DEBUG=true npm run dev
```

Look for the coverage report in the terminal.

---

## Troubleshooting

### Text not clickable / No data attributes?

**Check 1**: Did you restart the dev server after adding the plugin?

**Check 2**: Is the text actually from `t()`?
```javascript
// ✅ Works
<div>{t("key")}</div>

// ❌ Doesn't work
<div>Hard-coded text</div>
```

**Check 3**: Is it a dynamic key?
```javascript
// ❌ Can't wrap dynamic keys
<div>{t(variable)}</div>
<div>{t(`product.${type}`)}</div>
```

### Updates don't persist?

**Check**: Extension settings → Is the locales path **absolute**?
```
❌ Wrong: src/assets/locales
✅ Right: /Users/you/project/src/assets/locales
```

### Multiple keys with same value?

**Solution**: Use Babel plugin! It eliminates ambiguity by embedding the exact key in the DOM.

---

## Default Configuration

The plugin uses these defaults (no config needed if they match):

- **Locales path**: `src/assets/locales/`
- **Default language**: `de`
- **File structure**: `locales/{lang}/{namespace}.json`

**Example**:
```
src/assets/locales/
├── de/
│   ├── translation.json
│   └── common.json
└── en/
    ├── translation.json
    └── common.json
```

If your structure differs, see [BABEL_PLUGIN_INTEGRATION.md](BABEL_PLUGIN_INTEGRATION.md) for custom options.

---

## Key Features

✅ **Click to edit** - No more hunting for the right JSON file  
✅ **Template preservation** - Edit `"Step {{n}}"` not `"Step 1"`  
✅ **Multi-language** - Detects current language automatically  
✅ **Namespace detection** - Finds the right namespace automatically  
✅ **Instant updates** - Changes saved immediately to JSON  
✅ **Backups** - Timestamped backups before every change  
✅ **Visual feedback** - Green = wrapped, Orange = fallback  

---

## Advanced Features

### Coverage Analysis
```bash
I18N_DEBUG=true npm run dev
```
See which patterns are wrapped vs. skipped.

### Persistent Editor State
Enable once, stays enabled across page reloads (per hostname).

### Multi-key Updates
When multiple keys have the same value, all are updated at once.

---

## Next Steps

- Read [BABEL_PLUGIN_PATTERNS.md](BABEL_PLUGIN_PATTERNS.md) for supported patterns
- Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Read [COVERAGE_ANALYSIS.md](COVERAGE_ANALYSIS.md) to improve coverage

---

## Support

- 🐛 Bug? Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 📊 Low coverage? Check [COVERAGE_ANALYSIS.md](COVERAGE_ANALYSIS.md)
- 🤔 Pattern not supported? Check [BABEL_PLUGIN_PATTERNS.md](BABEL_PLUGIN_PATTERNS.md)
- ⚙️ Setup issues? Check [BABEL_PLUGIN_INTEGRATION.md](BABEL_PLUGIN_INTEGRATION.md)

---

**Enjoy editing translations without leaving your browser!** 🚀

