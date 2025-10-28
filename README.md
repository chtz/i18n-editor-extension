# i18n Text Editor Chrome Extension

> ⚠️ **Vibe-Coded Disclaimer**: This extension was created during an AI-assisted coding session with zero manual code writing or review. It modifies your files with reckless abandon. Use at your own risk, or better yet, don't use it at all. The developer (an AI) accepts no responsibility for eaten files, broken keyboards, or existential crises. You have been warned. 🤖

Simple click-to-edit Chrome extension for i18next translations with automatic JSON file updates.

## Features

- Click any translated text to edit inline
- Automatic updates to JSON resource files (with timestamped backups)
- Multi-language support (detects current language automatically)
- Visual notifications for success/errors
- Template preservation (edits original template with placeholders, not rendered text)
- Simple and focused - requires data attributes on your elements

## Prerequisites

- Node.js 12+
- Chrome 88+ (Manifest V3)
- **Elements must have data attributes** (automatically added by i18n-dom-tagger)
- i18next with postProcessor that marks translations with `[[i18n|ns|key]]value[[/i18n]]`

## Installation

```bash
# 1. Install native messaging host
cd i18n-editor-extension
./build/install-native.bash

# 2. Load extension in Chrome
# - Open chrome://extensions
# - Enable "Developer mode"
# - Click "Load unpacked", select this directory
# - Copy the Extension ID

# 3. Update native host config with your extension ID
# macOS:
sed -i '' 's/YOUR_EXTENSION_ID/your-actual-id/' \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Linux:
sed -i 's/YOUR_EXTENSION_ID/your-actual-id/' \
  "$HOME/.config/google-chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# 4. Configure extension
# - Click extension icon → Settings
# - Set absolute path to locales (e.g., /Users/you/project/src/assets/locales)
# - Set language code to match your working language (e.g., de, fr, en)
# - Save

# 5. Enable editor
# - Click extension icon → "Enable Editor"
# - Or in console: starti18ndebug()
```

## Integration with Your React App

The extension works with **i18n-dom-tagger**, a development-mode helper that automatically adds metadata attributes to your DOM.

### Step 1: Install i18n-dom-tagger

Copy `sample-integration/i18n-dom-tagger.ts` to your project.

### Step 2: Configure i18next with Marker PostProcessor

Add a postProcessor to your i18next config that wraps translations with markers:

```typescript
// i18n.ts
import i18n from "i18next";

i18n.use({
    type: "postProcessor",
    name: "i18nmark",
    process(value: string, key: string, opts: any, translator: any) {
        if (process.env.NODE_ENV !== "development") return value;
        const ns = opts?.ns || translator?.translator?.options?.defaultNS || "translation";
        // Wrap translation with markers
        return `[[i18n|${ns}|${key}]]${value}[[/i18n]]`;
    },
});

i18n
    .use(/* ... other plugins ... */)
    .init({
        postProcess: ["i18nmark"], // Enable marker postProcessor
        // ... rest of your config
    });
```

### Step 3: Activate i18n-dom-tagger

In your main entry point (e.g., `main.tsx`):

```typescript
// main.tsx
import { installI18nDomTagger } from "./i18n-dom-tagger";

// Activate after i18n is configured
installI18nDomTagger(); // Only runs in development mode
```

### How It Works

1. **i18next** translates keys and wraps them with markers: `[[i18n|ns|key]]translated text[[/i18n]]`
2. **i18n-dom-tagger** watches the DOM and processes these markers:
   - Removes the marker syntax
   - Adds metadata attributes to elements
3. **Extension** reads the metadata attributes to enable click-to-edit

### Generated HTML Attributes

The i18n-dom-tagger automatically generates:

**For text content:**
```html
<button data-i18n-text-keys="common.buttonLogout" data-i18n-text-ns="reviewed">
  Abmelden
</button>
```

**For attributes (placeholder, title, alt, etc.):**
```html
<input 
  placeholder="In Ihren Projekten suchen"
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="reviewed"
  data-i18n-placeholder-key="myCasesPage.searchPlaceholder"
/>
```

**Multiple translations in one element:**
```html
<!-- If element contains multiple translations, attributes are comma-separated -->
<div data-i18n-text-keys="key1,key2" data-i18n-text-ns="ns1,ns2">
  Text with multiple translations
</div>
```
> **Note:** When clicking elements with multiple keys, the extension edits the **first key only**.

## Usage

```javascript
// Enable/disable
starti18ndebug()
stopi18ndebug()

// Then click any translated text to edit
// Press Enter/Tab to save, Escape to cancel
```

## How It Works

### Development Flow

1. **i18next** translates your keys and marks them: `[[i18n|reviewed|common.logout]]Abmelden[[/i18n]]`
2. **i18n-dom-tagger** (MutationObserver) processes the DOM:
   - Strips markers from text/attributes
   - Adds `data-i18n-*` attributes to elements
3. **Extension** activates when you click an element:
   - Reads key and namespace from data attributes
   - Shows inline editor (text) or modal (attributes)
4. **You edit** the translation
5. **Press Enter** → Extension sends update to native host
6. **Native host** (Node.js):
   - Locates JSON file using namespace and current language
   - Updates the translation key
   - Creates timestamped backup
   - Saves the file
7. **Done!** Your changes are immediately in the source files

**Visual feedback:**
- Green outline = Text content element (inline editor)
- Blue outline = Translated attribute (modal editor)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Your React App (Development Mode)                           │
│  ┌──────────────┐    ┌──────────────────┐                  │
│  │   i18next    │───▶│ i18n-dom-tagger  │                  │
│  │ (marks text) │    │ (adds attributes)│                  │
│  └──────────────┘    └──────────────────┘                  │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Chrome Extension                                             │
│  ┌────────────────┐    ┌──────────────┐    ┌──────────────┐│
│  │ Content Script │───▶│    Bridge    │───▶│  Background  ││
│  │ (detects click)│    │   (relay)    │    │   (router)   ││
│  └────────────────┘    └──────────────┘    └──────┬───────┘│
└──────────────────────────────────────────────────┼──────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Native Messaging Host (Node.js)                              │
│  ┌─────────────────┐    ┌────────────────────────────────┐ │
│  │ Message Handler │───▶│  update-i18n.js                │ │
│  │  (stdin/stdout) │    │  (updates JSON, creates backup)│ │
│  └─────────────────┘    └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Components

- **i18n-dom-tagger** - React app helper that adds metadata to DOM (dev only)
- **Content Script** - Detects clicks on translated elements, shows editors
- **Bridge Script** - Communicates between page context and extension context
- **Background Script** - Routes messages to native host
- **Native Host** - Node.js process that receives update requests
- **File Updater** - Performs actual JSON file updates with backups

### Language Configuration

The extension uses the **configured language** from the extension settings to determine which language folder to update.

**Important:** Set the correct language in the extension settings:
1. Click extension icon → Settings
2. Set "Language Code" to match your working language (e.g., `de`, `fr`, `en`)
3. Save settings

All translation updates will be saved to files in this language folder (e.g., `/path/to/locales/de/*.json`).

**To switch languages:** Update the language code in extension settings and save. The extension will then update files in the new language folder.

### Namespace Resolution

The extension uses a **smart namespace resolution strategy**:

1. When you edit a translation, the update logic searches for the key in **`reviewed.json` first**
2. If the key is not found in `reviewed.json`, it searches in **`old.json`**
3. The update is performed in whichever file contains the key
4. If the key is not found in either file, an error is returned

This allows gradual migration from `old` namespace to `reviewed` namespace:
- New translations can be added to `reviewed.json`
- Legacy translations remain in `old.json`
- The extension automatically finds the correct file

**Note:** The namespace attribute (`data-i18n-text-ns`) is still used by the extension for logging and display purposes, but the actual file update logic searches both namespaces.

## Troubleshooting

**Element not editable / No attributes found**
- Verify i18n-dom-tagger is installed and activated (`installI18nDomTagger()` in main.tsx)
- Check i18next has the `i18nmark` postProcessor configured
- Open browser DevTools → Elements tab → inspect element → look for `data-i18n-text-keys` attributes
- Console should show: `[i18n-debug] Element missing required i18n attributes` if attributes are missing

**Markers visible in UI** (`[[i18n|...]]...[[/i18n]]`)
- i18n-dom-tagger is not running or failed to process the DOM
- Check console for errors in i18n-dom-tagger.ts
- Verify `process.env.NODE_ENV === 'development'`

**Updates don't persist**
- Extension settings must use **absolute path** (e.g., `/Users/you/project/src/assets/locales`)
- Verify the path exists and Node.js has write permissions
- Check native host config has correct extension ID
- View backups to confirm writes are happening: look for `.backup-TIMESTAMP.json` files

**Wrong language file updated**
- Check the "Language Code" setting in the extension popup (click extension icon → Settings)
- Ensure it matches the language you want to edit (e.g., `de`, `fr`, `en`)
- Verify your locales folder structure matches: `{lang}/{namespace}.json`
- The extension **always** uses the configured language, not auto-detection

**Native host errors**
```bash
# Check native host is installed
ls -la "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Make sure it's executable
chmod +x i18n-editor-extension/native/host/native-messaging-host.js

# View native host logs (run Chrome from terminal to see stderr output)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# Test native host manually
echo '{"root":"/abs/path/to/locales","lang":"de","payload":[{"key":"test","ns":"common","old":"old","new":"new"}]}' | \
  node i18n-editor-extension/native/host/native-messaging-host.js
```

**Multiple keys in one element**
- When an element has multiple translation keys (comma-separated), the extension edits only the **first key**
- This is a limitation of the current implementation
- Split translations into separate elements if you need individual editing

## License

MIT License - See [LICENSE](LICENSE) file for details.

Open source. Modify and distribute freely (at your own risk, see disclaimer above).
