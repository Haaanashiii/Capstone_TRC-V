# TRC-V Docker Setup & Configuration Guide

## 📋 Table of Contents
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Docker Network Explained](#docker-network-explained)
- [PM2 Process Manager Configuration](#pm2-process-manager-configuration)
- [Network Access (LAN & Remote)](#network-access-lan--remote)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React/Vite)                                       │
│  Container: trc-v-dashboard                                  │
│  Port: 3000                                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Nginx Reverse Proxy                                         │
│  Container: trc-v-nginx                                      │
│  Ports: 80 (HTTP), 443 (HTTPS)                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend API (Node.js/Express)                               │
│  Container: trc-v-backend                                    │
│  Port: 5170                                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  MongoDB Database                                            │
│  Container: trc-v-mongodb                                    │
│  Port: 27017                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** (usually included with Docker Desktop)
- **Minimum 4GB RAM** allocated to Docker
- **Ports Available**: 80, 443, 3000, 5170, 27017

---

## 🚀 Quick Start

### 1. Clone & Navigate
```bash
cd /path/to/CAPSTONE_TRC-V
```

### 2. Configure Environment
```bash
# Copy the root .env file and edit it
cp .env .env.local  # Optional: keep a local copy
```

### 3. Build & Run
```bash
# Build and start all containers
docker-compose up -d --build

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Create Super Admin (First Time Only)
```bash
docker-compose exec backend node scripts/seedSuperAdmin.js
```

### 5. Access the System
- **Dashboard**: http://localhost:3000
- **API via Nginx**: http://localhost:80
- **Direct Backend**: http://localhost:5170 (for debugging)
- **MongoDB**: mongodb://localhost:27017

---

## ⚙️ Environment Configuration

### 🗂️ File Structure
```
CAPSTONE_TRC-V/
├── .env                          # ROOT: Main Docker environment
├── docker-compose.yml            # Docker orchestration
├── dashboard/
│   ├── .env                      # Frontend environment (build-time)
│   └── Dockerfile
├── server/
│   ├── .env                      # Backend environment (runtime)
│   └── Dockerfile
└── nginx/
    └── nginx.conf                # Nginx configuration
```

---

### 📝 ROOT `.env` (Docker Compose)

**Location**: `CAPSTONE_TRC-V/.env`

**Purpose**: Shared environment variables for all containers

```env
# ===========================================
# NODE ENVIRONMENT
# ===========================================
NODE_ENV=production              # Use 'development' for dev mode
DEBUG=false                      # Enable verbose logging
DOCKER_ENV=true                  # REQUIRED: Disables HTTPS redirect in Docker

# ===========================================
# PORTS
# ===========================================
PORT=5170                        # Backend API port

# ===========================================
# DATABASE
# ===========================================
MONGO_URI=mongodb://mongo:27017/trc_v  # Docker service name 'mongo'

# ===========================================
# SECURITY - JWT & SESSIONS
# ===========================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
SESSION_SECRET=your-super-secret-session-key-change-this
ENCRYPTION_KEY=your-32-character-encryption-key
QR_SIGNATURE_SECRET=your-qr-signature-secret-key

# ===========================================
# CORS & API URLs
# ===========================================
# IMPORTANT: Add ALL domains that will access your API
CORS_ORIGIN=http://localhost:3000,http://localhost:80,http://192.168.1.100:3000,https://your-frontend-domain.com

# Frontend API endpoint (what dashboard calls)
VITE_API_BASE_URL=http://localhost:80        # Local: nginx
# VITE_API_BASE_URL=https://api.yourdomain.com  # Production: your DDNS/domain

# Frontend redirect URL
VITE_CLIENT_REDIRECT=http://localhost:3000
BASE_URL=http://localhost:3000

# ===========================================
# EMAIL SERVICE (Nodemailer)
# ===========================================
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password    # Gmail: Create App Password
EMAIL_FROM=TRC-V System <your-email@gmail.com>

# ===========================================
# GOOGLE OAUTH (Optional)
# ===========================================
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5170/auth/google/callback
```

---

### 🎨 Frontend `.env` (Dashboard)

**Location**: `CAPSTONE_TRC-V/dashboard/.env`

**Purpose**: Build-time variables (baked into production bundle)

```env
# API endpoint (must match VITE_API_BASE_URL in root .env)
VITE_API_BASE_URL=http://localhost:80

# Google OAuth (if using)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# App configuration
VITE_APP_NAME=TRC-V
VITE_APP_VERSION=1.0.0
```

**⚠️ IMPORTANT**: 
- Prefix all variables with `VITE_`
- Changes require rebuild: `docker-compose up -d --build dashboard`
- Values are embedded in JavaScript bundle (not secret!)

---

### 🔧 Backend `.env` (Server)

**Location**: `CAPSTONE_TRC-V/server/.env`

**Purpose**: Runtime environment for backend API

```env
# This file is OPTIONAL in Docker setup
# Docker uses the root .env file
# Only needed for running backend outside Docker (npm start)

NODE_ENV=development
PORT=5170
MONGO_URI=mongodb://localhost:27017/trc_v
JWT_SECRET=your-jwt-secret
# ... same variables as root .env
```

---

### 🌐 Nginx Configuration

**Location**: `CAPSTONE_TRC-V/nginx/nginx.conf`

**Key Sections to Customize**:

```nginx
# 1. UPSTREAM BACKENDS (if you have multiple backend instances)
upstream backend_servers {
    least_conn;
    server backend:5170;
    # server backend2:5170;  # Add more instances
}

# 2. RATE LIMITING (adjust as needed)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

# 3. SSL/HTTPS (for production with DDNS)
server {
    listen 443 ssl http2;
    server_name your-subdomain.ddns.net;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Rest of config...
}
```

---

### 🐳 Docker Compose Configuration

**Location**: `CAPSTONE_TRC-V/docker-compose.yml`

**Key Sections to Customize**:

```yaml
name: trc-v  # Project name (change if needed)

services:
  # DASHBOARD
  dashboard:
    build:
      context: ./dashboard
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}  # From root .env
    ports:
      - "3000:80"  # Change left port for different host port
    container_name: trc-v-dashboard

  # BACKEND
  backend:
    build:
      context: ./server
    ports:
      - "5170:5170"  # Change left port for different host port
    environment:
      - NODE_ENV=${NODE_ENV}
      - DOCKER_ENV=${DOCKER_ENV}
      # Add any backend env vars here
    container_name: trc-v-backend

  # MONGODB
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"  # Change left port if needed
    volumes:
      - mongodb_data:/data/db  # Persistent storage
    container_name: trc-v-mongodb

  # NGINX
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"      # HTTP
      - "443:443"    # HTTPS (configure SSL first)
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # - ./nginx/ssl:/etc/nginx/ssl:ro  # Uncomment for SSL
    container_name: trc-v-nginx

volumes:
  mongodb_data:  # Named volume for database persistence
```

---

### 🔗 Docker Network Explained

**What is `trc-v_trcv-network`?**

Docker Compose automatically creates an internal network for container-to-container communication. This network is **required** even when your frontend is hosted externally (e.g., Vercel).

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXTERNAL (Internet)                                                 │
│                                                                      │
│  [Vercel Frontend] ──→ [DDNS: api.yoursite.com]                     │
│                              │                                       │
│                              ▼ Port Forward (80/443)                │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│  YOUR SERVER                 │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Docker Network: trc-v_trcv-network (internal)              │    │
│  │                                                              │    │
│  │  [Nginx :80/443] ←→ [Backend :5170] ←→ [MongoDB :27017]     │    │
│  │         ↑                  ↑                   ↑             │    │
│  │         └──────────────────┴───────────────────┘             │    │
│  │              All containers talk via internal network        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- External traffic enters through Nginx (ports 80/443)
- Internal container communication uses Docker DNS (e.g., `backend:5170`, `mongo:27017`)
- The network is isolated - containers can't be accessed directly from outside unless ports are exposed
- **You don't need to configure this** - Docker Compose handles it automatically

---

### ⚙️ PM2 Process Manager Configuration

**Location**: `CAPSTONE_TRC-V/server/ecosystem.config.js`

**Purpose**: PM2 manages the Node.js process inside the Docker container, providing auto-restart, clustering, and logging.

**Default Configuration:**

```javascript
module.exports = {
  apps: [{
    name: 'trc-v-api',
    script: 'index.js',
    
    // INSTANCES: How many Node.js processes to run
    // Options:
    //   1        = Single instance (recommended for low-traffic/development)
    //   2, 4, 8  = Fixed number of instances
    //   'max'    = Use all CPU cores (recommended for production)
    instances: 1,
    
    // EXECUTION MODE
    // 'cluster' = Multiple instances with load balancing
    // 'fork'    = Single process (use with instances: 1)
    exec_mode: 'cluster',
    
    // MEMORY LIMIT: Restart if process exceeds this
    // Increase for heavy workloads, decrease for limited RAM
    max_memory_restart: '500M',  // Options: '256M', '500M', '1G', '2G'
    
    // AUTO-RESTART SETTINGS
    autorestart: true,           // Restart on crash
    max_restarts: 10,            // Max restarts before giving up
    min_uptime: '10s',           // Must run 10s to count as "started"
    restart_delay: 1000,         // Wait 1s between restarts
    
    // LOGGING
    log_file: './logs/combined.log',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,            // Combine logs from all instances
    
    // GRACEFUL SHUTDOWN
    kill_timeout: 5000,          // Wait 5s for graceful shutdown
    wait_ready: true,            // Wait for 'ready' signal
    listen_timeout: 10000,       // Max 10s to start listening
  }]
};
```

**Common Customizations:**

| Setting | Low Resource PC | Standard Server | High Traffic Production |
|---------|-----------------|-----------------|------------------------|
| `instances` | `1` | `2` | `'max'` or `4+` |
| `max_memory_restart` | `'256M'` | `'500M'` | `'1G'` |
| `exec_mode` | `'fork'` | `'cluster'` | `'cluster'` |

**Example: Low Resource Configuration**
```javascript
// For development PCs with limited RAM
instances: 1,
exec_mode: 'fork',  // Single process mode
max_memory_restart: '256M',
```

**Example: Production Server Configuration**
```javascript
// For dedicated servers with multiple cores
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster',
max_memory_restart: '1G',
```

**PM2 Commands (inside container):**
```bash
# Enter backend container
docker-compose exec backend sh

# Check PM2 status
pm2 status

# View logs
pm2 logs

# Restart application
pm2 restart trc-v-api

# Monitor resources
pm2 monit
```

---

## 🌍 Network Access (LAN & Remote)

### Local Access (Same Machine)
- Dashboard: http://localhost:3000
- API: http://localhost:80
- Direct Backend: http://localhost:5170

### LAN Access (From Other Devices on Same Network)

#### Step 1: Find Your Server's IP Address
```bash
# Windows
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)

# Linux/Mac
ip addr show
# or
ifconfig
```

#### Step 2: Update CORS_ORIGIN in `.env`
```env
CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000,http://192.168.1.100:80
#                              ↑ Add your server's LAN IP
```

#### Step 3: Restart Containers
```bash
docker-compose down
docker-compose up -d
```

#### Step 4: Access from LAN Devices
- Dashboard: **http://192.168.1.100:3000**
- API: **http://192.168.1.100:80**

**⚠️ Note**: Replace `192.168.1.100` with YOUR actual IP address

### Firewall Rules (Windows)
```powershell
# Allow inbound traffic on ports 80, 443, 3000
New-NetFirewallRule -DisplayName "TRC-V HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "TRC-V HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "TRC-V Dashboard" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## 🚀 Production Deployment

### Architecture
```
[Hosting Site (Frontend)]
         ↓ HTTPS
[DDNS Subdomain] ← Updates every 5s
         ↓ Port Forward
[Your Server] → [Docker Nginx] → [Backend]
```

### Step 1: Setup DDNS
1. Register with DDNS provider (e.g., No-IP, DuckDNS, Dynu)
2. Create subdomain: `yourcompany.ddns.net`
3. Install DDNS client on your server (updates every 5s)

### Step 2: Configure Port Forwarding
On your router:
- Forward port **80** → Your Server IP:80
- Forward port **443** → Your Server IP:443

### Step 3: SSL Certificate (HTTPS)
```bash
# Option 1: Let's Encrypt (Free)
# Install certbot
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  certbot/certbot certonly --standalone \
  -d yourcompany.ddns.net

# Option 2: Self-signed (Testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### Step 4: Update nginx.conf
```nginx
server {
    listen 443 ssl http2;
    server_name yourcompany.ddns.net;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # CRITICAL!
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourcompany.ddns.net;
    return 301 https://$server_name$request_uri;
}
```

### Step 5: Update `.env` for Production
```env
NODE_ENV=production
DOCKER_ENV=true  # KEEP THIS!

# Update CORS for your frontend domain
CORS_ORIGIN=https://your-frontend-vercel.app,https://yourcompany.ddns.net,http://192.168.1.100:3000

# Update API URL
VITE_API_BASE_URL=https://yourcompany.ddns.net

# Update base URLs
BASE_URL=https://your-frontend-vercel.app
VITE_CLIENT_REDIRECT=https://your-frontend-vercel.app
```

### Step 6: Rebuild & Deploy
```bash
docker-compose down
docker-compose up -d --build
```

---

## 🛠️ Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs nginx

# Check if ports are in use
netstat -ano | findstr "80"
netstat -ano | findstr "3000"
```

### CORS Errors
- Add frontend domain to `CORS_ORIGIN` in `.env`
- Make sure `DOCKER_ENV=true` is set
- Restart containers after changes

### 308 Redirect Errors
- Verify `DOCKER_ENV=true` in `.env`
- Check nginx passes `X-Forwarded-Proto` header
- Ensure enforceHttps middleware reads the header

### Can't access from LAN
- Check firewall rules
- Verify IP address is correct
- Add LAN IP to `CORS_ORIGIN`
- Test with: `curl http://YOUR-IP:80/health`

### Database connection issues
```bash
# Check MongoDB is running
docker-compose ps mongo

# Check connection string
docker-compose exec backend env | grep MONGO_URI

# Connect to MongoDB shell
docker-compose exec mongo mongosh trc_v
```

### Frontend can't reach backend
1. Check `VITE_API_BASE_URL` matches nginx port
2. Rebuild dashboard: `docker-compose up -d --build dashboard`
3. Clear browser cache
4. Check network tab in browser DevTools

---

## 📚 Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild specific service
docker-compose up -d --build backend

# View logs
docker-compose logs -f backend
docker-compose logs --tail 50 nginx

# Execute command in container
docker-compose exec backend sh
docker-compose exec mongo mongosh

# Check container stats
docker stats

# Remove all data (DANGER!)
docker-compose down -v  # Removes volumes/database
```

---

## 📞 Support & Contact

For issues or questions about this codebase:
- Repository: ray-Gabs/CAPSTONE_TRC-V
- Email: raygabs89@gmail.com

---

**Last Updated**: December 18, 2025
