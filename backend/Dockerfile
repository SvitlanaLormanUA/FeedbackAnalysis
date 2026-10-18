# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Full install (incl. prisma CLI) so `prisma db push` can run on boot.
COPY package*.json .npmrc ./
RUN npm ci

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
# Sync the schema to the DB on boot, then start the server.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
