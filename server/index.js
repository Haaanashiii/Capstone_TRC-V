const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Load environment variables first
dotenv.config();

const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter, authLimiter, qrVerificationLimiter } = require('./middlewares/rateLimiter');
const { sanitizeRequest } = require('./middlewares/validateRequest');
const { enforceHttps } = require('./middlewares/securityHeaders');
const { auditLogService } = require('./services/auditLogService');
const storage = require('./services/storageAdapter');

// API Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userAccountRoutes');
const adminRoutes = require('./routes/adminAccountRoutes');
const pendingAppsRoutes = require('./routes/pendingAppsRoutes');
const incidentReportsRoutes = require('./routes/reportsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const franchiseInformationRoutes = require('./routes/franchiseInformationRoutes');
const franchiseApplicationRoutes = require('./routes/franchiseApplicationRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const fareMatrixRoutes = require('./routes/fareMatrixRoutes');
const rolePageAccessRoutes = require('./routes/rolePageAccessRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const backupRoutes = require('./routes/backupRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const server = http.createServer(app);

// Socket.IO log level: 'debug' | 'info' | 'warn' | 'error'
const SOCKET_LOG_LEVEL = process.env.SOCKET_LOG_LEVEL || 'info';
const shouldLog = {
  debug: () => SOCKET_LOG_LEVEL === 'debug',
  info: () => ['debug', 'info'].includes(SOCKET_LOG_LEVEL),
  warn: () => ['debug', 'info', 'warn'].includes(SOCKET_LOG_LEVEL),
  error: () => true // Always log errors
};

// JWT token cache (1 min TTL) - speeds up Socket.IO auth
const TOKEN_CACHE_TTL = 60 * 1000;

class ExpiringMap {
  constructor(ttl) {
    this.ttl = ttl;
    this.map = new Map();
  }
  
  set(key, value) {
    if (this.map.has(key)) {
      const old = this.map.get(key);
      if (old && old.timeout) clearTimeout(old.timeout);
    }
    const timeout = setTimeout(() => this.map.delete(key), this.ttl);
    this.map.set(key, { value, timeout });
  }
  
  get(key) {
    const entry = this.map.get(key);
    return entry?.value || null;
  }
  
  delete(key) {
    const entry = this.map.get(key);
    if (entry && entry.timeout) clearTimeout(entry.timeout);
    return this.map.delete(key);
  }
}

const tokenCache = new ExpiringMap(TOKEN_CACHE_TTL);

const getCachedToken = (token) => {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.decoded;
  }
  tokenCache.delete(token);
  return null;
};

const cacheManager = require('./utils/cache');
const { TTL } = require('./utils/cache');

// Socket.IO allowed origins from CORS_ORIGIN env
const socketCorsOrigin = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production' ? false : '*');

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  engine: { wsEngine: 'ws' },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.set('io', io);

io.on('error', (error) => console.error('[SOCKET] Error:', error));

// Auth middleware - verify JWT token on connect
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  // Anonymous users can still view announcements
  if (!token) {
    socket.userId = 'anon-' + Math.random().toString(36).substr(2, 9);
    socket.userEmail = null;
    socket.userRole = null;
    socket.isAuthenticated = false;
    
    if (shouldLog.debug()) console.log(`[SOCKET.IO] Anonymous connection: ${socket.userId}`);
    return next();
  }
  
  try {
    // Check cache first, then verify
    let decoded = getCachedToken(token);
    
    if (!decoded) {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      tokenCache.set(token, {
        decoded,
        expiresAt: Date.now() + TOKEN_CACHE_TTL
      });
      }
    
    // Attach user info to socket
    socket.userId = decoded.userId || decoded.id || decoded._id || decoded.adminId;
    socket.userEmail = decoded.email;
    socket.userRole = decoded.role;
    socket.isAuthenticated = true;
    
    if (shouldLog.info()) console.log(`[SOCKET.IO] Authenticated: ${socket.userId} (${decoded.role})`);
    next();
  } catch (err) {
    console.error('[SOCKET.IO] Token verification failed:', err.message);
    // If token is invalid but provided, reject
    next(new Error('Invalid or expired token'));
  }
});

// Socket connection handler
io.on('connection', (socket) => {
  if (shouldLog.info()) console.log(`[SOCKET] Connected: ${socket.id} (${socket.userRole || 'anon'})`);
  
  socket.join('announcements');
  
  socket.on('error', (error) => console.error(`[SOCKET] Error:`, error));
  
  // Room join handler
  socket.on('join-room', async (room) => {
    // Validate room name format to prevent injection attacks
    if (typeof room !== 'string' || room.length > 100 || !/^[a-z0-9\-]*$/.test(room)) {
      socket.emit('error', { message: 'Invalid room name' });
      return;
    }
    
    // Auth required for private rooms
    if (!socket.isAuthenticated) {
      if (room === 'announcements') {
        socket.join(room);
        if (shouldLog.debug()) console.log(`[SOCKET.IO] Anonymous user ${socket.userId} joined announcements room`);
        return;
      }
      socket.emit('error', { message: 'Authentication required for this room' });
      return;
    }
    
    // Allowed rooms
    const allowedRooms = ['general', 'announcements', 'operators-room', 'bplo-admins', 'sb-admins'];
    const isPersonalRoom = room.startsWith('user-') && room.length < 50;
    
    if (!allowedRooms.includes(room) && !isPersonalRoom) {
      if (shouldLog.warn()) console.warn(`[SOCKET] Blocked: ${socket.userId} → ${room}`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const requestedUserId = isPersonalRoom ? room.slice(5) : null;
    
    // Role-based room access
    const canAccessRoom = () => {
      if (room === 'general' || room === 'announcements') return true;
      
      if (socket.userRole === 'super-admin') {
        return !isPersonalRoom || socket.userId === requestedUserId;
      }
      if (socket.userRole === 'bplo-admin') {
        return room === 'bplo-admins' || (isPersonalRoom && socket.userId === requestedUserId);
      }
      if (socket.userRole === 'sb-admin') {
        return room === 'sb-admins' || (isPersonalRoom && socket.userId === requestedUserId);
      }
      if (socket.userRole === 'operator') {
        return room === 'operators-room' || (isPersonalRoom && socket.userId === requestedUserId);
      }
      return false;
    };
    
    // Check if user is authorized
    if (!canAccessRoom()) {
      if (shouldLog.warn()) console.warn(`[SOCKET.IO] UNAUTHORIZED: User ${socket.userId} (${socket.userRole}) tried to join ${room}`);
      socket.emit('error', { message: `Not authorized to join room: ${room}` });
      return;
    }
    
    socket.join(room);
    if (shouldLog.info()) console.log(`[SOCKET] Joined: ${socket.userId} → ${room}`);
    
    // Send initial data (cached)
    try {
      const FranchiseApplication = require('./models/franchiseApplicationModel');
      const AdminAccount = require('./models/adminAccountModel');
      
      if (room === 'sb-admins') {
        const cacheKey = 'socket-sb-admins';
        let applications = cacheManager.get(cacheKey);
        
        if (!applications) {
          applications = await FranchiseApplication
            .find({ statusOfBPLO: 'awaiting-sb' })
            .sort({ submittedAt: -1 })
            .limit(50)
            .lean();
          cacheManager.set(cacheKey, applications, TTL.SOCKET_DATA);
        }
        
        socket.emit('approved-applications', applications);
      } else if (room === 'bplo-admins') {
        const cacheKey = 'socket-bplo-admins';
        let applications = cacheManager.get(cacheKey);
        
        if (!applications) {
          applications = await FranchiseApplication
            .find({ statusOfBPLO: 'pending' })
            .sort({ submittedAt: -1 })
            .limit(50)
            .lean();
          cacheManager.set(cacheKey, applications, TTL.SOCKET_DATA);
        }
        
        socket.emit('pending-applications', applications);
      } else if (room.startsWith('user-')) {
        // Personal room
      } else if (room === 'operators-room') {
        // Operators room
      }
    } catch (error) {
      console.error(`[SOCKET] Error:`, error.message);
    }
  });
  
  socket.on('join', (data) => {
    if (data?.userId) socket.join(`user-${data.userId}`);
  });
  
  socket.on('disconnect', () => {});
});

// Trust proxy (for NGINX reverse proxy)
app.set('trust proxy', 1);

// Content Security Policy
const cspDirectives = process.env.NODE_ENV === 'production'
  ? {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  : {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", "ws://localhost:5170", "ws://localhost:*"]
    };

app.use(helmet({
  contentSecurityPolicy: {
    directives: cspDirectives
  },
  referrerPolicy: { policy: 'same-origin' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'sameorigin' }
})); 

app.use(enforceHttps); 

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// CORS
const corsOriginEnv = process.env.CORS_ORIGIN || '';
let corsOptions;
const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
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
  console.warn('[WARNING] CORS_ORIGIN not set!');
  corsOptions = {
    origin: false,
    credentials: true,
    methods: corsMethods,
    allowedHeaders: corsAllowedHeaders
  };
}
app.use(cors(corsOptions));

// Logging (skip health checks)
app.use(morgan('dev', { skip: (req) => req.path === '/health' }));
app.use(sanitizeRequest);

// Static files
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Audit logging
app.use(auditLogService.createAuditMiddleware({
  excludePaths: ['/health', '/api/verify', '/announcements'],
  logBody: false
}));

// Debug CORS in dev
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
app.use('/api/incident-reports', incidentReportsRoutes);
app.use('/announcements', apiLimiter, announcementRoutes);
app.use('/api/franchise-information', apiLimiter, franchiseInformationRoutes);
app.use('/qr', qrVerificationLimiter, qrCodeRoutes);
app.use('/api/sessions', apiLimiter, sessionRoutes);
app.use('/api/scheduler', apiLimiter, require('./routes/schedulerRoutes'));
app.use('/api/audit-logs', apiLimiter, auditLogRoutes);
app.use('/api/fare-matrix', apiLimiter, fareMatrixRoutes);
app.use('/api/role-page-access', apiLimiter, rolePageAccessRoutes);
app.use('/api/certificates', apiLimiter, certificateRoutes);
app.use('/api/backup', apiLimiter, backupRoutes);
app.use('/api/files', fileRoutes); 

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cache stats endpoint (super-admin only)
app.get('/api/admin/cache-stats', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'super-admin') {
      return res.status(403).json({ success: false, message: 'Super-admin access required' });
    }
    
    const cacheManager = require('./utils/cache');
    const stats = cacheManager.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

// Cache management endpoint (admin only)
app.post('/api/admin/cache-clear', (req, res) => {
  const cacheManager = require('./utils/cache');
  const { pattern } = req.body;
  
  // In production, verify admin authentication
  if (pattern) {
    const deleted = cacheManager.deletePattern(pattern);
    res.json({
      success: true,
      message: `Cleared ${deleted} cache entries matching pattern: ${pattern}`
    });
  } else {
    cacheManager.clear();
    res.json({
      success: true,
      message: 'All cache entries cleared'
    });
  }
});

// Debug IP detection
app.get('/debug/ip', (req, res) => {
  const { getClientIp } = require('./utils/ipHelper');
  res.json({
    ip: getClientIp(req),
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null
    }
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5170;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const startTime = Date.now();

// Connect to MongoDB first, then start the HTTP server
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000, 
  maxPoolSize: 50,                 
  minPoolSize: 5,                  
  socketTimeoutMS: 30000,          
  family: 4,
  bufferCommands: false,           
  autoIndex: false                 
})
  .then(async () => {
    const mongoTime = Date.now() - startTime;
    console.log(`MongoDB connected in ${mongoTime}ms | ${storage.storageType}`);

    setImmediate(() => storage.init());

    server.listen(PORT, HOST, () => {
      console.log(`\nTRC-V Server | Port ${PORT} | Host ${HOST} | ${Date.now() - startTime}ms\n`);
      setTimeout(async () => {
        try {
          const indexStartTime = Date.now();
          const modelNames = mongoose.modelNames();
          if (modelNames.length > 0) {
            await Promise.all(
              modelNames.map(name => mongoose.model(name).syncIndexes())
            );
            console.log(`[Startup] Indexes synced (${modelNames.length} models) in ${Date.now() - indexStartTime}ms`);
          }
        } catch (err) {
          console.error('[Startup] Index sync error:', err.message);
        }
      }, 500); 
      setTimeout(() => {
        try { require('./services/franchiseExpiryScheduler').initializeFranchiseExpiryScheduler(); } catch (e) { console.error('[Scheduler] Expiry scheduler error:', e.message); }
        try { require('./services/backupScheduler').initializeBackupScheduler(); } catch (e) { console.error('[Scheduler] Backup scheduler error:', e.message); }
        try { require('./services/healthMonitorService').initializeHealthMonitor(); } catch (e) { console.error('[Scheduler] Health monitor error:', e.message); }
        console.log('[Startup] Schedulers initialized');
      }, 3000);
    });
  })
  .catch((err) => {
    console.error('MongoDB failed:', err.message);
    process.exit(1);
  });
