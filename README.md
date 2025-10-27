# i18n Text Editor Chrome Extension

> ⚠️ **Vibe-Coded Disclaimer**: This extension was created during an AI-assisted coding session with zero manual code writing or review. It modifies your files with reckless abandon. Use at your own risk, or better yet, don't use it at all. The developer (an AI) accepts no responsibility for eaten files, broken keyboards, or existential crises. You have been warned. 🤖

Click-to-edit Chrome extension for i18next translations with automatic JSON file updates via native messaging.

## Features

- Click any translated text to edit inline
- Automatic updates to JSON resource files (with timestamped backups)
- Multi-namespace support with automatic detection
- Visual notifications for success/errors
- Babel plugin integration for accurate key detection via DOM attributes
- Template preservation (edits original template with placeholders, not rendered text)

## Prerequisites

- Node.js 12+
- Chrome 88+ (Manifest V3)
- Web app with `window.i18next` exposed

## Installation

### Part 1: Install Extension

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
# - Set language code (e.g., de, en)
# - Save

# 5. Enable editor
# - Click extension icon → "Enable Editor"
# - Or in console: starti18ndebug()
```

### Part 2: Add Babel Plugin to Your React App (Recommended)

This plugin adds `data-i18n-key` attributes to all `t()` calls for accurate key detection.

**1. Copy the Babel plugin:**
```bash
# Copy babel-plugin-i18n-debug.cjs to your React project root
cp babel-plugin-i18n-debug.cjs /path/to/your/react/project/
```

**2. Update your build config:**

For **Vite** (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: process.env.NODE_ENV === 'development'
          ? [
              ['./babel-plugin-i18n-debug.cjs', {
                localesPath: path.resolve(__dirname, 'src/assets/locales'),
                defaultLang: 'de'
              }]
            ]
          : []
      }
    })
  ]
});
```

For **webpack/CRA** (`.babelrc` or `babel.config.js`):
```javascript
module.exports = {
  plugins: [
    process.env.NODE_ENV === 'development' && [
      './babel-plugin-i18n-debug.cjs',
      {
        localesPath: require('path').resolve(__dirname, 'src/assets/locales'),
        defaultLang: 'de'
      }
    ]
  ].filter(Boolean)
};
```

**3. Restart your dev server**

Now all `{t("key")}` calls will render as:
```html
<span data-i18n-key="key" data-i18n-ns="namespace" data-i18n-tpl="Original {{template}}">
  Rendered text
</span>
```

The extension will use these attributes for instant, accurate key detection!

## Usage

```javascript
// Enable/disable
starti18ndebug()
stopi18ndebug()

// Then click any translated text to edit
// Press Enter/Tab to save, Escape to cancel
```

## Architecture

### Components
1. **Content Script** (`content-script.js`) - Runs in page's main world, accesses `window.i18next`, provides inline editor
2. **Bridge Script** (`bridge.js`) - Runs in isolated world, handles Chrome API communication
3. **Background Worker** (`background.js`) - Routes messages, uses `chrome.runtime.sendNativeMessage()`
4. **Native Host** (`native-messaging-host.js`) - Node.js process, receives stdin, updates files, sends stdout
5. **File Updater** (`update-i18n.js`) - Performs JSON updates with validation and backups

### Chrome Native Messaging Protocol
Messages are framed: `[4-byte length (little-endian)][UTF-8 JSON]`

**Critical**: Must use UTF-8 byte length, not character length
```javascript
// ❌ WRONG: Multi-byte chars (ä, ö, ü) break this
const len = jsonString.length;

// ✅ CORRECT
const len = Buffer.byteLength(jsonString, 'utf8');
```

### Process Lifecycle
1. Chrome calls `sendNativeMessage()` → spawns new Node.js process per request
2. Native host reads stdin, processes, writes stdout, exits
3. Must flush stdout before exit to avoid race conditions:
```javascript
process.stdout.write(buffer, (err) => {
  process.stdout.end();
});
process.stdout.on('finish', () => process.exit(0));
```

### Execution Contexts
- Content scripts default to **isolated world** (no access to page JS)
- Use `"world": "MAIN"` in manifest to run in page context (access `window.i18next`)
- Bridge script in isolated world handles Chrome APIs (`chrome.runtime`)
- Communication via `window.postMessage()` between contexts

## File Structure

```
i18n-editor-extension/
├── manifest.json              # Chrome extension config (Manifest V3)
├── src/
│   ├── content/
│   │   ├── content-script.js # Editor UI (main world)
│   │   └── bridge.js         # Chrome API bridge (isolated world)
│   ├── background/
│   │   └── background.js     # Service worker
│   └── popup/
│       ├── popup.html        # Settings UI
│       └── popup.js
├── native/
│   ├── host/
│   │   └── native-messaging-host.js  # Native host
│   └── update-i18n.js                # File updater
├── config/
│   └── host-config.json              # Template for installation
└── build/
    └── install-native.bash           # Install script
```

**Native host location after installation:**
- macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json`
- Linux: `~/.config/google-chrome/NativeMessagingHosts/com.i18ntexteditor.host.json`

## Configuration

### Host Name Validation
Chrome requires reverse-domain format: `com.i18ntexteditor.host`
- Lowercase only
- Alphanumeric, dots, underscores
- No leading/trailing dots, no consecutive dots
- Config filename must match: `com.i18ntexteditor.host.json`

### Extension ID
Must match in native host config's `allowed_origins`. Extension ID changes when reloaded in developer mode.

### Resource Structure
```
project/
└── src/assets/locales/    # Configured root (absolute path)
    ├── de/
    │   ├── common.json
    │   └── ui.json
    └── en/
        ├── common.json
        └── ui.json
```

JSON format:
```json
{
  "welcome": {
    "title": "Welcome",
    "message": "Hello"
  }
}
```

## Troubleshooting

**"Native host not found"**
```bash
# Check file exists and has correct name
ls -la "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Verify name field matches
cat "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json" | grep name

# Check executable permissions
chmod +x native/host/native-messaging-host.js
```

**Extension ID mismatch**
```bash
# Get your extension ID from chrome://extensions
# Update config:
sed -i '' 's/YOUR_EXTENSION_ID/actual-id/' \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"
```

**File updates fail**
- Use absolute path (not relative) for resource root
- Verify language code matches directory structure
- Check Node.js has write permissions

**View logs**
```bash
# Run Chrome from terminal to see stderr
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

## Key Technical Solutions

1. **UTF-8 Byte Length**: Chrome's protocol requires byte count, not character count for multi-byte UTF-8
2. **Stdout Flushing**: Must wait for stdout flush before process exit to avoid race conditions
3. **Main World Execution**: Content script needs `"world": "MAIN"` to access page JS
4. **Bridge Pattern**: Separate script in isolated world for Chrome API access
5. **Host Name Format**: Lowercase reverse-domain required by Chrome validation

## Development

Debug:
- Content script: Browser console
- Background: `chrome://extensions` → Inspect service worker
- Native host: Run Chrome from terminal, watch stderr

Message format:
```json
{
  "root": "/absolute/path/to/locales",
  "lang": "de",
  "force": false,
  "payload": [
    {
      "key": "welcome.message",
      "ns": "common",
      "old": "Old text",
      "new": "New text"
    }
  ]
}
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

Open source. Modify and distribute freely (at your own risk, see disclaimer above).
