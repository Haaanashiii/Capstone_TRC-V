/**
 * Certificate Routes
 * Handles all certificate generation and inspection endpoints
 */

const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

/**
 * @route   POST /api/certificates/generate
 * @desc    Generate a certificate (PDF or Word document)
 * @access  Private - Admin only (sb-admin, bplo-admin, super-admin)
 * @body    {certificateType, franchiseData, format, generatedBy, generatedDate}
 */
router.post(
    '/generate',
    authenticate,
    authorize(['sb-admin', 'bplo-admin', 'super-admin']),
    certificateController.generateCertificate
);

/**
 * @route   GET /api/certificates/inspect-pdf/:templateName
 * @desc    Inspect PDF template fields for debugging
 * @access  Private - Admin only
 * @param   templateName - approval, cancellation, or existing
 */
router.get(
    '/inspect-pdf/:templateName',
    authenticate,
    authorize(['sb-admin', 'bplo-admin', 'super-admin']),
    certificateController.inspectPDFTemplate
);

/**
 * @route   GET /api/certificates/templates
 * @desc    Get list of available certificate templates
 * @access  Private - Admin only
 */
router.get(
    '/templates',
    authenticate,
    authorize(['sb-admin', 'bplo-admin', 'super-admin']),
    certificateController.getAvailableTemplates
);

module.exports = router;
