FROM ubuntu:24.04 AS development

# Install Node.js and other dependencies
RUN apt-get update && apt-get install -y curl gnupg unzip
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

COPY apps/swap apps/swap
COPY libs libs
COPY proto proto

# Generate Prisma client
RUN bunx prisma generate --schema apps/swap/prisma/schema.prisma

RUN bun install
RUN bun build:swap

FROM ubuntu:24.04 AS production

# Install Node.js and other dependencies
RUN apt-get update && apt-get install -y curl gnupg unzip
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./

RUN bun install --production

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/proto ./proto
COPY --from=development /usr/src/app/apps/swap/prisma ./prisma

CMD ["sh", "-c", "bun run prisma migrate deploy --schema prisma/schema.prisma && bun run dist/apps/swap/main.js"]
