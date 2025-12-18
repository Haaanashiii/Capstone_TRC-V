/**
 * Franchise Management Constants
 */

/** Application type constants */
export const APPLICATION_TYPES = Object.freeze({
  NEW: 'new',
  RENEWAL: 'renewal',
  CHANGE_UNIT: 'change-unit',
  UPDATE_OWNERSHIP: 'update-ownership',
})

/** Human-readable labels for application types (including backend variations) */
export const APPLICATION_TYPE_LABELS = Object.freeze({
  [APPLICATION_TYPES.NEW]: 'New',
  [APPLICATION_TYPES.RENEWAL]: 'Renewal',
  [APPLICATION_TYPES.CHANGE_UNIT]: 'Change Unit',
  [APPLICATION_TYPES.UPDATE_OWNERSHIP]: 'Update Ownership',
  // Backend variations with underscores
  change_unit: 'Change Unit',
  update_ownership: 'Update Ownership',
  // Amendment variations
  'amend-change_unit': 'Amendment - Change Unit',
  'amend-update_ownership': 'Amendment - Update Ownership',
})

/** CSS class mapping for application type badges */
export const APPLICATION_TYPE_CLASS_MAP = Object.freeze({
  [APPLICATION_TYPES.NEW]: 'status-new',
  new: 'status-new',
  [APPLICATION_TYPES.RENEWAL]: 'status-active',
  renewal: 'status-active',
  [APPLICATION_TYPES.CHANGE_UNIT]: 'status-investigating',
  change_unit: 'status-investigating',
  'change-unit': 'status-investigating',
  [APPLICATION_TYPES.UPDATE_OWNERSHIP]: 'status-warning',
  update_ownership: 'status-warning',
  'update-ownership': 'status-warning',
  'amend-change_unit': 'status-amend-change-unit',
  'amend-update_ownership': 'status-amend-update-ownership',
})

/** Supported image file extensions */
export const IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])

/** Image file extension regex */
export const IMAGE_REGEX = /\.(jpg|jpeg|png|gif|webp)$/i

/** Document fields config for view modal */
export const DOCUMENT_FIELDS = Object.freeze([
  { key: 'documentRegistration', label: 'Registration' },
  { key: 'documentBarangayClearance', label: 'Barangay Clearance' },
  { key: 'documentCedula', label: 'Cedula' },
  { key: 'documentDriversLicense', label: "Driver's License" },
  { key: 'documentVotersAffidavit', label: "Voter's Affidavit" },
  { key: 'documentChassisStencil', label: 'Chassis Stencil' },
  { key: 'documentPicture', label: 'Driver Picture' },
  { key: 'documentOperatorPicture', label: 'Operator Picture' },
  { key: 'documentORLTO', label: 'OR LTO' },
  { key: 'documentCRLTO', label: 'CR LTO' },
])

/** Barangay list */
export const BARANGAY_LIST = Object.freeze([
  'Aggub', 'Bagahabag', 'Bangaan', 'Bangar', 'Bascaran', 'Communal',
  'Concepcion', 'Curifang', 'Dadap', 'Lactawan', 'Osmeña', 'Pilar D. Galima',
  'Poblacion North', 'Poblacion South', 'Quezon', 'Quirino', 'Roxas',
  'San Juan', 'San Luis', 'Tucal', 'Uddiawan', 'Wacal',
])

/** Civil status options */
export const CIVIL_STATUS_OPTIONS = Object.freeze(['Single', 'Married', 'Widowed', 'Separated'])

/** Status display config for modal Chip */
export const MODAL_STATUS_CONFIG = Object.freeze({
  pending: { label: 'Pending Review', color: 'default' },
  'bplo-approved': { label: 'BPLO Approved - Awaiting OR', color: 'info' },
  'bplo-disapproved': { label: 'BPLO Disapproved', color: 'error' },
  'awaiting-sb': { label: 'Awaiting SB Approval', color: 'primary' },
  'sb-approved': { label: 'Finally Approved', color: 'success' },
  completed: { label: 'Completed - Franchise Created', color: 'success' },
})

/** Modal backdrop styling */
export const MODAL_BACKDROP_PROPS = Object.freeze({
  sx: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(3px)',
  },
})

/** Scrollbar styling */
export const SCROLLBAR_STYLES = Object.freeze({
  '&::-webkit-scrollbar': { width: '8px' },
  '&::-webkit-scrollbar-track': { background: '#F1F5F9' },
  '&::-webkit-scrollbar-thumb': {
    background: '#CBD5E1',
    borderRadius: '4px',
    '&:hover': { background: '#94A3B8' },
  },
})

/** Section header styling */
export const SECTION_HEADER_STYLES = Object.freeze({
  fontWeight: 700,
  color: '#0A356B',
  mb: 2,
  pb: 1,
  borderBottom: '3px solid #0A356B',
  fontSize: '1.1rem',
  letterSpacing: '0.5px',
})

/** Default form data */
export const INITIAL_FORM_DATA = Object.freeze({
  date: new Date().toISOString().slice(0, 10),
  sidecarPlateNumber: '',
  name: '',
  contactNumber: '',
  operatorEmail: '',
  address: '',
  barangay: '',
  birthPlace: '',
  birthDate: '',
  civilStatus: '',
  citizenship: '',
  todaMembership: '',
  unitModel: '',
  colorMotor: '',
  colorSidecar: 'Blue and Yellow',
  mvPlate: '',
  motorEngineNumber: '',
  chassisNumber: '',
  driverName: '',
  driverAddress: '',
  documentRegistration: null,
  documentBarangayClearance: null,
  documentCedula: null,
  documentDriversLicense: null,
  documentVotersAffidavit: null,
  documentMotorChassisStencil: null,
  documentOrLTO: null,
  documentCR: null,
  documentPicture: null,
  documentOperatorPicture: null,
  officialReceiptNumber: '',
  documentOfficialReceipt: null,
})

/** Get fresh form data with current date */
export const getFreshFormData = () => ({
  ...INITIAL_FORM_DATA,
  date: new Date().toISOString().slice(0, 10),
})
