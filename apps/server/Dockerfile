FROM oven/bun:latest AS development

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy root workspace files
COPY package.json ./
COPY bun.lock ./
COPY turbo.json ./

# Copy server app files
COPY apps/server/package.json ./apps/server/
COPY apps/server/tsconfig.json ./apps/server/
COPY apps/server/tsconfig.app.json ./apps/server/
COPY apps/server/nest-cli.json ./apps/server/
COPY apps/server/src ./apps/server/src
COPY apps/server/test ./apps/server/test


# Install dependencies
RUN bun install --frozen-lockfile

# Build the server
WORKDIR /usr/src/app/apps/server
RUN bun run build

FROM oven/bun:latest AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Copy workspace files
COPY package.json ./
COPY bun.lock ./
COPY apps/server/package.json ./apps/server/

# Install production dependencies
RUN bun install --production --frozen-lockfile

# Copy built application
COPY --from=development /usr/src/app/apps/server/dist ./apps/server/dist

WORKDIR /usr/src/app/apps/server

# Expose the port
EXPOSE 3000

CMD ["bun", "run", "start:prod"]
