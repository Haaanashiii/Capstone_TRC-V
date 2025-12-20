const { FranchiseLinkRequest, LINK_REQUEST_STATUS } = require('../models/franchiseLinkRequestModel');

/**
 * Franchise Link Request Repository
 * 
 * Data access layer for franchise link request operations
 */
class FranchiseLinkRequestRepository {
  
  /**
   * Create a new link request
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Created request
   */
  async create(data) {
    try {
      const request = new FranchiseLinkRequest(data);
      await request.save();
      return request;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('A pending request already exists for this franchise number');
      }
      throw error;
    }
  }
  
  /**
   * Find request by ID
   * @param {string} id - Request ID
   * @returns {Promise<Object|null>} Request or null
   */
  async findById(id) {
    return FranchiseLinkRequest.findById(id).lean();
  }
  
  /**
   * Find all requests with pagination and filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} { requests, total, page, limit }
   */
  async findAll({ 
    page = 1, 
    limit = 10, 
    status = null, 
    search = null,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const query = {};
    
    // Status filter
    if (status && Object.values(LINK_REQUEST_STATUS).includes(status)) {
      query.status = status;
    }
    
    // Search filter (by franchise number or user name)
    if (search) {
      query.$or = [
        { franchiseNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    const [requests, total] = await Promise.all([
      FranchiseLinkRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      FranchiseLinkRequest.countDocuments(query)
    ]);
    
    return {
      requests,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }
  
  /**
   * Find pending requests
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pending requests
   */
  async findPending(options = {}) {
    return this.findAll({ ...options, status: LINK_REQUEST_STATUS.PENDING });
  }
  
  /**
   * Find requests by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's requests
   */
  async findByUserId(userId) {
    return FranchiseLinkRequest.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
  }
  
  /**
   * Check if user has pending request for franchise
   * @param {string} userId - User ID
   * @param {string} franchiseNumber - Franchise number
   * @returns {Promise<boolean>}
   */
  async hasPendingRequest(userId, franchiseNumber) {
    return FranchiseLinkRequest.hasPendingRequest(userId, franchiseNumber);
  }
  
  /**
   * Update request status (approve/reject)
   * @param {string} id - Request ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object|null>} Updated request
   */
  async updateStatus(id, { status, reviewedBy, reviewedByName, rejectionReason, adminNotes }) {
    const update = {
      status,
      reviewedBy,
      reviewedByName,
      reviewedAt: new Date()
    };
    
    if (rejectionReason) update.rejectionReason = rejectionReason;
    if (adminNotes) update.adminNotes = adminNotes;
    
    return FranchiseLinkRequest.findByIdAndUpdate(
      id,
      update,
      { new: true }
    )
    .lean();
  }
  
  /**
   * Approve a link request
   * @param {string} id - Request ID
   * @param {Object} adminInfo - Admin information
   * @returns {Promise<Object|null>} Updated request
   */
  async approve(id, { adminId, adminName, adminNotes }) {
    return this.updateStatus(id, {
      status: LINK_REQUEST_STATUS.APPROVED,
      reviewedBy: adminId,
      reviewedByName: adminName,
      adminNotes
    });
  }
  
  /**
   * Reject a link request
   * @param {string} id - Request ID
   * @param {Object} adminInfo - Admin information
   * @returns {Promise<Object|null>} Updated request
   */
  async reject(id, { adminId, adminName, rejectionReason, adminNotes }) {
    return this.updateStatus(id, {
      status: LINK_REQUEST_STATUS.REJECTED,
      reviewedBy: adminId,
      reviewedByName: adminName,
      rejectionReason,
      adminNotes
    });
  }
  
  /**
   * Get statistics for dashboard
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [pending, approved, rejected, total] = await Promise.all([
      FranchiseLinkRequest.countDocuments({ status: LINK_REQUEST_STATUS.PENDING }),
      FranchiseLinkRequest.countDocuments({ status: LINK_REQUEST_STATUS.APPROVED }),
      FranchiseLinkRequest.countDocuments({ status: LINK_REQUEST_STATUS.REJECTED }),
      FranchiseLinkRequest.countDocuments()
    ]);
    
    return { pending, approved, rejected, total };
  }
  
  /**
   * Get pending count
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    return FranchiseLinkRequest.getPendingCount();
  }
  
  /**
   * Delete a request (soft delete by setting status or hard delete)
   * @param {string} id - Request ID
   * @returns {Promise<Object|null>}
   */
  async delete(id) {
    return FranchiseLinkRequest.findByIdAndDelete(id);
  }
}

module.exports = new FranchiseLinkRequestRepository();
