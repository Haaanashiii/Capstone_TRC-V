const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter, authLimiter, qrVerificationLimiter } = require('./middlewares/rateLimiter');
const { sanitizeRequest } = require('./middlewares/validateRequest');
const { enforceHttps } = require('./middlewares/securityHeaders');
const { auditLogService } = require('./services/auditLogService');

//routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const urlRoutes = require('./routes/urlRoutes');


dotenv.config();
const app = express();

// Performance-optimized middleware order
// Essential security middleware first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'sameorigin' }
})); 

app.use(enforceHttps); 

// Request parsing middleware
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser()); 

// CORS after parsing but before routes
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging and security checks
app.use(morgan('dev'));
app.use(sanitizeRequest); // Sanitize all request inputs

// Static file serving
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Audit logging (before rate limiting to log all attempts)
app.use(auditLogService.createLogMiddleware({
  excludePaths: ['/health', '/api/verify'],
  logBody: false
}));

// Rate limiting (just before routes) examples can be insisde routes t
// for specification and should avoid double limiting with api limiter
// app.use('/auth', authLimiter);  Stricter limits for auth routes
// app.use('/verify', qrVerificationLimiter); QR verification rate limits
// app.use('/', apiLimiter);  General API rate limiting
// app.use('/', urlRoutes); URL masking routes at root level
// app.use('/', require('./routes/verificationRoutes')); Ephemeral verification routes

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
