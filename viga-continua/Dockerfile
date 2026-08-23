# Build del proyecto independiente (viga-continua | hormigon | acero).
# En Coolify: Build Pack = Dockerfile, Base Directory = la carpeta del proyecto.
# node:22-slim (Debian) por los binarios precompilados de better-sqlite3.
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Runtime: sirve dist/ + API de persistencia (SQLite en DATA_DIR).
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY server ./server

ENV PORT=80
ENV DATA_DIR=/app/data

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]