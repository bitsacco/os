# Stage 1: Base
FROM node:lts-alpine AS base
WORKDIR /app
RUN apk update

# Stage 2: Install dependencies 
FROM base AS deps
WORKDIR /app

# Copy package.json files
COPY apps/admin/package.json ./apps/admin/
COPY apps/admin/yarn.lock ./apps/admin/

# Create directory structure for workspaces
RUN mkdir -p apps/admin

# Install dependencies
RUN yarn install

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy all project files
COPY . .

# Only build the admin package
WORKDIR /app/apps/admin
# Set environment variables for build
ENV NODE_ENV=production
ENV SKIP_TYPE_CHECK=true
ENV NEXT_DISABLE_ESLINT=1

# Use yarn to run the build command
RUN yarn build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
# Make Next.js runtime env vars configurable at container start
ENV NEXT_PUBLIC_API_URL=""

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to the non-root user
USER nextjs

# Expose the port that Next.js runs on
EXPOSE 3000

# Set the proper command to run the app
CMD ["node", "apps/admin/server.js"]
