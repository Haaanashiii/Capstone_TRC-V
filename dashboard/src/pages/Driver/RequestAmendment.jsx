import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  FormHelperText,
  CircularProgress,
  InputLabel
} from '@mui/material';
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
    stencil: null
  });

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
      motorNumber: 'MOTOR NUMBER'
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
      motorNumber: 'NUMERO NG MOTOR'
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

  // Fetch existing franchise data on component mount
  useEffect(() => {
    const fetchFranchiseData = async () => {
      try {
        setIsLoading(true);
        
        // First check if franchise data was passed via navigation state
        const passedFranchiseChainId = location.state?.franchiseChainId;
        const passedFranchise = location.state?.franchise;
        
        console.log('[RequestAmendment] Navigation state:', { 
          amendmentType: location.state?.amendmentType,
          hasPassedFranchise: !!passedFranchise,
          franchiseChainId: passedFranchiseChainId
        });
        
        // If franchise data was passed from navigation, use it as immediate fallback
        if (passedFranchise && passedFranchise.franchiseNumber) {
          console.log('[RequestAmendment] Using franchise from navigation state:', {
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
          console.log('[RequestAmendment] No token found, using passed data as final');
          setIsLoading(false);
          return;
        }

        console.log('[RequestAmendment] Fetching user data from /auth/me');
        
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
          console.error('[RequestAmendment] Failed to fetch user data:', userResponse.status);
          console.log('[RequestAmendment] Will use data from navigation state');
          setIsLoading(false);
          return;
        }

        const userData = await userResponse.json();
        console.log('[RequestAmendment] User data received:', userData);
        
        // Get franchise information from user data
        const userFranchise = userData.user?.franchise;
        
        if (!userFranchise) {
          console.warn('[RequestAmendment] No franchise found in user data');
          setIsLoading(false);
          return;
        }

        console.log('[RequestAmendment] Found franchise:', {
          franchiseChainId: userFranchise.franchiseChainId,
          franchiseNumber: userFranchise.franchiseNumber,
          operatorName: userFranchise.operatorName,
          status: userFranchise.franchiseStatus
        });

        // If we have a franchiseChainId, fetch the complete franchise history to get the latest version
        if (userFranchise.franchiseChainId) {
          try {
            console.log('[RequestAmendment] Fetching franchise chain history:', userFranchise.franchiseChainId);
            
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
              console.log('[RequestAmendment] Chain data received:', chainData);
              
              // Get the latest version (last item in the data array)
              if (chainData.data && chainData.data.length > 0) {
                const latestFranchise = chainData.data[chainData.data.length - 1];
                
                console.log('[RequestAmendment] Latest franchise version:', {
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
                
                console.log('[RequestAmendment] Form populated successfully');
              }
            } else {
              console.warn('[RequestAmendment] Failed to fetch franchise chain:', chainResponse.status);
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
            console.error('[RequestAmendment] Error fetching franchise chain:', chainError);
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
        console.error('[RequestAmendment] Error fetching franchise data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFranchiseData();
  }, [navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent duplicate submissions
    
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
      
      // Determine application type based on amendment type
      let applicationType = 'renewal'; // default
      if (amendmentType === 'owner') {
        applicationType = 'update_ownership';
      } else if (amendmentType === 'motor') {
        applicationType = 'change_unit';
      }
      
      console.log('[RequestAmendment] Submitting with applicationType:', applicationType);
      
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
      }
      
      console.log('[RequestAmendment] Submitting amendment request...');
      console.log('[RequestAmendment] Amendment type:', amendmentType);
      
      // Submit using the renew-amend endpoint
      const response = await franchiseAPI.createRenewAmend(formDataToSend);
      
      if (!response.data) throw new Error('No response data received');
      
      console.log('[RequestAmendment] Amendment submitted successfully:', response.data);
      
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
        stencil: null
      });
      
      // Redirect to franchisee list after 2 seconds
      setTimeout(() => {
        navigate('/operator/franchisee-list');
      }, 2000);
      
    } catch (error) {
      console.error('[RequestAmendment] Error submitting amendment:', error);
      console.error('[RequestAmendment] Error response:', error.response);
      
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
      
      console.error('[RequestAmendment] Error message:', errorMessage);
      
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
            <img src="/public/Logos/SBLogo.png" alt="Seal" />
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" />
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
                          setFormData({ ...formData, operatorPicture: processedFile });
                          Swal.fire({
                            ...alertStyle.successAlert,
                            title: 'Success!',
                            text: 'Picture uploaded successfully'
                          });
                        } catch {
                          setFormData({ ...formData, operatorPicture: file });
                          Swal.fire({
                            ...alertStyle.successAlert,
                            title: 'Success!',
                            text: 'Picture uploaded'
                          });
                        }
                      }
                    };
                    input.click();
                  }}
                >
                  {formData.operatorPicture ? formData.operatorPicture.name : 'No selected File - Click to upload'}
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
                            onClick={() => document.getElementById(`file-${doc.key}`).click()}
                          >
                            {uploads[doc.key] ? uploads[doc.key].name : t.noFileSelected}
                            <input
                              id={`file-${doc.key}`}
                              type="file"
                              hidden
                              accept="image/*,.pdf"
                              onChange={async (e) => {
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
                                    setUploads({ ...uploads, [doc.key]: processedFile });
                                    Swal.fire({
                                      ...alertStyle.successAlert,
                                      title: 'Success!',
                                      text: 'File uploaded successfully'
                                    });
                                  } catch {
                                    setUploads({ ...uploads, [doc.key]: file });
                                    Swal.fire({
                                      ...alertStyle.successAlert,
                                      title: 'Success!',
                                      text: 'File uploaded'
                                    });
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
    </div>
  );
}