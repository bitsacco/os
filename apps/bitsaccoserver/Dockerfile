# Multi-stage build for optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../libs/common/package.json ./libs/common/
COPY ../../libs/testing/package.json ./libs/testing/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .
COPY ../../libs/ ./libs/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bitsacco -u 1001

# Copy built application
COPY --from=builder --chown=bitsacco:nodejs /app/dist ./dist
COPY --from=builder --chown=bitsacco:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bitsacco:nodejs /app/package*.json ./

# Create directories for logs and temporary files
RUN mkdir -p /app/logs /app/tmp && \
    chown -R bitsacco:nodejs /app/logs /app/tmp

# Expose ports
EXPOSE 4000 4001 4002 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

# Switch to non-root user
USER bitsacco

# Start the application
CMD ["node", "dist/main.js"]

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Install development dependencies
RUN npm install -g @nestjs/cli nodemon

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose ports
EXPOSE 4000 4001 4002 9090 9229

# Start in development mode with debugging
CMD ["npm", "run", "start:debug"]