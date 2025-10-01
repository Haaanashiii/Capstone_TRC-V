const franchiseApplication = require('../models/franchiseApplicationModel');

exports.createFranchiseApplication = async (data) => {
    const payload = sanitize(data, process.env.ALLOWED_CREATE_FIELDS);
    const application = new franchiseApplication(payload);
    return await application.save();
};

exports.getFranchiseApplicationById = async (id) => {
    if (!isValidObjectId(id)) return null;

  return await franchiseApplication.findById(id);
};

exports.updateFranchiseApplication = async (id, data) => {
    if (!isValidObjectId(id)) return null;
    const update = sanitize(data, ALLOWED_UPDATE_FIELDS);
    return franchiseApplication.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true, context: 'query' }
    );  
};

exports.deleteFranchiseApplication = async (id) => {
    if (!isValidObjectId(id)) return null;
    return franchiseApplication.findByIdAndDelete(id);
};


