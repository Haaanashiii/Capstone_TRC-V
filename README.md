<div align="center">

# 🛺 TRC-V

### A Tricycle Franchising and QR Code-Based Verification and Reporting System for the Municipality of Solano, Nueva Vizcaya

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**A comprehensive full-stack web application designed to digitize and streamline tricycle franchise management, QR code-based verification, and incident reporting for the Municipal Government of Solano, Nueva Vizcaya.**

[Quick Start](#-quick-start) •
[Features](#-features) •
[Architecture](#%EF%B8%8F-system-architecture) •
[Documentation](#-documentation) •
[Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#%EF%B8%8F-system-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Configuration](#%EF%B8%8F-configuration)
- [Deployment](#-deployment)
- [Security](#-security)
- [Documentation](#-documentation)
- [Contributing](#-contributing)

---

## 🔍 Overview

**TRC-V (Tricycle Franchising and QR Code-Based Verification and Reporting System)** is a modern, full-featured web application developed specifically for the **Municipality of Solano, Nueva Vizcaya**. It digitizes and streamlines the management of tricycle franchise operations, enabling efficient regulatory compliance and public verification. The system provides a unified platform for:

- **Franchise Application Processing** — Manage applications from submission through multi-level approvals (BPLO → Sangguniang Bayan)
- **Digital QR Code Verification** — Instant verification of franchise authenticity via scannable QR codes
- **Operator & Driver Management** — Comprehensive profiles, document tracking, and compliance monitoring
- **Real-Time Analytics Dashboard** — Visual insights into franchise operations and regulatory metrics
- **Incident Reporting System** — Track and manage reported incidents involving franchised tricycles
- **Certificate Generation** — Automated generation of franchise certificates and driver IDs

---

## ✨ Features

### 🔐 Authentication & Authorization
- Multi-role authentication (Super Admin, Admin, BPLO Staff, SB Staff, Operators)
- JWT-based session management with refresh tokens
- OAuth integration (Google Sign-In)
- Role-based page access control (RBAC)
- Two-factor authentication via OTP (Email/SMS)

### 📝 Franchise Management
- Complete application lifecycle management
- Multi-level approval workflow (BPLO → Sangguniang Bayan)
- Walk-in application support
- Amendment requests and version control
- Franchise expiry tracking and notifications
- Automated franchise number generation

### 🔍 QR Code Verification
- Secure QR code generation for each franchise
- Public verification portal for citizens
- Anti-tampering with cryptographic signatures
- Rate-limited verification API
- Offline-capable Progressive Web App (PWA)

### 📊 Analytics & Reporting
- Interactive dashboard with KPI metrics
- Franchise statistics and trends (via Recharts)
- Incident reports management
- Export to Excel/PDF
- Audit trail logging

### 📢 Communication
- Email notifications (Nodemailer with Gmail)
- SMS notifications (Twilio integration)
- In-app announcement system
- Real-time updates via WebSocket (Socket.IO)

### 🗄️ Data Management
- MongoDB with GridFS for file storage
- Automated backup system (scheduled + manual)
- Data encryption at rest
- Fare matrix management

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  React 19 + Vite 7        │  Material UI + Tailwind CSS            │
│  Progressive Web App      │  Socket.IO Client                       │
│  Dashboard (Port 3000)    │  Recharts for Analytics                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       REVERSE PROXY                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Nginx                    │  SSL/TLS Termination                    │
│  Port 80/443              │  Load Balancing Ready                   │
│  Static File Serving      │  API Routing (/api/*)                   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Express.js 5             │  JWT Authentication                     │
│  Node.js 18+              │  Rate Limiting (express-rate-limit)     │
│  Socket.IO Server         │  Input Validation (express-validator)   │
│  PM2 Process Manager      │  Security Headers (Helmet)              │
│  Port 5170                │  Redis Adapter (Socket.IO clustering)   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  MongoDB 7                │  GridFS (File Storage)                  │
│  Mongoose ODM             │  Redis (Session/Cache)                  │
│  Port 27017               │  Automated Backups                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI Library |
| **Vite 7** | Build Tool & Dev Server |
| **Material UI 7** | Component Library |
| **Tailwind CSS 4** | Utility-First Styling |
| **React Router 7** | Client-Side Routing |
| **Axios** | HTTP Client |
| **Socket.IO Client** | Real-Time Communication |
| **Recharts** | Data Visualization |
| **SweetAlert2** | Alert Dialogs |
| **pdf-lib** | PDF Generation |
| **vite-plugin-pwa** | Progressive Web App |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime Environment |
| **Express.js 5** | Web Framework |
| **MongoDB 7** | Database |
| **Mongoose 8** | ODM |
| **Socket.IO 4** | WebSocket Server |
| **JWT** | Authentication |
| **Nodemailer** | Email Service |
| **Twilio** | SMS Service |
| **Sharp** | Image Processing |
| **QRCode** | QR Code Generation |
| **Winston** | Logging |
| **node-cron** | Task Scheduling |
| **PM2** | Process Manager |

### DevOps & Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker & Docker Compose** | Containerization |
| **Nginx** | Reverse Proxy & Load Balancer |
| **Redis** | Session Store & Socket.IO Adapter |
| **PM2** | Node.js Process Management |

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** v2.0+
- **Minimum 4GB RAM** allocated to Docker
- **Available Ports**: 80, 3000, 5170, 27017

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ray-Gabs/CAPSTONE_TRC-V.git
cd CAPSTONE_TRC-V

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# 3. Build and start all services
docker-compose up -d --build

# 4. Create Super Admin (first time only)
docker-compose exec backend node scripts/seedSuperAdmin.js

# 5. Access the application
# Dashboard: http://localhost:3000
# API: http://localhost:80/api
```

### Verify Installation

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Health check
curl http://localhost:5170/health
```

📖 **For detailed setup instructions, see [QUICKSTART.md](QUICKSTART.md)**

---

## 📁 Project Structure

```
CAPSTONE_TRC-V/
├── 📂 dashboard/                    # Frontend (React + Vite)
│   ├── 📂 public/                   # Static assets
│   │   ├── 📂 Logos/               # Brand assets
│   │   └── 📂 translations/        # i18n files
│   ├── 📂 src/
│   │   ├── 📂 assets/              # Images, fonts
│   │   ├── 📂 components/          # Reusable components
│   │   │   ├── AnimatedPage.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── UnifiedNavbar.jsx
│   │   │   └── ...
│   │   ├── 📂 contexts/            # React Context providers
│   │   ├── 📂 hooks/               # Custom React hooks
│   │   ├── 📂 pages/               # Page components
│   │   │   ├── 📂 Administration/  # Admin pages
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── FranchiseMgmt.jsx
│   │   │   │   ├── Analytics.jsx
│   │   │   │   └── ...
│   │   │   ├── 📂 auth/            # Authentication pages
│   │   │   ├── 📂 Driver/          # Operator/Driver pages
│   │   │   ├── 📂 Landing/         # Public landing page
│   │   │   └── 📂 Reporting/       # Report pages
│   │   ├── 📂 services/            # API service modules
│   │   ├── 📂 Styles/              # Global styles
│   │   └── 📂 utils/               # Utility functions
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── 📂 server/                       # Backend (Node.js + Express)
│   ├── 📂 configs/                 # Configuration files
│   │   └── connection.js           # MongoDB connection
│   ├── 📂 controllers/             # Route handlers
│   │   ├── authController.js
│   │   ├── franchiseApplicationController.js
│   │   ├── qrCodeController.js
│   │   └── ...
│   ├── 📂 middlewares/             # Express middlewares
│   │   ├── authenticate.js         # JWT verification
│   │   ├── authorize.js            # Role-based access
│   │   ├── rateLimiter.js          # Request throttling
│   │   └── ...
│   ├── 📂 models/                  # Mongoose schemas
│   │   ├── franchiseApplicationModel.js
│   │   ├── franchiseInformationModel.js
│   │   ├── userAccountModel.js
│   │   └── ...
│   ├── 📂 repositories/            # Data access layer
│   ├── 📂 routes/                  # API route definitions
│   ├── 📂 scripts/                 # Utility scripts
│   ├── 📂 services/                # Business logic services
│   │   ├── emailService.js
│   │   ├── qrCodeService.js
│   │   ├── backupService.js
│   │   └── ...
│   ├── 📂 templates/               # Email/Document templates
│   ├── 📂 utils/                   # Helper utilities
│   ├── 📂 backups/                 # Database backups
│   ├── Dockerfile
│   ├── ecosystem.config.js         # PM2 configuration
│   ├── index.js                    # Application entry
│   └── package.json
│
├── 📂 nginx/                        # Nginx configuration
│   ├── nginx.conf
│   └── 📂 conf.d/
│
├── docker-compose.yml              # Development Docker setup
├── docker-compose.prod.yml         # Production overrides
├── .env                            # Environment variables
├── DOCKER_SETUP.md                 # Docker documentation
├── QUICKSTART.md                   # Quick start guide
└── ReadMe.md                       # This file
```

---

## 📚 API Reference

### Base URL
```
Development: http://localhost:5170/api
Production:  http://your-domain.com/api
```

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | User login |
| `POST` | `/auth/signup` | User registration |
| `POST` | `/auth/logout` | User logout |
| `POST` | `/auth/refresh-token` | Refresh access token |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/verify-otp` | Verify OTP code |

### Franchise Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/franchise-applications` | List all applications |
| `POST` | `/franchise-applications` | Create new application |
| `GET` | `/franchise-applications/:id` | Get application details |
| `PUT` | `/franchise-applications/:id` | Update application |
| `POST` | `/franchise-applications/:id/approve` | Approve application |

### QR Code Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/qr-code/verify/:code` | Public verification |
| `POST` | `/qr-code/generate` | Generate new QR code |

### Dashboard Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard/stats` | Get dashboard statistics |
| `GET` | `/dashboard/analytics` | Get analytics data |

### File Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/files/upload` | Upload file |
| `GET` | `/files/:id` | Download file |

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# ===========================================
# NODE ENVIRONMENT
# ===========================================
NODE_ENV=production
DEBUG=false
DOCKER_ENV=true

# ===========================================
# SERVER PORTS
# ===========================================
PORT=5170

# ===========================================
# DATABASE
# ===========================================
MONGO_URI=mongodb://mongo:27017/trc_v

# ===========================================
# SECURITY - JWT & SESSIONS
# ===========================================
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key
SESSION_SECRET=your-super-secret-session-key
ENCRYPTION_KEY=your-32-character-encryption-key
QR_SIGNATURE_SECRET=your-qr-signature-secret-key

# ===========================================
# CORS CONFIGURATION
# ===========================================
CORS_ORIGIN=http://localhost:3000,http://localhost:80

# ===========================================
# EMAIL SERVICE (Gmail)
# ===========================================
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=TRC-V System <your-email@gmail.com>

# ===========================================
# SMS SERVICE (Twilio)
# ===========================================
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# ===========================================
# FRONTEND URLs
# ===========================================
VITE_API_BASE_URL=http://localhost
VITE_CLIENT_REDIRECT=http://localhost:3000
```

📖 **For complete configuration guide, see [DOCKER_SETUP.md](DOCKER_SETUP.md)**

---

## 🚢 Deployment

### Docker Deployment (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale backend containers
docker-compose up -d --scale backend=3

# View production logs
docker-compose logs -f backend
```

### Manual Deployment

```bash
# Backend
cd server
npm install --production
pm2 start ecosystem.config.js

# Frontend
cd dashboard
npm install
npm run build
# Serve dist/ folder with Nginx
```

### Health Monitoring

- **Backend Health**: `GET /health`
- **Database Health**: Checked via Docker healthcheck
- **Container Monitoring**: `docker-compose ps`

---

## 🔒 Security

TRC-V implements multiple layers of security:

### Authentication & Session Security
- JWT access tokens with short expiry (15 min)
- Refresh token rotation
- Secure HTTP-only cookies
- Session invalidation on logout

### API Security
- Rate limiting per endpoint
- Request sanitization
- Input validation (express-validator)
- SQL/NoSQL injection prevention

### Infrastructure Security
- Helmet.js security headers
- HPP (HTTP Parameter Pollution) protection
- CORS configuration
- HTTPS enforcement (production)

### Data Security
- Password hashing (bcrypt)
- Data encryption at rest
- Secure file storage (GridFS)
- Audit trail logging

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup guide |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Complete Docker configuration |
| [GRIDFS_OPTIMIZATION_SUMMARY.md](server/GRIDFS_OPTIMIZATION_SUMMARY.md) | File storage optimization |

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Install dependencies
cd dashboard && npm install
cd ../server && npm install

# Start development servers
# Terminal 1 - Backend
cd server && npm run start

# Terminal 2 - Frontend
cd dashboard && npm run dev
```

---

## 👥 Authors

Developed as a **Capstone Project** by:

| Contributor | GitHub |
|-------------|--------|
| **Luke Corpuz** | [@lukecorpuz](https://github.com/lukecorpuz) |
| **Ray Gabatino** | [@ray-Gabs](https://github.com/ray-Gabs) |
| **Ian Salvador Ramos** | [@itik-it](https://github.com/itik-it) |
| **Marla Rihana Jose** | [@Haaanashiii](https://github.com/Haaanashiii) |

**In partnership with:**
- 🏛️ Municipality of Solano, Nueva Vizcaya

---

<div align="center">

**⭐ If you find this project useful, please consider giving it a star!**

Made with ❤️ for the Municipality of Solano, Nueva Vizcaya 🇵🇭

</div>
