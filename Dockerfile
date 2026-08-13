# syntax=docker/dockerfile:1

# Runtime uses tsx (see package.json "start"), so no tsc build step is needed.
# Prisma client is generated at build time; DATABASE_URL is not required for generate.
FROM node:20-slim AS base
# Prisma engines need OpenSSL on slim images.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies (need devless install but tsx/prisma are runtime deps here).
COPY package*.json ./
RUN npm ci

# Generate Prisma client (requires the schema).
COPY prisma ./prisma
RUN npx prisma generate

# App source.
COPY . .

# API_PORT and SHORTEN_PORT (defaults 4000). Adjust in EasyPanel env if changed.
EXPOSE 3333 4000

CMD ["npm", "start"]
