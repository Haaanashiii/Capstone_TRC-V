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


exports.findByUsername = async (username, { projection, lean = false, collation } = {}) => {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('username must be a non-empty string');
  }
  let query = User.findOne({ username: username.trim() }, projection);
  if (collation) query = query.collation(collation);
  return await query;
};

exports.findByEmail = async (email, { projection, lean = false, collation } = {}) => {
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('email must be a non-empty string');
  }
  let query = User.findOne({ email: email.trim() }, projection);
  if (collation) query = query.collation(collation);
  return await query;
};

exports.findById = async (id, { projection, lean = false } = {}) => {
  return await User.findById(id, projection);
};

