# TRC-V Dashboard Dockerfile
# Multi-stage build for optimized production image

# ===========================================
# STAGE 1: Build Stage
# ===========================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
# python3, make, g++ needed for some native npm packages
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
# Using --legacy-peer-deps to handle React 19 compatibility issues
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Build arguments for environment variables
# These get baked into the build at build-time
ARG VITE_API_BASE_URL=http://localhost:5170
ARG VITE_CLIENT_REDIRECT=http://localhost:3000
ARG NODE_ENV=production

# Set environment variables for Vite build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CLIENT_REDIRECT=$VITE_CLIENT_REDIRECT
ENV NODE_ENV=$NODE_ENV

# Build the application
# This creates optimized production build in /app/dist
RUN npm run build

# ===========================================
# STAGE 2: Production Stage
# ===========================================
FROM nginx:alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration for SPA routing
RUN rm /etc/nginx/conf.d/default.conf
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss text/javascript;
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # PWA Service Worker - must not be cached
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # PWA Manifest
    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache";
        types { application/manifest+json webmanifest; }
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
