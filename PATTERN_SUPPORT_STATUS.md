# Pattern Support Status

## Your Specific Patterns - Analysis & Support

### ✅ Pattern 1: ConditionalExpression
```typescript
// Example from PageLayout.tsx:27
const message = error ? t("errors.gatewayDown") : t("errors.default");
```

**Status**: ✅ **NOW SUPPORTED**

**How it works**:
- Plugin detects conditional expression
- Checks if parent context is JSX-safe
- Wraps both consequent and alternate branches
- Each branch gets its own `data-i18n-key`

**Result**:
```jsx
const message = error 
  ? <span data-i18n-key="errors.gatewayDown">...</span>
  : <span data-i18n-key="errors.default">...</span>;

// When used in JSX:
<div>{message}</div>  // ← Now has data attributes!
```

---

### ✅ Pattern 2: ObjectProperty
```typescript
// Example from RegistrationPage.tsx:51
const validationSchema = {
  email: yup.string().required(t("common.validations.required")),
  name: yup.string().required(t("common.validations.required"))
};
```

**Status**: ✅ **NOW SUPPORTED**

**How it works**:
- Plugin wraps the value in object property
- Object can be spread or used in JSX

**Result**:
```typescript
const validationSchema = {
  email: yup.string().required(
    <span data-i18n-key="common.validations.required">Required</span>
  )
};
```

**Note**: This works if the object value is eventually rendered. If it's used purely for validation logic (not displayed), the wrapper might cause issues. In that case, accept the fallback behavior.

---

### ✅ Pattern 3: AssignmentExpression
```typescript
// Example from ProgressBarOnboardingStatus.tsx:30
let statusText;
if (condition) {
  statusText = t("onboarding.userRegistered");
}
```

**Status**: ✅ **NOW SUPPORTED**

**How it works**:
- Plugin wraps the assigned value
- Variable will contain wrapped JSX

**Result**:
```typescript
statusText = <span data-i18n-key="onboarding.userRegistered">...</span>;

// When used:
<div>{statusText}</div>  // ← Has data attributes!
```

---

### ❌ Pattern 4: Dynamic Key (MemberExpression)
```typescript
// Example from ProductApplicationsPage.tsx:224
const statusKey = product.statusKey;
<div>{t(statusKey)}</div>  // statusKey is a variable
```

**Status**: ❌ **CANNOT SUPPORT**

**Why**: The key is determined at **runtime**, but the plugin runs at **build time**. We don't know what `product.statusKey` will be until the code executes.

**Workarounds**:

**Option A**: Convert to static conditionals (if limited options)
```typescript
// ✅ Static keys
<div>
  {product.status === 'pending' && t("status.pending")}
  {product.status === 'approved' && t("status.approved")}
  {product.status === 'rejected' && t("status.rejected")}
</div>
```

**Option B**: Accept fallback behavior
```typescript
// Keep as-is, extension will use value matching (orange outline)
<div>{t(product.statusKey)}</div>
```

**Option C**: Use a mapping object (if values are known)
```typescript
const STATUS_KEYS = {
  PENDING: "status.pending",
  APPROVED: "status.approved",
  REJECTED: "status.rejected"
} as const;

// Then use:
<div>{t(STATUS_KEYS[product.status])}</div>
```

---

### ⚠️ Pattern 5: String Literal in Template Context
```typescript
// Example from LKVWithoutPage.tsx:173
// Unsupported context (TemplateLiteral): t("caseWizard.products.lkv.lkv_without.title")
```

**Status**: ⚠️ **NEED MORE INFO**

**This is confusing** - the key itself is a string literal (`"caseWizard.products..."`), not a template literal. The error says "TemplateLiteral" context.

**Possible scenarios**:

**A. t() inside template literal (can't support)**:
```typescript
// ❌ Can't wrap
const msg = `Title: ${t("caseWizard.products.lkv.lkv_without.title")}`;
```
**Fix**: Move out of template literal
```typescript
// ✅ Can wrap
const title = t("caseWizard.products.lkv.lkv_without.title");
const msg = `Title: ${title}`;
```

**B. t() assigned to template literal variable (might work now)**:
```typescript
// Check if this works after update
const template = someCondition 
  ? `${t("caseWizard.products.lkv.lkv_without.title")}` 
  : "default";
```

**Please share the exact code at line 173** so I can provide specific guidance.

---

### ❌ Pattern 6: Template Literal Key
```typescript
// Example from VGVPage.tsx:249
const productType = "vgv";
<div>{t(`product.${productType}.title`)}</div>
```

**Status**: ❌ **CANNOT SUPPORT**

**Why**: Same as Pattern 4 - the key is constructed at runtime.

**Workarounds**:

**Option A**: Static keys (if limited options)
```typescript
// ✅ Wrappable
<div>
  {productType === "vgv" && t("product.vgv.title")}
  {productType === "lkv" && t("product.lkv.title")}
  {productType === "agv" && t("product.agv.title")}
</div>
```

**Option B**: Use interpolation parameter
```typescript
// If the JSON structure allows:
// product.json: { "title": "{{type}} Product" }
<div>{t("product.title", { type: productType })}</div>
```

**Option C**: Accept fallback
```typescript
// Keep as-is, extension uses value matching
<div>{t(`product.${productType}.title`)}</div>
```

---

## Summary Table

| Pattern | Your File | Support | Coverage Impact |
|---------|-----------|---------|-----------------|
| ConditionalExpression | PageLayout.tsx:27 | ✅ Now Supported | +1 wrapped |
| ObjectProperty | RegistrationPage.tsx:51 | ✅ Now Supported | +1 wrapped (if displayed) |
| AssignmentExpression | ProgressBarOnboardingStatus.tsx:30 | ✅ Now Supported | +1 wrapped |
| MemberExpression | ProductApplicationsPage.tsx:224 | ❌ Dynamic key | Fallback |
| TemplateLiteral context | LKVWithoutPage.tsx:173 | ⚠️ Need code | TBD |
| Template literal key | VGVPage.tsx:249 | ❌ Dynamic key | Fallback |

## New Patterns Now Supported

In addition to your patterns, we also added:

### ✅ Array Elements
```typescript
const items = [
  t("item.one"),
  t("item.two"),
  t("item.three")
];
```

### ✅ Return Statements
```typescript
function getTitle() {
  return t("page.title");
}
```

### ✅ Logical Expressions (Improved)
```typescript
{isLoggedIn && t("welcome.user")}
{userName || t("guest.name")}
```

---

## Testing the Improvements

### Step 1: Update Plugin
The changes are already in `babel-plugin-i18n-debug.cjs`.

### Step 2: Restart Dev Server
```bash
npm run dev
```

### Step 3: Run Coverage Report
```bash
I18N_DEBUG=true npm run dev
```

**Expected improvement**:
- Before: ~75-80% wrapped
- After: ~85-90% wrapped

### Step 4: Test Your Specific Cases

**PageLayout.tsx:27** - Should now show green outline
**RegistrationPage.tsx:51** - Should now show green outline (if rendered)
**ProgressBarOnboardingStatus.tsx:30** - Should now show green outline

**ProductApplicationsPage.tsx:224** - Will still be orange (dynamic key)
**VGVPage.tsx:249** - Will still be orange (template literal key)

---

## For Dynamic Keys

If you have many dynamic keys, consider:

### Option 1: Create a Wrapper Component
```typescript
// TranslatedText.tsx
interface Props {
  tKey: string;
  options?: any;
}

export const TranslatedText = ({ tKey, options }: Props) => {
  const { t } = useTranslation();
  return (
    <span data-i18n-key={tKey} data-i18n-tpl={getTemplate(tKey)}>
      {t(tKey, options)}
    </span>
  );
};

// Usage:
<TranslatedText tKey={product.statusKey} />
```

This manually adds the data attributes even for dynamic keys!

### Option 2: Build-time Key Registry
If you know all possible dynamic keys at build time, you could generate a mapping file and import it.

---

## Questions to Clarify

1. **LKVWithoutPage.tsx:173** - Can you share the exact code around line 173?
2. **ObjectProperty in RegistrationPage** - Is the validation message displayed to users, or just used internally?
3. **Dynamic keys** - Are they from a limited set (enum), or truly dynamic (from API)?

---

## Expected Results

After restarting your dev server:

✅ **3-5 more patterns** will now be wrapped
✅ **Coverage should increase** by ~5-10%
⚠️ **Dynamic keys will still be orange** (fallback) - this is expected

Run `I18N_DEBUG=true npm run dev` to see the improvement! 🎯

