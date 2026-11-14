# Multi-Stage Production Dockerfile for @ojix/property-api
# Stage 1: Build & Compile TypeScript
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove development dependencies for a lean production layer
RUN npm prune --production

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

# Local OCR supports Kannada and English scans. Poppler renders PDF pages before
# Tesseract reads them; document facts still require human verification.
RUN apk add --no-cache \
    dumb-init \
    curl \
    chromium \
    font-noto \
    font-noto-kannada \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-kan

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Run as unprivileged node user for security
RUN mkdir -p /app/uploads && chown -R node:node /app

COPY --chown=node:node package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 8080

# Docker healthcheck targeting the zero-dependency liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://127.0.0.1:${PORT:-8080}/healthz" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
