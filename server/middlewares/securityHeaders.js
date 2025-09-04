// Enforce HTTPS in production
function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
}

module.exports = { enforceHttps };
