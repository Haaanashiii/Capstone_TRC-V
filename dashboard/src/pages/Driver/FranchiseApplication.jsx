import React, { useState, useRef, useEffect } from "react";
import Swal from 'sweetalert2';
import { useNavigate, useLocation } from 'react-router-dom';
import UnifiedNavbar from "../../components/UnifiedNavbar";
import PrivacyPolicyModal from "../../components/PrivacyPolicyModal";
import { TextField, Button, CircularProgress, Select, MenuItem, FormControl, InputLabel, FormHelperText, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import api, { franchiseAPI, TokenManager } from '../Services/api';
import { validateFile, formatFileSize } from '../../utils/fileValidation';
import { compressFile } from '../../utils/compressFile';
import "../../Styles/Operator's_CSS/FranchiseApplication.css";
import { logger } from '../../utils/logger';

// SweetAlert styling utility
const alertStyle = {
  successAlert: {
    icon: 'success',
    iconColor: '#10b981',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
      modal.style.zIndex = '9999';
    }
  },
  errorAlert: {
    icon: 'error',
    iconColor: '#ef4444',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
      modal.style.zIndex = '9999';
    }
  },
  warningAlert: {
    icon: 'warning',
    iconColor: '#f59e0b',
    confirmButtonColor: '#174D7A',
    customClass: {
      container: 'swal-container',
      popup: 'swal-popup',
      title: 'swal-title',
      htmlContainer: 'swal-text',
      confirmButton: 'swal-confirm-btn'
    },
    showConfirmButton: true,
    confirmButtonText: 'OK',
    didOpen: (modal) => {
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
      modal.style.zIndex = '9999';
    }
  }
};

export default function FranchiseApplication() {
  // Hooks must be at the top
  const navigate = useNavigate();
  const location = useLocation();
  
  // Language state
  const [language, setLanguage] = useState('en'); // 'en' for English, 'tl' for Tagalog
  
  // Fetch user email from backend API (not from JWT for security)
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = TokenManager.getAccessToken();
       
        if (!token) {
          logger.error('[FranchiseApplication] No access token found');
          return;
        }
        
        const userData = TokenManager.decodeToken(token);
        logger.log('[FranchiseApplication] JWT payload (no email for security):', userData);
        
        if (userData) {
          // Extract user ID from JWT
          const extractedUserId = userData.userId || userData.id || userData._id;
          if (extractedUserId) {
            logger.log('[FranchiseApplication] ✓ User ID extracted:', extractedUserId);
            
            // Fetch user email from backend API using the user ID
            try {
              const response = await api.get('/auth/me');
              logger.log('[FranchiseApplication] API response:', response.data);
              
              // Handle different response structures
              const userData = response.data?.user || response.data;
              const email = userData?.email;
              
              if (email) {
                logger.log('[FranchiseApplication] ✓ Email fetched from backend API:', email);
              } else {
                logger.error('[FranchiseApplication] ✗ No email in API response. Full response:', response.data);
                logger.error('[FranchiseApplication] ✗ This means the user account does not have an email saved in the database');
              }
            } catch (apiError) {
              logger.error('[FranchiseApplication] ✗ Failed to fetch user data from API:', apiError);
              logger.error('[FranchiseApplication] ✗ Response:', apiError.response?.data);
            }
          } else {
            logger.error('[FranchiseApplication] ✗ No user ID found in JWT token');
          }
        } else {
          logger.error('[FranchiseApplication] ✗ Failed to decode JWT token');
        }
      } catch (error) {
        logger.error('[FranchiseApplication] Error extracting data from token:', error);
      }
    };
    
    fetchUserData();
  }, []);  // Check if we're resubmitting a disapproved application
  useEffect(() => {
    const checkResubmission = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const appId = urlParams.get('resubmit');
      
      if (appId) {
        logger.log('[FranchiseApplication] Resubmission mode - loading application:', appId);
        setIsResubmission(true);
        setResubmissionAppId(appId);
        
        try {
          // Fetch the disapproved application data
          const response = await franchiseAPI.getById(appId);
          if (response.data && response.data.data) {
            const app = response.data.data;
            
            // Prefill all fields from the disapproved application
            setFields({
              date: app.submittedAt ? dayjs(app.submittedAt) : dayjs(),
              operatorName: app.operatorName || '',
              contact: app.operatorContactNumber || '',
              birthPlace: app.operatorBirthPlace || '',
              birthDate: app.operatorBirthDate ? dayjs(app.operatorBirthDate) : null,
              civilStatus: app.operatorCivilStatus || '',
              citizenship: app.operatorCitizenship || '',
              todaMembership: app.todaMembership || '',
              unitModel: app.unitModel || '',
              colorMotor: app.colorMotor || '',
              colorSidecar: app.sideCarColor || '',
              mvPlateNo: app.mvPlateNo || '',
              motorEngineNumber: app.motorEngineNo || '',
              chassisNumber: app.chasisNo || '',
              driverName: app.driverName || '',
              driverAddress: app.driversAddress || '',
              operatorAddress: app.operatorAddress || '',
              barangay: app.operatorBarangay || '',
              hasCoOwner: app.coOwnerName ? 'Yes' : 'No',
              operatorPicture: null,
            });
            
            // Prefill co-owners if they exist
            if (app.coOwnerName) {
              setCoOwners([{
                name: app.coOwnerName,
                address: app.coOwnerAddress || '',
                relationship: 'Family'
              }]);
            }
            
            // Store existing document URLs (so we don't require re-uploading if not changed)
            if (app.documents) {
              logger.log('[FranchiseApplication] Existing documents found:', app.documents);
              // Store document URLs in state so they can be referenced
              setExistingDocuments({
                motorRegistration: app.documents.motorRegistrationObj || null,
                barangayClearance: app.documents.barangayClearanceObj || null,
                cedula: app.documents.cedulaObj || null,
                driversLicense: app.documents.driversLicenseObj || null,
                votersAffidavit: app.documents.votersAffidavitObj || null,
                motorChassisStencil: app.documents.motorChassisStencilObj || null,
                driverPicture: app.documents.driverPictureObj || null,
                operatorPicture: app.documents.operatorPictureObj || null,
                orLTO: app.documents.orLTOObj || null,
                cr: app.documents.crObj || null
              });
            }
            
            logger.log('[FranchiseApplication] Application data loaded for resubmission');
          }
        } catch (error) {
          logger.error('[FranchiseApplication] Error loading application for resubmission:', error);
          Swal.fire({
            ...alertStyle.errorAlert,
            title: 'Error',
            text: 'Failed to load application data. Please try again.'
          });
        }
      }
    };
    
    checkResubmission();
  }, []);

  // Pre-fill form data when coming from renewal
  useEffect(() => {
    if (location.state && location.state.applicationType === 'renewal') {
      const renewalData = location.state;
      logger.log('[FranchiseApplication] Renewal mode - pre-filling data:', renewalData);
      setApplicationType('renewal');
      
      setFields({
        date: dayjs(),
        operatorName: renewalData.operatorName || "",
        contact: renewalData.operatorContactNumber || "",
        birthPlace: renewalData.operatorBirthPlace || "Municipality / Province",
        birthDate: renewalData.operatorBirthDate ? dayjs(renewalData.operatorBirthDate) : null,
        civilStatus: renewalData.operatorCivilStatus || "",
        citizenship: renewalData.operatorCitizenship || "",
        todaMembership: renewalData.todaMembership || "",
        address: renewalData.operatorAddress || "",
        barangay: renewalData.operatorBarangay || "",
        hasCoOwner: renewalData.coOwnerName ? "Yes" : "No",
        driverName: renewalData.driverName || "",
        driverAddress: renewalData.driversAddress || "",
        unitModel: renewalData.unitModel || "",
        colorMotor: renewalData.colorMotor || "",
        colorSidecar: renewalData.sideCarColor || "B/Y",
        mvPlateNo: renewalData.mvPlateNo || "",
        motorEngineNumber: renewalData.motorEngineNo || "",
        chassisNumber: renewalData.chasisNo || "",
        operatorPicture: null,
        driverPicture: null
      });
      
      // Set co-owners array if there's co-owner data
      if (renewalData.coOwnerName) {
        setCoOwners([{
          name: renewalData.coOwnerName,
          address: renewalData.coOwnerAddress || '',
          relationship: renewalData.coOwnerRelationship || ''
        }]);
      }
    }
  }, [location.state]);
  
  // Translation object
  const translations = {
    en: {
      title: "FRANCHISE APPLICATION",
      renewalTitle: "FRANCHISE RENEWAL",
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
      mvPlateNo: "MV PLATE",
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
      photoStencil: "Photocopy of Motor Chassis Stencil",
      photoAffidavit: "Photocopy of Voter's Affidavit",
      photoOrLTO: "OR LTO (Official Receipt)",
      photoCR: "CR (Certificate of Registration)",
      picture: "1x1 Picture of the Operator",
      driverPictureLabel: "1x1 Picture of the Driver",
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
      renewalTitle: "PAGPAPANIBAGO NG PRANGKISA",
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
      mvPlateNo: "MV PLAKA",
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
      photoStencil: "Photocopy ng Motor Chassis Stencil",
      photoAffidavit: "Photocopy ng Voter's Affidavit",
      photoOrLTO: "OR LTO (Official Receipt)",
      photoCR: "CR (Certificate of Registration)",
      picture: "1x1 na Larawan",
      driverPictureLabel: "1x1 na Larawan ng Driver",
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
  const [modalLoading, setModalLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionNotification, setCompressionNotification] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const modalFileRef = useRef();
  const dragCounter = useRef(0);

  // Process file (used by both file input and drag-drop)
  const processFile = async (file) => {
    if (!file) return;
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.success) {
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Invalid File',
        text: validation.message
      });
      return;
    }
    
    // Check if file needs compression
    const willCompress = file.size > 300 * 1024;
    
    // Show loading state if file will be compressed
    if (willCompress) {
      setModalLoading(true);
      setCompressionProgress(0);
    }
    
    try {
      // Simulate progressive compression steps
      if (willCompress) {
        setCompressionProgress(30);
        await new Promise(resolve => setTimeout(resolve, 300));
        setCompressionProgress(60);
      }
      
      // Compress the file (images and PDFs)
      const processedFile = await compressFile(file);
      
      setCompressionProgress(100);
      
      // Brief delay to show completion before closing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Show compression success message only if file was compressed
      if (willCompress && processedFile.size !== file.size) {
        const originalSize = formatFileSize(file.size);
        const newSize = formatFileSize(processedFile.size);
        const savings = Math.round((1 - processedFile.size / file.size) * 100);
        
        setCompressionNotification({
          originalSize,
          newSize,
          savings
        });
        
        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          setCompressionNotification(null);
        }, 3000);
      }
      
      setModalFile(processedFile);
    } catch (error) {
      logger.error('[FileCompression] Error:', error);
      Swal.fire({
        ...alertStyle.warningAlert,
        title: 'Compression Failed',
        text: 'Compression failed. Using original file.'
      });
      setModalFile(file);
    } finally {
      setModalLoading(false);
      setCompressionProgress(0);
    }
  };

  const handleModalFileChange = async (e) => {
    const file = e.target.files[0];
    await processFile(file);
  };

  // Drag and drop handlers - works anywhere on the modal
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (!modalLoading && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!modalLoading) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    
    if (modalLoading) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      await processFile(file);
    }
  };

  const [fields, setFields] = useState({
    date: dayjs(),
    operatorName: "",
    contact: "",
    birthPlace: "Municipality / Province", // Prefilled value
    birthDate: null,
    civilStatus: "",
    citizenship: "",
    todaMembership: "",
    unitModel: "",
    colorMotor: "",
    colorSidecar: "B/Y", // Prefilled and read-only
    mvPlateNo: "",
    motorEngineNumber: "",
    chassisNumber: "",
    driverName: "",
    driverAddress: "",
    operatorAddress: "",
    barangay: "",
    hasCoOwner: "",
    operatorPicture: null,
    driverPicture: null,
  });

  // Track if this is a resubmission (editing disapproved application)
  const [isResubmission, setIsResubmission] = useState(false);
  const [resubmissionAppId, setResubmissionAppId] = useState(null);
  const [existingDocuments, setExistingDocuments] = useState(null);
  
  // Track application type (new, renewal, amendment, change_unit)
  const [applicationType, setApplicationType] = useState('new');

  // Co-owner state
  const [coOwners, setCoOwners] = useState([]);

  // Error states for sidecar fields
  const [sidecarColorError, setSidecarColorError] = useState("");
  const [mvPlateError, setMvPlateError] = useState("");

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

  // MV Plate validation handler - Philippine format: 3 letters + numbers (e.g., ABC1234)
  // STRICTLY enforces format at input time, not just on submit
  const handleMVPlateChange = (e) => {
    let inputValue = e.target.value.toUpperCase().trim();
    let error = "";
    let validatedValue = "";
    
    // Handle empty input
    if (inputValue === "") {
      setFields({ ...fields, mvPlateNo: "" });
      setMvPlateError("");
      return;
    }
    
    // Process character by character to enforce strict rules
    for (let i = 0; i < inputValue.length; i++) {
      const char = inputValue[i];
      const charCode = char.charCodeAt(0);
      
      // Skip spaces (will be handled separately)
      if (char === " ") {
        continue;
      }
      
      // First 3 characters: MUST be letters only
      if (validatedValue.length < 3) {
        if (/^[A-Z]$/.test(char)) {
          validatedValue += char;
        } else {
          // Block invalid character - letter required at this position
          error = "First 3 characters must be letters only (A-Z)";
          break;
        }
      } 
      // After 3 letters: MUST be numbers only
      else if (validatedValue.length >= 3) {
        if (/^[0-9]$/.test(char)) {
          validatedValue += char;
        } else {
          // Block invalid character - number required after 3 letters
          error = "Numbers only after the first 3 letters";
          break;
        }
      }
      
      // Enforce maximum length (3 letters + 4 numbers = 7 total)
      if (validatedValue.length >= 7) {
        if (i < inputValue.length - 1) {
          error = "MV Plate format maximum: 3 letters + 4 numbers";
        }
        break;
      }
    }
    
    // Set the validated value and error state
    setFields({ ...fields, mvPlateNo: validatedValue });
    setMvPlateError(error);
  };

  // Helper function to truncate long filenames
  const truncateFilename = (filename, maxLength = 40) => {
    if (!filename || filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncatedName}...${extension}`;
  };

  const [uploads, setUploads] = useState({
    registration: null,
    barangay: null,
    cedula: null,
    license: null,
    stencil: null,
    affidavit: null,
    orLTO: null,
    cr: null,
    picture: null,
  });

  // Prevent multiple submissions / spamming
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Privacy agreement checkbox state
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  // Privacy modal state
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  // Field-level errors map
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (errors && Object.keys(errors).length) {
      logger.debug('[FranchiseApplication] Validation errors:', errors);
    }
  }, [errors]);

  const _handleFileChange = (key) => (e) => {
    setUploads({ ...uploads, [key]: e.target.files[0] });
  };

  // Validate that required fields and files are present
  const validateRequiredFields = () => {
    // Reset previous errors
    const newErrors = {};
    setSidecarColorError("");

    // Ensure every field in fields (except date, hasCoOwner, operatorPicture, driverPicture, todaMembership, and sidecarPlate) is present and non-empty
    Object.keys(fields).forEach(k => {
      if (k === 'date' || k === 'hasCoOwner' || k === 'operatorPicture' || k === 'driverPicture' || k === 'todaMembership' || k === 'sidecarPlate') return;
      const v = fields[k];
      if (k === 'birthDate') {
        if (!v) newErrors[k] = 'Date of birth is required';
      } else if (typeof v === 'string') {
        if (!v.trim()) newErrors[k] = 'This field is required';
      } else if (v === null || v === undefined) {
        newErrors[k] = 'This field is required';
      }
    });

    // Validation for sidecar color field (required but not strict Blue/Yellow)
    if (!fields.colorSidecar || !fields.colorSidecar.trim()) {
      newErrors.colorSidecar = 'Sidecar color is required';
      setSidecarColorError('Sidecar color is required');
    } else {
      setSidecarColorError('');
    }

    // Validation for MV Plate Number (Philippine format)
    if (!fields.mvPlateNo || !fields.mvPlateNo.trim()) {
      newErrors.mvPlateNo = 'MV Plate is required';
      setMvPlateError('MV Plate is required');
    } else if (!/^[A-Z]{3}[0-9]{1,4}$/.test(fields.mvPlateNo)) {
      // Should not happen with strict input validation, but added for safety
      newErrors.mvPlateNo = 'Invalid MV Plate format. Must be 3 letters + 1-4 numbers (e.g., ABC1234)';
      setMvPlateError('Invalid MV Plate format. Must be 3 letters + 1-4 numbers (e.g., ABC1234)');
    } else {
      setMvPlateError('');
    }

    // Required documents
    const requiredDocs = ['registration', 'barangay', 'cedula', 'license', 'affidavit', 'orLTO', 'cr', 'picture'];
    requiredDocs.forEach(dk => {
      if (!uploads[dk]) newErrors[`doc_${dk}`] = 'Document is required';
    });

    // Contact numeric check
    if (fields.contact && !/^[0-9]+$/.test(fields.contact)) {
      newErrors.contact = 'Only numbers are allowed in the contact field';
    }

    // Validate co-owners if selected
    if (fields.hasCoOwner === 'Yes') {
      coOwners.forEach((owner, idx) => {
        if (!owner.name.trim()) newErrors[`coOwner_${idx}_name`] = 'Co-owner name is required';
        if (!owner.address.trim()) newErrors[`coOwner_${idx}_address`] = 'Co-owner address is required';
        if (!owner.relationship) newErrors[`coOwner_${idx}_relationship`] = 'Relationship is required';
      });
    }

    // Validate operator picture
    if (!fields.operatorPicture) {
      newErrors.operatorPicture = 'Operator 1x1 picture is required';
    }

    // Validate driver picture
    if (!fields.driverPicture) {
      newErrors.driverPicture = 'Driver 1x1 picture is required';
    }

    // Special mapping to keep older per-field error states for UI
    if (newErrors.operatorAddress || newErrors.operatorAddress === '') setAddressError(newErrors.operatorAddress || '');
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
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Validation Error',
        text: message
      });
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
    orLTO: useRef(),
    cr: useRef(),
    picture: useRef(),
  };

  return (
    <div>

      <UnifiedNavbar 
        userType="operator" 
        language={language}
        onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')}
        translations={t}
      />

      <div className="franchise-app-bg">
        <div className="franchise-app-paper">
       
        {modalDocKey && (
          <div 
            className="franchise-modal-bg" 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDragging ? 'rgba(2, 132, 199, 0.15)' : 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              transition: 'background-color 0.3s ease'
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="franchise-modal" style={{ 
              width: '90%',
              maxWidth: '500px', 
              borderRadius: '24px', 
              background: '#fff', 
              boxShadow: '0 20px 60px rgba(23, 77, 122, 0.3)', 
              padding: '48px', 
              position: 'relative',
              margin: '20px',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ fontWeight: 900, fontSize: '2rem', marginBottom: 12, letterSpacing: '-0.5px', color: '#0A356B' }}>{t.selectFile}</div>
              <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '32px', color: '#666', letterSpacing: '0.3px' }}>
                {t.upload} {[
                  { key: 'registration', label: t.photoRegistration },
                  { key: 'barangay', label: t.photoBarangay },
                  { key: 'cedula', label: t.photoCedula },
                  { key: 'license', label: t.photoLicense },
                  { key: 'affidavit', label: t.photoAffidavit },
                  { key: 'picture', label: t.picture },
                ].find(d => d.key === modalDocKey)?.label}
              </div>
              <div style={{ marginBottom: '32px' }}>
                <div
                  style={{
                    background: isDragging 
                      ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' 
                      : 'linear-gradient(135deg, #f0f7ff 0%, #e8f1ff 100%)',
                    border: isDragging 
                      ? '3px dashed #0284c7' 
                      : '2.5px dashed #174D7A',
                    borderRadius: '20px',
                    padding: '48px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: '16px',
                    boxShadow: isDragging 
                      ? 'inset 0 4px 16px rgba(2, 132, 199, 0.15), 0 8px 24px rgba(2, 132, 199, 0.2)' 
                      : 'inset 0 2px 8px rgba(23, 77, 122, 0.05)',
                    cursor: modalLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    backgroundColor: isDragging 
                      ? 'rgba(186, 230, 253, 0.4)' 
                      : 'rgba(240, 247, 255, 0.8)',
                    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragging && !modalLoading) {
                      e.currentTarget.style.backgroundColor = 'rgba(224, 242, 255, 0.9)';
                      e.currentTarget.style.borderColor = '#0A356B';
                      e.currentTarget.style.boxShadow = 'inset 0 2px 12px rgba(23, 77, 122, 0.1), 0 4px 12px rgba(23, 77, 122, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.backgroundColor = 'rgba(240, 247, 255, 0.8)';
                      e.currentTarget.style.borderColor = '#174D7A';
                      e.currentTarget.style.boxShadow = 'inset 0 2px 8px rgba(23, 77, 122, 0.05)';
                    }
                  }}
                  onClick={() => !modalLoading && modalFileRef.current && modalFileRef.current.click()}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="iconGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{stopColor: '#174D7A'}} />
                          <stop offset="100%" style={{stopColor: '#0A356B'}} />
                        </linearGradient>
                      </defs>
                      {/* Cloud shape */}
                      <path d="M19 13c1.1 0 2-.9 2-2 0-1.05-.84-1.9-1.9-1.95C18.6 5.9 16 3 13 3c-2.5 0-4.6 1.7-5.1 4-.05.02-.1.02-.15.02C5.6 7 4 8.6 4 10.5 4 12.4 5.5 14 7.1 14" stroke="url(#iconGrad)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      {/* Upload arrow */}
                      <g stroke="url(#iconGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="10" x2="12" y2="18" />
                        <polyline points="9 15 12 18 15 15" />
                      </g>
                    </svg>
                  </div>
                  <div style={{ 
                    color: isDragging ? '#0284c7' : '#174D7A', 
                    fontWeight: 700, 
                    fontSize: isDragging ? '20px' : '18px', 
                    marginBottom: '8px', 
                    letterSpacing: '0.2px',
                    transition: 'all 0.3s ease'
                  }}>
                    {isDragging ? 'Drop file here' : t.browseFiles}
                  </div>
                  <div style={{ 
                    color: isDragging ? '#0284c7' : '#999', 
                    fontWeight: isDragging ? 600 : 400, 
                    fontSize: '13px',
                    transition: 'all 0.3s ease'
                  }}>
                    {isDragging ? 'Release to upload' : 'or drag and drop'}
                  </div>
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={modalFileRef}
                    onChange={handleModalFileChange}
                    disabled={modalLoading}
                  />
                </div>
                <div style={{ 
                  background: '#f8f9fa', 
                  borderRadius: '12px', 
                  padding: '14px 16px', 
                  textAlign: 'center', 
                  fontWeight: 500, 
                  color: '#333', 
                  fontSize: '15px', 
                  marginTop: '12px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  border: '1px solid #e0e0e0',
                  transition: 'all 0.2s ease'
                }}>
                  {modalFile ? truncateFilename(modalFile.name) : t.noFileSelected}
                </div>
                
                {/* Compression Loading Indicator */}
                {(modalLoading || compressionProgress > 0) && (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f1ff 100%)',
                    borderRadius: '12px',
                    border: '1px solid #d4e8f5'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" style={{
                        animation: 'spin 1s linear infinite',
                        '@keyframes spin': {
                          from: { transform: 'rotate(0deg)' },
                          to: { transform: 'rotate(360deg)' }
                        }
                      }}>
                        <defs>
                          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </defs>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="#174D7A" strokeWidth="2" opacity="0.2" />
                        <path d="M12 2A10 10 0 1 0 22 12" fill="none" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" className="spin-animation" />
                      </svg>
                     <span style={{ fontWeight: 600, color: '#174D7A', fontSize: '14px' }}>
                        Compressing image... {compressionProgress}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: '#e0e0e0',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #00b4d8, #0096c7)',
                        width: `${compressionProgress}%`,
                        transition: 'width 0.3s ease',
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                )}
                
                {/* Compression Success Notification */}
                {compressionNotification && (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f9f0 100%)',
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'slideIn 0.3s ease'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2" />
                      <path d="M8 12L11 15L16 9" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '15px' }}>Compression Complete</div>
                      <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                        {compressionNotification.originalSize} → {compressionNotification.newSize} ({compressionNotification.savings}% smaller!)
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                <button
                  className="franchise-cancel-btn"
                  style={{ 
                    background: '#f5f5f5', 
                    color: '#666', 
                    fontWeight: 600, 
                    borderRadius: '12px', 
                    padding: '12px 28px', 
                    fontSize: '15px', 
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: modalLoading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!modalLoading) {
                      e.currentTarget.style.backgroundColor = '#eeeeee';
                      e.currentTarget.style.borderColor = '#d0d0d0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                  onClick={() => { setModalDocKey(null); setModalFile(null); }}
                  disabled={modalLoading}
                >
                  {t.cancel}
                </button>
                <button
                  className="franchise-submit-btn"
                  style={{ 
                    background: '#174D7A', 
                    color: '#fff', 
                    fontWeight: 600, 
                    borderRadius: '12px', 
                    padding: '12px 28px', 
                    fontSize: '15px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(23, 77, 122, 0.3)', 
                    cursor: modalFile && !modalLoading ? 'pointer' : 'not-allowed',
                    opacity: modalFile && !modalLoading ? 1 : 0.6,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (modalFile && !modalLoading) {
                      e.currentTarget.style.backgroundColor = '#0f3a5f';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(23, 77, 122, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#174D7A';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(23, 77, 122, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => {
                    if (modalFile && modalDocKey) {
                      setUploads(u => ({ ...u, [modalDocKey]: modalFile }));
                      // If uploading driver picture from modal, also set it in fields
                      if (modalDocKey === 'picture') {
                        setFields(f => ({ ...f, driverPicture: modalFile }));
                      }
                    }
                    setModalDocKey(null);
                    setModalFile(null);
                  }}
                  disabled={!modalFile || modalLoading}
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
          <div className="franchise-app-title">{applicationType === 'renewal' ? t.renewalTitle : t.title}</div>
          <div className="franchise-app-date-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontWeight: 700, marginBottom: 4 }}>{t.date}</label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={fields.date}
                  onChange={(newValue) => setFields({ ...fields, date: newValue })}
                  disabled
                  readOnly
                  disableFuture
                  slotProps={{ textField: { size: 'small', className: 'franchise-app-input', disabled: true, InputProps: { readOnly: true } } }}
                />
              </LocalizationProvider>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 2, marginTop: 25 }}>
              <label style={{ fontWeight: 700, marginBottom: 8 }}>Do you have a Co-Owner for this Franchise?</label>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 16 }}>
                  <input
                    type="radio"
                    name="coOwner"
                    value="Yes"
                    checked={fields.hasCoOwner === 'Yes'}
                    onChange={(e) => {
                      setFields({ ...fields, hasCoOwner: e.target.value });
                      if (coOwners.length === 0) {
                        setCoOwners([{ name: '', address: '', relationship: '' }]);
                      }
                    }}
                    style={{ marginRight: 8, cursor: 'pointer', width: 18, height: 18 }}
                  />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 16 }}>
                  <input
                    type="radio"
                    name="coOwner"
                    value="No"
                    checked={fields.hasCoOwner === 'No'}
                    onChange={(e) => {
                      setFields({ ...fields, hasCoOwner: e.target.value });
                      setCoOwners([]);
                    }}
                    style={{ marginRight: 8, cursor: 'pointer', width: 18, height: 18 }}
                  />
                  No
                </label>
              </div>
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
            <TextField 
              label={t.placeOfBirth} 
              size="small" 
              className="franchise-app-input" 
              value={fields.birthPlace} 
              onChange={handleChange('birthPlace')}
              placeholder="e.g., Manila, Metro Manila"
            
            />
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
          {/* Email field removed - not required anymore */}
          
          
          <div className="franchise-app-grid-2">
            <TextField
              label="House No., Street, Purok/Subdivision"
              size="small"
              className="franchise-app-input"
              value={fields.operatorAddress}
              onChange={handleChange('operatorAddress')}
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
            <TextField 
              label={t.todaMembership} 
              size="small" 
              className="franchise-app-input" 
              value={fields.todaMembership} 
              onChange={handleChange('todaMembership')}
              helperText="Optional - Leave blank if not applicable"
            />
          </div>

          {/* Co-Owner Information */}
          {fields.hasCoOwner === 'Yes' && coOwners.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#174D7A' }}>
                Co-Owner Information
              </div>
              {coOwners.map((owner, index) => (
                <div key={index} style={{ marginBottom: 24, padding: 16, border: '2px solid #e0e0e0', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12, color: '#333' }}>
                    Co-Owner #{index + 1}
                  </div>
                  <div className="franchise-app-grid-2">
                    <TextField
                      label="Co-Owner Name"
                      size="small"
                      className="franchise-app-input"
                      value={owner.name}
                      onChange={(e) => {
                        const updated = [...coOwners];
                        updated[index].name = e.target.value;
                        setCoOwners(updated);
                      }}
                    />
                    <TextField
                      label="Address"
                      size="small"
                      className="franchise-app-input"
                      value={owner.address}
                      onChange={(e) => {
                        const updated = [...coOwners];
                        updated[index].address = e.target.value;
                        setCoOwners(updated);
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <FormControl size="small" className="franchise-app-input" fullWidth>
                      <InputLabel id={`relationship-label-${index}`}>Relationship</InputLabel>
                      <Select
                        labelId={`relationship-label-${index}`}
                        label="Relationship"
                        value={owner.relationship || ''}
                        onChange={(e) => {
                          const updated = [...coOwners];
                          updated[index].relationship = e.target.value;
                          setCoOwners(updated);
                        }}
                      >
                        <MenuItem value="Family">Family</MenuItem>
                        <MenuItem value="Spouse">Spouse</MenuItem>
                        <MenuItem value="Husband">Husband</MenuItem>
                        <MenuItem value="Others">Others</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>
              ))}
            </div>
          )}


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
            <TextField
              label={t.colorSidecar}
              size="small"
              className="franchise-app-input"
              value={fields.colorSidecar || "B/Y"}
              inputProps={{ readOnly: true }}
              required
              error={!!sidecarColorError}
              helperText={sidecarColorError || "Default: B/Y"}
              placeholder="B/Y"
            />
            <TextField 
              label={t.mvPlateNo} 
              size="small" 
              className="franchise-app-input" 
              value={fields.mvPlateNo} 
              onChange={handleMVPlateChange}
              error={!!mvPlateError}
              helperText={mvPlateError || "Format: ABC1234 (3 letters + up to 4 numbers)"}
              placeholder="ABC1234"
              inputProps={{
                maxLength: 7,
                autoComplete: "off"
              }}
            />
          </div>
          <div className="franchise-app-grid-2">
            <TextField label={t.motorEngineNumber} size="small" className="franchise-app-input" value={fields.motorEngineNumber} onChange={handleChange('motorEngineNumber')} />
            <TextField label={t.chassisNumber} size="small" className="franchise-app-input" value={fields.chassisNumber} onChange={handleChange('chassisNumber')} />
          </div>
          <div className="franchise-app-field">
            <TextField
              label="House No., Street, Purok/Subdivision, Barangay, Solano, Nueva Vizcaya"
              size="small"
              className="franchise-app-input"
              value={fields.driverAddress}
              onChange={handleChange('driverAddress')}
            />
          </div>
          
          {/* 1x1 Picture Upload for OPERATOR */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 700, color: '#222', fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>1x1 Picture of Operator</div>
            <div
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const validation = validateFile(file);
                    if (!validation.success) {
                      Swal.fire({
                        ...alertStyle.errorAlert,
                        title: 'Invalid File',
                        text: validation.message
                      });
                      return;
                    }
                    try {
                      const processedFile = await compressFile(file);
                      setFields({ ...fields, operatorPicture: processedFile });
                    } catch {
                      setFields({ ...fields, operatorPicture: file });
                    }
                  }
                };
                input.click();
              }}
            >
              {fields.operatorPicture ? truncateFilename(fields.operatorPicture.name) : t.noFileSelected + ' Click to upload'}
            </div>
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
              { key: 'stencil', label: t.photoStencil.toUpperCase() },
              { key: 'license', label: t.photoLicense.toUpperCase() },
              { key: 'affidavit', label: t.photoAffidavit.toUpperCase() },
              { key: 'orLTO', label: t.photoOrLTO.toUpperCase() },
              { key: 'cr', label: t.photoCR.toUpperCase() },
              { key: 'picture', label: t.driverPictureLabel.toUpperCase() },
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
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => {
                      setModalDocKey(doc.key);
                      setModalFile(null);
                    }}
                  >
                    {uploads[doc.key] ? truncateFilename(uploads[doc.key].name) : t.noFileSelected}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Agreement Section */}
          <div style={{ marginTop: 3, padding: '24px', background: '#fafbfd', borderRadius: '12px', boxShadow: '0 4px 12px rgba(23, 77, 122, 0.15)' }}>
            <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 24, color: '#174D7A' }}>
              {t.agreement}
            </div>
            <ol style={{ 
              marginLeft: 24,
              lineHeight: 1.8,
              color: '#444'
            }}>
              <li style={{ marginBottom: 16 }}>
                <Typography sx={{ 
                  fontSize: '15px',
                  fontFamily: 'Poppins, sans-serif',
                  color: '#333'
                }}>
                  {t.agreeText1}
                </Typography>
              </li>
              <li style={{ marginBottom: 16 }}>
                <Typography sx={{ 
                  fontSize: '15px',
                  fontFamily: 'Poppins, sans-serif',
                  color: '#333'
                }}>
                  {t.agreeText2}
                </Typography>
              </li>
              <li style={{ marginBottom: 16 }}>
                <Typography sx={{ 
                  fontSize: '15px',
                  fontFamily: 'Poppins, sans-serif',
                  color: '#333'
                }}>
                  {t.agreeText3}
                </Typography>
              </li>
            </ol>
          </div>

          {/* Sworn Statement Section */}
          <div style={{ marginTop: 4, padding: '24px', background: '#fafbfd', borderRadius: '12px', boxShadow: '0 4px 12px rgba(23, 77, 122, 0.15)' }}>
            <div style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 24, color: '#174D7A' }}>
              {t.swornStatement}
            </div>
            <div className="franchise-app-sworn-statement">
              <Typography sx={{ 
                marginBottom: 2, 
                lineHeight: 1.8,
                color: '#333',
                fontSize: '15px',
                fontFamily: 'Poppins, sans-serif'
              }}>
                {t.swornDeclaration}
              </Typography>
              <ol style={{ 
                marginLeft: 24, 
                marginBottom: 24,
                lineHeight: 1.8,
                color: '#444'
              }}>
                <li style={{ marginBottom: 12 }}>{t.swornItem1}</li>
                <li style={{ marginBottom: 12 }}>{t.swornItem2}</li>
                <li style={{ marginBottom: 12 }}>{t.swornItem3}</li>
                <li style={{ marginBottom: 12 }}>{t.swornItem4}</li>
              </ol>
              <Typography sx={{ 
                marginBottom: 3,
                fontWeight: 500,
                color: '#333',
                fontSize: '15px',
                fontFamily: 'Poppins, sans-serif'
              }}>
                {t.swornCompliance}
              </Typography>
              <div className="franchise-app-digital-signature">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                  <div style={{ width: 340 }}>
                    <div
                      style={{
                        width: '100%',
                        height: 80,
                        background: 'transparent',
                        borderTop: '2px solid #174D7A',
                        borderBottom: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#174D7A',
                        marginBottom: 8,
                        paddingTop: '10px',
                        letterSpacing: '1px'
                      }}
                    >
                      SIGNATURE
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Agreement Checkbox */}
          <div style={{ marginTop: 3, marginBottom: 24, padding: '16px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <input
              type="checkbox"
              checked={agreeToPrivacy}
              onChange={(e) => setAgreeToPrivacy(e.target.checked)}
              style={{ marginTop: 4, width: 20, height: 20, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <label style={{ cursor: 'pointer', fontSize: 14, color: '#333', fontWeight: 500 }}>
                I agree to the{' '}
                <span
                  onClick={() => setPrivacyModalOpen(true)}
                  style={{ color: '#174D7A', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                >
                  privacy policy
                </span>
                {' '}and understand that my personal information will be used for franchise application processing.
              </label>
            </div>
          </div>

          {/* Privacy Policy Modal */}
          <PrivacyPolicyModal
            open={privacyModalOpen}
            onClose={() => setPrivacyModalOpen(false)}
            onAgree={() => {
              setAgreeToPrivacy(true);
              setPrivacyModalOpen(false);
            }}
            onDecline={() => {
              setAgreeToPrivacy(false);
              setPrivacyModalOpen(false);
            }}
          />

          {/* Submit Button - At the bottom */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '32px 0' }}>
            <Button
              variant="contained"
              disabled={isSubmitting}
              sx={{ bgcolor: '#174D7A', color: '#fff', fontWeight: 700, borderRadius: 2, fontSize: 18, px: 4, py: 1 }}
              onClick={async () => {
                    if (isSubmitting) return; // ignore repeated clicks
                    // Validate address and barangay before building form data
                    const addr = (fields.operatorAddress || '').trim();
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
                      Swal.fire({
                        ...alertStyle.errorAlert,
                        title: 'Form Error',
                        text: 'Please fix form errors before submitting.'
                      });
                      return;
                    }

                    // Validate all fields before marking as submitting
                    const valid = validateRequiredFields();
                    if (!valid) return;

                    // Validate privacy agreement
                    if (!agreeToPrivacy) {
                      Swal.fire({
                        ...alertStyle.errorAlert,
                        title: 'Privacy Agreement Required',
                        text: 'You must agree to the privacy policy before submitting your application.'
                      });
                      return;
                    }

                    // Mark as submitting to prevent spam
                    setIsSubmitting(true);

                      const formDataToSend = new FormData();

                      // Personal Information - EXACT field names backend expects
                      formDataToSend.append('operatorName', fields.operatorName || '');
                      formDataToSend.append('operatorContactNumber', fields.contact || '');
                      formDataToSend.append('operatorAddress', fields.operatorAddress || '');
                      formDataToSend.append('operatorBarangay', fields.barangay || '');
                      formDataToSend.append('operatorBirthPlace', fields.birthPlace || '');
                      formDataToSend.append('operatorBirthDate', fields.birthDate ? (fields.birthDate.format ? fields.birthDate.format('YYYY-MM-DD') : fields.birthDate) : '');
                      formDataToSend.append('operatorCivilStatus', fields.civilStatus || '');
                      formDataToSend.append('operatorCitizenship', fields.citizenship || '');
                      
                      // Email is automatically obtained from user?.email on the backend
                      // No need to send from frontend - backend authentication middleware provides it
                      
                      // Driver/Operator Details
                      formDataToSend.append('driversID', fields.driverName || '');
                      formDataToSend.append('driverName', fields.driverName || '');
                      formDataToSend.append('driversAddress', fields.driverAddress || '');
                      formDataToSend.append('todaMembership', fields.todaMembership || '');
                      
                      // Vehicle Information
                      formDataToSend.append('unitModel', fields.unitModel || '');
                      formDataToSend.append('colorMotor', fields.colorMotor || '');
                      formDataToSend.append('sideCarColor', fields.colorSidecar || '');
                      formDataToSend.append('sideCarPlateNumber', fields.mvPlateNo || ''); // FIXED: Added this field
                      formDataToSend.append('mvPlateNo', fields.mvPlateNo || ''); 
                      formDataToSend.append('motorEngineNo', fields.motorEngineNumber || ''); 
                      formDataToSend.append('chasisNo', fields.chassisNumber || '');
                      
                      // Co-Owners Information
                      if (fields.hasCoOwner === 'Yes' && coOwners.length > 0) {
                        formDataToSend.append('coOwnerName', coOwners[0].name || '');
                        formDataToSend.append('coOwnerAddress', coOwners[0].address || '');
                        // Store additional co-owners in metadata if needed
                        if (coOwners.length > 1) {
                          formDataToSend.append('additionalCoOwners', JSON.stringify(coOwners.slice(1)));
                        }
                      } else {
                        formDataToSend.append('coOwnerName', '');
                        formDataToSend.append('coOwnerAddress', '');
                      }
                      
                      // Application Type (new, renewal, amendment, change_unit)
                      formDataToSend.append('applicationType', applicationType);
                      
                      // Documents - EXACT field names backend expects (with 'Obj' suffix)
                      // Only upload new files if provided, otherwise keep existing documents
                      if (uploads.registration) {
                        formDataToSend.append('motorRegistrationObj', uploads.registration);
                      } else if (isResubmission && existingDocuments?.motorRegistration) {
                        formDataToSend.append('existingMotorRegistration', existingDocuments.motorRegistration);
                      }
                      
                      if (uploads.barangay) {
                        formDataToSend.append('barangayClearanceObj', uploads.barangay);
                      } else if (isResubmission && existingDocuments?.barangayClearance) {
                        formDataToSend.append('existingBarangayClearance', existingDocuments.barangayClearance);
                      }
                      
                      if (uploads.cedula) {
                        formDataToSend.append('cedulaObj', uploads.cedula);
                      } else if (isResubmission && existingDocuments?.cedula) {
                        formDataToSend.append('existingCedula', existingDocuments.cedula);
                      }
                      
                      if (uploads.license) {
                        formDataToSend.append('driversLicenseObj', uploads.license);
                      } else if (isResubmission && existingDocuments?.driversLicense) {
                        formDataToSend.append('existingDriversLicense', existingDocuments.driversLicense);
                      }
                      
                      if (uploads.stencil) {
                        formDataToSend.append('motorChassisStencilObj', uploads.stencil);
                      } else if (isResubmission && existingDocuments?.motorChassisStencil) {
                        formDataToSend.append('existingMotorChassisStencil', existingDocuments.motorChassisStencil);
                      }
                      
                      if (uploads.affidavit) {
                        formDataToSend.append('votersAffidavitObj', uploads.affidavit);
                      } else if (isResubmission && existingDocuments?.votersAffidavit) {
                        formDataToSend.append('existingVotersAffidavit', existingDocuments.votersAffidavit);
                      }
                      
                      if (uploads.orLTO) {
                        formDataToSend.append('oRLTOObj', uploads.orLTO);
                      } else if (isResubmission && existingDocuments?.orLTO) {
                        formDataToSend.append('existingOrLTO', existingDocuments.orLTO);
                      }
                      
                      if (uploads.cr) {
                        formDataToSend.append('cRLTOObj', uploads.cr);
                      } else if (isResubmission && existingDocuments?.cr) {
                        formDataToSend.append('existingCR', existingDocuments.cr);
                      }
                      
                      if (uploads.picture) {
                        formDataToSend.append('driverPictureObj', uploads.picture);
                      } else if (fields.driverPicture) {
                        // If driver picture was uploaded directly (not through modal), use that
                        formDataToSend.append('driverPictureObj', fields.driverPicture);
                      } else if (isResubmission && existingDocuments?.driverPicture) {
                        formDataToSend.append('existingDriverPicture', existingDocuments.driverPicture);
                      }
                      
                      if (fields.operatorPicture) {
                        formDataToSend.append('operatorPictureObj', fields.operatorPicture);
                      } else if (isResubmission && existingDocuments?.operatorPicture) {
                        formDataToSend.append('existingOperatorPicture', existingDocuments.operatorPicture);
                      }
                      // Debug: Log all FormData keys and values before submission
                      logger.log('[FranchiseApplication] FormData to send:');
                      for (let pair of formDataToSend.entries()) {
                        if (pair[1] instanceof File) {
                          logger.log(`  ${pair[0]}: [File] name=${pair[1].name}, type=${pair[1].type}, size=${pair[1].size}`);
                        } else {
                          logger.log(`  ${pair[0]}: ${pair[1]}`);
                        }
                      }

                    try {
                      // Debug: Check token before submission (axios interceptor handles refresh automatically)
                      const token = sessionStorage.getItem('accessToken');
                      
                      // TEMPORARILY DISABLED: Protective route check
                      if (!token) {
                        Swal.fire({
                          ...alertStyle.errorAlert,
                          title: 'Session Expired',
                          text: 'Please log in again.'
                        });
                        setTimeout(() => navigate('/login'), 2000);
                        return;
                      }
                      
                      // Decode and log token payload for debugging
                      try {
                        const decoded = JSON.parse(atob(token.split('.')[1]));
                        logger.log('[FranchiseApplication] Token payload:', decoded);
                      } catch (e) {
                        logger.error('[FranchiseApplication] Failed to decode token:', e);
                      }
                      
                      logger.log('[FranchiseApplication] Submitting application...')
                      logger.log('[FranchiseApplication] Application type:', applicationType);
                      
                      let response;
                      if (isResubmission && resubmissionAppId) {
                        // Update existing disapproved application
                        logger.log('[FranchiseApplication] Resubmitting application:', resubmissionAppId);
                        response = await franchiseAPI.update(resubmissionAppId, formDataToSend);
                      } else if (applicationType === 'renewal' || applicationType === 'amendment' || applicationType === 'change_unit') {
                        // Renewal, amendment, or change unit - use the renew-amend endpoint
                        logger.log('[FranchiseApplication] Creating renewal/amendment/change_unit application');
                        response = await franchiseAPI.createRenewAmend(formDataToSend);
                      } else {
                        // Create new application
                        response = await franchiseAPI.create(formDataToSend);
                      }
                      
          
                      if (!response.data) throw new Error('No response data received')

                  
                      setFields({
                        date: dayjs(),
                        operatorName: "",
                        contact: "",
                        birthPlace: "Municipality / Province",
                        birthDate: null,
                        civilStatus: "",
                        citizenship: "",
                        todaMembership: "",
                        unitModel: "",
                        colorMotor: "",
                        colorSidecar: "B/Y",
                        mvPlateNo: "",
                        motorEngineNumber: "",
                        chassisNumber: "",
                        driverName: "",
                        driverAddress: "",
                        barangay: "",
                        hasCoOwner: "",
                        operatorPicture: null,
                      })
                      setAddressError('');
                      setBarangayError('');
                      setUploads({ registration: null, barangay: null, cedula: null, license: null, affidavit: null, orLTO: null, cr: null, picture: null })
                      setCoOwners([]);

                      
                      logger.log('[FranchiseApplication] Application submitted successfully')
                     
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

                         Swal.fire({
                        icon: 'success',
                        title: 'Application approved by BPLO',
                        text: 'Applicant will be notified to proceed with inspection and OR submission.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 4000,
                        timerProgressBar: true,
                        didOpen: (modal) => {
                          modal.style.borderRadius = '8px';
                          modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }
                      })

                      
                      try {
                        setTimeout(() => {
                          navigate('/operator/franchise')
                        }, 2000) 
                      } catch {
                        navigate('/operator/franchise')
                      }
                    } catch (err) {
                      logger.error('[FranchiseApplication] Failed to submit application:', err)
                      const status = err.response?.status;
                      const serverMessage = err.response?.data?.error || err.response?.data?.message || err.message;
                      if (status === 409) {
                        Swal.fire({
                          ...alertStyle.errorAlert,
                          title: 'Error',
                          text: serverMessage || 'An application already exists.'
                        });
                      } else if (status === 400) {
                        Swal.fire({
                          ...alertStyle.errorAlert,
                          title: 'Error',
                          text: serverMessage || 'Bad request. Please check your input.'
                        });
                      } else {
                        Swal.fire({
                          ...alertStyle.errorAlert,
                          title: 'Error',
                          text: serverMessage || 'Failed to submit application. Please try again later.'
                        });
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

        </div>
      </div>
    </div>
  );
}
