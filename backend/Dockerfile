# ══════════════════════════════════════════════════════════════════
# Laizer API — Dockerfile (multi-stage Alpine)
# Stage 1 (builder): install deps, generate Prisma client
# Stage 2 (runtime): lean image — no dev tools, no source map files
# ══════════════════════════════════════════════════════════════════

# ── Stage 1: builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# openssl is required by Prisma on Alpine
RUN apk add --no-cache openssl

# Install ALL dependencies (including devDeps for Prisma CLI)
COPY package*.json ./
RUN npm ci

# Copy schema and generate the Prisma client
# (No DB connection needed at build time — only reads schema.prisma)
COPY prisma ./prisma
RUN npx prisma generate

# Copy application source
COPY src ./src

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Copy only what the running process needs
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/src           ./src
COPY package*.json ./
COPY start.sh      ./
RUN chmod +x start.sh

EXPOSE 8000
ENV NODE_ENV=production

# Entrypoint: run Prisma migrations then start the server
CMD ["./start.sh"]
