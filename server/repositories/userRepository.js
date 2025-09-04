const User = require('../models/userModel');

exports.createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

exports.updateUser = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

exports.deleteUser = async (id) => {
  return await User.findByIdAndDelete(id);
};

exports.findByUsername = async (username) => {
  return await User.findOne({ username });
};

