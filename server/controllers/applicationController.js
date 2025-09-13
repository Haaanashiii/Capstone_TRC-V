const applicationRepository = require('../repositories/applicationRepository');

exports.createApplication = async (req, res, next) => {
  try {
    const application = await applicationRepository.createApplication(req.body);
    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
};

exports.getApplication = async (req, res, next) => {
  try {
    const application = await applicationRepository.getApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }   
    res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};


exports.updateApplication = async (req, res, next) => {
    try {
        const payload = pick(req.body, process.env.ALLOWED_UPDATE_FIELDS);
        const application = await applicationRepository.updateApplication(req.params.id, payload);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(200).json(application);
    } catch (error) {
        next(error);
    }
};

exports.deleteApplication = async (req, res, next) => {
    try {
        const application = await applicationRepository.deleteApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }   
};

