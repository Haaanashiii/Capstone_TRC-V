const User = require('../models/userAccountModel');
const bcrypt = require('bcryptjs');



exports.createUserAccount = async (userData) => {
  // If this is an OAuth account and username is missing, generate a safe one from the email
  if (!userData.username && userData.email) {
    const providerTag = userData.oauthProvider ? `${String(userData.oauthProvider).toLowerCase()}_` : '';
    const localPart = String(userData.email).split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let base = `${providerTag}${(localPart || 'user')}`;
    let candidate = base;
    let suffix = 0;
    // Try to find a unique username (limit attempts)
    while (await User.findOne({ username: candidate })) {
      suffix += 1;
      candidate = `${base}${Math.floor(Math.random() * 9000) + 1000}`; // random 4-digit suffix
      if (suffix > 10) break;
    }
    userData.username = candidate;
  }

  // Support provider-specific id fields (googleId etc.) by mapping to oauthId for consistency
  if (!userData.oauthId) {
    if (userData.googleId) userData.oauthId = userData.googleId;
    else if (userData.auth0Id) userData.oauthId = userData.auth0Id;
  }

  // Hash password only if provided (local accounts)
  if (userData.password) {
    const saltRounds = 12;
    userData.password = await bcrypt.hash(userData.password, saltRounds);
  }

  const user = new User(userData);
  try {
    const saved = await user.save();
    return saved;
  } catch (err) {
    // Log detailed validation errors to help debugging (do not reveal secrets)
    console.error('userAccountRepository.createUserAccount save error:', err && err.message);
    if (err && err.errors) {
      Object.keys(err.errors).forEach((k) => {
        try { console.error(' validation.', k, err.errors[k].message); } catch (e) {}
      });
    }
    throw err;
  }
};

exports.updateUserAccount = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

exports.deleteUserAccount = async (id) => {
  return await User.findByIdAndDelete(id);
};


exports.findAccountByUsername = async (username, { projection, lean = false, collation } = {}) => {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('username must be a non-empty string');
  }
  let query = User.findOne({ username: username.trim() }, projection);
  if (collation) query = query.collation(collation);
  return await query;
};

exports.findAccountByEmail = async (email, { projection, lean = false, collation } = {}) => {
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('email must be a non-empty string');
  }
  const normalized = email.trim().toLowerCase();
  let query = User.findOne({ email: normalized }, projection);
  if (collation) query = query.collation(collation);
  return await query;
};

// Return all accounts matching an email (useful when duplicates exist due to earlier schemas)
exports.findAccountsByEmail = async (email, { projection, lean = false, collation } = {}) => {
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('email must be a non-empty string');
  }
  const normalized = email.trim().toLowerCase();
  let query = User.find({ email: normalized }, projection);
  if (collation) query = query.collation(collation);
  if (lean) query = query.lean();
  return await query;
};

exports.findAccountById = async (id, { projection, lean = false } = {}) => {
  return await User.findById(id, projection);
};

// Find accounts by specific roles
exports.findAccountsByRoles = async (roles) => {
  return await User.find({ role: { $in: roles } }).select('-password');
};

// Find all accounts (if needed elsewhere)
exports.findAllAccounts = async () => {
  return await User.find().select('-password');
};

exports.getAllUsers = async () => {
  return await User.find({}).select('-password').lean();
};