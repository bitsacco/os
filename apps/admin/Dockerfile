# Stage 1: Base
FROM oven/bun:alpine AS base
WORKDIR /app

# Development stage for local development
FROM base AS development
WORKDIR /app

# Copy package files for development
COPY package.json ./
COPY bun.lock ./
COPY turbo.json ./
COPY apps/admin/package.json ./apps/admin/

# Install dependencies for development
RUN bun install --frozen-lockfile

# Development uses mounted volumes, so no need to copy source

# Stage 2: Install dependencies 
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json ./
COPY bun.lock ./
COPY turbo.json ./

# Copy admin package files
COPY apps/admin/package.json ./apps/admin/

# Install dependencies
RUN bun install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage (workspace install puts everything in root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace configuration
COPY package.json ./
COPY bun.lock ./
COPY turbo.json ./

# Copy admin app source
COPY apps/admin ./apps/admin/

# Set environment variables for build
ENV NODE_ENV=production
ENV SKIP_TYPE_CHECK=true
ENV NEXT_DISABLE_ESLINT=1

# Build the admin app
WORKDIR /app/apps/admin
RUN bun run build

# Stage 4: Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
# Make Next.js runtime env vars configurable at container start
ENV NEXT_PUBLIC_API_URL=""

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Switch to the non-root user
USER nextjs

# Expose the port that Next.js runs on
EXPOSE 3000

# Set the proper command to run the app
CMD ["node", "apps/admin/server.js"]
