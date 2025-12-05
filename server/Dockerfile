# TRC-V Backend - Production Dockerfile
# Scalable from single instance to cluster

FROM node:20-alpine AS base

# Install PM2 globally
RUN npm install -g pm2

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Remove dev files
RUN rm -rf tests/ *.test.js .env.example

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 5170

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5170/health || exit 1

# Start with PM2 Runtime (production mode)
# -i max = use all available CPUs
# Can override with docker-compose scale or K8s replicas
CMD ["pm2-runtime", "ecosystem.config.js"]
