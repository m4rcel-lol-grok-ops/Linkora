# Multi-stage production Dockerfile for Linkora
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Final stage
FROM node:20-alpine

RUN addgroup -g 1001 -S linkora && \
    adduser -S -u 1001 -G linkora linkora

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public
COPY migrations ./migrations
COPY seeds ./seeds

RUN mkdir -p /app/public/uploads /app/logs && \
    chown -R linkora:linkora /app

USER linkora

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
