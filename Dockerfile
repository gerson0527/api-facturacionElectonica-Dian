FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
  python3 make g++ libxml2-dev libxslt1-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y \
  libxml2-dev libxslt1-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install pm2 -g

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY xsd ./xsd

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main"]
