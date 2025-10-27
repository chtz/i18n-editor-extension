# Babel Plugin Integration Guide

## Overview

The Babel plugin automatically wraps all `t()` translation calls with `<span>` elements containing data attributes. This allows the Chrome extension to instantly identify the correct translation key without expensive bundle searches or ambiguous value matching.

## How It Works

### Before (Your Source Code)
```jsx
<button>{t("common.submit")}</button>
<h1>{t("page.title", { step: 1, total: 3 })}</h1>
```

### After (Compiled in Development Mode)
```html
<button>
  <span data-i18n-key="common.submit" data-i18n-ns="translation" data-i18n-tpl="Submit">
    Submit
  </span>
</button>
<h1>
  <span data-i18n-key="page.title" data-i18n-ns="translation" data-i18n-tpl="Step {{step}} of {{total}}">
    Step 1 of 3
  </span>
</h1>
```

### Key Features

1. **`data-i18n-key`**: The exact translation key (e.g., `"common.submit"`)
2. **`data-i18n-ns`**: The namespace (may be incorrect, extension ignores it)
3. **`data-i18n-tpl`**: The original template from JSON with placeholders (e.g., `"Step {{step}} of {{total}}"`)

## Benefits

✅ **Accurate Key Detection**: No guessing, key is directly in the DOM  
✅ **Template Editing**: Edit the original template with placeholders, not the rendered text  
✅ **No Value Conflicts**: Works even when multiple keys have the same translated value  
✅ **Namespace Auto-Detection**: Extension searches all namespaces to find the correct one  
✅ **Zero Runtime Overhead**: Only active in development mode  
✅ **Production Safe**: Completely removed in production builds  

## Installation

### 1. Copy Plugin to Your React Project

```bash
cp babel-plugin-i18n-debug.cjs /path/to/your/react/project/
```

### 2. Configure Build Tool

#### For Vite

Edit `vite.config.ts`:

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

#### For Create React App / webpack

Create or edit `babel.config.js`:

```javascript
const path = require('path');

module.exports = {
  presets: ['@babel/preset-react'],
  plugins: [
    process.env.NODE_ENV === 'development' && [
      './babel-plugin-i18n-debug.cjs',
      {
        localesPath: path.resolve(__dirname, 'src/assets/locales'),
        defaultLang: 'de'
      }
    ]
  ].filter(Boolean)
};
```

#### For Next.js

Edit `next.config.js`:

```javascript
module.exports = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.module.rules.push({
        test: /\.(js|jsx|ts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['./babel-plugin-i18n-debug.cjs', {
                localesPath: require('path').resolve(__dirname, 'public/locales'),
                defaultLang: 'en'
              }]
            ]
          }
        }
      });
    }
    return config;
  }
};
```

### 3. Configure Plugin Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `localesPath` | string | Yes | Absolute path to your locales directory |
| `defaultLang` | string | Yes | Default language code (e.g., `'de'`, `'en'`) |

**Important**: The `localesPath` must be an **absolute path**. Use `path.resolve()` or `__dirname` to ensure it's correct.

### 4. Verify File Structure

The plugin expects this structure:

```
localesPath/
├── de/
│   ├── translation.json
│   ├── common.json
│   └── ...
├── en/
│   ├── translation.json
│   ├── common.json
│   └── ...
└── fr/
    ├── translation.json
    └── ...
```

### 5. Restart Dev Server

```bash
npm run dev
# or
yarn dev
```

## How the Extension Uses the Attributes

When you click on translated text, the extension:

1. **Checks for `data-i18n-key`** - If present, uses it directly (fast path)
2. **Searches all namespaces** - Ignores potentially incorrect `data-i18n-ns`, searches all bundles to find the key
3. **Uses the template** - Edits `data-i18n-tpl` (original template) instead of rendered text
4. **Falls back to value matching** - If no data attributes, searches bundles by value (old behavior)

## Troubleshooting

### Problem: Attributes Not Appearing

**Check 1**: Verify development mode
```bash
# Make sure NODE_ENV is 'development'
echo $NODE_ENV
```

**Check 2**: Inspect compiled output
Open DevTools → Elements → Find a translated text → Check for `data-i18n-*` attributes

**Check 3**: Check console for plugin errors
Look for `[i18n-debug-plugin]` messages in the terminal

### Problem: Template Not Found

**Check 1**: Verify `localesPath` is absolute
```javascript
// ❌ Wrong
localesPath: 'src/assets/locales'

// ✅ Correct
localesPath: path.resolve(__dirname, 'src/assets/locales')
```

**Check 2**: Verify file structure matches
```bash
ls -la "$(your_localesPath)/$(your_defaultLang)/"
# Should show translation.json, common.json, etc.
```

**Check 3**: Check JSON file permissions
```bash
# Files must be readable
chmod 644 src/assets/locales/de/*.json
```

### Problem: Stack Overflow / Infinite Loop

This was fixed in the current version. Make sure you're using the latest plugin with `path.skip()`.

### Problem: React is Not Defined

This was fixed by generating JSX instead of `React.createElement()`. Update to the latest plugin version.

## Performance Impact

- **Build Time**: Minimal (~50-100ms for typical projects)
- **Bundle Size**: Zero (only in development, removed in production)
- **Runtime**: Zero (static HTML attributes)
- **HMR**: No impact (Babel runs on changed files only)

## Customization

### Change Wrapper Element

Currently uses `<span>`. To change to `<div>` or another element:

```javascript
// In babel-plugin-i18n-debug.cjs, line ~110
t.jsxIdentifier("span")  // Change to "div", etc.
```

### Add Custom Attributes

```javascript
// In babel-plugin-i18n-debug.cjs, line ~103
attributes.push(
    t.jsxAttribute(
        t.jsxIdentifier("data-custom-attr"),
        t.stringLiteral("custom-value")
    )
);
```

### Skip Certain Keys

```javascript
// In babel-plugin-i18n-debug.cjs, line ~67
if (key.startsWith('skip.')) {
    return; // Don't wrap keys starting with 'skip.'
}
```

## Without Babel Plugin

The extension still works without the Babel plugin, but:

- ❌ Slower (searches all bundles by value)
- ❌ Ambiguous when multiple keys have same value
- ❌ Edits rendered text, not template (loses placeholders)
- ❌ May match wrong key/namespace

**Recommendation**: Use the Babel plugin for the best experience!

## License

MIT - Same as the main extension

