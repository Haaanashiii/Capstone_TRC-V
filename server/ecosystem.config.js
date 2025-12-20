/**
 * PM2 Ecosystem Configuration - Enterprise Scale
 * ================================================
 * 
 * WHAT IS PM2?
 * PM2 is a process manager for Node.js that:
 *   - Keeps your server running 24/7 (auto-restarts on crash)
 *   - Runs multiple Node.js instances for better performance
 *   - Distributes incoming requests between instances
 *   - Provides zero-downtime reloads
 *   - Collects metrics and logs
 * 
 * SCALING GUIDE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Scale Level    │ PM2_INSTANCES │ Docker Containers │ Total     │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Single Office  │ 2             │ 1                  │ 2 workers │
 * │ City-wide      │ 4             │ 2                  │ 8 workers │
 * │ Province       │ max           │ 4+                 │ 16+ workers│
 * │ Enterprise     │ max           │ Docker Swarm/K8s   │ Auto-scale│
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * USAGE:
 *   # Development (single instance)
 *   node index.js
 *   
 *   # Production (cluster mode)
 *   pm2 start ecosystem.config.js --env production
 *   
 *   # Override instances at runtime
 *   PM2_INSTANCES=4 pm2 start ecosystem.config.js --env production
 *   
 *   # Zero-downtime reload
 *   pm2 reload ecosystem.config.js --env production
 *   
 *   # View metrics and status
 *   pm2 monit         # Live dashboard
 *   pm2 plus          # PM2 Plus monitoring (optional)
 *   pm2 status        # Quick status check
 * 
 * ENVIRONMENT VARIABLES:
 *   PM2_INSTANCES     - Number of workers (default: 2, use "max" for all CPUs)
 *   PM2_EXEC_MODE     - "cluster" or "fork" (default: cluster)
 *   PM2_MAX_MEMORY    - Memory limit per worker (default: 512M)
 */

// Determine instance count from environment or default
const getInstanceCount = () => {
  const envInstances = process.env.PM2_INSTANCES;
  if (envInstances === 'max') return 0; // PM2 interprets 0 as "max"
  if (envInstances && !isNaN(parseInt(envInstances))) {
    return parseInt(envInstances);
  }
  // Default: 2 instances (good balance for most deployments)
  return 2;
};

module.exports = {
  apps: [
    {
      name: 'trc-v-api',
      script: 'index.js',
      
      // ═══════════════════════════════════════════════════════════════
      // CLUSTER MODE CONFIGURATION
      // ═══════════════════════════════════════════════════════════════
      // PM2_INSTANCES=max for all CPUs, or set specific number
      instances: getInstanceCount(),
      exec_mode: process.env.PM2_EXEC_MODE || 'cluster',
      
      // ═══════════════════════════════════════════════════════════════
      // MEMORY MANAGEMENT
      // ═══════════════════════════════════════════════════════════════
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',
      node_args: [
        '--max-old-space-size=512',    // V8 heap limit (match max_memory_restart)
        '--optimize-for-size',          // Optimize memory over speed
        '--gc-interval=100'              // More frequent garbage collection
      ],
      
      // ═══════════════════════════════════════════════════════════════
      // ENVIRONMENT VARIABLES
      // ═══════════════════════════════════════════════════════════════
      env_production: {
        NODE_ENV: 'production',
        PORT: 5170,
        UV_THREADPOOL_SIZE: 16,         // Increase thread pool for I/O
        NODE_OPTIONS: '--enable-source-maps'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 5170,
        DEBUG: 'true'
      },
      
      // ═══════════════════════════════════════════════════════════════
      // GRACEFUL SHUTDOWN (Critical for zero-downtime deployments)
      // ═══════════════════════════════════════════════════════════════
      kill_timeout: 10000,              // 10s to close connections
      wait_ready: true,                 // Wait for process.send('ready')
      listen_timeout: 15000,            // 15s to start listening
      shutdown_with_message: true,      // Send SIGINT message
      
      // ═══════════════════════════════════════════════════════════════
      // AUTO-RESTART CONFIGURATION
      // ═══════════════════════════════════════════════════════════════
      autorestart: true,
      max_restarts: 15,                 // Allow more restarts before giving up
      min_uptime: '10s',
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,   // Exponential backoff: 100ms, 200ms, 400ms...
      
      // ═══════════════════════════════════════════════════════════════
      // LOGGING (Enterprise-ready)
      // ═══════════════════════════════════════════════════════════════
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      merge_logs: true,
      
      // Rotate logs (prevents disk fill)
      // Requires: pm2 install pm2-logrotate
      // Configure with: pm2 set pm2-logrotate:max_size 50M
      
      // ═══════════════════════════════════════════════════════════════
      // WATCH MODE (Development only)
      // ═══════════════════════════════════════════════════════════════
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'backups', '*.log'],
      
      // ═══════════════════════════════════════════════════════════════
      // CRON RESTART (Optional - restart daily at 4 AM for memory cleanup)
      // ═══════════════════════════════════════════════════════════════
      // cron_restart: '0 4 * * *',
      
      // ═══════════════════════════════════════════════════════════════
      // SOURCE MAPS (Better error stack traces)
      // ═══════════════════════════════════════════════════════════════
      source_map_support: true
    }
  ],

  // ═══════════════════════════════════════════════════════════════════
  // DEPLOYMENT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  // Usage: pm2 deploy production setup && pm2 deploy production
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'ubuntu',
      host: process.env.DEPLOY_HOST || 'YOUR_SERVER_IP',
      ref: 'origin/main',
      repo: 'git@github.com:ray-Gabs/CAPSTONE_TRC-V.git',
      path: '/var/www/trc-v',
      
      // Pre-deploy: Pull and install
      'pre-deploy-local': '',
      'post-deploy': [
        'cd server',
        'npm ci --only=production',
        'pm2 reload ecosystem.config.js --env production --update-env'
      ].join(' && '),
      'pre-setup': 'apt-get update && apt-get install -y git',
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production'
      }
    },
    
    // Staging environment (optional)
    staging: {
      user: process.env.STAGING_USER || 'ubuntu',
      host: process.env.STAGING_HOST || 'YOUR_STAGING_IP',
      ref: 'origin/develop',
      repo: 'git@github.com:ray-Gabs/CAPSTONE_TRC-V.git',
      path: '/var/www/trc-v-staging',
      'post-deploy': 'cd server && npm ci && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
