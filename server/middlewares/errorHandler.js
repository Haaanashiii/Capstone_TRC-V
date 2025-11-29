const winston = require('winston');
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

module.exports = errorHandler = (err, req, res, next) => {
  if (err) {
    // Log error details for troubleshooting
    logger.error({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      statusCode: err.statusCode || err.status || 500
    });

    // Get error status code
    const statusCode = err.statusCode || err.status || 500;
    
    // Hide technical details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorMessage = statusCode === 500 && !isDevelopment 
      ? 'Internal server error' 
      : err.message || 'Unknown error';

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      ...(isDevelopment && { stack: err.stack })
    });
  } else {
    next();
  }
};