const franchiseApplicationRepository = require('../repositories/applicationRepository');

exports.createFranchiseApplication = async (req, res, next) => {
  try {
    const application = await franchiseApplicationRepository.createFranchiseApplication(req.body);
    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
};

exports.getFranchiseApplication = async (req, res, next) => {
  try {
    const application = await franchiseApplicationRepository.getFranchiseApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }   
    res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};


exports.updateFranchiseApplication = async (req, res, next) => {
    try {
        const payload = pick(req.body, process.env.ALLOWED_UPDATE_FIELDS);
        const application = await franchiseApplicationRepository.updateFranchiseApplication(req.params.id, payload);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};

exports.deleteFranchiseApplication = async (req, res, next) => {
    try {
        const application = await franchiseApplicationRepository.deleteFranchiseApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }   
};
