FROM oven/bun:latest AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/swap/prisma/client ./prisma/client

# FIXME: This hack allows prisma to work with oven/bun
# Ref: https://github.com/oven-sh/bun/issues/5320#issuecomment-1730927088
COPY --from=node:20 /usr/local/bin/node /usr/local/bin/node

COPY apps/swap apps/swap
COPY libs libs
COPY proto proto

RUN bun install
RUN bun build:swap

FROM oven/bun:latest AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lockb ./

RUN bun install --production

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/proto ./proto
COPY --from=development /usr/src/app/prisma ./prisma

CMD ["sh", "-c", "bun prisma migrate deploy && bun dist/apps/swap/main.js"]
