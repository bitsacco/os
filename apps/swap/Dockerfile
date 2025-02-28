FROM oven/bun:latest AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lock ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

COPY apps/swap apps/swap
COPY libs libs
COPY proto proto

RUN bun install --no-frozen-lockfile
RUN bun build:swap

FROM oven/bun:latest AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lock ./

RUN bun install --production --no-frozen-lockfile

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/proto ./proto

CMD ["sh", "-c", "bun run dist/apps/swap/main.js"]
