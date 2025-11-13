const express = require('express');
const router = express.Router();
const sessionRepository = require('../repositories/sessionRepository');
const authenticate = require('../middlewares/authenticate');

/**
 * Get all active sessions for the current user
 * GET /api/sessions
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const sessions = await sessionRepository.getUserSessions(req.user.id);
    
    // Format sessions for frontend
    const formattedSessions = sessions.map(session => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      expiresAt: session.expiresAt,
      isCurrent: req.cookies.refreshToken && 
                 require('crypto').createHash('sha256').update(req.cookies.refreshToken).digest('hex') === session.refreshToken
    }));
    
    res.json({ sessions: formattedSessions });
  } catch (err) {
    next(err);
  }
});

/**
 * Revoke a specific session
 * DELETE /api/sessions/:sessionId
 */
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Get session to verify ownership
    const session = await sessionRepository.getUserSessions(req.user.id);
    const targetSession = session.find(s => s._id.toString() === sessionId);
    
    if (!targetSession) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Revoke the session
    await sessionRepository.deleteSession(sessionId);
    
    res.json({ message: 'Session revoked successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * Revoke all other sessions (keep current)
 * POST /api/sessions/revoke-others
 */
router.post('/revoke-others', authenticate, async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies.refreshToken;
    
    if (!currentRefreshToken) {
      return res.status(400).json({ error: 'No active session' });
    }
    
    // Get all user sessions
    const sessions = await sessionRepository.getUserSessions(req.user.id);
    const currentTokenHash = require('crypto').createHash('sha256').update(currentRefreshToken).digest('hex');
    
    // Delete all sessions except current
    for (const session of sessions) {
      if (session.refreshToken !== currentTokenHash) {
        await sessionRepository.deleteSession(session._id);
      }
    }
    
    res.json({ message: 'All other sessions revoked successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
