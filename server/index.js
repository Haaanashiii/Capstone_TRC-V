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
const userRoutes = require('./routes/userAccountRoutes');
const adminRoutes = require('./routes/adminAccountRoutes');
const pendingAppsRoutes = require('./routes/pendingAppsRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const franchiseInformationRoutes = require('./routes/franchiseInformationRoutes');
const franchiseApplicationRoutes = require('./routes/franchiseApplicationRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

dotenv.config();
const app = express();

// Trust proxy - required when behind Cloudflare Worker/Render
app.set('trust proxy', 1);

// Performance-optimized middleware order Essential security middleware first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://pub-422a490d7e024793bffa369b66dfae83.r2.dev"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", "https://trc-v.vercel.app", "https://*.vercel.app", "https://*.workers.dev"]
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

// CORS configuration
const corsOriginEnv = process.env.CORS_ORIGIN || '';
let corsOptions;
const corsMethods = ['GET', 'POST', 'PUT', 'DELETE'];
const corsAllowedHeaders = ['Content-Type', 'Authorization'];
if (corsOriginEnv) {
  const allowedOrigins = corsOriginEnv.split(',').map(s => s.trim()).filter(Boolean);
  corsOptions = {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: corsMethods,
    allowedHeaders: corsAllowedHeaders
  };
} else if (process.env.NODE_ENV === 'development') {
  corsOptions = {
    origin: true, 
    credentials: true,
    methods: corsMethods,
    allowedHeaders: corsAllowedHeaders
  };
} else {
  // Production fallback - should never hit this if CORS_ORIGIN is set properly
  console.warn('⚠️  CORS_ORIGIN not set in production! CORS will block all origins.');
  corsOptions = {
    origin: false,
    credentials: true,
    methods: corsMethods,
    allowedHeaders: corsAllowedHeaders
  };
}
app.use(cors(corsOptions));

// Logging and security checks
// Skip logging for health checks to reduce noise
app.use(morgan('dev', {
  skip: (req, res) => req.path === '/health'
}));
app.use(sanitizeRequest); 

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

// Dev-only: log Origin headers to help debug CORS preflight issues
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path && req.path.startsWith('/auth')) {
      console.log('Incoming request to', req.path, 'Origin:', req.headers.origin || '(none)');
    }
    next();
  });
}


// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/admins', adminRoutes);
app.use('/api/pending-apps', pendingAppsRoutes);
app.use('/api/franchise-applications', franchiseApplicationRoutes);
app.use('/reports', reportsRoutes);
app.use('/announcements', announcementRoutes);
app.use('/franchise-information', franchiseInformationRoutes);
app.use('/qr', qrCodeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/scheduler', require('./routes/schedulerRoutes'));


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5170;
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10
})
  .then(() => {
    console.log('MongoDB connected successfully');
    
    // Initialize franchise expiry scheduler
    const { initializeFranchiseExpiryScheduler } = require('./services/franchiseExpiryScheduler');
    initializeFranchiseExpiryScheduler();
    
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
