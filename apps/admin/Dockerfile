# Stage 1: Base
FROM oven/bun:latest AS base
WORKDIR /app
RUN apt-get update && apt-get install -y libc6

# Stage 2: Development
FROM base AS development
WORKDIR /app
ENV NODE_ENV=development

# Copy project files for development
COPY . .
WORKDIR /app
RUN bun install

# Stage 3: Builder
FROM base AS builder
WORKDIR /app

# Copy all project files
COPY . .
RUN bun install

# Build the admin app
WORKDIR /app/apps/admin
RUN bun run build

# Stage 4: Production image
FROM base AS production
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
# Make Next.js runtime env vars configurable at container start
ENV NEXT_PUBLIC_API_URL=""

# Create a non-root user for security
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/apps/admin/out ./apps/admin/out
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder /app/apps/admin/next.config.mjs ./apps/admin/next.config.mjs
COPY --from=builder /app/apps/admin/package.json ./apps/admin/package.json

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to the non-root user
USER nextjs

# Expose the port that Next.js runs on
EXPOSE 3000

# Set the proper command to run the app
CMD ["bun", "run", "start", "--prefix", "apps/admin"]
