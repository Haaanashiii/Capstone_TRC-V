# TRC-V Production Deployment Guide

## Overview

This guide explains how to connect a **hosted frontend** (on a web hosting service) to your **local backend server** running Docker with Nginx and PM2.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                       │
│                                                                          │
│   ┌──────────────────┐         ┌──────────────────────────────────┐     │
│   │  Hosted Frontend │         │         Your Domain               │     │
│   │  (Vercel/Netlify │ ──API──→│  api.yourdomain.com (DDNS)       │     │
│   │   /cPanel/etc)   │  calls  │         ↓                         │     │
│   └──────────────────┘         │  Points to your public IP         │     │
│                                └──────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼ (Port forwarding 80/443)
┌─────────────────────────────────────────────────────────────────────────┐
│                        YOUR LOCAL NETWORK                                │
│                                                                          │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────────┐   │
│   │   Router    │ ──────→ │   Nginx     │ ──────→ │  PM2 + Node.js  │   │
│   │ (port fwd)  │         │ (Docker)    │         │  (Docker)       │   │
│   └─────────────┘         └─────────────┘         └─────────────────┘   │
│                                                                          │
│   Server IP: 192.168.x.x (static recommended)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Hardware Requirements
- A dedicated computer/server that will run 24/7
- Minimum 4GB RAM, 2 CPU cores recommended
- Stable internet connection with upload speed of at least 10 Mbps

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

2. Edit `server/.env` with your settings:
   ```env
   # Database
   MONGODB_URI=mongodb://mongo:27017/trcv_db
   
   # Security - CHANGE THESE!
   JWT_SECRET=your-super-secret-key-change-this-to-something-random
   SESSION_SECRET=another-random-secret-key
   
   # Your API domain (the subdomain pointing to your local server)
   API_DOMAIN=api.yourdomain.com
   
   # CORS - Your hosted frontend URL
   CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
   
   # Environment
   NODE_ENV=production
   
   # Email settings (for OTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # Optional: Redis for session clustering
   REDIS_HOST=redis
   REDIS_PORT=6379
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

Since most home/office internet connections have dynamic public IPs, you need DDNS to keep your domain pointing to your current IP.

### Option A: Using No-IP (Free)

1. Create account at https://www.noip.com
2. Create a hostname (e.g., `yourcompany.ddns.net`)
3. Download and install the **No-IP DUC** (Dynamic Update Client) on your server
4. Configure it with your account credentials
5. It will automatically update your IP

### Option B: Using Duck DNS (Free)

1. Go to https://www.duckdns.org
2. Sign in with Google/GitHub/etc.
3. Create a subdomain (e.g., `yourcompany.duckdns.org`)
4. Install the update script:

**Linux:**
```bash
# Create update script
mkdir -p ~/duckdns
echo "url=\"https://www.duckdns.org/update?domains=yourcompany&token=YOUR-TOKEN&ip=\"" > ~/duckdns/duck.sh
chmod 700 ~/duckdns/duck.sh

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

### Option C: Router's Built-in DDNS

Many routers have built-in DDNS support. Check your router settings for DDNS options.

---

## Step 5: Configure Your Domain DNS

### 5.1 For API Subdomain

In your domain registrar's DNS settings (GoDaddy, Namecheap, Cloudflare, etc.):

**If using DDNS hostname (recommended):**

| Type  | Name  | Value                        | TTL  |
|-------|-------|------------------------------|------|
| CNAME | api   | yourcompany.ddns.net         | 300  |

**If using static IP (only if you have a static public IP):**

| Type | Name | Value         | TTL  |
|------|------|---------------|------|
| A    | api  | YOUR.PUBLIC.IP| 300  |

### 5.2 Verify DNS Propagation

After setting DNS, verify it's working:

```bash
# Check if DNS resolves correctly
nslookup api.yourdomain.com

# Or use online tools:
# https://dnschecker.org
```

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

# Build and start all services
docker-compose up -d --build

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

## Step 8: Configure the Hosted Frontend

### 8.1 Update Frontend Environment

On your hosted frontend, set these environment variables:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://api.yourdomain.com` |

**For Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `VITE_API_BASE_URL` = `https://api.yourdomain.com`
3. Redeploy

**For Netlify:**
1. Go to Site Settings → Build & Deploy → Environment
2. Add `VITE_API_BASE_URL` = `https://api.yourdomain.com`
3. Trigger redeploy

**For cPanel/Shared Hosting:**
Create or edit `.env` file in your frontend directory:
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```
Then rebuild and upload the `dist` folder.

### 8.2 Build Frontend for Production

```bash
cd dashboard
npm install
npm run build
```

Upload the contents of `dashboard/dist` to your web hosting.

---

## Step 9: Testing the Connection

### 9.1 Test API Connectivity

From any browser, visit:
```
https://api.yourdomain.com/api/health
```

### 9.2 Test CORS

Open browser developer tools (F12) on your frontend and check:
1. **Network tab**: API requests should show status 200
2. **Console tab**: No CORS errors

### 9.3 Test Authentication Flow

1. Try registering a new account
2. Check if OTP email is received
3. Complete login flow

---

## Troubleshooting

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
curl http://192.168.1.100/api/health

# Check public accessibility
curl http://YOUR-PUBLIC-IP/api/health
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

---

## Maintenance

### Daily Automatic Tasks
- DDNS updates IP automatically
- Docker restarts containers if they crash

### Weekly Checks
- [ ] Check Docker logs for errors
- [ ] Verify backups are running
- [ ] Monitor disk space

### Monthly Tasks
- [ ] Update Docker images: `docker-compose pull && docker-compose up -d`
- [ ] Review and clean old logs
- [ ] Check SSL certificate expiry

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

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart after config change
docker-compose restart

# Rebuild after code update
git pull
docker-compose up -d --build

# Check container status
docker-compose ps
```

### Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Main Docker configuration |
| `server/.env` | Backend environment variables |
| `nginx/nginx.conf` | Nginx reverse proxy config |
| `server/backups/` | Database backups |

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

*Last updated: December 2024*
*TRC-V Version: 1.0*
