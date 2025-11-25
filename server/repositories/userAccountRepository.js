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
    console.error('[Repo] User create error:', err.message);
    if (err && err.errors) {
      Object.keys(err.errors).forEach((k) => {
        try { console.error(' validation.', k, err.errors[k].message); } catch (e) {}
      });
    }
    throw err;
  }
};

exports.updateUserAccount = async (id, updateData) => {
  // Hash password if being updated
  if (updateData.password) {
    const saltRounds = 12;
    updateData.password = await bcrypt.hash(updateData.password, saltRounds);
  }
  
  // Try to find by userId first (UUID), then fall back to MongoDB _id
  let user = await User.findOne({ userId: id });
  if (!user) {
    user = await User.findById(id);
  }
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Update user
  Object.assign(user, updateData);
  return await user.save();
};

exports.deleteUserAccount = async (id) => {
  // Try to find by userId first (UUID), then fall back to MongoDB _id
  let user = await User.findOne({ userId: id });
  if (!user) {
    user = await User.findById(id);
  }
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return await User.deleteOne({ _id: user._id });
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
  // Try to find by userId first (UUID), then fall back to MongoDB _id
  let user = await User.findOne({ userId: id }, projection);
  if (!user) {
    user = await User.findById(id, projection);
  }
  return user;
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

// Get user with populated operator information and franchises
exports.findAccountByIdWithOperator = async (id) => {
  // Try to find by userId first (UUID), then fall back to MongoDB _id
  let user = await User.findOne({ userId: id }).populate({
    path: 'operatorInfo',
    populate: {
      path: 'franchiseInformations'
    }
  });
  if (!user) {
    user = await User.findById(id).populate({
      path: 'operatorInfo',
      populate: {
        path: 'franchiseInformations'
      }
    });
  }
  return user;
};

// Get all users with populated operator information and franchises
exports.getAllUsersWithOperator = async () => {
  return await User.find({}).select('-password').populate({
    path: 'operatorInfo',
    populate: {
      path: 'franchiseInformations'
    }
  }).lean();
};

// Helper: Get user with operator info (single level population)
exports.findAccountByIdWithOperatorInfo = async (id) => {
  let user = await User.findOne({ userId: id }).populate('operatorInfo');
  if (!user) {
    user = await User.findById(id).populate('operatorInfo');
  }
  return user;
};

// Helper: Get franchises for a user via operator information
exports.getFranchisesByUserId = async (id) => {
  let user = await User.findOne({ userId: id }).populate({
    path: 'operatorInfo',
    populate: {
      path: 'franchiseInformations'
    }
  });
  if (!user) {
    user = await User.findById(id).populate({
      path: 'operatorInfo',
      populate: {
        path: 'franchiseInformations'
      }
    });
  }
  return user?.operatorInfo?.franchiseInformations || [];
};
