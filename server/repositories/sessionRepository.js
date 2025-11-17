const Session = require('../models/sessionModel');
const crypto = require('crypto');

/**
 * Create a new session
 */
exports.createSession = async (userId, accountType, refreshToken, deviceInfo = {}, expiresInDays = 7) => {
  // Hash the refresh token before storing (security best practice)
  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  const session = new Session({
    userId,
    accountType,
    refreshToken: hashedToken,
    deviceInfo,
    expiresAt
  });
  
  await session.save();
  return session;
};

/**
 * Find session by refresh token
 */
exports.findSessionByToken = async (refreshToken) => {
  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  return await Session.findOne({
    refreshToken: hashedToken,
    isActive: true,
    expiresAt: { $gt: new Date() } // Not expired
  });
};

/**
 * Update session last used timestamp
 */
exports.updateSessionLastUsed = async (sessionId) => {
  return await Session.findByIdAndUpdate(
    sessionId,
    { lastUsed: new Date() },
    { new: true }
  );
};

/**
 * Revoke (deactivate) a session
 */
exports.revokeSession = async (refreshToken) => {
  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  return await Session.findOneAndUpdate(
    { refreshToken: hashedToken },
    { isActive: false },
    { new: true }
  );
};

/**
 * Revoke all sessions for a user
 */
exports.revokeAllUserSessions = async (userId) => {
  return await Session.updateMany(
    { userId, isActive: true },
    { isActive: false }
  );
};

/**
 * Get all active sessions for a user
 */
exports.getUserSessions = async (userId) => {
  return await Session.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastUsed: -1 });
};

/**
 * Delete expired sessions (cleanup)
 */
exports.deleteExpiredSessions = async () => {
  return await Session.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

/**
 * Delete session by ID
 */
exports.deleteSession = async (sessionId) => {
  return await Session.findByIdAndDelete(sessionId);
};

/**
 * Count active sessions for a user
 */
exports.countUserSessions = async (userId) => {
  return await Session.countDocuments({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};
