// Make sure all traffic uses secure HTTPS connections (production only)
function enforceHttps(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return next();

  // Check if connection is using HTTPS
  const xfwd = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = Boolean(req.secure) || xfwd.split(',')[0].trim() === 'https';

  if (!isHttps) {
    // Redirect non-HTTPS traffic to HTTPS
    const canonicalHost = process.env.CANONICAL_HOST || req.hostname;
    if (!canonicalHost) return res.status(400).send('Bad Request');
    res.set('Vary', 'X-Forwarded-Proto');
    return res.redirect(308, `https://${canonicalHost}${req.originalUrl}`);
  }

  return next();
}

module.exports = { enforceHttps };
