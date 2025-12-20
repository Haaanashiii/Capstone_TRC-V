import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  FormHelperText,
  CircularProgress,
  InputLabel,
  Typography
} from '@mui/material';
import PrivacyPolicyModal from "../../components/PrivacyPolicyModal";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useNavigate, useLocation } from 'react-router-dom';
import UnifiedNavbar from '../../components/UnifiedNavbar';
import { franchiseAPI, API_BASE_URL } from '../Services/api';
import { validateFile } from '../../utils/fileValidation';
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

// Constants
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'];

const INITIAL_FORM_STATE = {
  date: dayjs(),
  fullName: '',
  contactNumber: '',
  birthPlace: '',
  birthDate: null,
  address: '',
  barangay: '',
  civilStatus: '',
  citizenship: '',
  todaMembership: '',
  coOwner: '',
  orNumber: '',
  franchiseNumber: '',
  dateApproved: '',
  expiryDate: '',
  franchiseStatus: '',
  driverName: '',
  driverAddress: '',
  make: '',
  colorMotor: '',
  colorSidecar: 'B/Y',
  sidecarNumber: '',
  plateNumber: '',
  chassisNumber: '',
  motorNumber: '',
  hasCoOwner: '',
  operatorPicture: null
};

const BARANGAYS = [
  'Aggub', 'Bagahabag', 'Bangaan', 'Bangar', 'Bascaran', 'Communal',
  'Concepcion', 'Curifang', 'Dadap', 'Lactawan', 'Osmeña', 'Pilar D. Galima',
  'Poblacion North', 'Poblacion South', 'Quezon', 'Quirino', 'Roxas',
  'San Juan', 'San Luis', 'Tucal', 'Uddiawan', 'Wacal'
];

const FIELD_LABELS = {
  date: 'Date',
  fullName: 'Full Name',
  contactNumber: 'Contact Number',
  birthPlace: 'Place of Birth',
  birthDate: 'Date of Birth',
  address: 'Address',
  barangay: 'Barangay',
  civilStatus: 'Civil Status',
  citizenship: 'Citizenship',
  todaMembership: 'TODA Membership',
  coOwner: 'Co-owner',
  orNumber: 'OR Number',
  franchiseNumber: 'Franchise Number',
  dateApproved: 'Date Approved',
  expiryDate: 'Expiry Date',
  franchiseStatus: 'Franchise Status',
  driverName: 'Name of the Driver',
  driverAddress: 'Address of the Driver',
  make: 'Make/Model',
  colorMotor: 'Color (Motor)',
  colorSidecar: 'Color (Sidecar)',
  sidecarNumber: 'Sidecar Number',
  plateNumber: 'Plate Number',
  chassisNumber: 'Chassis Number',
  motorNumber: 'Motor Number'
};

export default function RequestAmendment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState('en');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  
  // Get amendment type from navigation state
  const amendmentType = location.state?.amendmentType || 'motor'; // 'owner' or 'motor'
  
  // Document uploads for owner amendment
  const [uploads, setUploads] = useState({
    registration: null,
    barangay: null,
    cedula: null,
    license: null,
    affidavit: null,
    picture: null,
    stencil: null,
    oRLTO: null,
    cRLTO: null
  });

  // Modal state for file upload
  const [modalDocKey, setModalDocKey] = useState(null);
  const [modalFile, setModalFile] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionNotification, setCompressionNotification] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const modalFileRef = useRef();

  // Helper function to truncate filename for display
  const truncateFilename = (filename, maxLength = 30) => {
    if (!filename || filename.length <= maxLength) return filename;
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4);
    return `${truncatedName}...${extension}`;
  };

  // Privacy agreement checkbox state
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  // Privacy modal state
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const translations = {
    en: { 
      title: 'AMENDMENT REQUEST', 
      toggleLanguage: 'Tagalog',
      subtitle: 'Update your franchise information',
      date: 'DATE',
      personalInfo: 'FRANCHISEE INFORMATION',
      franchiseInfo: 'MOTORIZED TRICYCLE OPERATORS FRANCHISE',
      motorcycleInfo: 'MOTORCYCLE INFORMATION',
      documentaryReqs: 'DOCUMENTARY REQUIREMENTS',
      docInstructions: 'Please upload clear scanned copies or photos of the following documents.',
      docFormat1: 'Accepted formats: JPG, PNG, or PDF',
      docFormat2: 'Maximum file size: 10MB per file (will be compressed to ~300KB)',
      docFormat3: 'All documents must be valid, complete, and readable',
      docFormat4: 'Files will be automatically optimized for quality and size',
      browseFiles: 'Browse Files to upload',
      noFileSelected: 'No selected File -',
      submit: 'Submit',
      cancel: 'Cancel',
      submitAmendment: 'Submit Amendment Request',
      selectFile: 'Select a File',
      upload: 'Upload',
      photoRegistration: 'Photocopy of Registration',
      photoBarangay: 'Photocopy of Barangay Clearance',
      photoCedula: 'Photocopy of Cedula',
      photoLicense: "Photocopy of Driver's License",
      photoAffidavit: "Photocopy of Voter's Affidavit",
      picture: '1x1 Picture',
      fullName: 'FULL NAME',
      civilStatus: 'CIVIL STATUS',
      coOwner: 'CO-OWNER',
      address: 'ADDRESS',
      orNumber: 'OR NUMBER',
      franchiseNumber: 'FRANCHISE NUMBER',
      dateApproved: 'DATE APPROVED',
      expiryDate: 'EXPIRY DATE',
      franchiseStatus: 'FRANCHISE STATUS',
      make: 'MAKE/MODEL',
      sidecarNumber: 'SIDECAR NUMBER',
      plateNumber: 'PLATE NUMBER',
      chassisNumber: 'CHASSIS NUMBER',
      motorNumber: 'MOTOR NUMBER',
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
      agreeText3: "That I bind myself to conform with the rules and regulations promulgated by the LGU in connection with operation of motorized tricycle-for-hire."
    },
    tl: { 
      title: 'HILING PARA SA PAG-AAYOS', 
      toggleLanguage: 'English',
      subtitle: 'I-update ang iyong impormasyon ng franchise',
      date: 'PETSA',
      personalInfo: 'IMPORMASYON NG FRANCHISEE',
      franchiseInfo: 'MOTORIZED TRICYCLE OPERATORS FRANCHISE',
      motorcycleInfo: 'IMPORMASYON NG MOTORSIKLO',
      documentaryReqs: 'MGA KINAKAILANGANG DOKUMENTO',
      docInstructions: 'Mangyaring mag-upload ng malinaw na scanned copies o mga larawan ng mga sumusunod na dokumento.',
      docFormat1: 'Mga tanggap na format: JPG, PNG, o PDF',
      docFormat2: 'Pinakamataas na laki ng file: 10MB bawat file (awtomatikong ie-compress sa ~300KB)',
      docFormat3: 'Ang lahat ng mga dokumento ay dapat na valid, kumpleto, at mababasa',
      docFormat4: 'Awtomatikong i-o-optimize ang mga file para sa kalidad at laki',
      browseFiles: 'Mag-browse ng mga file para i-upload',
      noFileSelected: 'Walang napiling File -',
      submit: 'Ipasa',
      cancel: 'Kanselahin',
      submitAmendment: 'Ipasa ang Hiling para sa Pag-aayos',
      selectFile: 'Pumili ng File',
      upload: 'I-upload',
      photoRegistration: 'Photocopy ng Rehistrasyon',
      photoBarangay: 'Photocopy ng Barangay Clearance',
      photoCedula: 'Photocopy ng Cedula',
      photoLicense: "Photocopy ng Driver's License",
      photoAffidavit: "Photocopy ng Voter's Affidavit",
      picture: '1x1 na Larawan',
      fullName: 'BUONG PANGALAN',
      civilStatus: 'KATAYUANG SIBIL',
      coOwner: 'CO-OWNER',
      address: 'TIRAHAN',
      orNumber: 'NUMERO NG OR',
      franchiseNumber: 'NUMERO NG FRANCHISE',
      dateApproved: 'PETSA NG PAG-APRUBA',
      expiryDate: 'PETSA NG PAG-EXPIRE',
      franchiseStatus: 'KATAYUAN NG FRANCHISE',
      make: 'MAKE/MODEL',
      sidecarNumber: 'NUMERO NG SIDECAR',
      plateNumber: 'NUMERO NG PLAKA',
      chassisNumber: 'NUMERO NG CHASSIS',
      motorNumber: 'NUMERO NG MOTOR',
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
      agreeText3: "Na aking itinatatag ang aking sarili na sumunod sa mga tuntunin at regulasyon na pinatupad ng LGU na may kaugnayan sa operasyon ng motorized tricycle-for-hire."
    }
  };

  const t = translations[language];

  // Memoized handlers for performance
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  }, []);

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
      if (willCompress) {
        const originalSize = (file.size / 1024).toFixed(2);
        const newSize = (processedFile.size / 1024).toFixed(2);
        const savings = (((file.size - processedFile.size) / file.size) * 100).toFixed(0);
        
        setCompressionNotification({
          originalSize: `${originalSize}KB`,
          newSize: `${newSize}KB`,
          savings: savings
        });
        
        // Clear notification after 2 seconds
        setTimeout(() => {
          setCompressionNotification(null);
        }, 2000);
      }
      
      setModalFile(processedFile);
    } catch (error) {
      logger.error('[RequestAmendment] File compression error:', error);
      setModalFile(file);
    } finally {
      setModalLoading(false);
      setCompressionProgress(0);
    }
  };

  // Handle modal file selection with compression
  const handleModalFileChange = async (e) => {
    const file = e.target.files[0];
    await processFile(file);
  };

  // Drag and drop handlers - works anywhere on the modal
  const dragCounter = useRef(0);

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

  // Fetch existing franchise data on component mount
  useEffect(() => {
    const fetchFranchiseData = async () => {
      try {
        setIsLoading(true);
        
        // First check if franchise data was passed via navigation state
        const passedFranchiseChainId = location.state?.franchiseChainId;
        const passedFranchise = location.state?.franchise;
        
        logger.log('[RequestAmendment] Navigation state:', { 
          amendmentType: location.state?.amendmentType,
          hasPassedFranchise: !!passedFranchise,
          franchiseChainId: passedFranchiseChainId
        });
        
        // If franchise data was passed from navigation, use it as immediate fallback
        if (passedFranchise && passedFranchise.franchiseNumber) {
          logger.log('[RequestAmendment] Using franchise from navigation state:', {
            franchiseNumber: passedFranchise.franchiseNumber,
            operatorName: passedFranchise.operatorName || passedFranchise.fullName,
            franchiseChainId: passedFranchiseChainId
          });
          
          // Populate form immediately with passed franchise data
          setFormData({
            date: dayjs(),
            fullName: passedFranchise.operatorName || passedFranchise.fullName || '',
            contactNumber: passedFranchise.operatorContactNumber || '',
            birthPlace: passedFranchise.operatorBirthPlace || '',
            birthDate: passedFranchise.operatorBirthDate ? dayjs(passedFranchise.operatorBirthDate) : null,
            address: passedFranchise.operatorAddress || passedFranchise.address || '',
            barangay: passedFranchise.operatorBarangay || '',
            civilStatus: passedFranchise.operatorCivilStatus || passedFranchise.civilStatus || '',
            citizenship: passedFranchise.operatorCitizenship || '',
            todaMembership: passedFranchise.todaMembership || '',
            coOwner: passedFranchise.coOwnerName || passedFranchise.coOwner || '',
            orNumber: passedFranchise.franchiseNumber || '',
            franchiseNumber: passedFranchise.franchiseNumber || '',
            dateApproved: passedFranchise.approvedAt 
              ? new Date(passedFranchise.approvedAt).toISOString().split('T')[0]
              : passedFranchise.dateApproved || '',
            expiryDate: passedFranchise.expiryDate 
              ? new Date(passedFranchise.expiryDate).toISOString().split('T')[0]
              : '',
            franchiseStatus: passedFranchise.franchiseStatus || 'Active',
            driverName: passedFranchise.driverName || '',
            driverAddress: passedFranchise.driversAddress || passedFranchise.driverAddress || '',
            make: passedFranchise.unitModel || passedFranchise.make || '',
            colorMotor: passedFranchise.colorMotor || '',
            colorSidecar: passedFranchise.sideCarColor || 'B/Y',
            sidecarNumber: passedFranchise.sideCarPlateNumber || passedFranchise.sidecarNumber || '',
            plateNumber: passedFranchise.mvPlateNo || passedFranchise.plateNumber || '',
            chassisNumber: passedFranchise.chasisNo || passedFranchise.chassisNumber || '',
            motorNumber: passedFranchise.motorEngineNo || passedFranchise.motorNumber || ''
          });
        }
        
        // Get token
        const token = sessionStorage.getItem('accessToken');
        if (!token) {
          logger.log('[RequestAmendment] No token found, using passed data as final');
          setIsLoading(false);
          return;
        }

        logger.log('[RequestAmendment] Fetching user data from /auth/me');
        
        // Fetch user data with franchise information from /auth/me
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!userResponse.ok) {
          logger.error('[RequestAmendment] Failed to fetch user data:', userResponse.status);
          logger.log('[RequestAmendment] Will use data from navigation state');
          setIsLoading(false);
          return;
        }

        const userData = await userResponse.json();
        logger.log('[RequestAmendment] User data received:', userData);
        
        // Get franchise information from user data
        const userFranchise = userData.user?.franchise;
        
        if (!userFranchise) {
          logger.warn('[RequestAmendment] No franchise found in user data');
          setIsLoading(false);
          return;
        }

        logger.log('[RequestAmendment] Found franchise:', {
          franchiseChainId: userFranchise.franchiseChainId,
          franchiseNumber: userFranchise.franchiseNumber,
          operatorName: userFranchise.operatorName,
          status: userFranchise.franchiseStatus
        });

        // If we have a franchiseChainId, fetch the complete franchise history to get the latest version
        if (userFranchise.franchiseChainId) {
          try {
            logger.log('[RequestAmendment] Fetching franchise chain history:', userFranchise.franchiseChainId);
            
            const chainResponse = await fetch(
              `${API_BASE_URL}/api/franchise-information/chain/${userFranchise.franchiseChainId}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (chainResponse.ok) {
              const chainData = await chainResponse.json();
              logger.log('[RequestAmendment] Chain data received:', chainData);
              
              // Get the latest version (last item in the data array)
              if (chainData.data && chainData.data.length > 0) {
                const latestFranchise = chainData.data[chainData.data.length - 1];
                
                logger.log('[RequestAmendment] Latest franchise version:', {
                  version: latestFranchise.version,
                  operatorName: latestFranchise.operatorName,
                  operatorAddress: latestFranchise.operatorAddress,
                  driverName: latestFranchise.driverName,
                  franchiseStatus: latestFranchise.franchiseStatus
                });

                // Pre-populate form with latest franchise data
                setFormData({
                  date: dayjs(),
                  fullName: latestFranchise.operatorName || '',
                  contactNumber: latestFranchise.operatorContactNumber || '',
                  birthPlace: latestFranchise.operatorBirthPlace || '',
                  birthDate: latestFranchise.operatorBirthDate ? dayjs(latestFranchise.operatorBirthDate) : null,
                  address: latestFranchise.operatorAddress || '',
                  barangay: latestFranchise.operatorBarangay || '',
                  civilStatus: latestFranchise.operatorCivilStatus || '',
                  citizenship: latestFranchise.operatorCitizenship || '',
                  todaMembership: latestFranchise.todaMembership || '',
                  coOwner: latestFranchise.coOwnerName || '',
                  orNumber: latestFranchise.franchiseNumber || '',
                  franchiseNumber: latestFranchise.franchiseNumber || '',
                  dateApproved: latestFranchise.approvedAt 
                    ? new Date(latestFranchise.approvedAt).toISOString().split('T')[0]
                    : '',
                  expiryDate: latestFranchise.expiryDate 
                    ? new Date(latestFranchise.expiryDate).toISOString().split('T')[0]
                    : '',
                  franchiseStatus: latestFranchise.franchiseStatus || 'Active',
                  driverName: latestFranchise.driverName || '',
                  driverAddress: latestFranchise.driversAddress || '',
                  make: latestFranchise.unitModel || '',
                  colorMotor: latestFranchise.colorMotor || '',
                  colorSidecar: latestFranchise.sideCarColor || 'B/Y',
                  sidecarNumber: latestFranchise.sideCarPlateNumber || '',
                  plateNumber: latestFranchise.mvPlateNo || '',
                  chassisNumber: latestFranchise.chasisNo || '',
                  motorNumber: latestFranchise.motorEngineNo || ''
                });
                
                logger.log('[RequestAmendment] Form populated successfully');
              }
            } else {
              logger.warn('[RequestAmendment] Failed to fetch franchise chain:', chainResponse.status);
              // Fallback: populate with basic franchise data
              setFormData({
                date: dayjs(),
                fullName: userFranchise.operatorName || '',
                contactNumber: userFranchise.operatorContactNumber || '',
                birthPlace: userFranchise.operatorBirthPlace || '',
                birthDate: userFranchise.operatorBirthDate ? dayjs(userFranchise.operatorBirthDate) : null,
                address: userFranchise.operatorAddress || '',
                barangay: userFranchise.operatorBarangay || '',
                civilStatus: userFranchise.operatorCivilStatus || '',
                citizenship: userFranchise.operatorCitizenship || '',
                todaMembership: userFranchise.todaMembership || '',
                coOwner: userFranchise.coOwnerName || '',
                orNumber: userFranchise.franchiseNumber || '',
                franchiseNumber: userFranchise.franchiseNumber || '',
                dateApproved: userFranchise.approvedAt 
                  ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
                  : '',
                expiryDate: userFranchise.expiryDate 
                  ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
                  : '',
                franchiseStatus: userFranchise.franchiseStatus || 'Active',
                driverName: userFranchise.driverName || '',
                driverAddress: userFranchise.driversAddress || '',
                make: userFranchise.unitModel || '',
                colorMotor: userFranchise.colorMotor || '',
                colorSidecar: userFranchise.sideCarColor || 'B/Y',
                sidecarNumber: userFranchise.sideCarPlateNumber || '',
                plateNumber: userFranchise.mvPlateNo || '',
                chassisNumber: userFranchise.chasisNo || '',
                motorNumber: userFranchise.motorEngineNo || ''
              });
            }
          } catch (chainError) {
            logger.error('[RequestAmendment] Error fetching franchise chain:', chainError);
            // Fallback: use franchise data from /auth/me
            setFormData({
              date: dayjs(),
              fullName: userFranchise.operatorName || '',
              contactNumber: userFranchise.operatorContactNumber || '',
              birthPlace: userFranchise.operatorBirthPlace || '',
              birthDate: userFranchise.operatorBirthDate ? dayjs(userFranchise.operatorBirthDate) : null,
              address: userFranchise.operatorAddress || '',
              barangay: userFranchise.operatorBarangay || '',
              civilStatus: userFranchise.operatorCivilStatus || '',
              citizenship: userFranchise.operatorCitizenship || '',
              todaMembership: userFranchise.todaMembership || '',
              coOwner: userFranchise.coOwnerName || '',
              orNumber: userFranchise.franchiseNumber || '',
              franchiseNumber: userFranchise.franchiseNumber || '',
              dateApproved: userFranchise.approvedAt 
                ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
                : '',
              expiryDate: userFranchise.expiryDate 
                ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
                : '',
              franchiseStatus: userFranchise.franchiseStatus || 'Active',
              driverName: userFranchise.driverName || '',
              driverAddress: userFranchise.driversAddress || '',
              make: userFranchise.unitModel || '',
              colorMotor: userFranchise.colorMotor || '',
              colorSidecar: userFranchise.sideCarColor || 'B/Y',
              sidecarNumber: userFranchise.sideCarPlateNumber || '',
              plateNumber: userFranchise.mvPlateNo || '',
              chassisNumber: userFranchise.chasisNo || '',
              motorNumber: userFranchise.motorEngineNo || ''
            });
          }
        } else {
          // No franchiseChainId, use basic franchise data
          setFormData({
            date: dayjs(),
            fullName: userFranchise.operatorName || '',
            contactNumber: userFranchise.operatorContactNumber || '',
            birthPlace: userFranchise.operatorBirthPlace || '',
            birthDate: userFranchise.operatorBirthDate ? dayjs(userFranchise.operatorBirthDate) : null,
            address: userFranchise.operatorAddress || '',
            barangay: userFranchise.operatorBarangay || '',
            civilStatus: userFranchise.operatorCivilStatus || '',
            citizenship: userFranchise.operatorCitizenship || '',
            todaMembership: userFranchise.todaMembership || '',
            coOwner: userFranchise.coOwnerName || '',
            orNumber: userFranchise.franchiseNumber || '',
            franchiseNumber: userFranchise.franchiseNumber || '',
            dateApproved: userFranchise.approvedAt 
              ? new Date(userFranchise.approvedAt).toISOString().split('T')[0]
              : '',
            expiryDate: userFranchise.expiryDate 
              ? new Date(userFranchise.expiryDate).toISOString().split('T')[0]
              : '',
            franchiseStatus: userFranchise.franchiseStatus || 'Active',
            driverName: userFranchise.driverName || '',
            driverAddress: userFranchise.driversAddress || '',
            make: userFranchise.unitModel || '',
            colorMotor: userFranchise.colorMotor || '',
            colorSidecar: userFranchise.sideCarColor || 'B/Y',
            sidecarNumber: userFranchise.sideCarPlateNumber || '',
            plateNumber: userFranchise.mvPlateNo || '',
            chassisNumber: userFranchise.chasisNo || '',
            motorNumber: userFranchise.motorEngineNo || ''
          });
        }
      } catch (error) {
        logger.error('[RequestAmendment] Error fetching franchise data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFranchiseData();
  }, [navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent duplicate submissions
    
    // Validate privacy agreement
    if (!agreeToPrivacy) {
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Privacy Agreement Required',
        text: 'You must agree to the privacy policy before submitting your amendment request.'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get token to check user info
      const token = sessionStorage.getItem('accessToken');
      
      if (!token) {
        Swal.fire({
          ...alertStyle.errorAlert,
          title: 'Session Expired',
          text: 'Please log in again.'
        });
        setTimeout(() => navigate('/login'), 2000);
        setIsSubmitting(false);
        return;
      }
      
      // Build FormData for submission
      const formDataToSend = new FormData();
      
     let applicationType = 'amend-change_unit'; // default
      if (amendmentType === 'owner') {
        applicationType = 'amend-update_ownership';
      } else if (amendmentType === 'motor') {
        applicationType = 'amend-change_unit';
      }
      

      
      logger.log('[RequestAmendment] Submitting with applicationType:', applicationType);
      
      // Add application type
      formDataToSend.append('applicationType', applicationType);
      
      // Personal/Operator Information - ALL FIELDS
      formDataToSend.append('operatorName', formData.fullName || '');
      formDataToSend.append('operatorContactNumber', formData.contactNumber || '');
      formDataToSend.append('operatorBirthPlace', formData.birthPlace || '');
      formDataToSend.append('operatorBirthDate', formData.birthDate ? (formData.birthDate.format ? formData.birthDate.format('YYYY-MM-DD') : formData.birthDate) : '');
      formDataToSend.append('operatorAddress', formData.address || '');
      formDataToSend.append('operatorBarangay', formData.barangay || '');
      formDataToSend.append('operatorCivilStatus', formData.civilStatus || '');
      formDataToSend.append('operatorCitizenship', formData.citizenship || '');
      formDataToSend.append('todaMembership', formData.todaMembership || '');
      formDataToSend.append('coOwnerName', formData.coOwner || '');
      
      // Driver Information
      formDataToSend.append('driverName', formData.driverName || '');
      formDataToSend.append('driversAddress', formData.driverAddress || '');
      
      // Franchise Information (read from form - user can edit these)
      formDataToSend.append('orNumber', formData.orNumber || '');
      formDataToSend.append('franchiseNumber', formData.franchiseNumber || '');
      
      // Motorcycle Information - ALL FIELDS
      formDataToSend.append('unitModel', formData.make || '');
      formDataToSend.append('colorMotor', formData.colorMotor || '');
      formDataToSend.append('sideCarColor', formData.colorSidecar || 'B/Y');
      formDataToSend.append('sideCarPlateNumber', formData.sidecarNumber || '');
      formDataToSend.append('mvPlateNo', formData.plateNumber || '');
      formDataToSend.append('chasisNo', formData.chassisNumber || '');
      formDataToSend.append('motorEngineNo', formData.motorNumber || '');
      
      // Operator Picture
      if (formData.operatorPicture) {
        formDataToSend.append('operatorPictureObj', formData.operatorPicture);
      }
      
      // Add uploaded documents for owner amendment
      if (amendmentType === 'owner') {
        const uploadHelper = async (fieldName, key) => {
          if (uploads[key]) {
            formDataToSend.append(fieldName, uploads[key]);
          }
        };
        
        await uploadHelper('motorRegistrationObj', 'registration');
        await uploadHelper('barangayClearanceObj', 'barangay');
        await uploadHelper('cedulaObj', 'cedula');
        await uploadHelper('driversLicenseObj', 'license');
        await uploadHelper('votersAffidavitObj', 'affidavit');
        await uploadHelper('motorChassisStencilObj', 'stencil');
        await uploadHelper('driverPictureObj', 'picture');
        await uploadHelper('oRLTOObj', 'oRLTO');
        await uploadHelper('cRLTOObj', 'cRLTO');
      }
      
      logger.log('[RequestAmendment] Submitting amendment request...');
      logger.log('[RequestAmendment] Amendment type:', amendmentType);
      
      // Submit using the renew-amend endpoint
      const response = await franchiseAPI.createRenewAmend(formDataToSend);
      
      if (!response.data) throw new Error('No response data received');
      
      logger.log('[RequestAmendment] Amendment submitted successfully:', response.data);
      
      // Show success message
      Swal.fire({
        ...alertStyle.successAlert,
        title: 'Success!',
        text: 'Amendment request submitted successfully!'
      });
      
      // Reset form
      setFormData(INITIAL_FORM_STATE);
      setUploads({
        registration: null,
        barangay: null,
        cedula: null,
        license: null,
        affidavit: null,
        picture: null,
        stencil: null,
        oRLTO: null,
        cRLTO: null
      });
      
      // Redirect to franchisee list after 2 seconds
      setTimeout(() => {
        navigate('/operator/franchisee-list');
      }, 2000);
      
    } catch (error) {
      logger.error('[RequestAmendment] Error submitting amendment:', error);
      logger.error('[RequestAmendment] Error response:', error.response);
      
      let errorMessage = 'Failed to submit amendment request. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data) {
        errorMessage = JSON.stringify(error.response.data);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      logger.error('[RequestAmendment] Error message:', errorMessage);
      
      Swal.fire({
        ...alertStyle.errorAlert,
        title: 'Error',
        text: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
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
          
          {/* Logo Section */}
          <div className="franchise-app-logo">
            <img src="/Logos/SBLogos.png" alt="Seal" />
            <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" />
          </div>

         

          {/* Title */}
          <div className="franchise-app-title">{t.title}</div>
          
          {/* Date Field and Co-Owner Selection - Same row layout as FranchiseApplication */}
          <div className="franchise-app-grid">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label={t.date}
                  value={formData.date || dayjs()}
                  onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                  disabled
                  readOnly
                  disableFuture
                  slotProps={{ textField: { size: 'small', className: 'franchise-app-input', disabled: true } }}
                />
              </LocalizationProvider>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.95rem' }}>Do you have a Co-Owner for this Franchise?</label>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 16 }}>
                  <input
                    type="radio"
                    name="hasCoOwner"
                    value="Yes"
                    checked={formData.hasCoOwner === 'Yes'}
                    onChange={(e) => setFormData({ ...formData, hasCoOwner: e.target.value })}
                    style={{ marginRight: 8, cursor: 'pointer', width: 18, height: 18 }}
                  />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 16 }}>
                  <input
                    type="radio"
                    name="hasCoOwner"
                    value="No"
                    checked={formData.hasCoOwner === 'No'}
                    onChange={(e) => setFormData({ ...formData, hasCoOwner: e.target.value })}
                    style={{ marginRight: 8, cursor: 'pointer', width: 18, height: 18 }}
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '64px 0',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <CircularProgress size={40} />
              <div style={{ color: '#64748b', fontSize: '1rem' }}>Loading franchise information...</div>
            </div>
          )}

          {/* Form Container */}
          {!isLoading && (
            <form onSubmit={handleSubmit}>
              {/* Personal Information Section */}
              <div className="franchise-app-section">
                {t.personalInfo}
                <div className="franchise-app-section-line" />
              </div>
              <div className="franchise-app-grid">
                <TextField
                  label="NAME OF OPERATOR"
                  size="small"
                  className="franchise-app-input"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  error={!!errors.fullName}
                  helperText={errors.fullName}
                />

                <TextField
                  label="CONTACT NUMBER"
                  size="small"
                  className="franchise-app-input"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  error={!!errors.contactNumber}
                  helperText={errors.contactNumber}
                />
              </div>

              <div className="franchise-app-grid-4">
                <TextField
                  label="PLACE OF BIRTH"
                  size="small"
                  className="franchise-app-input"
                  name="birthPlace"
                  value={formData.birthPlace}
                  onChange={handleChange}
                  error={!!errors.birthPlace}
                  helperText={errors.birthPlace}
                />

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="DATE OF BIRTH"
                    value={formData.birthDate}
                    onChange={(newValue) => setFormData({ ...formData, birthDate: newValue })}
                    disableFuture
                    slotProps={{ textField: { size: 'small', className: 'franchise-app-input' } }}
                  />
                </LocalizationProvider>
              </div>

              <div className="franchise-app-grid-4">
                <FormControl size="small" className="franchise-app-input" error={!!errors.civilStatus}>
                  <InputLabel>CIVIL STATUS</InputLabel>
                  <Select
                    label="CIVIL STATUS"
                    name="civilStatus"
                    value={formData.civilStatus || ''}
                    onChange={handleChange}
                  >
                    {CIVIL_STATUS_OPTIONS.map(status => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                  {errors.civilStatus && (
                    <FormHelperText>{errors.civilStatus}</FormHelperText>
                  )}
                </FormControl>

                <TextField
                  label="CITIZENSHIP"
                  size="small"
                  className="franchise-app-input"
                  name="citizenship"
                  value={formData.citizenship}
                  onChange={handleChange}
                  error={!!errors.citizenship}
                  helperText={errors.citizenship}
                />
              </div>

              <div className="franchise-app-grid-2">
                <TextField
                  label="House No., Street, Purok/Subdivision"
                  size="small"
                  className="franchise-app-input"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  error={!!errors.address}
                  helperText={errors.address}
                />

                <FormControl size="small" className="franchise-app-input" error={!!errors.barangay}>
                  <InputLabel>Barangay</InputLabel>
                  <Select
                    label="Barangay"
                    name="barangay"
                    value={formData.barangay || ''}
                    onChange={handleChange}
                  >
                    {BARANGAYS.map((b) => (
                      <MenuItem key={b} value={b}>{b}</MenuItem>
                    ))}
                  </Select>
                  {errors.barangay && (
                    <FormHelperText>{errors.barangay}</FormHelperText>
                  )}
                </FormControl>
              </div>

              <div className="franchise-app-field">
                <TextField
                  label="TODA MEMBERSHIP"
                  size="small"
                  className="franchise-app-input"
                  name="todaMembership"
                  value={formData.todaMembership}
                  onChange={handleChange}
                  helperText="Optional - Leave blank if not applicable"
                />
              </div>

              {/* Show Co-Owner field only if "Yes" is selected */}
              {formData.hasCoOwner === 'Yes' && (
                <div className="franchise-app-field">
                  <TextField
                    label="CO-OWNER"
                    size="small"
                    className="franchise-app-input"
                    name="coOwner"
                    value={formData.coOwner}
                    onChange={handleChange}
                    error={!!errors.coOwner}
                    helperText={errors.coOwner}
                  />
                </div>
              )}

              {/* Franchise Information Section */}
              <div className="franchise-app-section" style={{ marginTop: 32 }}>
                {t.franchiseInfo}
                <div className="franchise-app-section-line" />
              </div>
              <div className="franchise-app-grid">
                <TextField
                  label={t.orNumber}
                  size="small"
                  className="franchise-app-input"
                  name="orNumber"
                  value={formData.orNumber}
                  onChange={handleChange}
                  error={!!errors.orNumber}
                  helperText={errors.orNumber}
                />

                <TextField
                  label={t.franchiseNumber}
                  size="small"
                  className="franchise-app-input"
                  name="franchiseNumber"
                  value={formData.franchiseNumber}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Auto-loaded from franchise record"
                />
              </div>

              <div className="franchise-app-grid-4">
                <TextField
                  label={t.dateApproved}
                  size="small"
                  className="franchise-app-input"
                  name="dateApproved"
                  value={formData.dateApproved}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Auto-loaded from franchise record"
                />

                <TextField
                  label={t.expiryDate}
                  size="small"
                  className="franchise-app-input"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Auto-loaded from franchise record"
                />

                <TextField
                  label={t.franchiseStatus}
                  size="small"
                  className="franchise-app-input"
                  name="franchiseStatus"
                  value={formData.franchiseStatus?.toUpperCase() || ''}
                  onChange={handleChange}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Auto-loaded from franchise record"
                />
              </div>

              {/* Motorcycle Information Section */}
              <div className="franchise-app-section" style={{ marginTop: 32 }}>
                {t.motorcycleInfo}
                <div className="franchise-app-section-line" />
              </div>

              <div className="franchise-app-field">
                <TextField
                  label="NAME OF THE DRIVER"
                  size="small"
                  className="franchise-app-input"
                  name="driverName"
                  value={formData.driverName}
                  onChange={handleChange}
                  error={!!errors.driverName}
                  helperText={errors.driverName}
                />
              </div>

              <div className="franchise-app-grid-4">
                <TextField
                  label="UNIT MODEL"
                  size="small"
                  className="franchise-app-input"
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  error={!!errors.make}
                  helperText={errors.make}
                  placeholder="e.g., Honda TMX 155"
                />

                <TextField
                  label="COLOR (MOTOR)"
                  size="small"
                  className="franchise-app-input"
                  name="colorMotor"
                  value={formData.colorMotor}
                  onChange={handleChange}
                  error={!!errors.colorMotor}
                  helperText={errors.colorMotor}
                />
              </div>

              <div className="franchise-app-grid-4">
                <TextField
                  label="COLOR (SIDECAR)"
                  size="small"
                  className="franchise-app-input"
                  name="colorSidecar"
                  value={formData.colorSidecar || "B/Y"}
                  onChange={handleChange}
                  error={!!errors.colorSidecar}
                  helperText={errors.colorSidecar || "Default: Blue and Yellow (B/Y)"}
                  placeholder="B/Y"
                />

                <TextField
                  label="MV PLATE"
                  size="small"
                  className="franchise-app-input"
                  name="plateNumber"
                  value={formData.plateNumber}
                  onChange={handleChange}
                  error={!!errors.plateNumber}
                  helperText={errors.plateNumber}
                  placeholder="e.g., ABC-1234"
                />
              </div>

              <div className="franchise-app-grid-2">
                <TextField
                  label="MOTOR/ENGINE NUMBER"
                  size="small"
                  className="franchise-app-input"
                  name="motorNumber"
                  value={formData.motorNumber}
                  onChange={handleChange}
                  error={!!errors.motorNumber}
                  helperText={errors.motorNumber}
                  placeholder="Enter motor/engine number"
                />

                <TextField
                  label="CHASSIS NUMBER"
                  size="small"
                  className="franchise-app-input"
                  name="chassisNumber"
                  value={formData.chassisNumber}
                  onChange={handleChange}
                  error={!!errors.chassisNumber}
                  helperText={errors.chassisNumber}
                  placeholder="Enter chassis number"
                />
              </div>

              <div className="franchise-app-field">
                <TextField
                  label="House No., Street, Purok/Subdivision, Barangay, Solano, Nueva Vizcaya"
                  size="small"
                  className="franchise-app-input"
                  name="driverAddress"
                  value={formData.driverAddress}
                  onChange={handleChange}
                  error={!!errors.driverAddress}
                  helperText={errors.driverAddress}
                />
              </div>

              {/* 1x1 Picture Upload for Operator */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontWeight: 700, color: '#222', fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  1X1 PICTURE OF OPERATOR
                </div>
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
                    setModalDocKey('operatorPicture');
                    setModalFile(null);
                  }}
                >
                  {formData.operatorPicture ? truncateFilename(formData.operatorPicture.name) : t.noFileSelected}
                </div>
              </div>

              {/* Documentary Requirements Section - Only for Owner Amendment */}
              {amendmentType === 'owner' && (
                <div style={{ marginTop: 32 }}>
                  <div className="franchise-app-section">
                    {t.documentaryReqs}
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2.5vw, 18px)', marginBottom: 'clamp(20px, 4vw, 32px)' }}>
                    {[
                      { key: 'registration', label: 'PHOTOCOPY OF REGISTRATION' },
                      { key: 'barangay', label: 'PHOTOCOPY OF BARANGAY CLEARANCE' },
                      { key: 'cedula', label: 'PHOTOCOPY OF CEDULA' },
                      { key: 'stencil', label: 'PHOTOCOPY OF MOTOR CHASSIS STENCIL' },
                      { key: 'license', label: "PHOTOCOPY OF DRIVER'S LICENSE" },
                      { key: 'affidavit', label: "PHOTOCOPY OF VOTER'S AFFIDAVIT" },
                      { key: 'oRLTO', label: 'OR LTO (OFFICIAL RECEIPT)' },
                      { key: 'cRLTO', label: 'CR (CERTIFICATE OF REGISTRATION)' },
                      { key: 'picture', label: '1X1 PICTURE' }
                    ].map((doc) => (
                      <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 24px)', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px', minWidth: '150px', fontWeight: 700, color: '#222', fontSize: 'clamp(14px, 2.2vw, 18px)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{doc.label}</div>
                        <div style={{ flex: '1 1 250px', minWidth: '200px', display: 'flex', alignItems: 'center' }}>
                          <div
                            style={{
                              width: '100%',
                              background: '#eaf1ff',
                              borderRadius: 8,
                              padding: 'clamp(10px, 1.5vw, 12px) clamp(8px, 1vw, 16px)',
                              textAlign: 'center',
                              fontWeight: 500,
                              color: '#222',
                              fontSize: 'clamp(14px, 2vw, 16px)',
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
                </div>
              )}

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
                    {' '}and understand that my personal information will be used for franchise amendment processing.
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

              {/* Submit Buttons - Matching FranchiseApplication style */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: 'clamp(24px, 5vw, 40px) 0 0 0', gap: 'clamp(8px, 2vw, 16px)', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  disabled={isSubmitting}
                  sx={{ 
                    bgcolor: '#174D7A', 
                    color: '#fff', 
                    fontWeight: 700, 
                    borderRadius: 2, 
                    fontSize: { xs: '20px', sm: '20px', md: '22px' },
                    px: { xs: 6, sm: 5, md: 6 },
                    py: { xs: 2.5, sm: 2.25, md: 2.5 },
                    minWidth: { xs: '100%', sm: '200px', md: '240px' },
                    minHeight: { xs: '64px', sm: '56px', md: '62px' },
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    '&:hover': {
                      bgcolor: '#0d3a5f',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(23, 77, 122, 0.3)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                  type="submit"
                >
                  {isSubmitting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CircularProgress size={18} sx={{ color: '#fff' }} />
                      Submitting...
                    </span>
                  ) : (
                    t.submitAmendment
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* File Upload Modal */}
      {modalDocKey && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: isDragging ? 'rgba(2, 132, 199, 0.15)' : 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'background 0.3s ease'
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
            <div style={{ fontWeight: 900, fontSize: '2rem', marginBottom: 12, letterSpacing: '-0.5px', color: '#0A356B' }}>{t.selectFile || 'Select a File'}</div>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '32px', color: '#666', letterSpacing: '0.3px' }}>
              {t.upload || 'Upload'} {(() => {
                const docLabels = {
                  registration: t.photoRegistration || 'Photocopy of Registration',
                  barangay: t.photoBarangay || 'Photocopy of Barangay Clearance',
                  cedula: t.photoCedula || 'Photocopy of Cedula',
                  license: t.photoLicense || "Photocopy of Driver's License",
                  affidavit: t.photoAffidavit || "Photocopy of Voter's Affidavit",
                  stencil: 'Photocopy of Motor Chassis Stencil',
                  oRLTO: 'OR LTO (Official Receipt)',
                  cRLTO: 'CR (Certificate of Registration)',
                  picture: t.picture || '1x1 Picture',
                  operatorPicture: '1x1 Picture of Operator'
                };
                return docLabels[modalDocKey] || 'Document';
              })()}
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
                  {isDragging ? 'Drop file here' : (t.browseFiles || 'Browse Files to upload')}
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
                  accept="image/*,.pdf"
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
                      animation: 'spin 1s linear infinite'
                    }}>
                      <defs>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                      </defs>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="#174D7A" strokeWidth="2" opacity="0.2" />
                      <path d="M12 2A10 10 0 1 0 22 12" fill="none" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" />
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
                    // Handle different types of files
                    if (modalDocKey === 'operatorPicture') {
                      setFormData(prev => ({ ...prev, operatorPicture: modalFile }));
                    } else {
                      setUploads(u => ({ ...u, [modalDocKey]: modalFile }));
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
    </div>
  );
}