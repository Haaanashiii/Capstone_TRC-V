/**
 * PM2 Ecosystem Configuration
 * =============================
 * 
 * WHAT IS PM2?
 * PM2 is a process manager for Node.js that:
 *   - Keeps your server running 24/7 (auto-restarts on crash)
 *   - Runs multiple Node.js instances for better performance
 *   - Distributes incoming requests between instances
 *   - Saves logs to files
 * 
 * WHEN TO USE:
 *   - Windows (your PC):     DON'T use PM2, just run: node index.js
 *   - Ubuntu (production):   USE PM2 with this config
 * 
 * USAGE (on Ubuntu server):
 *   pm2 start ecosystem.config.js --env production    # Start all instances
 *   pm2 reload ecosystem.config.js --env production   # Restart without downtime
 *   pm2 stop all                                      # Stop everything
 *   pm2 logs                                          # View logs
 *   pm2 monit                                         # Live monitoring dashboard
 *   pm2 status                                        # Check status
 * 
 * CLUSTER MODE:
 *   - "max" = use all CPU cores (e.g., 4 cores = 4 Node.js instances)
 *   - Or set a number: instances: 4
 * 
 * LOAD BALANCING:
 *   - PM2 cluster uses round-robin by default
 *   - For "least connections" behavior, use Nginx upstream (see nginx-production.conf)
 */

module.exports = {
  apps: [
    {
      name: 'trc-v-api',
      script: 'index.js',
      
      // CLUSTER MODE - Multiple Node.js instances
      // "max" = Use all available CPU cores
      // Set to a number if you want specific count: instances: 4
      instances: 'max',
      exec_mode: 'cluster',
      
      // Auto-restart settings
      watch: false,  // Don't watch files in production
      max_memory_restart: '500M',  // Restart if using > 500MB RAM
      
      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 5170
      },
      
      // Environment variables for development
      env_development: {
        NODE_ENV: 'development',
        PORT: 5170
      },
      
      // Logging
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,
      
      // Exponential backoff for restarts (prevents crash loops)
      exp_backoff_restart_delay: 100
    }
  ],

  // Deployment configuration (optional - for git pull + restart)
  deploy: {
    production: {
      // SSH user and host
      user: 'ubuntu',  // Change to your username
      host: 'YOUR_SERVER_IP',  // Change to your server IP
      
      // Repository
      ref: 'origin/main',
      repo: 'git@github.com:ray-Gabs/CAPSTONE_TRC-V.git',
      path: '/var/www/trc-v',
      
      // Commands to run after git pull
      'pre-deploy-local': '',
      'post-deploy': 'cd server && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
