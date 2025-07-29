FROM oven/bun:latest AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lock ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY bunfig.toml bunfig.toml

COPY src src

RUN bun install --no-frozen-lockfile

RUN bun run build

FROM oven/bun:latest AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY bun.lock ./

RUN bun install --production --no-frozen-lockfile

COPY --from=development /usr/src/app/dist ./dist

CMD ["bun", "dist/main.js"]
