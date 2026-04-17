FROM oven/bun:1-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/package.json
COPY services/games/package.json ./services/games/package.json
COPY services/wallets/package.json ./services/wallets/package.json
COPY packages/messaging/package.json ./packages/messaging/package.json
COPY packages/persistence/package.json ./packages/persistence/package.json

RUN bun install --frozen-lockfile

COPY services/games ./services/games
COPY packages ./packages

WORKDIR /app/services/games

EXPOSE 4001

CMD ["bun", "run", "start:docker"]
