FROM node:22-alpine AS base

# Install ALL dependencies (needed for build)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci

# Install production-only dependencies
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci --omit=dev --workspace=@artemis-e2e/server --workspace=@artemis-e2e/shared

# Build client (Vite) + server (tsup)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages ./packages
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built artifacts
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/client/dist ./client-dist

# Copy production-only node_modules (server needs native deps like better-sqlite3)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# Create data directory
RUN mkdir -p /data/reports /data/backups && chown -R appuser:nodejs /data

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PATH=/data/reports.db
ENV DATA_DIR=/data
ENV CLIENT_DIST_PATH=/app/client-dist

CMD ["node", "dist/index.js"]
