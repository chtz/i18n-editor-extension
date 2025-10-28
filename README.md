# i18n Text Editor Chrome Extension

> ⚠️ **AI-Generated Disclaimer**: This extension was created during an AI-assisted coding session. It modifies your JSON files directly. Use at your own risk. 🤖

Click-to-edit Chrome extension for i18next translations with automatic JSON file updates.

## What It Does

Click any translated text in your React app → Edit it in a modal → Press Enter → JSON file updated automatically with timestamped backup.

## Prerequisites

- **Node.js** 12+
- **Chrome** 88+ (Manifest V3)
- **React app** with i18next
- **File structure**: `locales/{lang}/{namespace}.json` (e.g., `locales/de/reviewed.json`)

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ Your React App (Development Mode)                           │
│                                                              │
│  1. i18next postProcessor wraps translations with markers:  │
│     t("common.logout") → "[[i18n|reviewed|common.logout]]   │
│                           Abmelden[[/i18n]]"                 │
│                                                              │
│  2. i18n-dom-tagger (MutationObserver) processes DOM:       │
│     - Strips markers from visible text/attributes           │
│     - Adds data-i18n-* attributes to elements               │
│                                                              │
│  3. Result in DOM:                                          │
│     <button data-i18n-text-keys="common.logout"             │
│             data-i18n-text-ns="reviewed">                   │
│       Abmelden                                              │
│     </button>                                               │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Chrome Extension (click on text)                            │
│                                                              │
│  Content Script → Bridge → Background → Native Host         │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Native Messaging Host (Node.js)                             │
│                                                              │
│  - Searches reviewed.json, then old.json for key            │
│  - Creates timestamped backup                               │
│  - Updates JSON file with new value                         │
│  - Returns success/error to extension                       │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### 1. Prepare Your React App

**Copy the DOM tagger:**
```bash
cp sample-integration/i18n-dom-tagger.ts src/i18n-dom-tagger.ts
```

**Add postProcessor to i18n config** (before `.init()`):

```typescript
// src/i18n.ts
import i18n from "i18next";

i18n.use({
    type: "postProcessor",
    name: "i18nmark",
    process(value: string, key: string, opts: any, translator: any) {
        if (process.env.NODE_ENV !== "development") return value;
        const ns = opts?.ns || translator?.translator?.options?.defaultNS || "translation";
        return `[[i18n|${ns}|${key}]]${value}[[/i18n]]`;
    },
});

i18n
    .use(/* ... other plugins ... */)
    .init({
        postProcess: ["i18nmark"], // Enable marker
        // ... rest of config
    });
```

**Activate tagger in main entry point:**

```typescript
// src/main.tsx
import "./i18n"; // Import i18n config first
import { installI18nDomTagger } from "./i18n-dom-tagger";

installI18nDomTagger(); // Only runs in development

// ... rest of your app
```

**Verify it works:**
- Open DevTools → Elements tab
- Inspect a translated element
- Should see `data-i18n-text-keys` and `data-i18n-text-ns` attributes
- Should **not** see `[[i18n|...]]` markers in visible text

### 2. Install Extension

```bash
cd i18n-editor-extension
./build/install-native.bash

# Follow output instructions to:
# 1. Load extension in chrome://extensions
# 2. Copy extension ID and update native host config
```

Update native host config with your extension ID:

```bash
# macOS:
sed -i '' 's/YOUR_EXTENSION_ID/your-actual-id/' \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Linux:
sed -i 's/YOUR_EXTENSION_ID/your-actual-id/' \
  "$HOME/.config/google-chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"
```

### 3. Configure Extension

Click extension icon → Settings:

- **Resource Bundle Root**: `/absolute/path/to/your/project/src/assets/locales`
- **Language Code**: `de` (the language you want to edit)
- **Skip old value verification**: ☐ (optional, for force updates)

Click **Save Settings**.

### 4. Enable Editor

Click **Enable Editor** in popup, or run in console:

```javascript
starti18ndebug()
```

State persists across page reloads.

## Usage

1. **Enable editor** (popup or console)
2. **Click** any translated text or input field
3. **Modal opens** showing:
   - Rendered text (read-only, with interpolations like "Step 1 of 3")
   - Template text (editable, with placeholders like "Step {{current}} of {{total}}")
4. **Edit** the template text
5. **Press Enter** → File updated, backup created
6. **Press Escape** → Cancel

**To disable:**

```javascript
stopi18ndebug()
```

## Supported Patterns

The extension detects elements with these attributes (auto-generated by i18n-dom-tagger):

**Text content:**
```html
<button data-i18n-text-keys="common.logout" data-i18n-text-ns="reviewed">
  Abmelden
</button>
```

**Translated attributes** (placeholder, title, alt, etc.):
```html
<input 
  placeholder="Suchen..."
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="reviewed"
  data-i18n-placeholder-key="search.placeholder"
/>
```

**Multiple translations** (comma-separated, edits first key only):
```html
<div data-i18n-text-keys="key1,key2" data-i18n-text-ns="ns1,ns2">
  Text with multiple translations
</div>
```

## File Updates

### Namespace Resolution

The extension searches for keys in this order:

1. **`reviewed.json`** (check first)
2. **`old.json`** (fallback)
3. **Error** (key not found)

This allows gradual migration from `old` to `reviewed` namespace. The update happens in whichever file contains the key.

### Language Selection

The extension uses the **configured language** from settings, not auto-detection.

To edit French translations: Set "Language Code" to `fr` in settings.

### Backups

First update to a file creates a timestamped backup:

```
reviewed.json → reviewed.json.backup-2025-01-15T10-30-45
```

Subsequent updates in the same session don't create new backups.

## i18n-dom-tagger Details

The DOM tagger is a MutationObserver that processes translation markers:

**For text nodes:**
```html
<!-- Before (DOM from React) -->
<button>[[i18n|reviewed|common.logout]]Abmelden[[/i18n]]</button>

<!-- After (DOM tagger processes it) -->
<button data-i18n-text-keys="common.logout" data-i18n-text-ns="reviewed">
  Abmelden
</button>
```

**For attributes:**
```html
<!-- Before -->
<input placeholder="[[i18n|reviewed|search.placeholder]]Suchen...[[/i18n]]" />

<!-- After -->
<input 
  placeholder="Suchen..."
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="reviewed"
  data-i18n-placeholder-key="search.placeholder"
/>
```

**Performance characteristics:**
- Debounced (batches DOM changes, setTimeout 0)
- In-place mutations (no node add/remove)
- Dev-only (completely disabled in production)
- Minimal overhead (only processes marked nodes)

## Troubleshooting

**"Element not editable" notification:**
- Missing data attributes → Check i18n-dom-tagger is installed and running
- Verify postProcessor is configured: `postProcess: ["i18nmark"]`
- Inspect element in DevTools → should have `data-i18n-text-keys` attribute

**Markers visible in UI** (`[[i18n|...]]`):
- i18n-dom-tagger not running
- Check console for errors
- Verify `process.env.NODE_ENV === 'development'`

**No data attributes on elements:**
- PostProcessor not configured in i18next
- Check `postProcess: ["i18nmark"]` in i18next.init()
- Verify postProcessor is defined before `.init()`

**Updates don't persist:**
- Path must be **absolute** (e.g., `/Users/you/project/src/assets/locales`)
- Verify path exists and Node.js has write permissions
- Check extension ID in native host config matches chrome://extensions
- Look for `.backup-*` files to confirm writes are happening

**Wrong language file updated:**
- Check "Language Code" in extension settings
- Ensure it matches the language you want to edit
- Verify folder structure: `locales/{lang}/{namespace}.json`

**Native host errors:**

```bash
# Verify installation
ls -la "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Make executable
chmod +x i18n-editor-extension/native/host/native-messaging-host.js

# Test manually
echo '{"root":"/path/to/locales","lang":"de","payload":[{"key":"test.key","ns":"reviewed","old":"old","new":"new"}]}' | \
  node i18n-editor-extension/native/host/native-messaging-host.js

# View native host logs (run Chrome from terminal)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

## Architecture

**Extension Components:**
- `content-script.js` - Detects clicks, shows modal editor (runs in page context)
- `bridge.js` - Relays messages between page and extension (isolated context)
- `background.js` - Routes messages to native host (service worker)
- `popup.html/js` - Settings UI

**Native Components:**
- `native-messaging-host.js` - Receives messages via stdin, sends responses via stdout
- `update-i18n.js` - Performs JSON file updates with backups

**React App Helper:**
- `i18n-dom-tagger.ts` - MutationObserver that strips markers and adds attributes (copy to your project)

**Message Flow:**
```
Page Click → Content Script → Bridge → Background → Native Host → File Update
```

## Development

**File structure:**
```
i18n-editor-extension/
├── src/
│   ├── content/          # Content scripts
│   ├── background/       # Service worker
│   └── popup/           # Settings UI
├── native/
│   ├── host/            # Native messaging host
│   └── update-i18n.js   # JSON updater
├── sample-integration/
│   └── i18n-dom-tagger.ts  # Copy to your project
├── build/
│   └── install-native.bash # Installer
└── manifest.json
```

**Testing:**
```bash
# Test update logic
cd native
node test-update-logic.js

# Test native host manually
echo '{"root":"/path/to/locales","lang":"de","payload":[{"key":"test","ns":"reviewed","old":"old","new":"new"}]}' | \
  node host/native-messaging-host.js
```

## License

MIT License - See [LICENSE](LICENSE) file for details.
