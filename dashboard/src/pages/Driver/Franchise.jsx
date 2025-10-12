import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar";
import "../../Styles/Operator's_CSS/Franchise.css";

const navLinks = [
  { label: "HOME", href: "/" },
  { label: "MY FRANCHISE", href: "/driver/franchise" },
];

const Franchise = () => {
  const [showModal, setShowModal] = useState(false);
  const [orNumber, setOrNumber] = useState("");
  const [mtopFile, setMtopFile] = useState(null);
  const [orWarning, setOrWarning] = useState("");
  const navigate = useNavigate();

  return (
    <div className="franchise-bg">
      <Sidebar />

      {/* Card section yah */}
      <div className="franchise-card-wrapper">
        <div className="franchise-card-centered">
          <div className="franchise-profile-img-outer-centered">
            <img src="/Logos/Tricy (2).png" alt="Profile" className="franchise-profile-img" />
          </div>
          <div className="franchise-card-content-centered">
            <div className="franchise-card-name-centered">USER</div>
            <div className="franchise-card-status-centered">NO FRANCHISE</div>
            <div className="franchise-card-title-centered">FRANCHISE APPLICATION</div>
            <div className="franchise-card-subtitle-centered">Do you already have a franchise with us?</div>
            <div className="franchise-btn-group-centered">
              <button
                className="franchise-btn-centered"
                onClick={() => setShowModal(true)}
              >
                Yes, Link my franchise
              </button>
              <button
                className="franchise-btn-centered"
                onClick={() => navigate("/driver/franchise/application")}
              >
                No, apply for a new franchise
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="franchise-modal-bg">
          <div className="franchise-modal">
            <div className="franchise-modal-title">Franchise Link</div>
            <div className="franchise-modal-desc">Link your existing franchise to TRC-V for easy management of tricycle franchise</div>
            <div style={{ marginBottom: 18 }}>
              <label className="franchise-modal-label">O.R. Number</label>
              <input
                type="text"
                value={orNumber}
                onChange={e => {
                  const val = e.target.value;
                  if (/[^0-9]/.test(val)) {
                    setOrWarning("Numbers only are accepted");
                  } else {
                    setOrWarning("");
                  }
                  setOrNumber(val.replace(/[^0-9]/g, ""));
                }}
                className="franchise-modal-input"
                placeholder="Enter O.R. Number"
              />
              {orWarning && (
                <div style={{ color: '#b71c1c', fontWeight: 'bold', marginTop: '4px', fontSize: '14px', fontFamily: 'Poppins, sans-serif' }}>
                  <span style={{ marginRight: '6px' }}>⚠️</span>{orWarning}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label className="franchise-modal-label">Upload MTOP Document</label>
              <div className="franchise-upload-box">
                <label htmlFor="mtop-upload" className="franchise-upload-label">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="franchise-upload-icon">
                      <svg width="32" height="32" fill="#F5D76E" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#F5D76E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" stroke="#174D7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span className="franchise-upload-text">Browse Files to upload</span>
                  </div>
                  <input
                    id="mtop-upload"
                    type="file"
                    style={{ display: "none" }}
                    onChange={e => setMtopFile(e.target.files[0])}
                  />
                </label>
                <div className="franchise-upload-filename">
                  {mtopFile ? mtopFile.name : "No selected File -"}
                </div>
              </div>
            </div>
            <div className="franchise-modal-actions">
              <button
                className="franchise-cancel-btn"
                onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className="franchise-submit-btn"
                onClick={() => {/* handle submit logic here */}}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Franchise;
