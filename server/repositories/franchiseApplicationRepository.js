const franchiseApplication = require('../models/franchiseApplicationModel');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

exports.createFranchiseApplication = async (data) => {
    // Create Mongoose model directly. Validation is handled by the schema.
    const application = new franchiseApplication(data);
    return await application.save();
};

exports.getAllFranchiseApplications = async (query = {}, options = {}) => {
    const { skip = 0, limit = 20 } = options;
    const q = query && Object.keys(query).length ? query : {};
    
    if (limit > 0) {
      // Paginated query
      return await franchiseApplication
        .find(q)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } else {
      // No pagination - return all (for backward compatibility, but not recommended for large datasets)
      console.warn('[getAllFranchiseApplications] No limit specified - loading all results');
      return await franchiseApplication.find(q).sort({ submittedAt: -1 }).lean();
    }
};

exports.getFranchiseApplicationById = async (id) => {
    if (!isValidObjectId(id)) return null;
    return await franchiseApplication.findById(id).lean();
};

exports.updateFranchiseApplication = async (id, data) => {
    if (!isValidObjectId(id)) return null;
    return franchiseApplication.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true, context: 'query' }
    );
};

exports.deleteFranchiseApplication = async (id) => {
    if (!isValidObjectId(id)) return null;
    return franchiseApplication.findByIdAndDelete(id);
};

exports.findByUserId = async (userId) => {
    if (!userId) return null;
    return await franchiseApplication.findOne({ userId: userId }).lean();
};


