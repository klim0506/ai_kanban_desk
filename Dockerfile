# ── deps: install all packages ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── builder: generate prisma client + next build ─────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node_modules/.bin/prisma generate
RUN node_modules/.bin/next build

# ── runner: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# wget for healthcheck
RUN apk add --no-cache wget

# Copy everything needed to run both web and bot
COPY --from=builder /app/node_modules       ./node_modules
COPY --from=builder /app/.next              ./.next
COPY --from=builder /app/package.json       ./package.json
COPY --from=builder /app/next.config.mjs    ./next.config.mjs
COPY --from=builder /app/public             ./public
COPY --from=builder /app/prisma             ./prisma
COPY --from=builder /app/lib                ./lib
COPY --from=builder /app/types              ./types
COPY --from=builder /app/src                ./src
COPY --from=builder /app/tsconfig.json      ./tsconfig.json

EXPOSE 3000
