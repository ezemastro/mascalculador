# Multi-stage build parametrizado por app del monorepo.
#
#   APP        — workspace a construir (concrete | steel)
#   BUILD_CMD  — script de build (build | build:viga-continua)
#   DIST       — directorio de salida (dist | dist-viga-continua)
#
# Uso directo:
#   docker build --build-arg APP=concrete --build-arg BUILD_CMD=build:viga-continua \
#     --build-arg DIST=dist-viga-continua -t viga-continua .
FROM node:22-alpine AS build

ARG APP=concrete
ARG BUILD_CMD=build
ARG DIST=dist

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --no-audit --no-fund \
  && npm run ${BUILD_CMD} --workspace=apps/${APP} \
  && mkdir -p /out/html \
  && cp -r apps/${APP}/${DIST}/. /out/html/ \
  && if [ -f /out/html/viga-continua.html ]; then mv /out/html/viga-continua.html /out/html/index.html; fi

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/html /usr/share/nginx/html

EXPOSE 80
