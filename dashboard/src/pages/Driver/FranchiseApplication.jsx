import React, { useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import UnifiedSidebar from "../../components/UnifiedSidebar";
import { TextField, Button, Snackbar, Alert, CircularProgress, Select, MenuItem, FormControl, InputLabel, FormHelperText } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { franchiseAPI } from '../Services/api';
import { validateFile, formatFileSize } from '../../utils/fileValidation';
import { compressFile } from '../../utils/imageCompression';
import "../../Styles/Operator's_CSS/FranchiseApplication.css";

export default function FranchiseApplication() {
  // Language state
  const [language, setLanguage] = useState('en'); // 'en' for English, 'tl' for Tagalog
  
  // Translation object
  const translations = {
    en: {
      title: "FRANCHISE APPLICATION",
      date: "DATE",
      sidecarPlate: "SIDECAR PLATE NUMBER",
      personalInfo: "PERSONAL INFORMATION",
      nameOfOperator: "NAME OF OPERATOR",
      contactNumber: "CONTACT NUMBER",
      placeOfBirth: "PLACE OF BIRTH",
      dateOfBirth: "DATE OF BIRTH",
      civilStatus: "CIVIL STATUS",
      citizenship: "CITIZENSHIP",
      todaMembership: "TODA MEMBERSHIP",
      motorcycleInfo: "MOTORCYCLE INFORMATION",
      unitModel: "UNIT MODEL",
      colorMotor: "COLOR (MOTOR)",
      colorSidecar: "COLOR (SIDECAR)",
      mvPlate: "MV PLATE",
      motorEngineNumber: "MOTOR/ENGINE NUMBER",
      chassisNumber: "CHASSIS NUMBER",
      reqDocuments: "DOCUMENTARY REQUIREMENTS",
      docInstructions: "Please upload clear scanned copies or photos of the following documents.",
      docFormat1: "Accepted formats: JPG, PNG, or PDF",
      docFormat2: "Maximum file size: 10MB per file (will be compressed to ~300KB)",
      docFormat3: "All documents must be valid, complete, and readable",
      docFormat4: "Files will be automatically optimized for quality and size",
      selectFile: "Select a File",
      upload: "Upload",
      photoRegistration: "Photocopy of Registration",
      photoBarangay: "Photocopy of Barangay Clearance",
      photoCedula: "Photocopy of Cedula",
      photoLicense: "Photocopy of Driver's License",
      photoAffidavit: "Photocopy of Voter's Affidavit",
      picture: "1x1 Picture",
      browseFiles: "Browse Files to upload",
      noFileSelected: "No selected File -",
      digitalSignature: "Digital Signature",
      signatureArea: "Signature area (for printing)",
      submit: "Submit",
      cancel: "Cancel",
      submitApplication: "Submit Application",
      swornStatement: "SWORN STATEMENT OF APPLICANT'S UNDERTAKINGS",
      swornDeclaration: "I declare that I shall conform to the conditions relevant to the operation of my tricycle-for-hire such as:",
      swornItem1: "Submit myself including my tricycle unit to obey and to abide faithfully the TRICYCLE CODE OF SOLANO, other existing laws and ordinances relevant to motorized tricycle-for-hire;",
      swornItem2: "I shall pay without delay my corresponding taxes and fees, and submit all necessary documentary requirements;",
      swornItem3: "Notify the Tricycle Regulatory Unit any change, transfer and cessation of my tricycle operations;",
      swornItem4: "Any violation on my part or on the part of my driver herein stipulated conditions shall be sufficient cause for the revocation of my Franchise/Permit or any penalty may be imposed by the Solano Tricycle Franchising and Regulatory (STFRB)",
      swornCompliance: "In compliance, thereof, I voluntarily affixed my signature,",
      agreement: "AGREEMENT",
      agreeText1: "I hereby warrant the truth and correctness of all the particulars stated herein and any false statements made by me will constitute sufficient cause for the cancellation of any authorization given to me;",
      agreeText2: "Submit myself including my tricycle unit to obey and to abide faithfully the TRICYCLE CODE OF SOLANO, other existing laws and ordinances relevant to motorized tricycle-for-hire;",
      agreeText3: "That I bind myself to conform with the rules and regulations promulgated by the LGU in connection with operation of motorized tricycle-for-hire.",
      toggleLanguage: "Tagalog"
    },
    tl: {
      title: "APLIKASYON PARA SA PRANGKISA",
      date: "PETSA",
      sidecarPlate: "NUMERO NG PLAKA NG SIDECAR",
      personalInfo: "PERSONAL NA IMPORMASYON",
      nameOfOperator: "PANGALAN NG OPERATOR",
      contactNumber: "NUMERO NG TELEPONO",
      placeOfBirth: "LUGAR NG KAPANGANAKAN",
      dateOfBirth: "PETSA NG KAPANGANAKAN",
      civilStatus: "KATAYUANG SIBIL",
      citizenship: "PAGKAMAMAMAYAN",
      todaMembership: "MIYEMBRO NG TODA",
      motorcycleInfo: "IMPORMASYON NG MOTORSIKLO",
      unitModel: "MODEL NG UNIT",
      colorMotor: "KULAY (MOTOR)",
      colorSidecar: "KULAY (SIDECAR)",
      mvPlate: "MV PLAKA",
      motorEngineNumber: "NUMERO NG MOTOR/ENGINE",
      chassisNumber: "NUMERO NG CHASSIS",
      reqDocuments: "MGA KINAKAILANGANG DOKUMENTO",
      docInstructions: "Mangyaring mag-upload ng malinaw na scanned copies o mga larawan ng mga sumusunod na dokumento.",
      docFormat1: "Mga tanggap na format: JPG, PNG, o PDF",
      docFormat2: "Pinakamataas na laki ng file: 10MB bawat file (awtomatikong ie-compress sa ~300KB)",
      docFormat3: "Ang lahat ng mga dokumento ay dapat na valid, kumpleto, at mababasa",
      docFormat4: "Awtomatikong i-o-optimize ang mga file para sa kalidad at laki",
      selectFile: "Pumili ng File",
      upload: "I-upload",
      photoRegistration: "Photocopy ng Rehistrasyon",
      photoBarangay: "Photocopy ng Barangay Clearance",
      photoCedula: "Photocopy ng Cedula",
      photoLicense: "Photocopy ng Driver's License",
      photoAffidavit: "Photocopy ng Voter's Affidavit",
      picture: "1x1 na Larawan",
      browseFiles: "Mag-browse ng mga file para i-upload",
      noFileSelected: "Walang napiling File -",
      digitalSignature: "Digital na Pirma",
      signatureArea: "Lugar ng pirma (para sa pag-print)",
      submit: "Ipasa",
      cancel: "Kanselahin",
      submitApplication: "Ipasa ang Aplikasyon",
      swornStatement: "SINUMPAANG SALAYSAY NG MGA PANGAKO NG APLIKANTE",
      swornDeclaration: "Nagpapatunay ako na susundin ko ang mga kondisyon na may kaugnayan sa operasyon ng aking tricycle-for-hire tulad ng:",
      swornItem1: "Isusuko ko ang aking sarili kasama ang aking tricycle unit upang sumunod at tumupad nang tapat sa TRICYCLE CODE NG SOLANO, sa iba pang umiiral na mga batas at ordinansa na may kaugnayan sa motorized tricycle-for-hire;",
      swornItem2: "Babayaran ko nang walang pagkakaantala ang aking kaukulang mga buwis at bayad, at isusumite ang lahat ng kinakailangang mga dokumento;",
      swornItem3: "Ipababalita ko sa Tricycle Regulatory Unit ang anumang pagbabago, paglipat at paghinto ng aking tricycle operations;",
      swornItem4: "Ang anumang paglabag sa aking bahagi o sa bahagi ng aking driver sa mga kondisyong nabanggit dito ay magiging sapat na dahilan para sa pagpapawalang-bisa ng aking Franchise/Permit o anumang parusa na maaaring ipataw ng Solano Tricycle Franchising and Regulatory (STFRB)",
      swornCompliance: "Bilang pagsunod dito, kusang-loob kong nilagda ang aking pirma,",
      agreement: "KASUNDUAN",
      agreeText1: "Pinapatunayan ko na ang lahat ng mga detalyeng nabanggit dito ay totoo at tama, at ang anumang maling pahayag na aking gagawin ay magiging sapat na dahilan para sa pagkansela ng anumang pahintulot na ibinigay sa akin;",
      agreeText2: "Isusuko ko ang aking sarili kasama ang aking tricycle unit upang sumunod at tumupad nang tapat sa TRICYCLE CODE NG SOLANO, sa iba pang umiiral na mga batas at ordinansa na may kaugnayan sa motorized tricycle-for-hire;",
      agreeText3: "Na aking itinatatag ang aking sarili na sumunod sa mga tuntunin at regulasyon na pinatupad ng LGU na may kaugnayan sa operasyon ng motorized tricycle-for-hire.",
      toggleLanguage: "English"
    }
  };
  
  const t = translations[language];

  const [modalDocKey, setModalDocKey] = useState(null);
  const [modalFile, setModalFile] = useState(null);
  const modalFileRef = useRef();

  const handleModalFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.success) {
      setToast({
        open: true,
        message: validation.message,
        severity: 'error'
      });
      return;
    }
    
    // Check if file needs compression
    const willCompress = file.size > 300 * 1024;
    
    try {
      // Compress the file (images and PDFs)
      const processedFile = await compressFile(file);
      
      // Show compression success message only if file was compressed
      if (willCompress && processedFile.size !== file.size) {
        const originalSize = formatFileSize(file.size);
        const newSize = formatFileSize(processedFile.size);
        const savings = Math.round((1 - processedFile.size / file.size) * 100);
        
        setToast({
          open: true,
          message: ` ${originalSize} → ${newSize} (${savings}% smaller!)`,
          severity: 'success'
        });
      }
      
      setModalFile(processedFile);
    } catch (error) {
      console.error('[FileCompression] Error:', error);
      setToast({
        open: true,
        message: '⚠️ Compression failed. Using original file.',
        severity: 'warning'
      });
      setModalFile(file);
    }
  };
  const [fields, setFields] = useState({
    date: dayjs(),
    sidecarPlate: "",
    operatorName: "",
    contact: "",
    birthPlace: "",
    birthDate: null,
    civilStatus: "",
    citizenship: "",
    todaMembership: "",
    unitModel: "",
    colorMotor: "",
    colorSidecar: "",
    mvPlate: "",
    motorEngineNumber: "",
    chassisNumber: "",
    driverName: "",
    driverAddress: "",
    barangay: "",
    email: "",
  });

  const [addressError, setAddressError] = useState("");
  const [barangayError, setBarangayError] = useState("");

  const BARANGAYS = [
    'Aggub',
    'Bagahabag',
    'Bangaan',
    'Bangar',
    'Bascaran',
    'Communal',
    'Concepcion',
    'Curifang',
    'Dadap',
    'Lactawan',
    'Osmeña',
    'Pilar D. Galima',
    'Poblacion North',
    'Poblacion South',
    'Quezon',
    'Quirino',
    'Roxas',
    'San Juan',
    'San Luis',
    'Tucal',
    'Uddiawan',
    'Wacal',
  ];

  const [contactError, setContactError] = useState("");

  const handleChange = (field) => (e) => {
    setFields({ ...fields, [field]: e.target.value });
  };

  const handleContactChange = (e) => {
    const value = e.target.value;
    const numbersOnly = /^[0-9]*$/;
    
    if (value === "" || numbersOnly.test(value)) {
      setFields({ ...fields, contact: value });
      setContactError("");
    } else {
      setContactError("Only numbers are allowed in the contact field");
    }
  };

  const [uploads, setUploads] = useState({
    registration: null,
    barangay: null,
    cedula: null,
    license: null,
    affidavit: null,
    picture: null,
  });

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Prevent multiple submissions / spamming
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Field-level errors map
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (errors && Object.keys(errors).length) {
      console.debug('[FranchiseApplication] Validation errors:', errors);
    }
  }, [errors]);

  const navigate = useNavigate();

  const handleToastClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setToast(t => ({ ...t, open: false }));
  };

  // Auto-close toast after 3 seconds
  React.useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => {
        setToast(t => ({ ...t, open: false }));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast.open]);

  const _handleFileChange = (key) => (e) => {
    setUploads({ ...uploads, [key]: e.target.files[0] });
  };

  // Validate that required fields and files are present
  const validateRequiredFields = () => {
    // Reset previous errors
    const newErrors = {};

    // Ensure every field in `fields` (except `date`) is present and non-empty
    Object.keys(fields).forEach(k => {
      if (k === 'date') return;
      const v = fields[k];
      if (k === 'birthDate') {
        if (!v) newErrors[k] = 'Date of birth is required';
      } else if (typeof v === 'string') {
        if (!v.trim()) newErrors[k] = 'This field is required';
      } else if (v === null || v === undefined) {
        newErrors[k] = 'This field is required';
      }
    });

    // Required documents
    const requiredDocs = ['registration', 'barangay', 'cedula', 'license', 'affidavit', 'picture'];
    requiredDocs.forEach(dk => {
      if (!uploads[dk]) newErrors[`doc_${dk}`] = 'Document is required';
    });

    // Contact numeric check
    if (fields.contact && !/^[0-9]+$/.test(fields.contact)) {
      newErrors.contact = 'Only numbers are allowed in the contact field';
    }

    // Special mapping to keep older per-field error states for UI
    if (newErrors.driverAddress || newErrors.driverAddress === '') setAddressError(newErrors.driverAddress || '');
    if (newErrors.barangay) setBarangayError(newErrors.barangay);
    if (newErrors.contact) setContactError(newErrors.contact);

    setErrors(newErrors);

    const missingCount = Object.keys(newErrors).length;
    if (missingCount > 0) {
      const preview = Object.keys(newErrors).slice(0, 6).map(k => {
        if (k.startsWith('doc_')) return k.replace('doc_', '').replace(/^[a-z]/, c => c.toUpperCase());
        return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      }).join(', ');
      const message = missingCount > 6 ? `Please fill required fields: ${preview} and ${missingCount - 6} more.` : `Please fill required fields: ${preview}.`;
      setToast({ open: true, message, severity: 'error' });
      return false;
    }

    return true;
  };


  const _fileRefs = {
    registration: useRef(),
    barangay: useRef(),
    cedula: useRef(),
    license: useRef(),
    affidavit: useRef(),
    picture: useRef(),
  };

  return (
    <div>

      <UnifiedSidebar 
        userType="operator" 
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />

      <div className="franchise-app-bg">
        <div className="franchise-app-paper">
       
        {modalDocKey && (
          <div className="franchise-modal-bg">
            <div className="franchise-modal" style={{ maxWidth: 480, borderRadius: 18, background: '#fff', boxShadow: '0 4px 24px #0002', padding: 36, position: 'relative' }}>
              <div style={{ fontWeight: 900, fontSize: '2.2rem', marginBottom: 8, letterSpacing: 0.5 }}>{t.selectFile}</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 24, color: '#111' }}>
                {t.upload} {[
                  { key: 'registration', label: t.photoRegistration },
                  { key: 'barangay', label: t.photoBarangay },
                  { key: 'cedula', label: t.photoCedula },
                  { key: 'license', label: t.photoLicense },
                  { key: 'affidavit', label: t.photoAffidavit },
                  { key: 'picture', label: t.picture },
                ].find(d => d.key === modalDocKey)?.label}
              </div>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    background: '#f6f9ff',
                    border: '3px dashed #174D7A',
                    borderRadius: 18,
                    padding: 32,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: 12,
                    boxShadow: '0 2px 8px #0001',
                    cursor: 'pointer',
                  }}
                  onClick={() => modalFileRef.current && modalFileRef.current.click()}
                >
                  <div style={{ marginBottom: 8 }}>
                    <svg width="64" height="64" fill="#174D7A" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ color: '#174D7A', fontWeight: 600, fontSize: 17 }}>{t.browseFiles}</div>
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={modalFileRef}
                    onChange={handleModalFileChange}
                  />
                </div>
                <div style={{ background: '#eaf1ff', borderRadius: 8, padding: '12px 0', textAlign: 'center', fontWeight: 500, color: '#222', fontSize: 16, marginTop: 4 }}>
                  {modalFile ? modalFile.name : t.noFileSelected}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  className="franchise-cancel-btn"
                  style={{ background: '#f3f3f3', color: '#174D7A', fontWeight: 700, borderRadius: 8, padding: '10px 32px', fontSize: 18, border: 'none', boxShadow: '0 2px 8px #0001', cursor: 'pointer' }}
                  onClick={() => { setModalDocKey(null); setModalFile(null); }}
                >
                  {t.cancel}
                </button>
                <button
                  className="franchise-submit-btn"
                  style={{ background: '#174D7A', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '10px 32px', fontSize: 18, border: 'none', boxShadow: '0 2px 8px #174D7A22', cursor: 'pointer' }}
                  onClick={() => {
                    if (modalFile && modalDocKey) {
                      setUploads(u => ({ ...u, [modalDocKey]: modalFile }));
                    }
                    setModalDocKey(null);
                    setModalFile(null);
                  }}
                  disabled={!modalFile}
                >
                  {t.submit}
                </button>
              </div>
            </div>
          </div>
        )}
          <div className="franchise-app-logo">
            <img src="/public/Logos/SBLogo.png" alt="Seal" />
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" />
          </div>
          <div className="franchise-app-title">{t.title}</div>
          <div className="franchise-app-date-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontWeight: 700, marginBottom: 4 }}>{t.date}</label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={fields.date}
                  onChange={(newValue) => setFields({ ...fields, date: newValue })}
                  disableFuture
                  slotProps={{ textField: { size: 'small', className: 'franchise-app-input' } }}
                />
              </LocalizationProvider>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
              <label style={{ fontWeight: 700, marginBottom: 4 }}>{t.sidecarPlate}</label>
              <TextField size="small" className="franchise-app-input" value={fields.sidecarPlate} onChange={handleChange('sidecarPlate')} />
            </div>
          </div>
          <div className="franchise-app-section">
            {t.personalInfo}
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-grid">
            <TextField label={t.nameOfOperator} size="small" className="franchise-app-input" value={fields.operatorName} onChange={handleChange('operatorName')} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <TextField 
                label={t.contactNumber} 
                size="small" 
                className="franchise-app-input" 
                value={fields.contact} 
                onChange={handleContactChange}
                error={!!contactError}
                helperText={contactError}
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
              />
            </div>
          </div>
          <div className="franchise-app-grid-4">
            <TextField label={t.placeOfBirth} size="small" className="franchise-app-input" value={fields.birthPlace} onChange={handleChange('birthPlace')} />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label={t.dateOfBirth}
                value={fields.birthDate}
                onChange={(newValue) => setFields({ ...fields, birthDate: newValue })}
                disableFuture
                slotProps={{ textField: { size: 'small', className: 'franchise-app-input' } }}
              />
            </LocalizationProvider>
          </div>
          <div className="franchise-app-grid-4">
            <FormControl size="small" className="franchise-app-input">
              <InputLabel id="civil-status-label">{t.civilStatus}</InputLabel>
              <Select
                labelId="civil-status-label"
                label={t.civilStatus}
                value={fields.civilStatus || ''}
                onChange={(e) => setFields({ ...fields, civilStatus: e.target.value })}
              >
                <MenuItem value={"Single"}>Single</MenuItem>
                <MenuItem value={"Married"}>Married</MenuItem>
                <MenuItem value={"Widowed"}>Widowed</MenuItem>
                <MenuItem value={"Separated"}>Separated</MenuItem>
              </Select>
            </FormControl>
            <TextField label={t.citizenship} size="small" className="franchise-app-input" value={fields.citizenship} onChange={handleChange('citizenship')} />
          </div>
          <div className="franchise-app-grid">
            <TextField
              label="EMAIL"
              size="small"
              className="franchise-app-input"
              value={fields.email}
              onChange={handleChange('email')}
              helperText={'(Use account email)'}
              inputProps={{ autoComplete: 'off' }}
            />
          </div>
          
          
          <div className="franchise-app-grid-2">
            <TextField
              label="ADDRESS OF THE DRIVER"
              size="small"
              className="franchise-app-input"
              value={fields.driverAddress}
              onChange={handleChange('driverAddress')}
              error={!!addressError}
              helperText={addressError}
            />
            <FormControl size="small" className="franchise-app-input" error={!!barangayError}>
              <InputLabel id="barangay-label">Barangay</InputLabel>
              <Select
                labelId="barangay-label"
                label="Barangay"
                value={fields.barangay || ''}
                onChange={(e) => setFields({ ...fields, barangay: e.target.value })}
              >
                {BARANGAYS.map((b) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </Select>
              <FormHelperText>{barangayError}</FormHelperText>
            </FormControl>
          </div>

          <div className="franchise-app-field">
            <TextField label={t.todaMembership} size="small" className="franchise-app-input" value={fields.todaMembership} onChange={handleChange('todaMembership')} />
          </div>


          {/* Motorcycle Information Section */}
          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            {t.motorcycleInfo}
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-field">
            <TextField label="NAME OF THE DRIVER" size="small" className="franchise-app-input" value={fields.driverName} onChange={handleChange('driverName')} />
          </div>
          <div className="franchise-app-grid-4">
            <TextField label={t.unitModel} size="small" className="franchise-app-input" value={fields.unitModel} onChange={handleChange('unitModel')} />
            <TextField label={t.colorMotor} size="small" className="franchise-app-input" value={fields.colorMotor} onChange={handleChange('colorMotor')} />
          </div>
          <div className="franchise-app-grid-4">
            <TextField label={t.colorSidecar} size="small" className="franchise-app-input" value={fields.colorSidecar} onChange={handleChange('colorSidecar')} />
            <TextField label={t.mvPlate} size="small" className="franchise-app-input" value={fields.mvPlate} onChange={handleChange('mvPlate')} />
          </div>
          <div className="franchise-app-grid-2">
            <TextField label={t.motorEngineNumber} size="small" className="franchise-app-input" value={fields.motorEngineNumber} onChange={handleChange('motorEngineNumber')} />
            <TextField label={t.chassisNumber} size="small" className="franchise-app-input" value={fields.chassisNumber} onChange={handleChange('chassisNumber')} />
          </div>
          



    
          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            {t.reqDocuments}
            <div className="franchise-app-section-line" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontStyle: 'italic', marginBottom: 8 }}>
              {t.docInstructions}
            </p>
            <ul style={{ marginLeft: 24 }}>
              <li>{t.docFormat1}</li>
              <li>{t.docFormat2}</li>
              <li>{t.docFormat3}</li>
              <li>{t.docFormat4}</li>
            </ul>
          </div>
      
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: '#222', fontSize: 16, marginBottom: 2 }}>
              <div style={{ flex: 2 }}></div>
              <div style={{ flex: 2 }}></div>
            </div>

            {[
              { key: 'registration', label: t.photoRegistration.toUpperCase() },
              { key: 'barangay', label: t.photoBarangay.toUpperCase() },
              { key: 'cedula', label: t.photoCedula.toUpperCase() },
              { key: 'license', label: t.photoLicense.toUpperCase() },
              { key: 'affidavit', label: t.photoAffidavit.toUpperCase() },
              { key: 'picture', label: t.picture.toUpperCase() },
            ].map((doc) => (
              <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ flex: 2, fontWeight: 700, color: '#222', fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>{doc.label}</div>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
                  <div
                    className="franchise-app-upload-filename"
                    style={{
                      width: '100%',
                      background: '#eaf1ff',
                      borderRadius: 8,
                      padding: '12px 0',
                      textAlign: 'center',
                      fontWeight: 500,
                      color: '#222',
                      fontSize: 16,
                      cursor: 'pointer',
                      border: 'none',
                      outline: 'none',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => {
                      setModalDocKey(doc.key);
                      setModalFile(null);
                    }}
                  >
                    {uploads[doc.key] ? uploads[doc.key].name : t.noFileSelected}
                  </div>
                </div>
              </div>
            ))}
          </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '32px 0 0 0' }}>
                <Button
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{ bgcolor: '#174D7A', color: '#fff', fontWeight: 700, borderRadius: 2, fontSize: 18, px: 4, py: 1 }}
                  onClick={async () => {
                    if (isSubmitting) return; // ignore repeated clicks
                    // Validate address and barangay before building form data
                    const addr = (fields.driverAddress || '').trim();
                    const bgy = fields.barangay;
                    let hasError = false;
                    if (!addr) {
                      setAddressError('Address is required');
                      hasError = true;
                    } else {
                      setAddressError('');
                    }
                    if (!bgy) {
                      setBarangayError('Please select a barangay');
                      hasError = true;
                    } else {
                      setBarangayError('');
                    }
                    if (hasError) {
                      setToast({ open: true, message: 'Please fix form errors before submitting.', severity: 'error' });
                      return;
                    }

                    // Validate all fields before marking as submitting
                    const valid = validateRequiredFields();
                    if (!valid) return;

                    // Mark as submitting to prevent spam
                    setIsSubmitting(true);

                      const formDataToSend = new FormData();

                      // Personal Information - Backend expects these exact field names
                      formDataToSend.append('operatorName', fields.operatorName || '');
                      formDataToSend.append('operatorContact', fields.contact || '');
                      // Only include operatorEmail if user provided one (prevents server from falling back to authenticated account email)
                      if (fields.email && String(fields.email).trim()) {
                        formDataToSend.append('operatorEmail', String(fields.email).trim());
                      }
                      formDataToSend.append('operatorAddress', fields.driverAddress || '');
                      formDataToSend.append('actionType', 'NEW'); // Backend expects uppercase
                      
                      // Driver/Operator Details
                      formDataToSend.append('driversID', fields.driverName || '');
                      formDataToSend.append('driversAddress', fields.driverAddress || '');
                      formDataToSend.append('birthPlace', fields.birthPlace || '');
                      formDataToSend.append('birthDate', fields.birthDate ? (fields.birthDate.format ? fields.birthDate.format('YYYY-MM-DD') : fields.birthDate) : '');
                      formDataToSend.append('civilStatus', fields.civilStatus || '');
                      formDataToSend.append('citizenship', fields.citizenship || '');
                      formDataToSend.append('todaMembership', fields.todaMembership || '');
                      // Append barangay (new field)
                      formDataToSend.append('barangay', fields.barangay || '');
                      
                      // Vehicle Information
                      formDataToSend.append('unitModel', fields.unitModel || '');
                      formDataToSend.append('colorMotor', fields.colorMotor || '');
                      formDataToSend.append('sideCar', fields.colorSidecar || ''); // Backend expects 'sideCar' not 'colorSidecar'
                      formDataToSend.append('mvPlateNo', fields.mvPlate || ''); // Backend expects 'mvPlateNo'
                      formDataToSend.append('motorEngineNo', fields.motorEngineNumber || ''); // Backend expects 'motorEngineNo'
                      formDataToSend.append('chasisNo', fields.chassisNumber || ''); // Backend expects 'chasisNo'
                      
                      if (uploads.registration) {
                        formDataToSend.append('documentRegistration', uploads.registration);
                      }
                      if (uploads.barangay) {
                        formDataToSend.append('documentBarangayClearance', uploads.barangay);
                      }
                      if (uploads.cedula) {
                        formDataToSend.append('documentCedula', uploads.cedula);
                      }
                      if (uploads.license) {
                        formDataToSend.append('documentDriversLicense', uploads.license);
                      }
                      if (uploads.affidavit) {
                        formDataToSend.append('documentVotersAffidavit', uploads.affidavit);
                      }
                      if (uploads.picture) {
                        formDataToSend.append('documentPicture', uploads.picture);
                      }
                      

                    try {
                      // Debug: Check token before submission (axios interceptor handles refresh automatically)
                      const token = sessionStorage.getItem('accessToken');
                      
                      if (!token) {
                        setToast({ open: true, message: 'Session expired. Please log in again.', severity: 'error' });
                        setTimeout(() => navigate('/login'), 2000);
                        return;
                      }
                      
                      // Decode and log token payload for debugging
                      try {
                        const decoded = JSON.parse(atob(token.split('.')[1]));
                        console.log('[FranchiseApplication] Token payload:', decoded);
                      } catch (e) {
                        console.error('[FranchiseApplication] Failed to decode token:', e);
                      }
                      
                      console.log('[FranchiseApplication] Submitting application...')
                      const response = await franchiseAPI.create(formDataToSend)
                      
          
                      if (!response.data) throw new Error('No response data received')

                  
                      setFields({
                        date: dayjs(),
                        sidecarPlate: "",
                        operatorName: "",
                        contact: "",
                        birthPlace: "",
                        birthDate: null,
                        civilStatus: "",
                        citizenship: "",
                        todaMembership: "",
                        unitModel: "",
                        colorMotor: "",
                        colorSidecar: "",
                        mvPlate: "",
                        motorEngineNumber: "",
                        chassisNumber: "",
                        driverName: "",
                        driverAddress: "",
                        barangay: "",
                        email: "",
                      })
                      setAddressError('');
                      setBarangayError('');
                      setUploads({ registration: null, barangay: null, cedula: null, license: null, affidavit: null, picture: null })

                      
                      console.log('[FranchiseApplication] Application submitted successfully')
                     
                      try { sessionStorage.setItem('franchiseMenuReplaced', 'true') } catch { /* ignore */ }
                      // persist owner userId so the operator mapping is consistent
                      try {
                        const token = sessionStorage.getItem('accessToken')
                        if (token) {
                          try {
                            const payload = JSON.parse(atob(token.split('.')[1]));
                            if (payload?.id) sessionStorage.setItem('franchiseOwnerUserId', payload.id)
                          } catch { /* ignore */ }
                        }
                      } catch { /* ignore */ }

                      setToast({ open: true, message: 'Application submitted successfully. Administrators will be able to review it shortly.', severity: 'success' })

                      
                      try {
                        setTimeout(() => {
                          navigate('/')
                        }, 2000) 
                      } catch {
                        navigate('/')
                      }
                    } catch (err) {
                      console.error('[FranchiseApplication] Failed to submit application:', err)
                      const status = err.response?.status;
                      const serverMessage = err.response?.data?.error || err.response?.data?.message || err.message;
                      if (status === 409) {
                        setToast({ open: true, message: serverMessage || 'An application with this email already exists.', severity: 'error' });
                      } else if (status === 400) {
                        setToast({ open: true, message: serverMessage || 'Bad request. Please check your input.', severity: 'error' });
                      } else {
                        setToast({ open: true, message: serverMessage || 'Failed to submit application. Please try again later.', severity: 'error' });
                      }
                      // Allow user to try again
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CircularProgress size={18} sx={{ color: '#fff' }} />
                      Submitting...
                    </span>
                  ) : (
                    t.submitApplication
                  )}
                </Button>
              </div>

          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            {t.swornStatement}
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-sworn-statement">
            <p>{t.swornDeclaration}</p>
            <ol style={{ marginLeft: 24 }}>
              <li>{t.swornItem1}</li>
              <li>{t.swornItem2}</li>
              <li>{t.swornItem3}</li>
              <li>{t.swornItem4}</li>
            </ol>
            <p>{t.swornCompliance}</p>
            <div className="franchise-app-digital-signature">
                <div className="franchise-app-digital-signature" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                  <div style={{ width: 340 }}>
                    <div
                      style={{
                        width: '100%',
                        height: 80,
                        background: 'transparent',
                        borderTop: '2px solid #000',
                        borderBottom: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 400,
                        fontSize: 16,
                        color: '#000',
                        marginBottom: 8,
                        paddingTop: '10px'
                      }}
                    >
                      SIGNATURE
                    </div>
                  </div>
                </div>
            </div>
          </div>
          {/* Snackbar for toast notifications */}
          <Snackbar
            open={toast.open}
            autoHideDuration={6000}
            onClose={handleToastClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert onClose={handleToastClose} severity={toast.severity} sx={{ width: '100%' }}>
              {toast.message}
            </Alert>
          </Snackbar>

        </div>
      </div>
    </div>
  );
}
