# Troubleshooting Guide

## Multiple Keys with Same Value

### Problem

When clicking on text, you see a warning like:
```
⚠️ Multiple keys (11) have the same value! Using best guess: reviewed:caseWizard.vgv.title
💡 Tip: Add Babel plugin to your React app for accurate key detection
```

The editor shows an **orange border** and displays which key was selected.

### Why This Happens

Multiple translation keys have the same translated text. For example:
```json
// common.json
{
  "product.vgv.title": "Vertragsgarantieversicherung",
  "productType.vgv.title": "Vertragsgarantieversicherung",
  "nav.vgv.label": "Vertragsgarantieversicherung"
}
```

### Solutions

#### Option 1: Use Babel Plugin (Recommended)

The Babel plugin embeds the exact key in the DOM, eliminating ambiguity.

**Before** (ambiguous):
```html
<p>Vertragsgarantieversicherung</p>
```
→ Extension searches all bundles → Finds 11 matches → Guesses best one

**After** (precise):
```html
<p>
  <span data-i18n-key="nav.vgv.label">
    Vertragsgarantieversicherung
  </span>
</p>
```
→ Extension reads key from DOM → No guessing needed

See [BABEL_PLUGIN_INTEGRATION.md](BABEL_PLUGIN_INTEGRATION.md) for setup.

#### Option 2: Manually Verify in Console

When multiple keys are found, check the console output:
```
✅ Exact matches found:
['reviewed:caseWizard.products.vgv.vgv.title',
 'reviewed:caseWizard.vgv.title',
 'reviewed:myCasesPage.productType.CONTRACT_BOND_INSURANCE.title',
 ...]
```

The extension uses this heuristic to pick the "best" key:
1. **Prefer keys with fewer dots** (less nested)
2. **Prefer shorter keys** (more specific)

If the wrong key is selected, you can:
- Edit it anyway (all 11 keys will be updated with the same value)
- Or find the element's actual usage in your code and determine the correct key manually

#### Option 3: Deduplicate Your Translations

If many keys have the same value, consider consolidating:

**Before:**
```json
{
  "product.vgv.title": "Vertragsgarantieversicherung",
  "productType.vgv.title": "Vertragsgarantieversicherung",
  "nav.vgv.label": "Vertragsgarantieversicherung"
}
```

**After:**
```json
{
  "product.vgv.name": "Vertragsgarantieversicherung",
  "product.vgv.title": "{{name}} - Details",
  "productType.vgv.title": "{{name}}",
  "nav.vgv.label": "{{name}}"
}
```

Then use:
```jsx
{t('product.vgv.title', { name: t('product.vgv.name') })}
```

### Visual Indicators

The extension uses different colors to indicate confidence:

| Color | Meaning |
|-------|---------|
| **Green** | Found via `data-i18n-key` (Babel plugin) - 100% accurate |
| **Orange** | Found via value matching (fallback) - best guess |
| **Red** | (Old behavior) Single match via value |

When the editor has an **orange border**, it means multiple keys were found. Hover over the key indicator below the input to see all matches.

---

## Element Not Wrapped by Babel Plugin

### Problem

Some elements don't have `data-i18n-key` even with the Babel plugin installed.

### Common Causes

1. **Component props:**
   ```jsx
   <Button label={t("submit")} />
   ```
   The Babel plugin can't reach inside JSX props easily.

2. **Conditional rendering:**
   ```jsx
   {isLoading ? t("loading") : t("done")}
   ```
   May not be wrapped correctly.

3. **Hook usage:**
   ```jsx
   const { t } = useTranslation();
   const title = t("page.title");
   return <h1>{title}</h1>;
   ```
   The variable `title` doesn't get wrapped.

4. **Interpolation:**
   ```jsx
   {`${t("prefix")}: ${t("suffix")}`}
   ```
   Template literals don't preserve JSX.

### Solutions

For these cases, you have three options:

#### A. Refactor to Direct JSX (Best for Babel Plugin)
```jsx
// ❌ Before (not wrapped)
<Button label={t("submit")} />

// ✅ After (wrapped)
<Button label={<>{t("submit")}</>} />
```

#### B. Add Manual Data Attributes
```jsx
<Button 
  data-i18n-key="submit"
  label={t("submit")} 
/>
```

#### C. Accept Fallback Behavior
Let the extension find it by value. It will show a warning if multiple keys match.

---

## Wrong Namespace Detected

### Problem

The extension updates the wrong namespace file.

### Why This Happens

The `data-i18n-ns` attribute from the Babel plugin may be incorrect (hard-coded as `"translation"`). The extension now **ignores this** and searches all namespaces to find where the key actually exists.

### How It Works Now

1. Extension reads `data-i18n-key` from DOM
2. **Ignores** `data-i18n-ns`
3. Searches all loaded namespaces for the key
4. Uses the namespace where the key is found
5. Falls back to default namespace if not found anywhere

### Console Output

```
✅ Found key in namespace: reviewed
```

This confirms the extension found the key in the correct namespace.

---

## Template Not Preserved

### Problem

When editing text with placeholders like `"Step {{step}} of {{total}}"`, you only see the rendered text `"Step 1 of 3"`.

### Solution

Make sure the Babel plugin is configured with the correct `localesPath`:

```typescript
// vite.config.ts
['./babel-plugin-i18n-debug.cjs', {
  localesPath: path.resolve(__dirname, 'src/assets/locales'), // Must be absolute!
  defaultLang: 'de'
}]
```

When configured correctly, the element will have:
```html
<span data-i18n-tpl="Step {{step}} of {{total}}">
  Step 1 of 3
</span>
```

And the editor will show the template with placeholders.

---

## Extension Not Finding Translation

### Problem

Clicking on translated text shows "No candidates found in current bundles."

### Checklist

1. **Is `window.i18next` exposed?**
   ```javascript
   // In your i18n.ts
   if (import.meta.env.DEV) {
     window.i18next = i18n;
   }
   ```

2. **Are namespaces loaded?**
   ```javascript
   // Check in console
   window.i18next.store.data
   ```

3. **Is the text actually from i18next?**
   Some text might be hard-coded or from a different source.

4. **Is it inside an iframe?**
   The extension doesn't work across iframe boundaries.

---

## Performance Issues

### Problem

Extension is slow when clicking on text.

### Cause

Without the Babel plugin, the extension searches ALL translation bundles by value, which can be slow with large translation files.

### Solution

**Use the Babel plugin!** It reduces lookup time from O(n×m) to O(1):
- Without plugin: Search thousands of key-value pairs
- With plugin: Read one attribute from DOM

---

## Updates Don't Persist

### Problem

Changes are made but don't appear in the JSON files.

### Checklist

1. **Is the native host installed?**
   ```bash
   ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
   ```

2. **Is the extension ID correct?**
   Check `com.i18ntexteditor.host.json` has your extension ID in `allowed_origins`.

3. **Is the locales path correct?**
   Extension settings → Must be **absolute path**.

4. **Check permissions:**
   ```bash
   # Native host must be executable
   chmod +x i18n-editor-extension/native/host/native-messaging-host.js
   
   # JSON files must be writable
   chmod 644 src/assets/locales/**/*.json
   ```

5. **Check logs:**
   Run Chrome from terminal to see native host stderr:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
   ```

---

## Best Practices

### ✅ Do

- Use the Babel plugin for best results
- Keep translation values unique when possible
- Use templates for repeated patterns
- Check console warnings
- Test in development mode only

### ❌ Don't

- Don't use the extension in production
- Don't edit production JSON files directly
- Don't ignore the "multiple keys" warnings
- Don't have thousands of duplicate values

---

## Getting Help

If you're still stuck:

1. Open DevTools Console
2. Enable the editor: `starti18ndebug()`
3. Click the problematic text
4. Copy the full console output
5. Check the `[i18n-debug]` messages

Look for:
- `✅ Found via data attributes` = Babel plugin working
- `⚠️ Multiple keys found` = Ambiguous value
- `❌ No exact match` = Not in translation bundles

