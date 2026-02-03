# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage (GCP Cloud Run, GKE, or any container runtime)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Postgres full-reset + seed scripts (so GCP container can clean & reseed when DATABASE_URL is set)
COPY --from=builder /app/scripts/full-reset-postgres.js /app/scripts/init-postgres.js /app/scripts/seed-postgres.js /app/scripts/
RUN chown -R nextjs:nodejs /app/scripts

# Entrypoint: when DATABASE_URL set run full-reset+seed; then start server
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

# GCP Cloud Run sets PORT (e.g. 8080); default 3000 for local/docker-compose
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Start server and seed demo data on boot when DATABASE_URL is set
CMD ["/app/docker-entrypoint.sh"]
