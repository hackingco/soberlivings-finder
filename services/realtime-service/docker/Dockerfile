# Multi-stage build for Node.js realtime service

# Stage 1: Dependencies
FROM node:18-alpine AS dependencies

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy source code
COPY . .

# Copy production dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs

# Stage 3: Production image
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S realtime -u 1001 -G nodejs

# Copy application files
COPY --from=build --chown=realtime:nodejs /app .

# Create necessary directories with proper permissions
RUN mkdir -p logs && chown -R realtime:nodejs logs
RUN mkdir -p /app/.cache && chown -R realtime:nodejs /app/.cache

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Expose port
EXPOSE 3003

# Switch to non-root user
USER realtime

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# Development stage
FROM build AS development

# Install development dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Expose port
EXPOSE 3003

# Use nodemon for development
CMD ["nodemon", "server.js"]