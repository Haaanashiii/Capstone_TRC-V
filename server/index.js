const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter, authLimiter, qrVerificationLimiter } = require('./middlewares/rateLimiter');
const { sanitizeRequest } = require('./middlewares/validateRequest');
const { enforceHttps } = require('./middlewares/securityHeaders');
const { auditLogService } = require('./services/auditLogService');
  
// Lazy-load routes (improves startup time)
console.log('[SERVER] Loading routes...');
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
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const fareMatrixRoutes = require('./routes/fareMatrixRoutes');
console.log('[SERVER] ✅ Routes loaded');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
// Dynamically allows origins from CORS_ORIGIN env variable
const socketCorsOrigin = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production' ? false : '*');

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Engine configuration for WebSocket support
  engine: {
    wsEngine: 'ws'
  },
  // Additional production-ready settings
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Store io instance in app for access in controllers
app.set('io', io);

// Socket.IO error handling
io.on('error', (error) => {
  console.error('[SOCKET.IO] Server error:', error);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[SOCKET.IO] Client connected: ${socket.id}`);
  console.log(`[SOCKET.IO] Available transports: websocket, polling`);
  console.log(`[SOCKET.IO] Connection handshake:', { id: socket.id, connected: socket.connected }`);
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`[SOCKET.IO] Socket error for ${socket.id}:`, error);
  });
  
  // Allow clients to join specific rooms based on their role
  socket.on('join-room', async (room) => {
    if (!['bplo-admins', 'sb-admins', 'users', 'general'].includes(room)) {
      console.warn(`[SOCKET.IO] Invalid room requested: ${room}`);
      return;
    }
    
    console.log(`[SOCKET.IO] Client ${socket.id} attempting to join room: ${room}`);
    socket.join(room);
    console.log(`[SOCKET.IO] Client ${socket.id} successfully joined room: ${room}`);
    
    // Emit current state when joining room (prevents stale data)
    try {
      const FranchiseApplication = require('./models/franchiseApplicationModel');
      
      if (room === 'sb-admins') {
        // SB admins see applications that are awaiting SB approval
        const applications = await FranchiseApplication.find({
          statusOfBPLO: 'awaiting-sb'
        }).sort({ submittedAt: -1 });
        socket.emit('approved-applications', applications);
        console.log(`[SOCKET.IO] Sent ${applications.length} awaiting-sb applications to SB admin`);
      } else if (room === 'bplo-admins') {
        // BPLO admins see pending applications
        const applications = await FranchiseApplication.find({
          statusOfBPLO: 'pending'
        }).sort({ submittedAt: -1 });
        socket.emit('pending-applications', applications);
        console.log(`[SOCKET.IO] Sent ${applications.length} pending applications to BPLO admin`);
      } else if (room === 'general') {
        // General room for dashboard pages - no initial state needed
        console.log(`[SOCKET.IO] Client ${socket.id} joined general room for dashboard updates`);
      }
    } catch (error) {
      console.error(`[SOCKET.IO] Error fetching initial data for ${room}:`, error.message);
    }
  });
  
  // Handle user-specific room joins
  socket.on('join', (data) => {
    if (data?.userId) {
      const userRoom = `user-${data.userId}`;
      socket.join(userRoom);
      console.log(`[SOCKET.IO] User ${data.userId} joined personal room: ${userRoom}`);
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`[SOCKET.IO] Client disconnected: ${socket.id}`);
  });
});

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
      connectSrc: ["'self'", "https://trc-v.vercel.app", "https://*.vercel.app", "https://*.workers.dev", "ws://localhost:5170", "ws://localhost:*"]
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
app.use(auditLogService.createAuditMiddleware({
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
app.use('/auth', authLimiter, authRoutes);
app.use('/users', apiLimiter, userRoutes);
app.use('/admins', apiLimiter, adminRoutes);
app.use('/api/pending-apps', apiLimiter, pendingAppsRoutes);
app.use('/api/franchise-applications', apiLimiter, franchiseApplicationRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/reports', apiLimiter, reportsRoutes);
app.use('/announcements', apiLimiter, announcementRoutes);
app.use('/api/franchise-information', apiLimiter, franchiseInformationRoutes);
app.use('/qr', qrVerificationLimiter, qrCodeRoutes);
app.use('/api/sessions', apiLimiter, sessionRoutes);
app.use('/api/scheduler', apiLimiter, require('./routes/schedulerRoutes'));
app.use('/api/audit-logs', apiLimiter, auditLogRoutes);
app.use('/api/fare-matrix', apiLimiter, fareMatrixRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// IP debug endpoint (helpful for testing IP detection)
app.get('/debug/ip', (req, res) => {
  const { getClientIp } = require('./utils/ipHelper');
  const detectedIp = getClientIp(req, true); // Enable debug logging
  
  res.status(200).json({
    detectedIp,
    headers: {
      'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null,
      'user-agent': req.headers['user-agent'] || null
    },
    express: {
      ip: req.ip || null,
      ips: req.ips || [],
      protocol: req.protocol
    },
    connection: {
      remoteAddress: req.connection?.remoteAddress || null,
      remotePort: req.connection?.remotePort || null
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5170;

console.log('[SERVER] Starting server initialization...');
const startTime = Date.now();

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // Increase timeout to 10 seconds
  maxPoolSize: 10,
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
})
  .then(() => {
    const dbConnectTime = Date.now() - startTime;
    console.log(`[SERVER] ✅ MongoDB connected (${dbConnectTime}ms)`);
    
    // Start server immediately, initialize scheduler in background
    server.listen(PORT, '0.0.0.0', () => {
      const totalBootTime = Date.now() - startTime;
      console.log(`[SERVER] ✅ Server running on port ${PORT} (${totalBootTime}ms)`);
      console.log(`[SERVER] ✅ Socket.IO enabled on ws://0.0.0.0:${PORT}/socket.io/`);
      console.log(`[SERVER] ✅ Socket.IO CORS enabled for origins: ${socketCorsOrigin}`);
      
      // Initialize scheduler AFTER server starts (non-blocking)
      setImmediate(() => {
        try {
          const { initializeFranchiseExpiryScheduler } = require('./services/franchiseExpiryScheduler');
          initializeFranchiseExpiryScheduler();
        } catch (err) {
          console.error('[SERVER] ⚠️  Scheduler initialization failed:', err.message);
        }
      });
    });
  })
  .catch((err) => {
    console.error('[SERVER] ❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
