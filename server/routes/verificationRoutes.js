/**
 * Verification Routes with Ephemeral Links
 * 
 * These routes handle the QR code verification with ephemeral links that expire quickly
 * after being scanned, making them non-shareable.
 */

const express = require('express');
const router = express.Router();
const { qrVerificationLimiter } = require('../middlewares/rateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const { createEphemeralToken, getOperatorDataFromToken } = require('../services/urlMaskingService');
const { verifyQRCodeSignature } = require('../services/qrCodeService');
const Application = require('../models/applicationModel');

// Apply rate limiting to prevent abuse
router.use(qrVerificationLimiter);

/**
 * GET /verify
 * Initial QR code verification endpoint that generates an ephemeral token
 */
router.get('/verify', sanitizeRequest, async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Invalid QR code format', 
        valid: false 
      });
    }
    
    // Find the application by franchise ID
    const application = await Application.findOne({ 
      franchiseId: id, 
      status: 'approved' 
    }).populate('driverId');
    
    if (!application) {
      return res.status(404).json({ 
        error: 'Franchise record not found', 
        valid: false,
        message: 'This franchise is not found in our records'
      });
    }
    
    // Check if franchise is expired
    const now = new Date();
    const expiryDate = application.expiryDate ? new Date(application.expiryDate) : null;
    const isExpired = expiryDate && now > expiryDate;
    
    // Create ephemeral token with operator data
    const operatorData = {
      ssn: application.ssn,
      franchiseId: application.franchiseId,
      expiryDate: application.expiryDate
    };
    
    const ephemeralToken = createEphemeralToken(operatorData);
    
    // Redirect to the ephemeral URL
    res.redirect(ephemeralToken.ephemeralUrl);
    
  } catch (err) {
    console.error('QR verification error:', err);
    res.status(500).json({ 
      error: 'Server error', 
      valid: false,
      message: 'An error occurred while verifying this QR code'
    });
  }
});

/**
 * GET /temp/:token
 * Ephemeral token verification endpoint that displays operator information
 * This link expires quickly after being accessed
 */
router.get('/temp/:token', sanitizeRequest, async (req, res) => {
  try {
    const { token } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Get operator data from the ephemeral token
    const operatorData = getOperatorDataFromToken(token, ipAddress);
    
    if (!operatorData) {
      return res.status(404).json({ 
        error: 'Expired or invalid link', 
        valid: false,
        message: 'This verification link has expired or is invalid'
      });
    }
    
    // Get application details from database for additional verification
    const application = await Application.findOne({ 
      ssn: operatorData.ssn, 
      franchiseId: operatorData.franchiseId,
      status: 'approved' 
    }).populate('driverId');
    
    if (!application) {
      return res.status(404).json({ 
        error: 'Franchise record not found', 
        valid: false,
        message: 'This franchise is not found in our records'
      });
    }
    
    // Check if franchise is expired
    const now = new Date();
    const expiryDate = application.expiryDate ? new Date(application.expiryDate) : null;
    const isExpired = expiryDate && now > expiryDate;
    
    // Only show safe details, not documents
    const driver = application.driverId;
    res.json({
      valid: true,
      name: driver.name,
      plateNumber: application.plateNumber,
      franchiseId: application.franchiseId,
      franchiseValidity: application.updatedAt,
      expiryDate: expiryDate,
      isExpired: isExpired,
      status: isExpired ? 'expired' : application.status,
      ephemeralLink: true,
      expiresIn: '60 seconds'
    });
  } catch (err) {
    console.error('Ephemeral token verification error:', err);
    res.status(500).json({ 
      error: 'Server error', 
      valid: false,
      message: 'An error occurred while verifying this QR code'
    });
  }
});

// Legacy endpoint for backward compatibility (with ephemeral token generation)
router.get('/verify/:ssn', async (req, res) => {
  try {
    const { ssn } = req.params;
    const application = await Application.findOne({ ssn, status: 'approved' }).populate('driverId');
    
    if (!application) {
      return res.status(404).json({ message: 'Not found or not approved' });
    }
    
    // Create ephemeral token with operator data
    const operatorData = {
      ssn: application.ssn,
      franchiseId: application.franchiseId || 'LEGACY',
      expiryDate: application.expiryDate
    };
    
    const ephemeralToken = createEphemeralToken(operatorData);
    
    // Redirect to the ephemeral URL
    res.redirect(ephemeralToken.ephemeralUrl);
    
  } catch (err) {
    res.status(500).json({ error: 'Server error', valid: false });
  }
});

module.exports = router;