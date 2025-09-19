import React, { useState, useRef } from "react";
import Sidebar from "./sidebar";
import { TextField, Button } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "./FranchiseApplication.css";

export default function FranchiseApplication() {
  // Digital signature upload state and handler
  const [digitalSignature, setDigitalSignature] = useState(null);
  const digitalSignatureRef = useRef();
  const handleDigitalSignatureChange = (e) => {
    setDigitalSignature(e.target.files[0]);
  };
  // Modal state for document upload (dynamic per document)
  const [modalDocKey, setModalDocKey] = useState(null); // null or one of the doc keys
  const [modalFile, setModalFile] = useState(null);
  const modalFileRef = useRef();

  // Handler for modal file upload (modal)
  const handleModalFileChange = (e) => {
    setModalFile(e.target.files[0]);
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
  });


  const handleChange = (field) => (e) => {
    setFields({ ...fields, [field]: e.target.value });
  };

  // State for each document upload
  const [uploads, setUploads] = useState({
    registration: null,
    barangay: null,
    cedula: null,
    license: null,
    affidavit: null,
    picture: null,
  });

  // Handlers for file input (main form)
  const handleFileChange = (key) => (e) => {
    setUploads({ ...uploads, [key]: e.target.files[0] });
  };

  // Refs for file inputs
  const fileRefs = {
    registration: useRef(),
    barangay: useRef(),
    cedula: useRef(),
    license: useRef(),
    affidavit: useRef(),
    picture: useRef(),
  };

  return (
    <div>

      <Sidebar />
      {/* Main Content */}
      <div className="franchise-app-bg">
        <div className="franchise-app-paper">
        {/* Upload Modal (Dynamic per document) */}
        {modalDocKey && (
          <div className="franchise-modal-bg">
            <div className="franchise-modal" style={{ maxWidth: 480, borderRadius: 18, background: '#fff', boxShadow: '0 4px 24px #0002', padding: 36, position: 'relative' }}>
              <div style={{ fontWeight: 900, fontSize: '2.2rem', marginBottom: 8, letterSpacing: 0.5 }}>Select a File</div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 24, color: '#111' }}>
                Upload {[
                  { key: 'registration', label: 'Photocopy of Registration' },
                  { key: 'barangay', label: 'Photocopy of Barangay Clearance' },
                  { key: 'cedula', label: 'Photocopy of Cedula' },
                  { key: 'license', label: "Photocopy of Driver's License" },
                  { key: 'affidavit', label: "Photocopy of Voter's Affidavit" },
                  { key: 'picture', label: '1x1 Picture' },
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
                  <div style={{ color: '#174D7A', fontWeight: 600, fontSize: 17 }}>Browse Files to upload</div>
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={modalFileRef}
                    onChange={handleModalFileChange}
                  />
                </div>
                <div style={{ background: '#eaf1ff', borderRadius: 8, padding: '12px 0', textAlign: 'center', fontWeight: 500, color: '#222', fontSize: 16, marginTop: 4 }}>
                  {modalFile ? modalFile.name : 'No selected File -'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  className="franchise-cancel-btn"
                  style={{ background: '#f3f3f3', color: '#174D7A', fontWeight: 700, borderRadius: 8, padding: '10px 32px', fontSize: 18, border: 'none', boxShadow: '0 2px 8px #0001', cursor: 'pointer' }}
                  onClick={() => { setModalDocKey(null); setModalFile(null); }}
                >
                  Cancel
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
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
          <div className="franchise-app-logo">
            <img src="/public/Logos/SBLogo.png" alt="Seal" />
            <img src="/public/Logos/TRC-vLogo.png" alt="TRC-V Logo" />
          </div>
          <div className="franchise-app-title">FRANCHISE APPLICATION</div>
          <div className="franchise-app-date-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontWeight: 700, marginBottom: 4 }}>DATE</label>
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
              <label style={{ fontWeight: 700, marginBottom: 4 }}>SIDECAR PLATE NUMBER</label>
              <TextField size="small" className="franchise-app-input" value={fields.sidecarPlate} onChange={handleChange('sidecarPlate')} />
            </div>
          </div>
          <div className="franchise-app-section">
            PERSONAL INFORMATION
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-grid">
            <TextField label="NAME OF OPERATOR" size="small" className="franchise-app-input" value={fields.operatorName} onChange={handleChange('operatorName')} />
            <TextField label="CONTACT NUMBER" size="small" className="franchise-app-input" value={fields.contact} onChange={handleChange('contact')} />
          </div>
          <div className="franchise-app-grid-4">
            <TextField label="BIRTH PLACE" size="small" className="franchise-app-input" value={fields.birthPlace} onChange={handleChange('birthPlace')} />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="BIRTH DATE"
                value={fields.birthDate}
                onChange={(newValue) => setFields({ ...fields, birthDate: newValue })}
                disableFuture
                slotProps={{ textField: { size: 'small', className: 'franchise-app-input' } }}
              />
            </LocalizationProvider>
            <TextField label="CIVIL STATUS" size="small" className="franchise-app-input" value={fields.civilStatus} onChange={handleChange('civilStatus')} />
            <TextField label="CITIZENSHIP" size="small" className="franchise-app-input" value={fields.citizenship} onChange={handleChange('citizenship')} />
          </div>
          <div className="franchise-app-field">
            <TextField label="TODA MEMBERSHIP" size="small" className="franchise-app-input" value={fields.todaMembership} onChange={handleChange('todaMembership')} />
          </div>
          {/* Motorcycle Information Section */}
          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            MOTORCYCLE INFORMATION
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-grid-4">
            <TextField label="UNIT MODEL" size="small" className="franchise-app-input" />
            <TextField label="COLOR (MOTOR)" size="small" className="franchise-app-input" />
            <TextField label="COLOR (SIDECAR)" size="small" className="franchise-app-input" />
            <TextField label="MV PLATE" size="small" className="franchise-app-input" />
          </div>
          <div className="franchise-app-grid-2">
            <TextField label="MOTOR/ENGINE NUMBER" size="small" className="franchise-app-input" />
            <TextField label="CHASSIS NUMBER" size="small" className="franchise-app-input" />
          </div>
          <div className="franchise-app-grid-2">
            <TextField label="NAME OF THE DRIVER" size="small" className="franchise-app-input" />
            <TextField label="ADDRESS OF THE DRIVER" size="small" className="franchise-app-input" />
          </div>


    
          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            DOCUMENTARY REQUIREMENTS
            <div className="franchise-app-section-line" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontStyle: 'italic', marginBottom: 8 }}>
              Please upload clear scanned copies or photos of the following documents.
            </p>
            <ul style={{ marginLeft: 24 }}>
              <li>Accepted formats: JPG, PNG, or PDF</li>
              <li>Maximum file size: 5MB per file</li>
              <li>All documents must be valid, complete, and readable</li>
              <li>Incomplete submissions will not be processed.</li>
            </ul>
          </div>
      
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: '#222', fontSize: 16, marginBottom: 2 }}>
              <div style={{ flex: 2 }}></div>
              <div style={{ flex: 2 }}></div>
            </div>

            {[
              { key: 'registration', label: 'PHOTOCOPY OF REGISTRATION' },
              { key: 'barangay', label: 'PHOTOCOPY OF BARANGAY CLEARANCE' },
              { key: 'cedula', label: 'PHOTOCOPY OF CEDULA' },
              { key: 'license', label: "PHOTOCOPY OF DRIVER'S LICENSE" },
              { key: 'affidavit', label: "PHOTOCOPY OF VOTER'S AFFIDAVIT" },
              { key: 'picture', label: '1X1 PICTURE' },
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
                    {uploads[doc.key] ? uploads[doc.key].name : 'No selected File -'}
                  </div>
                </div>
              </div>
            ))}
          </div>
               <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '32px 0 0 0' }}>
              <Button
                variant="contained"
                sx={{ bgcolor: '#174D7A', color: '#fff', fontWeight: 700, borderRadius: 2, fontSize: 18, px: 4, py: 1 }}
                onClick={() => {/* handle submit logic here */}}
              >
                Submit Application
              </Button>
            </div>

          {/* Sworn Statement Section */}
          <div className="franchise-app-section" style={{ marginTop: 32 }}>
            SWORN STATEMENT OF APPLICANT'S UNDERTAKINGS
            <div className="franchise-app-section-line" />
          </div>
          <div className="franchise-app-sworn-statement">
            <p>I declare that I shall conform to the conditions relevant to the operation of my tricycle-for-hire such as:</p>
            <ol style={{ marginLeft: 24 }}>
              <li>Submit myself including my tricycle unit to obey and to abide faithfully the TRICYCLE CODE OF SOLANO, other existing laws and ordinances relevant to motorized tricycle-for-hire;</li>
              <li>I shall pay without delay my corresponding taxes and fees, and submit all necessary documentary requirements;</li>
              <li>Notify the Tricycle Regulatory Unit any change, transfer and cessation of my tricycle operations;</li>
              <li>Any violation on my part or on the part of my driver herein stipulated conditions shall be sufficient cause for the revocation of my Franchise/Permit or any penalty may be imposed by the Solano Tricycle Franchising and Regulatory (STFRB)</li>
            </ol>
            <p>In compliance, thereof, I voluntarily affixed my signature,</p>
            <div className="franchise-app-digital-signature">
                <div className="franchise-app-digital-signature" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                  <div style={{ width: 340 }}>
                    <div
                      style={{
                        width: '100%',
                        height: 100,
                        background: '#ddd',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 18,
                        color: '#222',
                        cursor: 'pointer',
                        border: 'none',
                        marginBottom: 8,
                      }}
                      onClick={() => digitalSignatureRef.current && digitalSignatureRef.current.click()}
                    >
                      DIGITAL SIGNATURE
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        ref={digitalSignatureRef}
                        onChange={handleDigitalSignatureChange}
                      />
                    </div>
                    {digitalSignature && (
                      <div style={{ background: '#eaf1ff', borderRadius: 8, padding: '8px 0', textAlign: 'center', fontWeight: 500, color: '#222', fontSize: 15 }}>
                        {digitalSignature.name}
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
