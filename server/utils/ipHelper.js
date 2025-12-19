// Get visitor's real IP address (handles NGINX proxy)
// SECURITY: Only trust proxy headers when request comes from trusted proxy
function getClientIp(req, debug = false) {
  let ip = null;
  let source = null;

  // SECURITY: Check if request came through trusted proxy (nginx/docker)
  // req.ip already handles trust proxy settings from Express
  // This prevents IP spoofing via fake X-Forwarded-For headers
  const isTrustedProxy = isTrustedProxyRequest(req);

  // Only trust forwarded headers if from trusted proxy
  if (isTrustedProxy) {
    // Use Express's built-in IP which respects 'trust proxy' setting
    // This is the SAFEST way - Express handles proxy trust validation
    if (req.ip) {
      ip = req.ip;
      source = 'req.ip (trusted proxy)';
    }
    // Fallback to x-real-ip set by nginx (more reliable than x-forwarded-for)
    else if (req.headers['x-real-ip']) {
      ip = req.headers['x-real-ip'];
      source = 'x-real-ip';
    }
    // Last resort: parse x-forwarded-for (nginx should set this)
    else if (req.headers['x-forwarded-for']) {
      const forwardedIps = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
      ip = forwardedIps[0]; // Get first IP (original client)
      source = 'x-forwarded-for';
    }
  } else {
    // SECURITY: Direct connection - ignore all proxy headers (could be spoofed)
    // Get IP from direct connection only
    if (req.socket && req.socket.remoteAddress) {
      ip = req.socket.remoteAddress;
      source = 'socket.remoteAddress (direct)';
    }
    else if (req.connection && req.connection.remoteAddress) {
      ip = req.connection.remoteAddress;
      source = 'connection.remoteAddress (direct)';
    }
    else if (req.ip) {
      ip = req.ip;
      source = 'req.ip (direct)';
    }
  }

  // Normalize IPv6 to IPv4 where possible
  if (ip) {
    ip = normalizeIpAddress(ip);
  }

  // Show debug info if requested (development only)
  if (debug && process.env.NODE_ENV !== 'production') {
    console.log('[IP Debug]', {
      source,
      ip,
      headers: {
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

// Check if IP address is real (not localhost or unknown)
function isValidIp(ip) {
  if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1') {
    return false;
  }
  
  // Validate IPv4 format
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
  }
  
  // Validate IPv6 format
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv6Regex.test(ip);
}

/**
 * SECURITY: Check if request came from a trusted proxy
 * Only trust proxy headers when the immediate connection is from nginx/docker network
 * 
 * YOUR DEPLOYMENT:
 * Frontend (hosted online) → Domain (DDNS) → Local Nginx → Local PM2/Backend
 * 
 * Since nginx is LOCAL, connections come from:
 * - 127.0.0.1 (nginx & node on same machine)
 * - 192.168.x.x (nginx & node on same LAN)
 * Both are automatically trusted!
 */
function isTrustedProxyRequest(req) {
  // Get the immediate connection IP (not the forwarded one)
  const connectionIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  
  // Normalize the connection IP
  const normalizedConnectionIp = normalizeIpAddress(connectionIp);
  
  // OPTIONAL: Allow explicit trusted proxy IPs via environment variable
  // Set TRUSTED_PROXY_IPS=1.2.3.4,5.6.7.8 if you ever need to trust specific external IPs
  const explicitTrustedProxies = (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
  
  if (explicitTrustedProxies.length > 0 && explicitTrustedProxies.includes(normalizedConnectionIp)) {
    return true;
  }
  
  // Check if connection is from localhost (nginx on same machine)
  if (normalizedConnectionIp === '127.0.0.1' || normalizedConnectionIp === '::1') {
    return true;
  }
  
  // Check if connection is from private/LAN network
  // This covers: Docker (172.x), Home LAN (192.168.x), Enterprise (10.x)
  if (isInPrivateRange(normalizedConnectionIp)) {
    return true;
  }
  
  // SECURITY: If connection is from public IP, DON'T trust proxy headers
  // This prevents IP spoofing attacks from random internet sources
  return false;
}

/**
 * Check if IP is in private/reserved ranges (RFC 1918)
 */
function isInPrivateRange(ip) {
  if (!ip) return false;
  
  // IPv4 private ranges
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (localhost)
    if (parts[0] === 127) return true;
  }
  
  return false;
}

/**
 * Normalize IP address (handle IPv6-mapped IPv4, etc)
 */
function normalizeIpAddress(ip) {
  if (!ip) return 'Unknown';
  
  // Remove IPv6 prefix for IPv4-mapped addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Convert IPv6 localhost to IPv4
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

module.exports = {
  getClientIp,
  isValidIp,
  isTrustedProxyRequest,
  isInPrivateRange,
  normalizeIpAddress
};
