# Translation Coverage Analysis

The Babel plugin includes a **deep search** that finds ALL `t()` calls in your codebase and reports which ones are wrapped vs. skipped, helping you identify patterns to refactor.

## Enable Coverage Report

Set the `I18N_DEBUG` environment variable when running your dev server:

### For Vite

```bash
I18N_DEBUG=true npm run dev
# or
I18N_DEBUG=true yarn dev
```

### For webpack/CRA

```bash
I18N_DEBUG=true npm start
```

### For Next.js

```bash
I18N_DEBUG=true npm run dev
```

## Sample Output

```
[i18n-debug-plugin] Translation Coverage Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total t() calls found: 487
  ✅ Wrapped: 412 (85%)
  ⚠️  Skipped: 75 (15%)

Pattern Breakdown:
  Direct JSX: 298
  JSX Attributes: 89
  Conditionals: 18
  Variables: 7
  Dynamic Keys: 23
  Template Literals: 12
  Other: 40

⚠️  Skipped Patterns (first 10):
  1. Dynamic key (Identifier): t(variable) at src/pages/Dashboard.tsx:45
  2. Template literal: t(`...`) at src/components/ProductCard.tsx:78
  3. Unsupported context (CallExpression): t("key") at src/utils/format.ts:12
  4. Dynamic key (BinaryExpression): t(variable) at src/pages/Cases.tsx:156
  5. Unsupported context (ObjectProperty): t("key") at src/config.ts:23
  6. Template literal: t(`...`) at src/components/Table.tsx:234
  7. Unsupported context (ArrowFunctionExpression): t("key") at src/hooks/useTitle.ts:8
  8. Dynamic key (ConditionalExpression): t(variable) at src/pages/Profile.tsx:89
  9. Unsupported context (ReturnStatement): t("key") at src/utils/i18n.ts:34
  10. Template literal: t(`...`) at src/components/Nav.tsx:67
  ... and 65 more
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Set I18N_DEBUG=true to see this report
```

## Understanding the Report

### Pattern Categories

| Pattern | Description | Example |
|---------|-------------|---------|
| **Direct JSX** | t() directly in JSX content | `<div>{t("key")}</div>` |
| **JSX Attributes** | t() in component props | `<Button label={t("key")} />` |
| **Conditionals** | t() in ternary/logical | `{x ? t("a") : t("b")}` |
| **Variables** | t() assigned to variable | `const x = t("key")` |
| **Dynamic Keys** | t() with non-literal key | `t(variable)` or `t("a" + b)` |
| **Template Literals** | t() with template string | ``t(`product.${type}`)`` |
| **Other** | Complex/unsupported contexts | Function args, objects, etc. |

### Coverage Goals

| Coverage | Quality | Action |
|----------|---------|--------|
| **90%+** | ✅ Excellent | Maintain current patterns |
| **80-89%** | 🟢 Good | Address low-hanging fruit |
| **70-79%** | 🟡 Fair | Review skipped patterns |
| **<70%** | 🔴 Poor | Significant refactoring needed |

## Using the Report to Improve Coverage

### Step 1: Identify High-Impact Patterns

Look at the "Skipped Patterns" list. Find patterns that appear frequently.

**Example**: If you see many:
```
Unsupported context (ObjectProperty): t("key") at src/config.ts:23
```

This suggests you have config objects with translations:
```javascript
// Current (not wrapped)
const config = {
  title: t("page.title"),
  description: t("page.desc")
};
```

### Step 2: Refactor to Supported Patterns

**Option A**: Move to JSX
```jsx
// ✅ Now wrapped
return (
  <div>
    <h1>{t("page.title")}</h1>
    <p>{t("page.desc")}</p>
  </div>
);
```

**Option B**: Accept fallback
If the text isn't directly rendered (e.g., document.title), accept that it won't be wrapped. This is fine!

### Step 3: Handle Dynamic Keys

**Find them:**
```
Dynamic key (Identifier): t(variable) at src/pages/Dashboard.tsx:45
```

**Options:**

**A. Convert to static** (if possible):
```jsx
// ❌ Before (dynamic)
const key = `product.${type}.title`;
<div>{t(key)}</div>

// ✅ After (static with fallback)
<div>
  {type === 'vgv' && t("product.vgv.title")}
  {type === 'other' && t("product.other.title")}
</div>
```

**B. Accept fallback** (if truly dynamic):
```jsx
// Sometimes dynamic keys are necessary
const dynamicKey = `error.${errorCode}`;
<div>{t(dynamicKey)}</div>
// This will use orange outline (fallback) - that's OK!
```

### Step 4: Fix Template Literals

**Find them:**
```
Template literal: t(`...`) at src/components/ProductCard.tsx:78
```

**Refactor:**
```jsx
// ❌ Before (template literal key)
t(`product.${productId}.name`)

// ✅ Option 1: Use options parameter
t("product.name", { productId })

// ✅ Option 2: If productId is limited, use conditionals
{productId === '123' && t("product.123.name")}
{productId === '456' && t("product.456.name")}
```

### Step 5: Review "Other" Contexts

**Find them:**
```
Unsupported context (CallExpression): t("key") at src/utils/format.ts:12
```

**Check the code:**
```typescript
// Example: Translation in utility function
function formatTitle(key: string) {
  return capitalize(t(key));  // ← Not in JSX context
}
```

**Options:**

**A. Move logic to component:**
```jsx
// ✅ Now in JSX context
function Component() {
  const title = capitalize(t("key")); // Variable pattern - wrapped!
  return <h1>{title}</h1>;
}
```

**B. Accept it's not editable:**
If it's truly non-visual (logging, metadata, etc.), that's fine.

## Advanced: Export Full Report

To get a complete list of ALL skipped patterns (not just first 10):

### Option 1: Redirect stderr to file

```bash
I18N_DEBUG=true npm run dev 2> coverage-report.txt
```

Then search the file for `[i18n-debug-plugin]`.

### Option 2: Modify plugin to write file

Edit `babel-plugin-i18n-debug.cjs`:

```javascript
// In post() function, add:
const fs = require('fs');
if (process.env.I18N_DEBUG === 'true') {
  const report = JSON.stringify(this.i18nStats, null, 2);
  fs.writeFileSync('i18n-coverage.json', report);
  console.log('📊 Full report saved to i18n-coverage.json');
}
```

Then analyze with:
```bash
cat i18n-coverage.json | jq '.skippedReasons'
```

## Continuous Monitoring

### In CI/CD

Add to your build pipeline:

```yaml
# .github/workflows/ci.yml
- name: Check i18n coverage
  run: |
    I18N_DEBUG=true npm run build 2>&1 | tee coverage.log
    WRAPPED=$(grep "Wrapped:" coverage.log | sed 's/.*(\([0-9]*\)%).*/\1/')
    if [ "$WRAPPED" -lt 80 ]; then
      echo "❌ Translation coverage below 80%: ${WRAPPED}%"
      exit 1
    fi
    echo "✅ Translation coverage: ${WRAPPED}%"
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
echo "Checking i18n coverage..."
I18N_DEBUG=true npm run build:dev > /dev/null 2>&1
# (parse and check coverage threshold)
```

## FAQ

### Q: Why are some patterns skipped?

**A:** The plugin can only wrap patterns that:
1. Have string literal keys (known at build time)
2. Can be wrapped in JSX (render contexts)

Dynamic keys and non-render contexts can't be wrapped.

### Q: Is 100% coverage possible?

**A:** No, and that's OK! Some patterns shouldn't be wrapped:
- `document.title = t("title")` (browser API, not visible)
- `console.log(t("debug"))` (logging)
- Dynamic keys from API responses

Aim for 80-90% on visible UI text.

### Q: Does this slow down builds?

**A:** Minimal impact (~50-100ms). The tracking is only active when `I18N_DEBUG=true`, so production builds are unaffected.

### Q: Can I customize the report?

**A:** Yes! Edit the `post()` function in `babel-plugin-i18n-debug.cjs`. You can:
- Change the output format
- Add custom metrics
- Write to files
- Send to analytics

## Best Practices

✅ **Do:**
- Run coverage report weekly
- Fix high-frequency skipped patterns
- Aim for 80%+ coverage on UI components
- Accept <100% is normal

❌ **Don't:**
- Obsess over 100% coverage
- Refactor working code just for coverage
- Wrap non-render translations
- Ignore "Dynamic Keys" entirely (some are refactorable!)

## Summary

The coverage report helps you:
1. **See the big picture** - How much of your app is covered
2. **Find patterns** - What's being skipped and why
3. **Prioritize** - Focus on high-impact refactors
4. **Track progress** - Monitor coverage over time

**Goal**: 80-90% coverage = Most UI text is editable via the extension! 🎯

