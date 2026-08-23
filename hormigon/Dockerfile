# Build del proyecto independiente (redeploy con SMTP envs) (viga-continua | hormigon | acero).
# En Coolify: Build Pack = Dockerfile, Base Directory = la carpeta del proyecto.
# node:22-slim (Debian) por los binarios precompilados de better-sqlite3.
# El toolchain (python3/make/g++) compila better-sqlite3 cuando el binario
# precargado no matchea la plataforma (ej. ARM) — el runtime solo copia los
# módulos YA instalados, nunca vuelve a instalar.
FROM node:22-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Runtime: sirve dist/ + API de persistencia (SQLite en DATA_DIR).
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server

ENV PORT=80
ENV DATA_DIR=/app/data

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]