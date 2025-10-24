const operatorInformationRepository = require('../repositories/operatorInformationRepository');

exports.createOperatorInformation = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    // prevent id injection and prototype pollution
    const { id, _id, ...body } = req.body;
    for (const k of ['__proto__', 'prototype', 'constructor']) delete body[k];
    const operatorInformation = await operatorInformationRepository.createOperatorInformation(body);

    return res.status(201).json(operatorInformation);
  }
  catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError' || error?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate operator information' });
    }
  }
};

exports.getOperatorInformation = async (req, res, next) => {
  try {
    if (!req.params?.id) {
      return res.status(400).json({ error: 'id param is required' });
    }
    const operatorInformation = await operatorInformationRepository.getOperatorInformationById(req.params.id);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    return res.status(200).json(operatorInformation);
  } catch (error) {
    if (error?.name === 'CastError' || /invalid input syntax.*uuid/i.test(error?.message || '')) {
      return res.status(400).json({ error: 'Invalid id format' });
    }
    return next(error);
  }
};

exports.updateOperatorInformation = async (req, res, next) => {
  try {
    const operatorInformation = await operatorInformationRepository.updateOperatorInformation(req.params.id, req.body);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    res.status(200).json(operatorInformation);
  } catch (error) {
    next(error);
  }
};

exports.deleteOperatorInformation = async (req, res, next) => {
  try {
    const operatorInformation = await operatorInformationRepository.deleteOperatorInformation(req.params.id);
    if (!operatorInformation) {
      return res.status(404).json({ error: 'Operator information not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
