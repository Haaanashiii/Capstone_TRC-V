/**
 * EXAMPLE: How to Use the i18n Translation System
 * 
 * This is a complete working example showing how to integrate translations
 * into your user-side pages.
 */

import React from "react";
import UnifiedNavbar from "../components/UnifiedNavbar";
import { useTranslation } from "../hooks/useTranslation";
import { Button, Typography, TextField } from "@mui/material";

export default function ExampleTranslatedPage() {
  // ✅ Step 1: Get the translation function
  const { t, language } = useTranslation();
  
  // You can now use t("key") anywhere in your component
  
  return (
    <div>
      {/* ✅ Step 2: Use UnifiedNavbar without any props */}
      <UnifiedNavbar />
      
      <div style={{ padding: "20px" }}>
        {/* ✅ Step 3: Use t() for all text content */}
        
        {/* Example 1: Simple text */}
        <Typography variant="h4">
          {t("franchiseApplication.title")}
        </Typography>
        
        {/* Example 2: Button text */}
        <Button>
          {t("common.submit")}
        </Button>
        
        {/* Example 3: Input labels */}
        <TextField 
          label={t("franchiseApplication.nameOfOperator")}
          placeholder={t("operatorHome.orNumberPlaceholder")}
        />
        
        {/* Example 4: Conditional text */}
        {language === 'en' ? (
          <p>Currently viewing in English</p>
        ) : (
          <p>Kasalukuyang tinitignan sa Tagalog</p>
        )}
        
        {/* Example 5: Multiple translations */}
        <div>
          <h2>{t("franchiseApplication.personalInfo")}</h2>
          <label>{t("franchiseApplication.contactNumber")}</label>
          <label>{t("franchiseApplication.placeOfBirth")}</label>
          <label>{t("franchiseApplication.dateOfBirth")}</label>
        </div>
        
        {/* Example 6: Common translations */}
        <div>
          <Button>{t("common.save")}</Button>
          <Button>{t("common.cancel")}</Button>
          <Button>{t("common.delete")}</Button>
        </div>
        
        {/* Example 7: Alert messages */}
        <Button onClick={() => alert(t("operatorHome.pleaseProvideWarning"))}>
          Show Warning
        </Button>
      </div>
    </div>
  );
}

/**
 * HOW TO ADD NEW TRANSLATIONS:
 * 
 * 1. Open public/translations/en.json
 * 2. Add your key:
 *    {
 *      "myPage": {
 *        "newField": "My New Field"
 *      }
 *    }
 * 
 * 3. Open public/translations/tl.json
 * 4. Add the Tagalog version:
 *    {
 *      "myPage": {
 *        "newField": "Aking Bagong Field"
 *      }
 *    }
 * 
 * 5. Use in component:
 *    {t("myPage.newField")}
 */

/**
 * CONVERSION CHECKLIST FOR EXISTING PAGES:
 * 
 * ❌ OLD WAY (Don't do this):
 * 
 * import { useState } from "react";
 * const [language, setLanguage] = useState('en');
 * const translations = { en: {...}, tl: {...} };
 * const t = translations[language];
 * <UnifiedNavbar language={language} onLanguageToggle={...} translations={t} />
 * 
 * ✅ NEW WAY (Do this):
 * 
 * import { useTranslation } from "../hooks/useTranslation";
 * const { t } = useTranslation();
 * <UnifiedNavbar />
 * 
 * That's it! The translation system handles everything else.
 */
