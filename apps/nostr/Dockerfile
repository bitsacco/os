FROM oven/bun:latest AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

COPY apps/nostr apps/nostr
COPY libs libs
COPY proto proto

RUN bun install
RUN bun build:nostr

FROM oven/bun:latest AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./

RUN bun install --production

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/proto ./proto

CMD ["sh", "-c", "bun run dist/apps/nostr/main.js"]
