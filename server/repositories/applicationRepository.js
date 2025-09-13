const Application = require('../models/applicationModel');

const createApplication = async (data) => {
    const payload = sanitize(data, process.env.ALLOWED_CREATE_FIELDS);
    const application = new Application(payload);
    return await application.save();
};

const getApplicationById = async (id) => {
    if (!isValidObjectId(id)) return null;

  return await Application.findById(id);
};

const updateApplication = async (id, data) => {
    if (!isValidObjectId(id)) return null;
    const update = sanitize(data, ALLOWED_UPDATE_FIELDS);
    return Application.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true, context: 'query' }
    );  
};

const deleteApplication = async (id) => {
    if (!isValidObjectId(id)) return null;
    return Application.findByIdAndDelete(id);
};

module.exports = {
  createApplication,
  getApplicationById,
  updateApplication,
  deleteApplication
};
