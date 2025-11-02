const franchiseApplication = require('../models/franchiseApplicationModel');
const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

exports.createFranchiseApplication = async (data) => {
    // Create Mongoose model directly. Validation is handled by the schema.
    const application = new franchiseApplication(data);
    return await application.save();
};

exports.getAllFranchiseApplications = async (query = {}) => {
    
    const q = query && Object.keys(query).length ? query : {};
    return await franchiseApplication.find(q).sort({ submittedAt: -1 }).lean();
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


