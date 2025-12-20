# TRC-V Production Deployment Guide

## Overview

This guide explains how to connect a **hosted frontend** (on a web hosting service like Hostinger, iFast, or cPanel) to your **local backend server** running Docker with Nginx and PM2.

> 📈 **Enterprise Scaling:** For multi-server clusters and high-availability setups, see [ENTERPRISE_SCALING_GUIDE.md](ENTERPRISE_SCALING_GUIDE.md)

---

## 🎯 Complete Request Flow

Here's exactly how a user request flows through your system:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              THE COMPLETE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. USER visits https://yourdomain.com (hosted on Hostinger/iFast)              │
│                          │                                                       │
│                          ▼                                                       │
│  2. FRONTEND loads from web host, makes API call to api.yourdomain.com          │
│                          │                                                       │
│                          ▼                                                       │
│  3. DNS resolves api.yourdomain.com → CNAME → yourcompany.ddns.net              │
│                          │                                                       │
│                          ▼                                                       │
│  4. DDNS resolves yourcompany.ddns.net → Your Public IP (updated every 5 min)   │
│                          │                                                       │
│                          ▼                                                       │
│  5. ROUTER receives request on port 80/443, forwards to 192.168.x.x:80          │
│                          │                                                       │
│                          ▼                                                       │
│  6. NGINX (Docker) receives request, load balances to backend                   │
│                          │                                                       │
│                          ▼                                                       │
│  7. BACKEND (PM2 cluster) processes request, queries MongoDB/Redis              │
│                          │                                                       │
│                          ▼                                                       │
│  8. RESPONSE travels back: Backend → Nginx → Router → Internet → User           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Visual Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                          │
│                                                                                │
│  ┌────────────────────────┐              ┌─────────────────────────────────┐  │
│  │  HOSTED FRONTEND       │              │  YOUR DOMAIN (DNS)              │  │
│  │  ━━━━━━━━━━━━━━━━━━━   │              │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  Hostinger / iFast     │   API Call   │  yourdomain.com → Hostinger IP  │  │
│  │  cPanel / Netlify      │ ───────────→ │  api.yourdomain.com → DDNS      │  │
│  │  Vercel / etc.         │              │       ↓                          │  │
│  │                        │              │  yourcompany.ddns.net            │  │
│  │  Files: HTML/JS/CSS    │              │       ↓                          │  │
│  │  (Static React build)  │              │  YOUR PUBLIC IP                  │  │
│  └────────────────────────┘              └─────────────────────────────────┘  │
│                                                        │                       │
└────────────────────────────────────────────────────────┼───────────────────────┘
                                                         │
                                                         ▼ Port 80/443
┌────────────────────────────────────────────────────────────────────────────────┐
│                         YOUR LOCAL NETWORK / SERVER                             │
│                                                                                 │
│  ┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐     │
│  │     ROUTER      │      │      NGINX       │      │   BACKEND (PM2)    │     │
│  │  ━━━━━━━━━━━━   │      │  ━━━━━━━━━━━━━   │      │  ━━━━━━━━━━━━━━━   │     │
│  │  Port Forward:  │─────→│  Load Balancer   │─────→│  Node.js Cluster   │     │
│  │  80 → Server:80 │      │  SSL Termination │      │  2-16+ workers     │     │
│  │  443→ Server:443│      │  Rate Limiting   │      │                    │     │
│  └─────────────────┘      └──────────────────┘      └─────────┬──────────┘     │
│                                                                │                │
│        ┌──────────────────────────────────────────────────────┘                │
│        │                                                                        │
│        ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐      │
│  │                        DATA LAYER                                     │      │
│  │  ┌─────────────────────┐        ┌─────────────────────────┐          │      │
│  │  │      MongoDB        │        │         Redis           │          │      │
│  │  │  ━━━━━━━━━━━━━━━━   │        │  ━━━━━━━━━━━━━━━━━━━━   │          │      │
│  │  │  Database           │        │  Sessions + Socket.IO   │          │      │
│  │  │  Port: 27017        │        │  Port: 6379             │          │      │
│  │  └─────────────────────┘        └─────────────────────────┘          │      │
│  └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│  DDNS Client: Updates IP to DDNS provider every 5 minutes                      │
│  Server Static IP: 192.168.x.x (configured via router DHCP reservation)        │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Deployment Checklist

Use this checklist to track your progress:

### Phase 1: Local Server Setup
- [ ] Install Docker on your server PC
- [ ] Clone the repository
- [ ] Configure `.env` file with production values
- [ ] Set static IP for your server (192.168.x.x)
- [ ] Start Docker containers and verify they work locally

### Phase 2: Network Configuration
- [ ] Set up DDNS account (No-IP, Duck DNS, or router built-in)
- [ ] Install DDNS update client (5-minute interval)
- [ ] Configure router port forwarding (80 and 443)
- [ ] Open firewall ports on server PC
- [ ] Test: Can you access your server from outside your network?

### Phase 3: Domain Configuration
- [ ] Add CNAME record: `api` → `yourcompany.ddns.net`
- [ ] Wait for DNS propagation (use dnschecker.org)
- [ ] Test: Does `api.yourdomain.com` resolve correctly?

### Phase 4: SSL/HTTPS Setup
- [ ] Obtain SSL certificate (Let's Encrypt recommended)
- [ ] Configure Nginx with SSL
- [ ] Test: Does `https://api.yourdomain.com` work?

### Phase 5: Frontend Deployment
- [ ] Build frontend for production: `npm run build`
- [ ] Upload `dist` folder to Hostinger/iFast
- [ ] Set environment variable: `VITE_API_BASE_URL=https://api.yourdomain.com`
- [ ] Test: Does the full login flow work?

---

## Prerequisites

### Hardware Requirements

| Scale Level | RAM | CPU Cores | Upload Speed | Concurrent Users |
|-------------|-----|-----------|--------------|------------------|
| Small Office | 4GB | 2 | 10 Mbps | ~500 |
| City-wide | 8GB | 4 | 50 Mbps | ~2,000 |
| Province | 16GB | 8 | 100 Mbps | ~8,000 |
| Enterprise | 32GB+ | 16+ | 1 Gbps | 50,000+ |

- A dedicated computer/server that will run 24/7
- Stable internet connection

### Software Requirements
- **Operating System**: Windows 10/11 Pro, Windows Server, or Linux (Ubuntu 20.04+ recommended)
- **Docker Desktop** (Windows) or **Docker Engine** (Linux)
- **Git** (to clone the repository)

### What You'll Need
- [ ] Domain name (e.g., `yourdomain.com`)
- [ ] Access to domain DNS settings
- [ ] Access to your router's admin panel
- [ ] Static local IP for your server (or DHCP reservation)

---

## Step 1: Prepare Your Local Server

### 1.1 Install Docker

**Windows:**
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Run the installer and follow the prompts
3. Restart your computer when prompted
4. Open Docker Desktop and wait for it to start

**Linux (Ubuntu/Debian):**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Log out and back in for group changes to take effect
```

### 1.2 Clone the Repository

```bash
# Navigate to where you want to store the project
cd /path/to/your/projects

# Clone the repository
git clone <repository-url> CAPSTONE_TRC-V
cd CAPSTONE_TRC-V
```

### 1.3 Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp server/.env.example server/.env
   ```

2. Edit `.env` in the project root with your settings:
   ```env
   # Database
   MONGO_URI=mongodb://mongo:27017/trcv
   
   # Security - CHANGE THESE!
   JWT_SECRET=your-super-secret-key-change-this-to-something-random
   JWT_REFRESH_SECRET=another-random-secret-key
   SESSION_SECRET=yet-another-random-secret-key
   
   # Your API domain (the subdomain pointing to your local server)
   API_DOMAIN=api.yourdomain.com
   
   # CORS - Your hosted frontend URL
   CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
   
   # Environment
   NODE_ENV=production
   DOCKER_ENV=true
   
   # Email settings (for OTP)
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   EMAIL_FROM=TRC-V System <your-email@gmail.com>
   
   # Redis for Socket.IO clustering (required for scaling)
   REDIS_HOST=redis
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   
   # Scaling Configuration
   PM2_INSTANCES=2              # Workers per container (1, 2, 4, or "max")
   PM2_MAX_MEMORY=512M          # Memory limit per worker
   ```

> ⚠️ **IMPORTANT**: Generate secure random strings for `JWT_SECRET` and `SESSION_SECRET`. You can use this command:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Step 2: Set Up Static IP for Your Server

Your server needs a consistent IP address so port forwarding works reliably.

### Option A: Static IP (Recommended)

**Windows:**
1. Open **Control Panel** → **Network and Sharing Center** → **Change adapter settings**
2. Right-click your network adapter → **Properties**
3. Select **Internet Protocol Version 4 (TCP/IPv4)** → **Properties**
4. Select **Use the following IP address**:
   - IP address: `192.168.1.100` (or another unused IP in your range)
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1` (your router's IP)
   - DNS: `8.8.8.8` and `8.8.4.4`

**Linux:**
```bash
# Edit netplan configuration
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:  # Your network interface name
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

```bash
sudo netplan apply
```

### Option B: DHCP Reservation

1. Log into your router's admin panel (usually `192.168.1.1`)
2. Find **DHCP Reservation** or **Address Reservation** settings
3. Add your server's MAC address and assign a fixed IP

---

## Step 3: Configure Your Router (Port Forwarding)

### 3.1 Access Router Admin Panel

1. Open a browser and go to your router's IP (commonly `192.168.1.1` or `192.168.0.1`)
2. Log in with your router credentials

### 3.2 Set Up Port Forwarding

Navigate to **Port Forwarding** (may be under Advanced Settings, NAT, or Virtual Servers).

Add these rules:

| Service Name | External Port | Internal Port | Internal IP      | Protocol |
|-------------|---------------|---------------|------------------|----------|
| HTTP        | 80            | 80            | 192.168.1.100    | TCP      |
| HTTPS       | 443           | 443           | 192.168.1.100    | TCP      |

> 📝 Replace `192.168.1.100` with your server's actual static IP.

### 3.3 Firewall Settings

If your server has a firewall, allow these ports:

**Windows Firewall:**
```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=TCP localport=443
```

**Linux (UFW):**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## Step 4: Set Up DDNS (Dynamic DNS)

Since most home/office internet connections have dynamic public IPs, you need DDNS to keep your domain pointing to your current IP. **The DDNS client will update your IP every 5 minutes** to ensure stable connectivity.

### Option A: Using No-IP (Free) - Recommended for Windows

1. Create account at https://www.noip.com
2. Create a hostname (e.g., `yourcompany.ddns.net`)
3. Download and install the **No-IP DUC** (Dynamic Update Client) on your server
4. Configure it with your account credentials
5. **Set update interval to 5 minutes** (Settings → Update Interval)
6. Enable "Run on Windows startup"

**Verify it's working:**
```powershell
# Check your DDNS hostname resolves to your public IP
nslookup yourcompany.ddns.net
```

### Option B: Using Duck DNS (Free)

1. Go to https://www.duckdns.org
2. Sign in with Google/GitHub/etc.
3. Create a subdomain (e.g., `yourcompany.duckdns.org`)
4. Install the update script:

**Windows (Task Scheduler - 5 minute updates):**

1. Create a file `C:\duckdns\duck.cmd`:
```batch
@echo off
curl -k "https://www.duckdns.org/update?domains=yourcompany&token=YOUR-TOKEN&ip="
```

2. Open **Task Scheduler** → **Create Basic Task**
   - Name: `DuckDNS Update`
   - Trigger: **Daily**, then edit to repeat every **5 minutes** for **1 day**
   - Action: **Start a program** → `C:\duckdns\duck.cmd`
   - Check: **Run whether user is logged in or not**

**Alternative: PowerShell script with Windows Service:**
```powershell
# Save as C:\duckdns\update-duckdns.ps1
$token = "YOUR-DUCKDNS-TOKEN"
$domain = "yourcompany"

while ($true) {
    try {
        Invoke-WebRequest -Uri "https://www.duckdns.org/update?domains=$domain&token=$token&ip=" -UseBasicParsing
        Write-Host "$(Get-Date): DuckDNS updated successfully"
    } catch {
        Write-Host "$(Get-Date): DuckDNS update failed: $_"
    }
    Start-Sleep -Seconds 300  # 5 minutes
}
```

**Linux (runs every 5 minutes via cron):**
```bash
# Create update script
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh << 'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=yourcompany&token=YOUR-TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
EOF
chmod 700 ~/duckdns/duck.sh

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -

# Verify cron is set
crontab -l
```

### Option C: Router's Built-in DDNS

Many routers have built-in DDNS support (check Settings → DDNS or Dynamic DNS):

| Router Brand | Supported DDNS Providers |
|--------------|-------------------------|
| TP-Link | No-IP, DynDNS, TP-Link DDNS |
| ASUS | ASUS DDNS, No-IP, DynDNS |
| Netgear | No-IP, DynDNS |
| Linksys | DynDNS, No-IP |

**Benefits of router-based DDNS:**
- ✅ Always running (doesn't depend on server being on)
- ✅ Updates automatically
- ✅ No software to install

### Verify DDNS is Working

```powershell
# 1. Get your current public IP
(Invoke-WebRequest -Uri "https://api.ipify.org").Content

# 2. Check what your DDNS resolves to
nslookup yourcompany.ddns.net

# 3. They should match!
```

---

## Step 5: Configure Your Domain DNS

### 5.1 For API Subdomain

In your domain registrar's DNS settings (GoDaddy, Namecheap, Cloudflare, Hostinger, etc.):

**Point your API subdomain to your DDNS hostname:**

| Type  | Name  | Value                        | TTL  |
|-------|-------|------------------------------|------|
| CNAME | api   | yourcompany.ddns.net         | 300  |

This means:
- `api.yourdomain.com` → `yourcompany.ddns.net` → Your Public IP → Your Router → Nginx

**If your registrar doesn't support CNAME for subdomains**, use an A record with your public IP (but you'll need to update it manually if your IP changes):

| Type | Name | Value         | TTL  |
|------|------|---------------|------|
| A    | api  | YOUR.PUBLIC.IP| 300  |

### 5.2 Hostinger DNS Setup

1. Log in to Hostinger → **Domains** → Select your domain
2. Click **DNS / Nameservers**
3. Scroll to **DNS Records**
4. Click **Add Record**:
   - Type: `CNAME`
   - Name: `api`
   - Target: `yourcompany.ddns.net`
   - TTL: `300` (5 minutes)
5. Click **Add**

### 5.3 iFast / cPanel DNS Setup

1. Log in to cPanel
2. Go to **Zone Editor** (under Domains)
3. Click **Manage** next to your domain
4. Click **Add Record** → **Add CNAME Record**:
   - Name: `api`
   - CNAME: `yourcompany.ddns.net`
   - TTL: `300`
5. Click **Add Record**

### 5.4 Cloudflare DNS Setup (If using Cloudflare)

1. Log in to Cloudflare → Select your domain
2. Go to **DNS** → **Records**
3. Click **Add record**:
   - Type: `CNAME`
   - Name: `api`
   - Target: `yourcompany.ddns.net`
   - Proxy status: **DNS only** (grey cloud) - Important!
   - TTL: Auto
4. Click **Save**

> ⚠️ **Important for Cloudflare:** Set proxy to "DNS only" (grey cloud icon), not "Proxied" (orange cloud). This ensures your DDNS works correctly.

### 5.5 Verify DNS Propagation

After setting DNS, verify it's working:

```powershell
# Windows
nslookup api.yourdomain.com

# Expected output should show your DDNS hostname
```

```bash
# Linux/Mac
dig api.yourdomain.com +short
```

**Online tools:**
- https://dnschecker.org - Check propagation worldwide
- https://mxtoolbox.com/DNSLookup.aspx - Detailed DNS lookup

> ⏰ DNS changes can take 5 minutes to 48 hours to propagate globally.

---

## Step 6: Configure Nginx for Production

### 6.1 Update Nginx Configuration

Edit `nginx/nginx.conf` to add your domain:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Your API subdomain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API Proxy
    location / {
        proxy_pass http://backend:5170;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6.2 SSL Certificate (HTTPS)

**Option A: Let's Encrypt with Certbot (Recommended)**

The easiest way is to use Certbot. Create a new file `docker-compose.ssl.yml`:

```yaml
version: '3.8'
services:
  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

Initial certificate generation:
```bash
# Create directories
mkdir -p certbot/conf certbot/www

# Get certificate (replace with your domain and email)
docker run -it --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d api.yourdomain.com
```

**Option B: Use your hosting provider's SSL**

If your domain registrar offers SSL certificates, follow their instructions and place the certificate files in the appropriate location.

---

## Step 7: Start the Backend Server

### 7.1 Start Docker Containers

```bash
cd CAPSTONE_TRC-V

# Development/Small Office (single container, 2 PM2 workers)
docker-compose up -d --build

# Production (use production overrides)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Scale for higher traffic (2 containers × 2 PM2 workers = 4 workers)
docker-compose up -d --scale backend=2

# Check if containers are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 7.2 Verify Backend is Running

```bash
# Test locally first
curl http://localhost:5170/api/health

# Then test via your domain (after DNS propagates)
curl http://api.yourdomain.com/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

---

## Step 8: Deploy Frontend to Hosting Service

### 8.1 Build Frontend for Production

First, update the API URL in your frontend:

**Option A: Edit `.env` before building:**
```bash
cd dashboard

# Create/edit .env file
echo "VITE_API_BASE_URL=https://api.yourdomain.com" > .env

# Install dependencies and build
npm install
npm run build
```

**Option B: Build with inline environment variable:**
```bash
cd dashboard
VITE_API_BASE_URL=https://api.yourdomain.com npm run build
```

**Windows PowerShell:**
```powershell
cd dashboard
$env:VITE_API_BASE_URL="https://api.yourdomain.com"
npm run build
```

This creates a `dist` folder with your production-ready files.

---

### 8.2 Deploy to Hostinger

#### Step 1: Access File Manager
1. Log in to Hostinger → **Hosting** → Select your hosting plan
2. Click **File Manager**

#### Step 2: Upload Files
1. Navigate to `public_html` (or your domain folder)
2. **Delete** existing files (if any) - backup first if needed
3. Click **Upload Files** (top right)
4. Upload **all contents** from your `dashboard/dist` folder:
   ```
   dist/
   ├── index.html      ← Upload this
   ├── assets/         ← Upload this folder
   ├── favicon.ico     ← Upload this
   └── ...             ← Upload everything
   ```
5. Make sure `index.html` is in the **root** of `public_html`, not inside a subfolder

#### Step 3: Configure .htaccess for SPA Routing
Create `.htaccess` file in `public_html`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable GZIP compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

#### Step 4: Enable SSL
1. Go to Hostinger → **SSL** → Select your domain
2. Click **Install SSL** (free with Hostinger)
3. Wait for SSL to activate (usually instant)

---

### 8.3 Deploy to iFast / cPanel Hosting

#### Step 1: Access File Manager
1. Log in to cPanel
2. Click **File Manager**
3. Navigate to `public_html`

#### Step 2: Upload Files
1. Click **Upload** in the top toolbar
2. Drag and drop **all files** from your `dashboard/dist` folder
3. Or use **Compress** to create a zip, upload, then **Extract**

**Using FTP (Alternative):**
```bash
# Connect via FTP client (FileZilla, WinSCP, etc.)
Host: ftp.yourdomain.com
Username: (from cPanel FTP Accounts)
Password: (your FTP password)
Port: 21

# Upload dist/* to /public_html/
```

#### Step 3: Create .htaccess
1. In File Manager, click **+ File** → Name it `.htaccess`
2. Right-click → **Edit** → Paste the .htaccess content from above
3. **Save Changes**

#### Step 4: Enable SSL
1. In cPanel → **SSL/TLS Status**
2. Click **Run AutoSSL** or **Install SSL**

---

### 8.4 Deploy to Vercel (Alternative - Recommended for Ease)

1. Push your code to GitHub
2. Go to https://vercel.com → Import your repository
3. Set environment variable:
   - `VITE_API_BASE_URL` = `https://api.yourdomain.com`
4. Deploy

**Vercel provides:**
- ✅ Automatic SSL
- ✅ Global CDN
- ✅ Automatic deployments on git push

---

### 8.5 Deploy to Netlify (Alternative)

1. Drag and drop your `dist` folder to https://app.netlify.com/drop
2. Go to **Site Settings** → **Environment Variables**
3. Add `VITE_API_BASE_URL` = `https://api.yourdomain.com`
4. **Redeploy**

---

### 8.6 Verify Frontend Deployment

1. Visit your domain: `https://yourdomain.com`
2. Open browser DevTools (F12) → **Console** tab
3. Check for errors
4. Go to **Network** tab → Try logging in
5. Verify API calls go to `https://api.yourdomain.com`

---

## Step 9: Testing the Complete Flow

### 9.1 Test the Full Chain

```
User → yourdomain.com (Hostinger) → api.yourdomain.com → DDNS → Your Router → Nginx → Backend
```

**Step-by-step verification:**

```powershell
# 1. Verify DDNS is working
nslookup yourcompany.ddns.net
# Should return your public IP

# 2. Verify subdomain points to DDNS
nslookup api.yourdomain.com
# Should return your DDNS hostname or public IP

# 3. Test API directly
curl https://api.yourdomain.com/health
# Should return: {"status":"ok",...}

# 4. Test from browser
# Visit https://yourdomain.com and try logging in
```

### 9.2 Test API Connectivity

From any browser, visit:
```
https://api.yourdomain.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

### 9.3 Test CORS

Open browser developer tools (F12) on your frontend and check:
1. **Network tab**: API requests should show status 200
2. **Console tab**: No CORS errors

### 9.4 Test Complete Authentication Flow

1. Visit `https://yourdomain.com`
2. Click **Login** or **Register**
3. Enter credentials
4. Verify OTP email is received
5. Enter OTP and complete login
6. Navigate the dashboard - all features should work

---

## Troubleshooting

### Hosted Frontend + Local Backend Issues

#### 1. "Network Error" or "Failed to Fetch" from Frontend

**Symptoms:** Frontend loads but API calls fail

**Checklist:**
- [ ] `VITE_API_BASE_URL` is set correctly (check browser DevTools → Console)
- [ ] API subdomain resolves correctly: `nslookup api.yourdomain.com`
- [ ] DDNS is updated with current IP
- [ ] Port forwarding is working
- [ ] Backend is running: `docker-compose ps`

**Quick Debug:**
```powershell
# 1. Check what URL frontend is using
# Open browser DevTools → Network tab → look at API request URLs

# 2. Test API directly
curl https://api.yourdomain.com/health

# 3. If that fails, test locally
curl http://localhost:5170/health
```

#### 2. CORS Errors (Most Common)

**Error:** `Access to fetch at 'https://api.yourdomain.com' has been blocked by CORS`

**Cause:** Backend doesn't allow requests from your hosted frontend domain

**Solution:**
1. Edit your `.env` file on the server:
```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

2. Restart:
```bash
docker-compose restart backend
```

**Note:** Include both `www` and non-`www` versions if applicable.

#### 3. "Mixed Content" Error

**Error:** `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`

**Cause:** Frontend on HTTPS but API URL uses HTTP

**Solutions:**
- Ensure `VITE_API_BASE_URL` starts with `https://`
- Enable SSL on your backend (see SSL Setup section)
- Rebuild frontend after fixing the URL

#### 4. API Works Locally But Not Remotely

**Symptoms:** `curl localhost:5170/health` works, but `curl api.yourdomain.com/health` fails

**Debug Steps:**
```powershell
# 1. Check public IP matches DDNS
nslookup yourcompany.ddns.net
# Compare with: https://whatismyip.com

# 2. Check port forwarding from outside
# Ask a friend to run, or use mobile data:
curl http://YOUR-PUBLIC-IP/health

# 3. Test if ports are blocked by ISP
# Use an online port checker: https://portchecker.co
```

**Common Fixes:**
- ISP blocks port 80/443 → Call ISP to unblock or use alternative ports
- Router firewall → Enable "Allow incoming connections" or add firewall rule
- Double NAT → If you have two routers, port forward through both

#### 5. DDNS Not Updating (IP Mismatch)

**Symptoms:** API worked yesterday but not today

**Cause:** Dynamic IP changed but DDNS didn't update

**Check Windows Task Scheduler:**
```powershell
# View task status
Get-ScheduledTask -TaskName "DDNS Update" | Get-ScheduledTaskInfo

# Run manually
schtasks /run /tn "DDNS Update"
```

**Check No-IP DUC:**
- Open No-IP DUC from system tray
- Verify it shows "IP up to date" with correct IP

**Force Update Duck DNS:**
```powershell
$token = "your-duck-dns-token"
$domain = "yourcompany"
Invoke-WebRequest "https://www.duckdns.org/update?domains=$domain&token=$token&ip=" | Select-Object -Expand Content
```

---

### Common Issues

#### 1. "Connection Refused" or "Site Can't Be Reached"

**Checklist:**
- [ ] Docker containers are running (`docker-compose ps`)
- [ ] Port forwarding is configured correctly
- [ ] Firewall allows ports 80/443
- [ ] DNS has propagated (`nslookup api.yourdomain.com`)
- [ ] DDNS client is running and updated

**Debug steps:**
```bash
# Check if backend is listening
netstat -tulpn | grep -E '80|443|5170'

# Test from another device on same network
curl http://192.168.1.100/health

# Check public accessibility
curl http://YOUR-PUBLIC-IP/health
```

#### 2. CORS Errors

**Error:** "Access-Control-Allow-Origin" missing

**Solution:** Ensure `CORS_ORIGIN` in `.env` includes your frontend domain:
```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

#### 3. SSL/HTTPS Issues

**Error:** "Certificate not trusted" or "Connection not secure"

**Solutions:**
- Ensure certificate is properly installed
- Check certificate expiry: `openssl s_client -connect api.yourdomain.com:443`
- Renew Let's Encrypt: `docker-compose run certbot renew`

#### 4. API Requests Timeout

**Possible causes:**
- ISP blocking port 80/443 (call ISP to unblock)
- Router firewall blocking incoming connections
- Double NAT (if you have multiple routers)

#### 5. Dynamic IP Changed

If API stops working after router restart:
- Check DDNS client is running
- Manually trigger DDNS update
- Verify public IP matches DDNS record

#### 6. Frontend Page Refreshes Give 404

**Symptoms:** Homepage works, but refreshing on `/dashboard` or `/login` gives 404

**Cause:** Missing `.htaccess` for SPA routing (on Hostinger/cPanel)

**Solution:** Create `.htaccess` as shown in Step 8.2

#### 7. Slow API Response

**Possible causes:**
- Residential internet upload speed is slow
- Too many PM2 instances for hardware
- MongoDB needs indexing

**Solutions:**
```bash
# Check backend resources
docker-compose exec backend pm2 monit

# Reduce PM2 instances if CPU is maxed
# Edit .env: PM2_INSTANCES=1

# Check MongoDB slow queries
docker-compose logs mongodb | grep -i "slow"
```

---

### Quick Diagnostic Commands

Run these commands to diagnose issues:

```powershell
# === Local Server Checks ===
# 1. Are containers running?
docker-compose ps

# 2. Check backend logs
docker-compose logs --tail=50 backend

# 3. Check nginx logs
docker-compose logs --tail=50 nginx

# 4. Test local health endpoint
curl http://localhost/health

# === Network Checks ===
# 5. Get current public IP
(Invoke-WebRequest -Uri "https://api.ipify.org").Content

# 6. Check DDNS resolution
nslookup yourcompany.ddns.net

# 7. Check subdomain resolution
nslookup api.yourdomain.com

# 8. Test API from internet (use phone on mobile data)
curl https://api.yourdomain.com/health

# === DNS Propagation Check ===
# Use online tool: https://www.whatsmydns.net/#A/api.yourdomain.com
```

---

## Maintenance

### Daily Automatic Tasks
- DDNS updates IP automatically
- Docker restarts containers if they crash
- PM2 auto-restarts workers on crash
- Log rotation (configured in docker-compose)

### Weekly Checks
- [ ] Check Docker logs for errors: `docker-compose logs --tail=100`
- [ ] Verify backups are running
- [ ] Monitor disk space: `docker system df`
- [ ] Check PM2 status: `docker-compose exec backend pm2 status`

### Monthly Tasks
- [ ] Update Docker images: `docker-compose pull && docker-compose up -d`
- [ ] Review and clean old logs: `docker-compose exec backend pm2 flush`
- [ ] Check SSL certificate expiry
- [ ] Prune unused Docker resources: `docker system prune -f`

### Backup Commands

```bash
# Create manual backup
docker-compose exec backend npm run backup:manual

# List backups
ls -la server/backups/

# Restore from backup
docker-compose exec backend npm run backup:restore <backup-id>
```

---

## Security Checklist

Before going live, ensure:

- [ ] Changed default `JWT_SECRET` and `SESSION_SECRET`
- [ ] `NODE_ENV=production` is set
- [ ] CORS only allows your frontend domain
- [ ] HTTPS is enabled with valid certificate
- [ ] Firewall only allows required ports (80, 443)
- [ ] Database is not exposed to internet
- [ ] Regular backups are configured
- [ ] Strong admin passwords are set

---

## Quick Reference

### Commands

```bash
# Start all services
docker-compose up -d

# Production mode with overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale backend containers
docker-compose up -d --scale backend=2

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Zero-downtime reload (no dropped connections)
docker-compose exec backend pm2 reload ecosystem.config.js

# Restart after config change
docker-compose restart

# Rebuild after code update
git pull
docker-compose up -d --build

# Check container status
docker-compose ps

# Monitor PM2 processes
docker-compose exec backend pm2 monit
```

### Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Main Docker configuration |
| `docker-compose.prod.yml` | Production overrides (scaling, security) |
| `.env` | Environment variables (project root) |
| `nginx/nginx.conf` | Nginx reverse proxy & load balancer |
| `server/ecosystem.config.js` | PM2 cluster configuration |
| `server/backups/` | Database backups |

### Scaling Reference

| Scale Level | Command |
|-------------|---------|
| Development | `docker-compose up -d` |
| Small Office | `PM2_INSTANCES=2 docker-compose up -d` |
| City-wide | `docker-compose up -d --scale backend=2` |
| Province | `docker-compose up -d --scale backend=4` |
| Enterprise | See [ENTERPRISE_SCALING_GUIDE.md](ENTERPRISE_SCALING_GUIDE.md) |

### Support Contacts

For technical issues:
- Check logs first: `docker-compose logs -f`
- Review this guide's troubleshooting section
- Contact developer with error logs

---

## Appendix: Network Diagram

```
INTERNET
    │
    ▼
┌─────────────────────────────────────────┐
│            YOUR ROUTER                   │
│  Public IP: (from ISP, may change)      │
│  DDNS: api.yourdomain.com               │
│                                          │
│  Port Forwarding:                        │
│  80  → 192.168.1.100:80                 │
│  443 → 192.168.1.100:443                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│         YOUR SERVER (192.168.1.100)     │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │         DOCKER                   │    │
│  │                                  │    │
│  │  ┌──────────┐   ┌────────────┐  │    │
│  │  │  Nginx   │──→│  Backend   │  │    │
│  │  │  :80/443 │   │   :5170    │  │    │
│  │  └──────────┘   └────────────┘  │    │
│  │        │              │         │    │
│  │        │        ┌─────┴─────┐   │    │
│  │        │        │  MongoDB  │   │    │
│  │        │        │  :27017   │   │    │
│  │        │        └───────────┘   │    │
│  │        │                        │    │
│  │        │        ┌───────────┐   │    │
│  │        │        │   Redis   │   │    │
│  │        │        │  :6379    │   │    │
│  │        │        └───────────┘   │    │
│  └────────┴────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

---

## Additional Resources

- **Quick Start:** [QUICKSTART.md](QUICKSTART.md) - Get running in 5 minutes
- **Enterprise Scaling:** [ENTERPRISE_SCALING_GUIDE.md](ENTERPRISE_SCALING_GUIDE.md) - Cluster deployments
- **Docker Setup:** [DOCKER_SETUP.md](DOCKER_SETUP.md) - Detailed configuration

---

*Last updated: December 2025*  
*TRC-V Version: 1.0 (Enterprise Ready)*
