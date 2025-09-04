/**
 * URL Masking Routes
 * 
 * These routes handle the masked URLs for tricycle operator information.
 */

const express = require('express');
const router = express.Router();
const { getOperatorDataFromMaskedUrl } = require('../services/urlMaskingService');
const { apiLimiter } = require('../middlewares/rateLimiter');
const { sanitizeRequest } = require('../middlewares/validateRequest');
const Application = require('../models/applicationModel');

// Apply rate limiting to prevent abuse
router.use(apiLimiter);

/**
 * GET /v/:shortId
 * Retrieve and display tricycle operator information from a masked URL
 */
router.get('/v/:shortId', sanitizeRequest, async (req, res) => {
  try {
    const { shortId } = req.params;
    
    // Get operator data from the masked URL
    const operatorData = getOperatorDataFromMaskedUrl(shortId);
    
    if (!operatorData) {
      return res.status(404).json({
        success: false,
        message: 'The requested information could not be found or has expired'
      });
    }
    
    // Retrieve full application details from the database
    const application = await Application.findOne({
      ssn: operatorData.ssn,
      franchiseId: operatorData.franchiseId
    }).populate('driver');
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Tricycle operator information not found'
      });
    }
    
    // Return only the necessary information
    return res.status(200).json({
      success: true,
      data: {
        driverName: application.driver.name,
        franchiseId: application.franchiseId,
        plateNumber: application.plateNumber,
        expiryDate: application.expiryDate,
        status: application.status,
        isValid: new Date() < new Date(application.expiryDate)
      }
    });
  } catch (error) {
    console.error('Error retrieving masked URL data:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving the information'
    });
  }
});

module.exports = router;