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

