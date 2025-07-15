const userRepository = require('../repositories/userRepository');

exports.createUser = async (req, res, next) => {
  try {
    const user = await userRepository.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await userRepository.updateUser(req.params.id, req.body);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    await userRepository.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
