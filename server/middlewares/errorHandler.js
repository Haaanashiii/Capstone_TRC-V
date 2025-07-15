const winston = require('winston');
const logger = winston.createLogger({
  level: 'error',
  transports: [new winston.transports.Console()],
});

module.exports = errorHandler = (err, req, res, next) => {
  if (err) {
    logger.error(err);

    res.status(400).json({
      status: "Something went wrong",
      error: err.message || "Unknown error",
    });
  } else {
    next();
  }
};