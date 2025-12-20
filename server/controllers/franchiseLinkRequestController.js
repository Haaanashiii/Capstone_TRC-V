const franchiseLinkRequestRepository = require('../repositories/franchiseLinkRequestRepository');
const { LINK_REQUEST_STATUS } = require('../models/franchiseLinkRequestModel');
const FranchiseInformation = require('../models/franchiseInformationModel');
const UserAccount = require('../models/userAccountModel');
const emailService = require('../services/emailService');
const storage = require('../services/storageAdapter');

/**
 * Franchise Link Request Controller
 * 
 * Handles API endpoints for franchise linking requests (operator submission + admin review)
 */

// Helper to convert gridfs:// URLs to HTTP URLs
const convertToHttpUrls = (data) => storage.convertGridFSUrls(data);

/**
 * Create a new franchise link request (Operator)
 * POST /api/franchise-link-requests
 */
exports.createLinkRequest = async (req, res, next) => {
  try {
    const { franchiseNumber } = req.body;
    const userId = req.user.id;
    const file = req.file; // From multer middleware
    
    console.log('[FranchiseLinkRequest] Creating request for franchise:', franchiseNumber, 'user:', userId);
    console.log('[FranchiseLinkRequest] File provided:', file ? 'Yes' : 'No');
    console.log('[FranchiseLinkRequest] Request body:', req.body);
    
    if (!franchiseNumber || franchiseNumber.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Franchise number is required'
      });
    }
    
    // Check if franchise exists
    const franchise = await FranchiseInformation.findOne({
      franchiseNumber: franchiseNumber.trim(),
      isCurrentVersion: true
    });
    
    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Franchise not found',
        message: 'No franchise found with this number. Please verify and try again.'
      });
    }
    
    // Check if franchise is already linked
    if (franchise.linkedUser) {
      return res.status(400).json({
        success: false,
        error: 'Franchise already linked',
        message: 'This franchise is already linked to an account.'
      });
    }
    
    // Check if user already has a pending request for this franchise
    const hasPending = await franchiseLinkRequestRepository.hasPendingRequest(userId, franchiseNumber.trim());
    if (hasPending) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate request',
        message: 'You already have a pending request for this franchise number.'
      });
    }
    
    // Get user details by userId (UUID string, not ObjectId)
    const user = await UserAccount.findOne({ userId }).select('username email firstName lastName contactNumber');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Prepare request data
    const requestData = {
      userId,
      franchiseNumber: franchiseNumber.trim(),
      userEmail: user.email,
      userName: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username,
      userContact: user.contactNumber
    };
    
    // Handle file upload if provided
    if (file) {
      console.log('[FranchiseLinkRequest] Uploading file:', file.originalname);
      
      // Store file using storage adapter (GridFS)
      const uploadResult = await storage.uploadFileToStorage(file, 'franchise-link-requests');
      
      if (uploadResult.success) {
        requestData.supportingDocument = uploadResult.gridfsUrl;
        requestData.documentFilename = file.originalname;
        console.log('[FranchiseLinkRequest] File uploaded successfully:', uploadResult.gridfsUrl);
      } else {
        console.error('[FranchiseLinkRequest] File upload failed:', uploadResult.error);
        return res.status(500).json({
          success: false,
          error: 'File upload failed',
          message: uploadResult.error
        });
      }
    }
    
    // Create the request
    const linkRequest = await franchiseLinkRequestRepository.create(requestData);
    
    console.log('[FranchiseLinkRequest] Request created successfully:', linkRequest._id);
    
    // Emit WebSocket event for real-time admin notification
    if (req.app.get('io')) {
      req.app.get('io').to('admin-room').emit('franchise-link-request-new', {
        requestId: linkRequest._id,
        franchiseNumber: linkRequest.franchiseNumber,
        userName: linkRequest.userName,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Your franchise linking request has been submitted. Please wait for admin approval.',
      data: linkRequest
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error creating request:', error);
    console.error('[FranchiseLinkRequest] Error stack:', error.stack);
    
    // Return detailed error for debugging
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get all link requests (Admin)
 * GET /api/franchise-link-requests
 */
exports.getAllRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, sortBy, sortOrder } = req.query;
    
    const result = await franchiseLinkRequestRepository.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      search,
      sortBy,
      sortOrder
    });
    
    // Convert any gridfs URLs
    result.requests = result.requests.map(r => convertToHttpUrls(r));
    
    return res.status(200).json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching requests:', error);
    return next(error);
  }
};

/**
 * Get pending requests (Admin)
 * GET /api/franchise-link-requests/pending
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const result = await franchiseLinkRequestRepository.findPending({
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    result.requests = result.requests.map(r => convertToHttpUrls(r));
    
    return res.status(200).json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching pending requests:', error);
    return next(error);
  }
};

/**
 * Get single request by ID (Admin)
 * GET /api/franchise-link-requests/:id
 */
exports.getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const request = await franchiseLinkRequestRepository.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Get franchise details for additional context
    const franchise = await FranchiseInformation.findOne({
      franchiseNumber: request.franchiseNumber,
      isCurrentVersion: true
    }).select('operatorName franchiseStatus expiryDate operatorBarangay').lean();
    
    return res.status(200).json({
      success: true,
      data: {
        ...convertToHttpUrls(request),
        franchiseDetails: franchise ? convertToHttpUrls(franchise) : null
      }
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching request:', error);
    return next(error);
  }
};

/**
 * Get statistics (Admin)
 * GET /api/franchise-link-requests/statistics
 */
exports.getStatistics = async (req, res, next) => {
  try {
    const stats = await franchiseLinkRequestRepository.getStatistics();
    
    return res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching statistics:', error);
    return next(error);
  }
};

/**
 * Approve a link request (Admin)
 * POST /api/franchise-link-requests/:id/approve
 */
exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.username || req.user.firstName || 'Admin';
    
    console.log('[FranchiseLinkRequest] Approving request:', id, 'by admin:', adminId);
    
    // Get the request first
    const request = await franchiseLinkRequestRepository.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    if (request.status !== LINK_REQUEST_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        error: 'Request already processed',
        message: `This request has already been ${request.status}.`
      });
    }
    
    // Get franchise and verify it's still available
    const franchise = await FranchiseInformation.findOne({
      franchiseNumber: request.franchiseNumber,
      isCurrentVersion: true
    });
    
    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'Franchise not found',
        message: 'The franchise associated with this request no longer exists.'
      });
    }
    
    if (franchise.linkedUser) {
      return res.status(400).json({
        success: false,
        error: 'Franchise already linked',
        message: 'This franchise has already been linked to another account.'
      });
    }
    
    // Approve the request
    const updatedRequest = await franchiseLinkRequestRepository.approve(id, {
      adminId,
      adminName,
      adminNotes
    });
    
    // Link the franchise to the user (userId is a UUID string)
    const user = await UserAccount.findOne({ userId: request.userId });
    if (!user) {
      console.error('[FranchiseLinkRequest] User not found for userId:', request.userId);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The user account associated with this request could not be found.'
      });
    }
    
    // Update franchise with user's MongoDB _id
    franchise.linkedUser = user._id;
    console.log('[FranchiseLinkRequest] Before save - franchise._id:', franchise._id, 'linkedUser:', franchise.linkedUser, 'isCurrentVersion:', franchise.isCurrentVersion);
    await franchise.save();
    console.log('[FranchiseLinkRequest] After save - franchise saved successfully');
    
    // Verify the save worked
    const verifyFranchise = await FranchiseInformation.findById(franchise._id);
    console.log('[FranchiseLinkRequest] Verification - franchise linkedUser:', verifyFranchise?.linkedUser);
    
    // Update user's franchiseChainIds
    if (franchise.franchiseChainId) {
      if (!user.franchiseChainIds) user.franchiseChainIds = [];
      if (!user.franchiseChainIds.includes(franchise.franchiseChainId)) {
        user.franchiseChainIds.push(franchise.franchiseChainId);
        await user.save();
        console.log('[FranchiseLinkRequest] User franchiseChainIds updated:', user.franchiseChainIds);
      }
    }
    
    console.log('[FranchiseLinkRequest] Request approved, franchise linked to user:', user._id);
    
    // Send approval email
    try {
      if (request.userEmail) {
        await emailService.sendFranchiseLinkApprovalEmail({
          to: request.userEmail,
          userName: request.userName,
          franchiseNumber: request.franchiseNumber,
          operatorName: franchise.operatorName
        });
        console.log('[FranchiseLinkRequest] Approval email sent to:', request.userEmail);
      }
    } catch (emailError) {
      console.error('[FranchiseLinkRequest] Failed to send approval email:', emailError.message);
      // Don't fail the request if email fails
    }
    
    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to('admin-room').emit('franchise-link-request-updated', {
        requestId: id,
        status: 'approved'
      });
      
      // Notify the user
      req.app.get('io').emit(`user-${request.userId._id || request.userId}`, {
        type: 'franchise-link-approved',
        franchiseNumber: request.franchiseNumber
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Request approved successfully. Franchise has been linked to the user.',
      data: convertToHttpUrls(updatedRequest)
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error approving request:', error);
    return next(error);
  }
};

/**
 * Reject a link request (Admin)
 * POST /api/franchise-link-requests/:id/reject
 */
exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.username || req.user.firstName || 'Admin';
    
    console.log('[FranchiseLinkRequest] Rejecting request:', id, 'by admin:', adminId);
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }
    
    // Get the request first
    const request = await franchiseLinkRequestRepository.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    if (request.status !== LINK_REQUEST_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        error: 'Request already processed',
        message: `This request has already been ${request.status}.`
      });
    }
    
    // Reject the request
    const updatedRequest = await franchiseLinkRequestRepository.reject(id, {
      adminId,
      adminName,
      rejectionReason: rejectionReason.trim(),
      adminNotes
    });
    
    console.log('[FranchiseLinkRequest] Request rejected');
    
    // Send rejection email
    try {
      if (request.userEmail) {
        await emailService.sendFranchiseLinkRejectionEmail({
          to: request.userEmail,
          userName: request.userName,
          franchiseNumber: request.franchiseNumber,
          rejectionReason: rejectionReason.trim()
        });
        console.log('[FranchiseLinkRequest] Rejection email sent to:', request.userEmail);
      }
    } catch (emailError) {
      console.error('[FranchiseLinkRequest] Failed to send rejection email:', emailError.message);
      // Don't fail the request if email fails
    }
    
    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').to('admin-room').emit('franchise-link-request-updated', {
        requestId: id,
        status: 'rejected'
      });
      
      // Notify the user
      req.app.get('io').emit(`user-${request.userId._id || request.userId}`, {
        type: 'franchise-link-rejected',
        franchiseNumber: request.franchiseNumber,
        reason: rejectionReason
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Request rejected successfully.',
      data: convertToHttpUrls(updatedRequest)
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error rejecting request:', error);
    return next(error);
  }
};

/**
 * Get user's own link requests (Operator)
 * GET /api/franchise-link-requests/my-requests
 */
exports.getMyRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const requests = await franchiseLinkRequestRepository.findByUserId(userId);
    
    return res.status(200).json({
      success: true,
      data: requests.map(r => convertToHttpUrls(r))
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching user requests:', error);
    return next(error);
  }
};

/**
 * Get pending count for badge (Admin)
 * GET /api/franchise-link-requests/pending-count
 */
exports.getPendingCount = async (req, res, next) => {
  try {
    const count = await franchiseLinkRequestRepository.getPendingCount();
    
    return res.status(200).json({
      success: true,
      count
    });
    
  } catch (error) {
    console.error('[FranchiseLinkRequest] Error fetching pending count:', error);
    return next(error);
  }
};
