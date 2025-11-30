# i18n Implementation Guide

## ✅ What Has Been Completed

### 1. Core Infrastructure (DONE)
- ✅ Created `contexts/I18nContext.jsx` - Global i18n context with:
  - Language state management (en/tl)
  - LocalStorage persistence
  - Remote JSON translation loading from `/public/translations/`
  - `toggleLanguage()` function
  - `t(key)` translation function with nested key support

- ✅ Created `hooks/useTranslation.js` - Custom hook providing:
  ```javascript
  const { t, language, toggleLanguage } = useTranslation();
  ```

- ✅ Created translation files:
  - `/public/translations/en.json` - English translations
  - `/public/translations/tl.json` - Tagalog translations

### 2. App Configuration (DONE)
- ✅ Updated `App.jsx`:
  - Created `UserRoutesWrapper` component
  - Wrapped all user/operator/driver routes with `<I18nProvider>`
  - Admin routes remain unchanged (no i18n)

### 3. Navigation (DONE)
- ✅ Updated `UnifiedNavbar.jsx`:
  - Removed props: `language`, `onLanguageToggle`, `translations`
  - Now uses `useTranslation()` hook
  - Language toggle buttons connected to global `toggleLanguage()`
  - All navbar text uses `t("navbar.key")` format
  - Works on both desktop and mobile

### 4. Operator Home Page (PARTIALLY DONE)
- ✅ Added `useTranslation()` hook
- ✅ Removed local `language` state and `translations` object
- ✅ Removed props from `<UnifiedNavbar />`
- ⚠️ Most UI text still needs conversion to `t("operatorHome.key")`

---

## 🔧 How to Complete the Translation for Remaining Pages

### Example: Converting a Page to Use i18n

**BEFORE:**
```javascript
import React, { useState } from "react";
import UnifiedNavbar from "../../components/UnifiedNavbar";

export default function MyPage() {
  const [language, setLanguage] = useState('en');
  
  const translations = {
    en: { title: "My Page", submit: "Submit" },
    tl: { title: "Aking Pahina", submit: "Ipasa" }
  };
  
  const t = translations[language];
  
  return (
    <div>
      <UnifiedNavbar 
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />
      <h1>{t.title}</h1>
      <button>{t.submit}</button>
    </div>
  );
}
```

**AFTER:**
```javascript
import React from "react";
import UnifiedNavbar from "../../components/UnifiedNavbar";
import { useTranslation } from "../../hooks/useTranslation";

export default function MyPage() {
  const { t } = useTranslation();
  
  return (
    <div>
      <UnifiedNavbar />
      <h1>{t("myPage.title")}</h1>
      <button>{t("common.submit")}</button>
    </div>
  );
}
```

### Step-by-Step Conversion Process

1. **Import the hook:**
   ```javascript
   import { useTranslation } from "../../hooks/useTranslation";
   ```

2. **Use the hook in component:**
   ```javascript
   const { t } = useTranslation();
   ```

3. **Remove old code:**
   - Delete `const [language, setLanguage] = useState('en')`
   - Delete the `translations` object
   - Delete `const t = translations[language]`

4. **Update UnifiedNavbar:**
   ```javascript
   // OLD
   <UnifiedNavbar 
     language={language}
     onLanguageToggle={() => setLanguage(...)}
     translations={t}
   />
   
   // NEW
   <UnifiedNavbar />
   ```

5. **Convert all text references:**
   ```javascript
   // OLD
   {t.title}
   {t.submit}
   
   // NEW
   {t("franchiseApplication.title")}
   {t("common.submit")}
   ```

---

## 📝 Remaining Tasks

### Page: FranchiseApplication.jsx
**Status:** Needs conversion
**Steps:**
1. Add: `import { useTranslation } from "../../hooks/useTranslation";`
2. Add: `const { t } = useTranslation();`
3. Remove: `const [language, setLanguage] = useState('en')`
4. Remove: The entire `translations` object
5. Remove: `const t = translations[language]`
6. Update: `<UnifiedNavbar />` (remove all props)
7. Replace all `{t.title}` with `{t("franchiseApplication.title")}`
8. Replace all `{t.date}` with `{t("franchiseApplication.date")}`
9. etc. for all text fields

### Page: RequestAmendment.jsx
**Status:** Needs conversion
**Same steps as above**, but use `t("amendment.key")` keys

### Page: DriverID.jsx
**Status:** Needs conversion
**Add translations to JSON files first**, then follow same steps

### Page: FranchiseeListOperatorSide.jsx
**Status:** Needs conversion
**Add translations to JSON files first**, then follow same steps

### Page: QROperatorID.jsx (if has text)
**Status:** Needs review
**Check if page has translatable text**

---

## 📋 Quick Reference

### Translation Key Structure in JSON Files:
```json
{
  "navbar": { "home": "HOME", ... },
  "operatorHome": { "user": "USER", ... },
  "franchiseApplication": { "title": "FRANCHISE APPLICATION", ... },
  "amendment": { "title": "AMENDMENT REQUEST", ... },
  "common": { "loading": "Loading...", "submit": "Submit", ... }
}
```

### Using Translations in Components:
```javascript
// Simple key
t("common.loading")  // → "Loading..."

// Nested key
t("navbar.home")  // → "HOME"

// Complex key
t("franchiseApplication.title")  // → "FRANCHISE APPLICATION"
```

### Language Toggle:
The language toggle button is already implemented in `UnifiedNavbar`.
No additional code needed in individual pages.

---

## ✨ Benefits of This Implementation

1. **Centralized Management**: All translations in JSON files
2. **Persistent Language**: Saved in localStorage
3. **Global State**: Language change affects entire app instantly
4. **Easy Updates**: Edit JSON files to change translations
5. **Remote Loading**: Can load translations from API in future
6. **No Props Drilling**: No need to pass language/translations through components
7. **Clean Code**: Pages only need `const { t } = useTranslation()`

---

## 🔍 Testing

1. Open any user-side page
2. Click the EN/TAG toggle in navbar
3. All text should change immediately
4. Refresh page - language persists
5. Navigate between pages - language stays consistent

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors
2. Verify translation keys exist in JSON files
3. Ensure page is wrapped in `UserRoutesWrapper` in App.jsx
4. Check that `useTranslation()` is called inside the component
