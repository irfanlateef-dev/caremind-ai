FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src/

# Prisma generate only needs env vars present in schema; no DB connection at build time.
ENV CENTRAL_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/caremind_central"
ENV TENANT_DATABASE_URL="postgresql://build:build@127.0.0.1:5433/caremind_tenant_build"

RUN npx prisma generate --schema=prisma/central/schema.prisma && \
    npx prisma generate --schema=prisma/tenant/schema.prisma && \
    npm run build

# ─── Production image ─────────────────────────────────────────────────────
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y \
    openssl \
    postgresql-client \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/
COPY prisma ./prisma/

# Prisma CLI + engines required for per-org tenant migrations at register-org
RUN npx prisma version

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
  && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
