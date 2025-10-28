# i18n-dom-tagger Sample Integration

This folder contains sample files showing how to integrate the i18n click-to-edit extension with your React + i18next app.

## Files

- **`i18n-dom-tagger.ts`** - DOM mutation observer that processes translation markers and adds metadata attributes
- **`i18n.ts`** - Sample i18next configuration with the marker postProcessor
- **`main.tsx`** - Sample main entry point showing how to activate the tagger

## How It Works

### 1. Marker PostProcessor (i18n.ts)

The postProcessor wraps every translation with markers in development mode:

```typescript
// Input: t("common.logout")
// Output: "[[i18n|reviewed|common.logout]]Abmelden[[/i18n]]"
```

This happens **before** the text is rendered to the DOM.

### 2. DOM Tagger (i18n-dom-tagger.ts)

The tagger is a MutationObserver that:
- Watches for DOM changes
- Finds text nodes and attributes containing markers
- Strips the markers from visible text
- Adds metadata attributes to elements

**Text node example:**
```html
<!-- Before -->
<button>[[i18n|reviewed|common.logout]]Abmelden[[/i18n]]</button>

<!-- After -->
<button data-i18n-text-keys="common.logout" data-i18n-text-ns="reviewed">
  Abmelden
</button>
```

**Attribute example:**
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

### 3. Activation (main.tsx)

Simply call `installI18nDomTagger()` after importing your i18n config:

```typescript
import "./i18n.ts";
import { installI18nDomTagger } from "./i18n-dom-tagger";

installI18nDomTagger(); // Starts the MutationObserver
```

The function:
- Only runs in `development` mode (production builds are unaffected)
- Processes the entire document on first run
- Watches for future changes (React re-renders, dynamic content)
- Returns a cleanup function (call it to stop observing)

## Integration Steps

1. **Copy** `i18n-dom-tagger.ts` to your project
2. **Add** the postProcessor to your i18next config (see `i18n.ts`)
3. **Import and activate** in your main entry point (see `main.tsx`)
4. **Verify** it's working:
   - Open DevTools → Elements tab
   - Inspect a translated element
   - Look for `data-i18n-text-keys` and `data-i18n-text-ns` attributes
   - You should **not** see `[[i18n|...]]` markers in visible text

## Multiple Translations in One Element

If an element contains multiple translation keys, attributes are comma-separated:

```html
<div data-i18n-text-keys="key1,key2,key3" data-i18n-text-ns="ns1,ns2,ns1">
  Multiple translations here
</div>
```

The extension will edit the **first key** when you click the element.

## Performance

The tagger is designed to be efficient:
- **Debounced**: Batches DOM changes into a single pass (setTimeout 0)
- **In-place mutations**: Never adds/removes DOM nodes, only modifies text and attributes
- **Dev-only**: Completely disabled in production builds
- **Minimal overhead**: Only processes nodes containing the marker syntax

## Troubleshooting

**Markers visible in UI:**
- Tagger is not running or failed
- Check console for errors
- Verify `process.env.NODE_ENV === 'development'`

**No data attributes on elements:**
- PostProcessor not configured in i18next
- Check `postProcess: ["i18nmark"]` in i18next.init()
- Verify postProcessor is defined before `.init()`

**Attributes added but extension doesn't work:**
- Extension may not be enabled for this tab
- Check extension icon → "Enable Editor"
- Or run `starti18ndebug()` in console

## Advanced: Multiple Namespaces

The sample uses a common pattern with multiple namespaces:

```typescript
ns: ["reviewed", "old"],
defaultNS: "reviewed",
fallbackNS: "old",
```

This allows you to:
- Keep new/reviewed translations in `reviewed.json`
- Keep legacy translations in `old.json`
- Gradually migrate from `old` to `reviewed`

The tagger correctly handles both namespaces and adds appropriate metadata.

## License

Part of the i18n Text Editor Chrome Extension. See [../LICENSE](../LICENSE) for details.

