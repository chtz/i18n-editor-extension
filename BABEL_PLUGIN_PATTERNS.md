# Babel Plugin - Supported Patterns

The enhanced Babel plugin now catches many more translation patterns beyond simple `{t("key")}` calls.

## ✅ Fully Supported Patterns

### 1. Direct JSX Content (Original)
```jsx
// ✅ Works perfectly
<div>{t("welcome.message")}</div>
<p>{t("title", { ns: "common" })}</p>
```

**Compiled to:**
```html
<div>
  <span data-i18n-key="welcome.message" data-i18n-tpl="...">
    Welcome!
  </span>
</div>
```

---

### 2. JSX Attribute Values
```jsx
// ✅ Now supported!
<Button label={t("submit")} />
<Input placeholder={t("enter.name")} />
<img alt={t("logo.alt")} />
```

**Compiled to:**
```jsx
<Button label={
  <span data-i18n-key="submit" data-i18n-tpl="Submit">Submit</span>
} />
```

**Visual**: The button's label will be clickable for editing!

---

### 3. Conditional Expressions in JSX
```jsx
// ✅ Now supported!
<div>
  {isLoading ? t("loading") : t("done")}
</div>

<p>
  {hasError ? t("error.message") : t("success.message")}
</p>
```

**Compiled to:**
```html
<div>
  <span data-i18n-key="loading">Loading...</span>
  <!-- or -->
  <span data-i18n-key="done">Done!</span>
</div>
```

---

### 4. Logical Expressions (&&, ||)
```jsx
// ✅ Now supported!
<div>
  {isAdmin && t("admin.welcome")}
  {userName || t("guest.name")}
</div>
```

**Compiled to:**
```html
<div>
  <span data-i18n-key="admin.welcome">Welcome, Admin</span>
</div>
```

---

### 5. Variable Assignments Used in JSX
```jsx
// ✅ Now supported!
const title = t("page.title");

return <h1>{title}</h1>;
```

**Compiled to:**
```jsx
const title = (
  <span data-i18n-key="page.title" data-i18n-tpl="Page Title">
    Page Title
  </span>
);

return <h1>{title}</h1>;
```

**Result**: The `<h1>` will contain the wrapped span with attributes!

---

### 6. useTranslation Hook
```jsx
// ✅ Now supported!
const { t } = useTranslation();

return <div>{t("message")}</div>;
```

**Works just like the direct `t()` calls!**

---

### 7. i18next.t() Calls
```jsx
// ✅ Now supported!
<div>{i18next.t("global.title")}</div>
```

**Compiled to:**
```html
<div>
  <span data-i18n-key="global.title">Title</span>
</div>
```

---

## ⚠️ Partially Supported Patterns

### 8. String Templates / Interpolation
```jsx
// ⚠️ Loses wrapping
<div>{`${t("prefix")}: ${t("suffix")}`}</div>
```

**Issue**: Template literals flatten to strings, losing JSX structure.

**Workaround**: Use separate elements
```jsx
// ✅ Better
<div>
  {t("prefix")}: {t("suffix")}
</div>
```

---

### 9. Array.map() with Translations
```jsx
// ⚠️ Complex
{items.map(item => <li>{t(`item.${item.id}`)}</li>)}
```

**Issue**: Dynamic keys (template literals) aren't string literals.

**Workaround**: If possible, use static keys
```jsx
// ✅ Better
{items.map(item => (
  <li>{t(item.translationKey)}</li>
))}
```

Or accept fallback behavior for dynamic keys.

---

## ❌ Not Supported Patterns

### 10. Dynamic Key Generation
```jsx
// ❌ Cannot analyze at build time
const key = `product.${productType}.title`;
<div>{t(key)}</div>

// ❌ Runtime concatenation
<div>{t("prefix." + suffix)}</div>
```

**Why**: Plugin only transforms **string literal** keys. Dynamic keys are runtime values.

**Workaround**: Use fallback extension behavior (value matching).

---

### 11. Stored in Non-JSX Contexts
```jsx
// ❌ Used outside React
const title = t("title");
document.title = title; // Browser tab title

// ❌ Used in non-render code
console.log(t("debug.message"));
```

**Why**: No JSX wrapper can be applied in non-React contexts.

**Workaround**: These cases don't need wrapping (not visible for editing anyway).

---

### 12. Inside Complex Expressions
```jsx
// ❌ Too complex
<div>
  {someFunction(t("arg1"), t("arg2"))}
</div>

// ❌ Inside objects
const config = {
  title: t("config.title"),
  description: t("config.desc")
};
```

**Why**: Plugin focuses on direct rendering paths.

**Workaround**: 
- Refactor to simpler patterns
- Or accept fallback behavior

---

## How to Identify Coverage

### Check Console Logs

When clicking on text:

**✅ With wrapper:**
```
[i18n-debug] lookup + edit (from data attributes)
Element: <span data-i18n-key="...">
✅ Found key in namespace: reviewed
```

**⚠️ Without wrapper:**
```
[i18n-debug] lookup + edit (fallback: no data attributes)
⚠️ Multiple keys (11) have the same value!
💡 Tip: Add Babel plugin to your React app
```

### Visual Indicators

- **Green outline** = Has `data-i18n-key` (covered by plugin)
- **Orange outline** = No attributes (fallback, not covered)

---

## Best Practices

### ✅ Do

```jsx
// Direct in JSX
<h1>{t("title")}</h1>

// In attributes
<Button label={t("submit")} />

// In conditionals
{isOpen ? t("close") : t("open")}

// In variables used in JSX
const msg = t("message");
return <p>{msg}</p>;
```

### ❌ Avoid

```jsx
// String templates (loses structure)
<div>{`${t("a")} ${t("b")}`}</div>

// Dynamic keys (can't analyze)
<div>{t(`product.${type}`)}</div>

// Complex expressions
<div>{format(t("date"), options)}</div>
```

---

## Testing Your Coverage

### 1. Enable Extension
```javascript
starti18ndebug()
```

### 2. Click Around Your App
- Green outline = ✅ Plugin working
- Orange outline = ⚠️ Not covered

### 3. Check Console
Look for:
- `"from data attributes"` = Good!
- `"fallback: no data attributes"` = Not covered
- `"Multiple keys found"` = Ambiguous, needs plugin

### 4. Improve Coverage
For any orange outlines:
1. Check the pattern against this document
2. Refactor to a supported pattern if possible
3. Or accept fallback behavior

---

## Plugin Configuration

### Default Behavior
- Only transforms string literals: `t("key")` ✅
- Skips template literals: `t(\`key\`)` ❌
- Skips variables: `t(myKey)` ❌

### Why String Literals Only?
The plugin needs to:
1. Read the key at **build time**
2. Look up the template in JSON files
3. Embed it in the attribute

Dynamic keys don't have values at build time!

---

## Troubleshooting

### "Why isn't my t() call wrapped?"

**Check:**
1. Is it a string literal? `t("key")` not `t(variable)`
2. Is NODE_ENV='development'?
3. Did you restart the dev server?
4. Check console for `[i18n-debug-plugin]` errors

### "The wrapper breaks my layout!"

The plugin adds `<span>` elements. If this causes layout issues:

**Solution 1**: Use CSS to make spans behave like their parent
```css
/* In development only */
[data-i18n-key] {
  display: contents; /* Makes span "invisible" to layout */
}
```

**Solution 2**: Configure wrapper element (advanced)
Edit `babel-plugin-i18n-debug.cjs` to use `<div>` or fragment.

### "I see duplicate wrappers!"

This was a bug in earlier versions. Make sure you're using the latest plugin with:
- `path.skip()` to prevent recursion
- `__i18nWrapped` flag to mark processed nodes

---

## Summary

| Pattern | Support | Visual |
|---------|---------|--------|
| Direct JSX | ✅ Full | 🟢 Green |
| JSX Attributes | ✅ Full | 🟢 Green |
| Conditionals | ✅ Full | 🟢 Green |
| Variables → JSX | ✅ Full | 🟢 Green |
| String Templates | ⚠️ Partial | 🟠 Orange |
| Dynamic Keys | ❌ None | 🟠 Orange |

**Recommendation**: Aim for 80%+ green coverage on your main UI. Accept orange for edge cases.

