# Page-by-Page Translation Conversion Instructions

## ✅ COMPLETED PAGES
- UnifiedNavbar.jsx ✓
- App.jsx ✓
- OperatorHomePage.jsx (partially - navbar done, needs UI text conversion)

---

## 🔄 TO-DO: FranchiseApplication.jsx

### Current Issues to Fix:
1. Remove local language state
2. Remove translations object
3. Update all t.key references to t("franchiseApplication.key")

### Search and Replace Instructions:

**Step 1:** Add import at top
```javascript
import { useTranslation } from "../../hooks/useTranslation";
```

**Step 2:** Replace this block:
```javascript
// DELETE THESE LINES (around line 16):
const [language, setLanguage] = useState('en');

// DELETE THIS ENTIRE translations OBJECT (around lines 145-260):
const translations = {
  en: { ... },
  tl: { ... }
};

const t = translations[language];
```

**Step 3:** Add hook (around line 17):
```javascript
const { t } = useTranslation();
```

**Step 4:** Update UnifiedNavbar (around line 543):
```javascript
// OLD:
<UnifiedNavbar 
  language={language}
  onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
  translations={t}
/>

// NEW:
<UnifiedNavbar />
```

**Step 5:** Global find and replace in FranchiseApplication.jsx:

| Find | Replace With |
|------|-------------|
| `{t.title}` | `{t("franchiseApplication.title")}` |
| `{t.date}` | `{t("franchiseApplication.date")}` |
| `{t.sidecarPlate}` | `{t("franchiseApplication.sidecarPlate")}` |
| `{t.personalInfo}` | `{t("franchiseApplication.personalInfo")}` |
| `{t.nameOfOperator}` | `{t("franchiseApplication.nameOfOperator")}` |
| `{t.contactNumber}` | `{t("franchiseApplication.contactNumber")}` |
| `{t.placeOfBirth}` | `{t("franchiseApplication.placeOfBirth")}` |
| `{t.dateOfBirth}` | `{t("franchiseApplication.dateOfBirth")}` |
| `{t.civilStatus}` | `{t("franchiseApplication.civilStatus")}` |
| `{t.citizenship}` | `{t("franchiseApplication.citizenship")}` |
| `{t.todaMembership}` | `{t("franchiseApplication.todaMembership")}` |
| `{t.motorcycleInfo}` | `{t("franchiseApplication.motorcycleInfo")}` |
| `{t.unitModel}` | `{t("franchiseApplication.unitModel")}` |
| `{t.colorMotor}` | `{t("franchiseApplication.colorMotor")}` |
| `{t.colorSidecar}` | `{t("franchiseApplication.colorSidecar")}` |
| `{t.mvPlateNo}` | `{t("franchiseApplication.mvPlateNo")}` |
| `{t.motorEngineNumber}` | `{t("franchiseApplication.motorEngineNumber")}` |
| `{t.chassisNumber}` | `{t("franchiseApplication.chassisNumber")}` |
| `{t.reqDocuments}` | `{t("franchiseApplication.reqDocuments")}` |
| `{t.docInstructions}` | `{t("franchiseApplication.docInstructions")}` |
| `{t.docFormat1}` | `{t("franchiseApplication.docFormat1")}` |
| `{t.docFormat2}` | `{t("franchiseApplication.docFormat2")}` |
| `{t.docFormat3}` | `{t("franchiseApplication.docFormat3")}` |
| `{t.docFormat4}` | `{t("franchiseApplication.docFormat4")}` |
| `{t.selectFile}` | `{t("franchiseApplication.selectFile")}` |
| `{t.upload}` | `{t("franchiseApplication.upload")}` |
| `{t.photoRegistration}` | `{t("franchiseApplication.photoRegistration")}` |
| `{t.photoBarangay}` | `{t("franchiseApplication.photoBarangay")}` |
| `{t.photoCedula}` | `{t("franchiseApplication.photoCedula")}` |
| `{t.photoLicense}` | `{t("franchiseApplication.photoLicense")}` |
| `{t.photoStencil}` | `{t("franchiseApplication.photoStencil")}` |
| `{t.photoAffidavit}` | `{t("franchiseApplication.photoAffidavit")}` |
| `{t.photoOrLTO}` | `{t("franchiseApplication.photoOrLTO")}` |
| `{t.photoCR}` | `{t("franchiseApplication.photoCR")}` |
| `{t.picture}` | `{t("franchiseApplication.picture")}` |
| `{t.browseFiles}` | `{t("franchiseApplication.browseFiles")}` |
| `{t.noFileSelected}` | `{t("franchiseApplication.noFileSelected")}` |
| `{t.digitalSignature}` | `{t("franchiseApplication.digitalSignature")}` |
| `{t.signatureArea}` | `{t("franchiseApplication.signatureArea")}` |
| `{t.submit}` | `{t("franchiseApplication.submit")}` |
| `{t.cancel}` | `{t("franchiseApplication.cancel")}` |
| `{t.submitApplication}` | `{t("franchiseApplication.submitApplication")}` |
| `{t.swornStatement}` | `{t("franchiseApplication.swornStatement")}` |
| `{t.swornDeclaration}` | `{t("franchiseApplication.swornDeclaration")}` |
| `{t.swornItem1}` | `{t("franchiseApplication.swornItem1")}` |
| `{t.swornItem2}` | `{t("franchiseApplication.swornItem2")}` |
| `{t.swornItem3}` | `{t("franchiseApplication.swornItem3")}` |
| `{t.swornItem4}` | `{t("franchiseApplication.swornItem4")}` |
| `{t.swornCompliance}` | `{t("franchiseApplication.swornCompliance")}` |
| `{t.agreement}` | `{t("franchiseApplication.agreement")}` |
| `{t.agreeText1}` | `{t("franchiseApplication.agreeText1")}` |
| `{t.agreeText2}` | `{t("franchiseApplication.agreeText2")}` |
| `{t.agreeText3}` | `{t("franchiseApplication.agreeText3")}` |

---

## 🔄 TO-DO: RequestAmendment.jsx

Same steps as FranchiseApplication, but replace `t.` with `t("amendment.")`:

**Example replacements:**
| Find | Replace With |
|------|-------------|
| `{t.title}` | `{t("amendment.title")}` |
| `{t.subtitle}` | `{t("amendment.subtitle")}` |
| `{t.date}` | `{t("amendment.date")}` |
| `{t.personalInfo}` | `{t("amendment.personalInfo")}` |
| `{t.fullName}` | `{t("amendment.fullName")}` |
| `{t.civilStatus}` | `{t("amendment.civilStatus")}` |
| ... and so on

---

## 🔄 TO-DO: OperatorHomePage.jsx

**Remaining replacements needed:**
| Find | Replace With |
|------|-------------|
| `{t.user}` | `{t("operatorHome.user")}` |
| `{t.franchiseLinked}` | `{t("operatorHome.franchiseLinked")}` |
| `{t.noFranchise}` | `{t("operatorHome.noFranchise")}` |
| `{t.franchiseDetails}` | `{t("operatorHome.franchiseDetails")}` |
| `{t.orNumber}` | `{t("operatorHome.orNumber")}` |
| `{t.status}` | `{t("operatorHome.status")}` |
| `{t.linkedOn}` | `{t("operatorHome.linkedOn")}` |
| `{t.franchiseApplication}` | `{t("operatorHome.franchiseApplication")}` |
| `{t.questionText}` | `{t("operatorHome.questionText")}` |
| `{t.yesLink}` | `{t("operatorHome.yesLink")}` |
| `{t.noApply}` | `{t("operatorHome.noApply")}` |
| `{t.franchiseLinkTitle}` | `{t("operatorHome.franchiseLinkTitle")}` |
| `{t.franchiseLinkDesc}` | `{t("operatorHome.franchiseLinkDesc")}` |
| `{t.orNumberLabel}` | `{t("operatorHome.orNumberLabel")}` |
| `{t.orNumberPlaceholder}` | `{t("operatorHome.orNumberPlaceholder")}` |
| `{t.uploadMtop}` | `{t("operatorHome.uploadMtop")}` |
| `{t.browseFiles}` | `{t("operatorHome.browseFiles")}` |
| `{t.noFileSelected}` | `{t("operatorHome.noFileSelected")}` |
| `{t.cancel}` | `{t("operatorHome.cancel")}` |
| `{t.submit}` | `{t("operatorHome.submit")}` |

---

## 🔄 TO-DO: Other Pages

For any other user-side pages (DriverID, FranchiseeListOperatorSide, etc.):

1. Check if they have local translation objects
2. If yes, extract all keys
3. Add them to `/public/translations/en.json` and `tl.json`
4. Follow the same conversion pattern

---

## 🛠️ VS Code Tip

Use VS Code's "Find and Replace" feature:
1. Press `Ctrl+H` (Windows) or `Cmd+H` (Mac)
2. Enable "Use Regular Expression" (.*) button
3. Find: `\{t\.(\w+)\}`
4. This will help you find all instances quickly

---

## ✅ Quick Validation

After converting a page, check:
1. No errors in browser console
2. No `language` or `setLanguage` references
3. No local `translations` object
4. UnifiedNavbar has no props
5. All text changes when clicking EN/TAG toggle
