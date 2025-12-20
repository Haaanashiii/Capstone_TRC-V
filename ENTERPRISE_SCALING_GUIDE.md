# TRC-V Enterprise Scaling Guide

## Overview

This guide explains how to scale TRC-V from a single server to an enterprise cluster. The system is designed to scale horizontally with minimal configuration changes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOAD BALANCER (External)                             │
│                         (Cloudflare, AWS ALB, etc.)                          │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NGINX                                           │
│                     (Reverse Proxy + Load Balancer)                          │
│                              Port 80/443                                     │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Backend #1    │ │   Backend #2    │ │   Backend #3    │
│ PM2 (4 workers) │ │ PM2 (4 workers) │ │ PM2 (4 workers) │
│    Port 5170    │ │    Port 5170    │ │    Port 5170    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│       REDIS             │   │       MONGODB           │
│  (Session + Socket.IO)  │   │     (Database)          │
│      Port 6379          │   │      Port 27017         │
└─────────────────────────┘   └─────────────────────────┘
```

---

## Scaling Levels

| Level | Backend Containers | PM2 Workers/Container | Total Workers | Concurrent Users |
|-------|-------------------|----------------------|---------------|------------------|
| **Development** | 1 | 1 | 1 | ~100 |
| **Small Office** | 1 | 2 | 2 | ~500 |
| **City-wide** | 2 | 2 | 4 | ~2,000 |
| **Province** | 4 | 4 | 16 | ~8,000 |
| **Enterprise** | 8+ | max | 32+ | ~50,000+ |

---

## Quick Start Scaling Commands

### Development (Single Instance)
```bash
docker-compose up -d
```

### Small Office (2 PM2 Workers)
```bash
# Set in .env
PM2_INSTANCES=2

docker-compose up -d
```

### City-wide (4 Workers Total)
```bash
# Set in .env
PM2_INSTANCES=2

# Scale to 2 containers
docker-compose up -d --scale backend=2
```

### Province (16 Workers Total)
```bash
# Set in .env  
PM2_INSTANCES=4

# Scale to 4 containers
docker-compose up -d --scale backend=4
```

### Enterprise (Production Mode)
```bash
# Set in .env
PM2_INSTANCES=max
BACKEND_REPLICAS=8

# Use production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Configuration Reference

### Environment Variables

Add these to your `.env` file:

```env
# ===========================================
# SCALING CONFIGURATION
# ===========================================

# PM2 Workers per container
# Options: 1, 2, 4, 8, or "max" (all CPUs)
PM2_INSTANCES=2

# Memory limit per PM2 worker
PM2_MAX_MEMORY=512M

# Backend container replicas (for production compose)
BACKEND_REPLICAS=2

# ===========================================
# DATABASE SCALING
# ===========================================

# MongoDB connection (use replica set URI for HA)
MONGO_URI=mongodb://mongo:27017/trcv
# For replica set:
# MONGO_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/trcv?replicaSet=rs0

# Redis connection
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-password

# ===========================================
# PRODUCTION SECURITY
# ===========================================
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=your-strong-mongodb-password
```

---

## Horizontal Scaling

### Adding More Backend Containers

The simplest way to scale is adding more backend containers:

```bash
# Scale to 3 backend containers
docker-compose up -d --scale backend=3
```

Nginx will automatically load balance between all backend containers using least-connections algorithm.

### Adding External Servers

For multi-server deployments, update `nginx/nginx.conf`:

```nginx
upstream backend_servers {
    least_conn;
    
    # Local backends (Docker)
    server backend:5170 weight=1;
    
    # External servers
    server 192.168.1.101:5170 weight=1 max_fails=3 fail_timeout=30s;
    server 192.168.1.102:5170 weight=1 max_fails=3 fail_timeout=30s;
    
    # Backup server (only used when all others fail)
    server backup.example.com:5170 backup;
    
    keepalive 64;
}
```

---

## High Availability Setup

### MongoDB Replica Set

For production, use a 3-node MongoDB replica set:

```yaml
# docker-compose.ha.yml
services:
  mongo1:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo1-data:/data/db
    networks:
      - trcv-network

  mongo2:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo2-data:/data/db
    networks:
      - trcv-network

  mongo3:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo3-data:/data/db
    networks:
      - trcv-network
```

Initialize the replica set:
```javascript
// Connect to mongo1 and run:
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
})
```

### Redis Sentinel (High Availability)

For Redis HA, use Redis Sentinel or Redis Cluster:

```yaml
# docker-compose.redis-ha.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    
  redis-slave:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379
    
  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

---

## Docker Swarm Deployment

For true enterprise scale, use Docker Swarm:

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml trc-v

# Scale services
docker service scale trc-v_backend=8

# View services
docker service ls
docker service ps trc-v_backend
```

---

## Kubernetes Deployment

For Kubernetes, convert the Docker Compose files:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.28.0/kompose-linux-amd64 -o kompose

# Convert
./kompose convert -f docker-compose.yml -f docker-compose.prod.yml

# Apply
kubectl apply -f .
```

---

## Monitoring & Observability

### PM2 Monitoring

```bash
# View all processes
docker-compose exec backend pm2 status

# Live monitoring dashboard
docker-compose exec backend pm2 monit

# View logs
docker-compose exec backend pm2 logs

# View metrics
docker-compose exec backend pm2 show trc-v-api
```

### Docker Stats

```bash
# Real-time resource usage
docker stats

# Container-specific
docker stats trc-v-backend trc-v-mongodb trc-v-redis
```

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /nginx-health` | Nginx health (fast) |
| `GET /health` | Backend health |
| `GET /api/status` | Detailed system status |

---

## Performance Tuning

### Nginx Optimization

For high traffic, increase these values in `nginx.conf`:

```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 8192;  # Increase for enterprise
    use epoll;
    multi_accept on;
}

http {
    # Increase rate limits for enterprise
    limit_req_zone $binary_remote_addr zone=api_limit:50m rate=100r/s;
}
```

### MongoDB Optimization

```bash
# Increase cache size for large datasets
mongod --wiredTigerCacheSizeGB 4

# Create indexes for common queries
db.franchiseInformation.createIndex({ status: 1, createdAt: -1 })
db.users.createIndex({ email: 1 }, { unique: true })
```

### Redis Optimization

```bash
# Increase max memory for heavy caching
redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

---

## Troubleshooting

### Backend Not Scaling

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs backend

# Check PM2 inside container
docker-compose exec backend pm2 status
```

### Socket.IO Not Working Across Containers

Ensure Redis is running and configured:

```bash
# Check Redis connection
docker-compose exec backend node -e "
  const redis = require('redis');
  const client = redis.createClient({ url: 'redis://redis:6379' });
  client.connect().then(() => console.log('Redis OK')).catch(console.error);
"
```

### High Memory Usage

```bash
# Check memory per container
docker stats --no-stream

# Reduce PM2 workers
PM2_INSTANCES=2 docker-compose up -d

# Reduce memory limit
PM2_MAX_MEMORY=256M docker-compose up -d
```

---

## Zero-Downtime Deployment

```bash
# Reload PM2 inside container (graceful)
docker-compose exec backend pm2 reload ecosystem.config.js

# Rolling update (Docker)
docker-compose up -d --no-deps --build backend

# Docker Swarm rolling update
docker service update --image myregistry/trc-v-backend:v2 trc-v_backend
```

---

## Security Checklist for Production

- [ ] Set strong `JWT_SECRET` (64+ characters)
- [ ] Set strong `MONGO_ROOT_PASS`
- [ ] Set `REDIS_PASSWORD`
- [ ] Enable SSL/TLS in Nginx
- [ ] Restrict MongoDB port (don't expose 27017 to public)
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up log rotation
- [ ] Configure backup automation

---

## Support

For issues or questions about scaling, check:
1. `docker-compose logs -f` for real-time logs
2. `pm2 monit` for PM2 dashboard
3. `/health` endpoint for system status
