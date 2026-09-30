# Multi-Stage Production Dockerfile for @ojix/property-api
# Stage 1: Build & Compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove development dependencies for a lean production layer
RUN npm prune --production

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling and zombie reaping
RUN apk add --no-cache dumb-init curl

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Run as unprivileged node user for security
RUN mkdir -p /app/uploads && chown -R node:node /app

COPY --chown=node:node package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000

# Docker healthcheck targeting the zero-dependency liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/healthz || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
