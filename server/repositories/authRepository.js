const User = require('../models/userModel');

exports.findByUsername = async (username) => {
  return await User.findOne({ username });
};
