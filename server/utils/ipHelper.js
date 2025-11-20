/**
 * Extract the real client IP address from the request
 * Handles various proxy configurations (Cloudflare Worker, Render, Vercel)
 * 
 * Works in all environments:
 * - Development (localhost): Returns 127.0.0.1 or ::1
 * - Production (Render behind Cloudflare Worker): Extracts from proxy headers
 * 
 * @param {Object} req - Express request object
 * @param {boolean} debug - Enable debug logging (default: false)
 * @returns {string} - Client IP address
 */
function getClientIp(req, debug = false) {
  let ip = null;
  let source = null;

  // Priority 1: Cloudflare's connecting IP header (most reliable when using Cloudflare)
  // Cloudflare Workers can pass this through if configured
  if (req.headers['cf-connecting-ip']) {
    ip = req.headers['cf-connecting-ip'];
    source = 'cf-connecting-ip';
  }
  
  // Priority 2: X-Forwarded-For header (standard for proxies)
  // Render adds this automatically. Format: "client, proxy1, proxy2"
  // Always take the FIRST IP (original client), not the last
  else if (req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
    ip = forwardedIps[0];
    source = 'x-forwarded-for';
  }
  
  // Priority 3: X-Real-IP header (used by nginx and some proxies)
  else if (req.headers['x-real-ip']) {
    ip = req.headers['x-real-ip'];
    source = 'x-real-ip';
  }
  
  // Priority 4: Express's req.ip (automatically set when 'trust proxy' is enabled)
  // This works on Render without Cloudflare Worker
  else if (req.ip) {
    ip = req.ip;
    source = 'req.ip';
  }
  
  // Priority 5: Direct connection remote address (localhost development)
  else if (req.connection && req.connection.remoteAddress) {
    ip = req.connection.remoteAddress;
    source = 'connection.remoteAddress';
  }
  
  // Priority 6: Socket remote address (alternative for direct connections)
  else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
    source = 'socket.remoteAddress';
  }

  // Clean up IPv6 localhost to IPv4 for consistency
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // Debug logging (only in development)
  if (debug && process.env.NODE_ENV !== 'production') {
    console.log('[IP Debug]', {
      source,
      ip,
      headers: {
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip']
      },
      reqIp: req.ip,
      connectionRemote: req.connection?.remoteAddress,
      socketRemote: req.socket?.remoteAddress
    });
  }

  return ip || 'Unknown';
}

/**
 * Validate if an IP address is valid (not a proxy placeholder)
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid
 */
function isValidIp(ip) {
  if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1') {
    return false;
  }
  
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
  }
  
  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv6Regex.test(ip);
}

module.exports = {
  getClientIp,
  isValidIp
};
