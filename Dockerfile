# ------------------------------------------------------------------------------
# Multi-stage Dockerfile for IPO Intelligence & Allotment Platform
# ------------------------------------------------------------------------------

# Stage 1: Build & TypeScript compilation
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist
COPY migrations/ ./migrations/

# Security: run as non-root user
USER node

EXPOSE 3000

# Default command starts HTTP API server
CMD ["node", "dist/server.js"]
