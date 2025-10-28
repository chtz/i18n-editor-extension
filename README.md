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
- Web app with `window.i18next` exposed
- **Elements must have data attributes**: `data-i18n-text-keys` and `data-i18n-text-ns`

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
# - Set default language code (e.g., de)
# - Save

# 5. Enable editor
# - Click extension icon → "Enable Editor"
# - Or in console: starti18ndebug()
```

## Required HTML Attributes

The extension supports **two patterns**:

### Pattern 1: Text Content

For translated text content (button labels, headings, paragraphs, etc.):

```html
<button 
  data-i18n-text-keys="common.buttonLogout" 
  data-i18n-text-ns="reviewed"
>
  Abmelden
</button>
```

**Required attributes:**
- `data-i18n-text-keys` - The translation key
- `data-i18n-text-ns` - The namespace

### Pattern 2: Translated Attributes

For translated attributes (placeholder, title, aria-label, alt, etc.):

```html
<input 
  placeholder="In Ihren Projekten suchen"
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="reviewed"
  data-i18n-placeholder-key="myCasesPage.searchPlaceholder"
/>
```

**Required attributes:**
- `data-i18n-attr` - Which attribute is translated (e.g., `"placeholder"`, `"title"`, `"alt"`)
- `data-i18n-{attr}-ns` - The namespace (e.g., `data-i18n-placeholder-ns="reviewed"`)
- `data-i18n-{attr}-key` - The translation key (e.g., `data-i18n-placeholder-key="..."`)

**Examples:**
```html
<!-- Placeholder -->
<input 
  placeholder="Search..."
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="common"
  data-i18n-placeholder-key="search.placeholder"
/>

<!-- Title attribute -->
<button 
  title="Click to logout"
  data-i18n-attr="title"
  data-i18n-title-ns="common"
  data-i18n-title-key="button.logout.title"
>
  Logout
</button>

<!-- Alt text -->
<img 
  src="logo.png"
  alt="Company Logo"
  data-i18n-attr="alt"
  data-i18n-alt-ns="common"
  data-i18n-alt-key="logo.alt"
/>
```

### How to Add Them

**In React components:**
```jsx
// Text content
<button 
  data-i18n-text-keys="common.buttonLogout"
  data-i18n-text-ns="reviewed"
>
  {t("common.buttonLogout")}
</button>

// Attribute
<input 
  placeholder={t("search.placeholder")}
  data-i18n-attr="placeholder"
  data-i18n-placeholder-ns="common"
  data-i18n-placeholder-key="search.placeholder"
/>
```

**Or create helper components:**
```jsx
// Text wrapper
const T = ({ k, ns = "translation", ...props }) => {
  const { t } = useTranslation();
  return (
    <span data-i18n-text-keys={k} data-i18n-text-ns={ns} {...props}>
      {t(k, { ns })}
    </span>
  );
};

// Usage:
<T k="common.buttonLogout" ns="reviewed" />
```

## Usage

```javascript
// Enable/disable
starti18ndebug()
stopi18ndebug()

// Then click any translated text to edit
// Press Enter/Tab to save, Escape to cancel
```

## How It Works

1. **Click** on an element with i18n attributes (text content or translated attribute)
2. Extension **reads** the key and namespace from the data attributes
3. Extension **fetches** the template from `window.i18next` bundle
4. **Edit** the translation inline
5. **Press Enter** → Extension sends update to native host
6. Native host **updates** the JSON file and creates a backup
7. **Done!** Your changes are saved to the file

**Visual feedback:**
- Green outline = Text content element
- Blue outline = Translated attribute element

### Components

- **Content Script** - Detects clicks, shows inline editor
- **Bridge Script** - Communicates between page and extension
- **Background Script** - Routes messages to native host
- **Native Host** - Node.js process that updates JSON files
- **File Updater** - Performs actual file updates with backups

## Troubleshooting

**Element not editable**
- Make sure element has both `data-i18n-text-keys` and `data-i18n-text-ns` attributes
- Check browser console for error messages

**Updates don't persist**
- Extension settings must use **absolute path** (e.g., `/Users/you/project/src/assets/locales`)
- Verify the path exists and Node.js has write permissions
- Check native host config has correct extension ID

**Native host errors**
```bash
# Check native host is installed
ls -la "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.i18ntexteditor.host.json"

# Make sure it's executable
chmod +x native/host/native-messaging-host.js

# View native host logs (run Chrome from terminal)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

Open source. Modify and distribute freely (at your own risk, see disclaimer above).
