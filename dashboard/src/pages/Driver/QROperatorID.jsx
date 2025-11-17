import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import api from '../Services/api';

function QROperatorID() {
  const { operatorId } = useParams(); // This is now the hashedMTOP
  const [operatorData, setOperatorData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFareMatrixModal, setShowFareMatrixModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOperatorData = async () => {
      try {
        setLoading(true);
        // Use the new hashed MTOP endpoint for QR lookups
        const response = await api.get(`/franchise-information/qr/hash/${operatorId}`);
        setOperatorData(response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching franchise data:", error);
        
        // Handle rate limit errors specifically
        if (error.response?.status === 429) {
          const errorData = error.response.data;
          if (errorData.code === 'QR_ID_RATE_LIMIT_EXCEEDED') {
            setError(`This QR code has been scanned too frequently. Please wait ${errorData.retryAfter} seconds before scanning again.`);
          } else if (errorData.code === 'QR_IP_RATE_LIMIT_EXCEEDED') {
            setError('Too many QR code scans from your device. Please wait a moment before trying again.');
          } else {
            setError('Rate limit exceeded. Please try again later.');
          }
        } else {
          setError(error.response?.data?.error || error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    if (operatorId) {
      // Hide the hashed MTOP from the URL IMMEDIATELY before fetching data
      window.history.replaceState(null, 'TRC-V Operator Verification', '/');
      
      fetchOperatorData();
    }
  }, [operatorId]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center">
        <div className="text-xl font-semibold text-white">Loading...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center p-4">
        <div className="max-w-md p-8 text-center bg-white shadow-2xl rounded-2xl">
          <div className="mb-4 text-5xl text-red-500">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Error Loading Data</h2>
          <p className="mb-4 text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[#1B4B75] hover:bg-[#143c6e] text-white font-semibold px-6 py-2 rounded-lg transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show "not found" state
  if (!operatorData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center p-4">
        <div className="max-w-md p-8 text-center bg-white shadow-2xl rounded-2xl">
          <div className="mb-4 text-5xl text-gray-400">🔍</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Operator Not Found</h2>
          <p className="text-gray-600">This QR code may be invalid or the operator record does not exist.</p>
        </div>
      </div>
    );
  }

  // Use actual operator data
  const displayData = operatorData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="bg-[#1B4B75] rounded-t-3xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Logos/SBLogo.png" alt="SB Logo" className="object-contain w-12 h-12" />
            <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="object-contain w-12 h-12" />
          </div>
          <div className="text-right">
            <h1 className="text-sm font-bold leading-tight text-white">OPERATOR'S</h1>
            <h2 className="text-sm font-bold leading-tight text-white">IDENTIFICATION</h2>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 bg-white shadow-2xl rounded-b-3xl">
          {/* Profile Photo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 overflow-hidden border-4 border-gray-200 rounded-full shadow-lg">
                <img 
                  src={displayData.profilePhoto || "/default-avatar.png"} 
                  alt="Operator" 
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          </div>

          {/* ID Number */}
          <div className="flex justify-center mb-6">
            <div className="bg-[#1B4B75] text-white font-bold px-6 py-2 rounded-lg text-lg">
              ID NO: {displayData.driversID}
            </div>
          </div>

          {/* Operator Name */}
          <h3 className="mb-2 text-2xl font-bold text-center text-gray-900">
            {`${displayData.firstName} ${displayData.middleName} ${displayData.lastName}${displayData.suffix ? ' ' + displayData.suffix : ''}`.trim()}
          </h3>

          {/* Address */}
          <p className="mb-6 text-sm text-center text-gray-600">
            {displayData.address}, Brgy. {displayData.barangay}
          </p>

          {/* Franchise Status Badge - Conditional Display */}
          <div className="flex justify-center gap-3 mb-6">
            {displayData.franchiseStatus === 'expired' ? (
              <span className="px-4 py-2 text-xs font-bold text-red-700 bg-red-100 border-2 border-red-300 rounded-md">
                EXPIRED FRANCHISE
              </span>
            ) : (
              <span className="px-4 py-2 text-xs font-bold text-green-700 bg-green-100 border-2 border-green-300 rounded-md">
                ACTIVE FRANCHISE
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3">
            <button 
              onClick={() => setShowReportModal(true)}
              className="bg-[#F4D35E] hover:bg-[#e6c44d] text-gray-900 font-bold px-6 py-3 rounded-lg text-sm transition-all shadow-md hover:shadow-lg"
            >
              REPORT OVERPRICING
            </button>
            <button 
              onClick={() => setShowFareMatrixModal(true)}
              className="bg-[#F4D35E] hover:bg-[#e6c44d] text-gray-900 font-bold px-6 py-3 rounded-lg text-sm transition-all shadow-md hover:shadow-lg"
            >
              VIEW FARE MATRIX
            </button>
          </div>
        </div>
      </div>

      {/* Report Overpricing Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Report Overpricing</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-gray-600">
              Please provide details about the overpricing incident.
            </p>
            <textarea 
              className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:border-[#1B4B75]" 
              rows="4"
              placeholder="Describe the incident..."
            ></textarea>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2 font-semibold text-gray-800 transition-all bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button 
                className="flex-1 bg-[#1B4B75] hover:bg-[#143c6e] text-white font-semibold py-2 rounded-lg transition-all"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fare Matrix Modal */}
      {showFareMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Fare Matrix</h3>
              <button 
                onClick={() => setShowFareMatrixModal(false)}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Base Fare (First 4km)</span>
                  <span className="font-bold text-[#1B4B75]">₱15.00</span>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Additional per km</span>
                  <span className="font-bold text-[#1B4B75]">₱2.50</span>
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Night Surcharge (10PM-5AM)</span>
                  <span className="font-bold text-[#1B4B75]">+₱5.00</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowFareMatrixModal(false)}
              className="w-full mt-6 bg-[#1B4B75] hover:bg-[#143c6e] text-white font-semibold py-3 rounded-lg transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QROperatorID;
