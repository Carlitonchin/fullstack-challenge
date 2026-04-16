FROM oven/bun:1-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json ./
RUN bun install

COPY . .

EXPOSE 4002

CMD ["bun", "run", "start:docker"]
