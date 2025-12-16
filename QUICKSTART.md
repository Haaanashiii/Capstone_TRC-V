# TRC-V Quick Start Guide

## 🚀 Getting Started in 5 Minutes

This guide will help you get TRC-V up and running quickly using Docker.

---

## Prerequisites

- ✅ Docker Desktop installed and running
- ✅ Minimum 4GB RAM available
- ✅ Ports 80, 3000, 5170, 27017 available

### Check Docker Installation
```bash
docker --version
docker-compose --version
```

---

## Step 1: Configure Environment Variables

### 1.1 Open the `.env` file in the project root

**Location**: `CAPSTONE_TRC-V/.env`

### 1.2 Update Email Configuration (IMPORTANT!)

Find the email section and update with your Gmail credentials:

```env
# ===========================================
# EMAIL SERVICE (Nodemailer with Gmail)
# ===========================================
EMAIL_USER=your-email@gmail.com                    # ← Change this
EMAIL_PASSWORD=your-app-specific-password          # ← Change this (see below)
EMAIL_FROM=TRC-V System <your-email@gmail.com>    # ← Change this
```

### 1.3 Get Gmail App Password

**Why?** Gmail doesn't allow direct password login from apps. You need an "App Password":

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** (left sidebar)
3. Enable **2-Step Verification** (if not already enabled)
4. Search for **App passwords** or go to: https://myaccount.google.com/apppasswords
5. Select:
   - App: **Mail**
   - Device: **Other (Custom name)** → Enter "TRC-V System"
6. Click **Generate**
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
8. Paste it in `.env` as `EMAIL_PASSWORD` (remove spaces: `abcdefghijklmnop`)

### 1.4 Update CORS Origins (Optional for LAN Access)

If you want to access the system from other devices on your network:

```env
# Find your IP with: ipconfig (Windows) or ip addr (Linux)
CORS_ORIGIN=http://localhost:3000,http://localhost:80,http://192.168.1.100:3000,http://192.168.1.100:80
#                                                      ↑ Add your server's IP
```

### 1.5 Keep Production Settings

**DON'T CHANGE THESE:**
```env
NODE_ENV=production        # Required for production testing
DOCKER_ENV=true           # Required to disable HTTPS redirect
```

---

## Step 2: Start Docker Containers

### 2.1 Navigate to Project Directory
```bash
cd "d:\coding projects\Capstone\CAPSTONE_TRC-V"
```

### 2.2 Build and Start All Services
```bash
docker-compose up -d --build
```

**What this does:**
- Builds the dashboard (React/Vite)
- Builds the backend (Node.js/Express)
- Starts MongoDB database
- Starts Nginx reverse proxy

**Wait time:** 2-3 minutes for first build

### 2.3 Check Container Status
```bash
docker-compose ps
```

**Expected output:**
```
NAME                IMAGE             STATUS
trc-v-backend       trc-v-backend     Up (healthy)
trc-v-dashboard     trc-v-dashboard   Up
trc-v-mongodb       mongo:7           Up (healthy)
trc-v-nginx         nginx:alpine      Up
```

### 2.4 View Logs (If Needed)
```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f dashboard
docker-compose logs -f nginx
```

---

## Step 3: Create Super Admin Account

### 3.1 Run the Seed Script

**IMPORTANT:** This script runs **ONCE** and then **self-destructs** for security!

```bash
docker-compose exec backend node scripts/seedSuperAdmin.js
```

### 3.2 Expected Output

```
🔐 TRC-V Super Admin Initialization
====================================

✅ MongoDB Connected: mongo:27017

✅ Super Admin Created Successfully!
========================================
Email:     raygabs89@gmail.com
Username:  raygabs
Password:  trC-V@Solano_2025
========================================

🔒 This script will now self-destruct for security...

🔒 Security: Seed script has been permanently deleted
✅ Database connection closed

✅ Initialization complete
```

### 3.3 Verify Script Self-Destruction

```bash
docker-compose exec backend ls -la scripts/
```

**You should NOT see** `seedSuperAdmin.js` in the list. ✅

---

## Step 4: Access the System

### 4.1 Open Dashboard

**URL**: http://localhost:3000

### 4.2 Login with Super Admin

**Credentials:**
- **Email**: `raygabs89@gmail.com`
- **Password**: `trC-V@Solano_2025`

### 4.3 Complete OTP Verification

1. After clicking **Login**, check your email inbox
2. You'll receive an email with subject: **"Your TRC-V Login Verification Code"**
3. Copy the 6-digit OTP code
4. Enter it in the verification modal
5. Click **Verify**

**Note:** OTP expires in 10 minutes

### 4.4 First Login Setup

After successful verification:
1. You'll be redirected to the dashboard
2. **IMPORTANT:** Change your password immediately:
   - Go to **Settings** or **Profile**
   - Update password
   - Update email if needed

---

## Step 5: LAN Access (Optional)

If you want to access the system from other devices on your local network:

### 5.1 Find Your Server's IP

**Windows:**
```bash
ipconfig
```
Look for **IPv4 Address** (e.g., `192.168.1.88`)

**Linux/Mac:**
```bash
ip addr show
# or
ifconfig
```

### 5.2 Update Firewall Rules (Windows)

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "TRC-V HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "TRC-V Dashboard" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### 5.3 Access from Other Devices

**Dashboard:** http://192.168.1.88:3000  
**API:** http://192.168.1.88:80

*(Replace `192.168.1.88` with YOUR server's IP)*

---

## Common Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Restart a Service
```bash
docker-compose restart backend
docker-compose restart dashboard
docker-compose restart nginx
```

### Rebuild After Code Changes
```bash
# Rebuild specific service
docker-compose up -d --build backend

# Rebuild all services
docker-compose down
docker-compose up -d --build
```

### View Real-Time Logs
```bash
docker-compose logs -f backend
```

### Access Container Shell
```bash
# Backend
docker-compose exec backend sh

# MongoDB
docker-compose exec mongo mongosh trc_v
```

### Check Container Resources
```bash
docker stats
```

---

## Troubleshooting

### ❌ Problem: Containers won't start

**Solution 1:** Check if ports are in use
```bash
# Windows
netstat -ano | findstr "80"
netstat -ano | findstr "3000"
netstat -ano | findstr "5170"

# Kill process using port (Windows)
taskkill /PID <process_id> /F
```

**Solution 2:** Check Docker Desktop is running and has enough resources
- Open Docker Desktop
- Go to Settings → Resources
- Allocate at least 4GB RAM

---

### ❌ Problem: Can't login - CORS error

**Solution:** Check CORS_ORIGIN in `.env`
```env
CORS_ORIGIN=http://localhost:3000,http://localhost:80
```

Then restart backend:
```bash
docker-compose restart backend
```

---

### ❌ Problem: OTP email not received

**Check 1:** Verify email credentials in `.env`
```bash
docker-compose exec backend sh
env | grep EMAIL
```

**Check 2:** Check backend logs for email errors
```bash
docker-compose logs backend | grep -i "email\|otp\|nodemailer"
```

**Check 3:** Verify Gmail App Password
- Make sure it's 16 characters without spaces
- Make sure 2-Step Verification is enabled on Google Account

**Check 4:** Check spam/junk folder

---

### ❌ Problem: 308 Redirect errors

**Solution:** Verify DOCKER_ENV flag
```bash
docker-compose exec backend sh
env | grep DOCKER_ENV
```

Should show: `DOCKER_ENV=true`

If not, update `.env` and rebuild:
```bash
docker-compose down
docker-compose up -d --build backend
```

---

### ❌ Problem: MongoDB connection failed

**Check 1:** MongoDB container is running
```bash
docker-compose ps mongo
```

**Check 2:** Check MongoDB logs
```bash
docker-compose logs mongo
```

**Solution:** Restart MongoDB
```bash
docker-compose restart mongo
```

---

### ❌ Problem: Dashboard shows blank page

**Check 1:** Check browser console (F12)

**Check 2:** Verify VITE_API_BASE_URL
```env
# In .env file
VITE_API_BASE_URL=http://localhost:80
```

**Solution:** Rebuild dashboard
```bash
docker-compose up -d --build dashboard
```

Then clear browser cache (Ctrl+Shift+Delete) and refresh

---

### ❌ Problem: Need to reset super admin

**Solution 1:** Delete existing admin from database
```bash
# Connect to MongoDB
docker-compose exec mongo mongosh trc_v

# Delete admin
db.adminaccounts.deleteOne({ role: 'super-admin' })

# Exit
exit
```

**Solution 2:** Re-create seedSuperAdmin.js script
- Copy the script from backup or repository
- Place in `server/scripts/seedSuperAdmin.js`
- Update email in the script
- Run: `docker-compose exec backend node scripts/seedSuperAdmin.js`

---

## Stopping the System

### Graceful Shutdown
```bash
docker-compose down
```

### Remove All Data (DANGER!)
```bash
# This deletes the database and all uploads
docker-compose down -v
```

---

## Next Steps

After logging in successfully:

1. **Change Default Password**
   - Go to Profile → Settings
   - Update password

2. **Configure System Settings**
   - Set up fare matrix
   - Configure announcement settings
   - Set up user roles and permissions

3. **Create Additional Admin Accounts**
   - Go to Administration → User Management
   - Add BPLO admins and SB admins

4. **Test QR Code Generation**
   - Go to Services → Operator Management
   - Create test operator account
   - Generate QR code

5. **Review Logs and Monitoring**
   - Check system logs regularly
   - Monitor backup schedules
   - Review audit trails

---

## Important Security Notes

⚠️ **BEFORE PRODUCTION DEPLOYMENT:**

1. **Change All Default Passwords**
   - Super admin password
   - JWT secrets in `.env`
   - Encryption keys

2. **Update Email Credentials**
   - Use a dedicated system email account
   - Don't use personal Gmail

3. **Configure SSL/HTTPS**
   - Get SSL certificate (Let's Encrypt recommended)
   - Update nginx.conf with SSL settings
   - See [DOCKER_SETUP.md](DOCKER_SETUP.md) for details

4. **Set Up Backups**
   - Configure automatic backups
   - Test restore procedures
   - Store backups off-site

5. **Update CORS for Production**
   ```env
   CORS_ORIGIN=https://your-frontend-domain.com,https://your-api-domain.com
   ```

6. **Enable Rate Limiting**
   - Review nginx rate limits
   - Adjust based on expected traffic

---

## Support

**Issues or Questions?**
- Repository: ray-Gabs/CAPSTONE_TRC-V
- Email: raygabs89@gmail.com

**Documentation:**
- Full Docker Setup: [DOCKER_SETUP.md](DOCKER_SETUP.md)
- Environment Config: See `.env` file comments

---

**Last Updated:** December 16, 2025  
**System Version:** TRC-V 1.0.0
