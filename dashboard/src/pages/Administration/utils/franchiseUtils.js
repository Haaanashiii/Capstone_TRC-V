/**
 * Franchise Management Utility Functions
 */

import { API_BASE_URL } from '../../Services/api'
import {
  IMAGE_EXTENSIONS,
  IMAGE_REGEX,
  APPLICATION_TYPE_CLASS_MAP,
  APPLICATION_TYPE_LABELS,
} from '../constants/franchiseConstants'

/** Trigger file download via temporary anchor element */
export const triggerFileDownload = (href, filename) => {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Format date to locale string or return fallback */
export const formatDate = (date, fallback = 'N/A') => {
  if (!date) return fallback
  try {
    return new Date(date).toLocaleString()
  } catch {
    return fallback
  }
}

/** Get CSS class for application type badge */
export const getApplicationTypeClass = (applicationType) =>
  APPLICATION_TYPE_CLASS_MAP[applicationType] ?? 'status-default'

/** Check if file is an image */
export const isImageFile = (file) => 
  file?.type?.includes('image') || IMAGE_REGEX.test(file?.name || '')

/** Check if file is a PDF */
export const isPdfFile = (file) => 
  file?.type?.includes('pdf') || file?.name?.toLowerCase().endsWith('.pdf')

/** Determine file type from URL extension */
export const getFileTypeFromUrl = (url) => {
  if (!url || typeof url !== 'string') return 'unknown'
  
  const ext = url.split('.').pop()?.toLowerCase() ?? ''
  
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'document'
}

/** Remove trailing slash from URL */
export const sanitizeBaseUrl = (baseUrl) => baseUrl.replace(/\/$/, '')

/** Convert gridfs:// URL to HTTP URL */
export const convertGridFSUrl = (url) => {
  if (!url || typeof url !== 'string') return url
  
  const baseUrl = sanitizeBaseUrl(API_BASE_URL)
  
  if (url.startsWith('gridfs://')) {
    const fileId = url.substring(9) // Remove 'gridfs://' prefix
    return `${baseUrl}/api/files/${fileId}`
  }
  
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`
  }
  
  return url
}

/** Normalize document from backend to frontend format */
export const normalizeDocument = (doc, fallbackName = 'Document') => {
  if (!doc) return null
  
  // Enriched format: {url, displayName, type, ...}
  if (typeof doc === 'object' && doc.url) {
    return {
      name: doc.displayName || fallbackName,
      path: convertGridFSUrl(doc.url),
      type: doc.type || 'application/octet-stream',
      documentType: doc.documentType ?? null,
      uploadedAt: doc.uploadedAt ?? null,
      fileSize: doc.fileSize ?? null,
    }
  }
  
  // Legacy string format
  if (typeof doc === 'string') {
    return {
      name: fallbackName,
      path: convertGridFSUrl(doc),
      type: getFileTypeFromUrl(doc),
    }
  }
  
  return null
}

/** Normalize application from backend to frontend format */
export const normalizeApplication = (it) => ({
  id: it.id || it._id,
  franchiseNumber: it.franchiseNumber || '',
  name: it.operatorName || it.driverName || '',
  make: it.unitModel || '',
  plateNumber: it.mvPlateNo || it.mvPlate || '',
  // Backend might store as either applicationType or changeType
  applicationType: it.applicationType || it.changeType || 'new',
  address: it.operatorAddress || '',
  barangay: it.operatorBarangay || '',
  contactNumber: it.operatorContactNumber || '',
  email: it.operatorEmail || '',
  coOwnerName: it.coOwnerName || '',
  coOwnerAddress: it.coOwnerAddress || '',
  sidecarPlateNumber: it.sideCarPlateNumber || '',
  birthPlace: it.operatorBirthPlace || '',
  birthDate: it.operatorBirthDate 
    ? new Date(it.operatorBirthDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) 
    : '',
  civilStatus: it.operatorCivilStatus || '',
  citizenship: it.operatorCitizenship || '',
  todaMembership: it.todaMembership || '',
  unitModel: it.unitModel || '',
  colorMotor: it.colorMotor || '',
  colorSidecar: it.sideCarColor || '',
  mvPlate: it.mvPlateNo || '',
  motorEngineNumber: it.motorEngineNo || '',
  chassisNumber: it.chasisNo || '',
  driverName: it.driverName || '',
  driverAddress: it.driversAddress || '',
  statusOfBPLO: it.statusOfBPLO || 'pending',
  submittedAt: it.submittedAt ? new Date(it.submittedAt).toLocaleDateString() : '',
  // OR and approval information (for SB admins)
  officialReceiptNumber: it.officialReceiptNumber || '',
  orSubmittedAt: it.orSubmittedAt ? new Date(it.orSubmittedAt).toLocaleDateString() : '',
  bploApprovedBy: it.bploApprovedBy || '',
  bploApprovedAt: it.bploApprovedAt || '',
  bploInspectionRequired: it.bploInspectionRequired || false,
  bploDisapprovedReason: it.bploDisapprovedReason || '',
  sbApprovedBy: it.sbApprovedBy || '',
  sbApprovedAt: it.sbApprovedAt || '',
  sbResolutionNumber: it.sbResolutionNumber || '',
  sbResolutionDocument: it.sbResolutionDocument || '',
  // Documents - backend now returns enriched objects with {url, displayName, type, ...}
  // Using normalizeDocument handles both new format and legacy string format
  // Try both Obj suffix and without suffix for backwards compatibility
  documentRegistration: normalizeDocument(it.documents?.motorRegistrationObj || it.documents?.motorRegistration, 'Motor Registration'),
  documentBarangayClearance: normalizeDocument(it.documents?.barangayClearanceObj || it.documents?.barangayClearance, 'Barangay Clearance'),
  documentCedula: normalizeDocument(it.documents?.cedulaObj || it.documents?.cedula, 'Cedula'),
  documentDriversLicense: normalizeDocument(it.documents?.driversLicenseObj || it.documents?.driversLicense, "Driver's License"),
  documentVotersAffidavit: normalizeDocument(it.documents?.votersAffidavitObj || it.documents?.votersAffidavit, "Voter's Affidavit"),
  documentChassisStencil: normalizeDocument(it.documents?.motorChassisStencilObj || it.documents?.motorChassisStencil, 'Chassis Stencil'),
  documentPicture: normalizeDocument(it.documents?.driverPictureObj || it.documents?.driverPicture, 'Driver Picture'),
  documentOperatorPicture: normalizeDocument(it.documents?.operatorPictureObj || it.documents?.operatorPicture, 'Operator Picture'),
  documentORLTO: normalizeDocument(it.documents?.oRLTOObj || it.documents?.oRLTO, 'OR LTO'),
  documentCRLTO: normalizeDocument(it.documents?.cRLTOObj || it.documents?.cRLTO, 'CR LTO'),
  documents: {
    ...it.documents,
    oRTreasurerOfficeObj: it.documents?.oRTreasurerOfficeObj ?? null,
  },
  qrCode: it.qrCode ?? null,
})

/** Get application type label */
export const getApplicationTypeLabel = (applicationType) =>
  APPLICATION_TYPE_LABELS[applicationType] || applicationType || 'Unknown'
