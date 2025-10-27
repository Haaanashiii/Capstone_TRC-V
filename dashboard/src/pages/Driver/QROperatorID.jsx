import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import api from '../Services/api';

function QROperatorID() {
  const { operatorId } = useParams();
  const [operatorData, setOperatorData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFareMatrixModal, setShowFareMatrixModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOperatorData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/operators/${operatorId}`);
        setOperatorData(response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching operator data:", error);
        
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
      // Hide the operator ID from the URL IMMEDIATELY before fetching data
      window.history.replaceState(null, 'TRC-V Operator Verification', '/');
      
      fetchOperatorData();
    }
  }, [operatorId]);

  // Temporarily disabled for testing - show UI even with errors
  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center">
  //       <div className="text-white text-xl font-semibold">Loading...</div>
  //     </div>
  //   );
  // }

  // if (error) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center p-4">
  //       <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
  //         <div className="text-red-500 text-5xl mb-4">⚠️</div>
  //         <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
  //         <p className="text-gray-600 mb-4">{error}</p>
  //         <button 
  //           onClick={() => window.location.reload()} 
  //           className="bg-[#1B4B75] hover:bg-[#143c6e] text-white font-semibold px-6 py-2 rounded-lg transition-all"
  //         >
  //           Try Again
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  // if (!operatorData) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center">
  //       <div className="text-white text-xl font-semibold">No data found</div>
  //     </div>
  //   );
  // }

  // Use mock data if no operator data loaded (for testing)
  const displayData = operatorData || {
    driversID: "DRV-XXXX-XXX",
    firstName: "Sample",
    middleName: "Test",
    lastName: "Operator",
    suffix: "",
    address: "Sample Address",
    barangay: "Sample Barangay",
    profilePhoto: null,
    franchiseStatus: "active"
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B4B75] to-[#083d77] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="bg-[#1B4B75] rounded-t-3xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Logos/SBLogo.png" alt="SB Logo" className="w-12 h-12 object-contain" />
            <img src="/Logos/TRC-vLogo.png" alt="TRC-V Logo" className="w-12 h-12 object-contain" />
          </div>
          <div className="text-right">
            <h1 className="text-white font-bold text-sm leading-tight">OPERATOR'S</h1>
            <h2 className="text-white font-bold text-sm leading-tight">IDENTIFICATION</h2>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-3xl p-8 shadow-2xl">
          {/* Profile Photo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg">
                <img 
                  src={displayData.profilePhoto || "/default-avatar.png"} 
                  alt="Operator" 
                  className="w-full h-full object-cover"
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
          <h3 className="text-center text-2xl font-bold text-gray-900 mb-2">
            {`${displayData.firstName} ${displayData.middleName} ${displayData.lastName}${displayData.suffix ? ' ' + displayData.suffix : ''}`.trim()}
          </h3>

          {/* Address */}
          <p className="text-center text-sm text-gray-600 mb-6">
            {displayData.address}, Brgy. {displayData.barangay}
          </p>

          {/* Franchise Status Badge - Conditional Display */}
          <div className="flex justify-center gap-3 mb-6">
            {displayData.franchiseStatus === 'expired' ? (
              <span className="bg-red-100 text-red-700 px-4 py-2 rounded-md text-xs font-bold border-2 border-red-300">
                EXPIRED FRANCHISE
              </span>
            ) : (
              <span className="bg-green-100 text-green-700 px-4 py-2 rounded-md text-xs font-bold border-2 border-green-300">
                ACTIVE FRANCHISE
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Report Overpricing</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
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
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-all"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Fare Matrix</h3>
              <button 
                onClick={() => setShowFareMatrixModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Base Fare (First 4km)</span>
                  <span className="font-bold text-[#1B4B75]">₱15.00</span>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Additional per km</span>
                  <span className="font-bold text-[#1B4B75]">₱2.50</span>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
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
