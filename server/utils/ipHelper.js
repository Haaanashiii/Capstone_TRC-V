// Get visitor's real IP address (handles NGINX proxy)
function getClientIp(req, debug = false) {
  let ip = null;
  let source = null;

  // Check NGINX x-forwarded-for header (used by nginx reverse proxy)
  if (req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
    ip = forwardedIps[0]; // Get first IP (original client)
    source = 'x-forwarded-for';
  }
  
  // Check NGINX x-real-ip header
  else if (req.headers['x-real-ip']) {
    ip = req.headers['x-real-ip'];
    source = 'x-real-ip';
  }
  
  // Use Express's built-in IP when 'trust proxy' is enabled
  else if (req.ip) {
    ip = req.ip;
    source = 'req.ip';
  }
  
  // Get IP from direct connection
  else if (req.connection && req.connection.remoteAddress) {
    ip = req.connection.remoteAddress;
    source = 'connection.remoteAddress';
  }
  
  // Get IP from socket connection
  else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
    source = 'socket.remoteAddress';
  }

  // Convert IPv6 localhost to IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
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

module.exports = {
  getClientIp,
  isValidIp
};
