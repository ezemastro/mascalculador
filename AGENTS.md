# AGENTS.md

## Encender el programa

El repositorio tiene **3 proyectos independientes** (cada uno autocontenido con su propio `package.json`, `shared/` vendado y Dockerfile):

- **`viga-continua/`** — Analisis de vigas continuas (envolventes Mu/Vu). Puerto `5175`.
- **`hormigon/`** — Estructuras de Hormigon (Viga H, Viga Continua, Bases, Losas, Columna H). Puerto `5174`.
- **`acero/`** — Estructuras de Acero (Viga Acero, Columnas, Carteles). Puerto `5173`.

Cuando el usuario pida encender/entrar/arrancar el programa de **viga continua**, usar:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\viga-continua'; npm run dev:all"
```

`dev:all` corre en paralelo (con `concurrently`):
- **API + SQLite** (`npm run server`, puerto `5176`) — persiste en `viga-continua/data/storage.db` (fuera de git).
- **Vite** (`npm run dev`, puerto `5175`) — proxya `/api` a la API.

Sin la API, la app sigue funcionando con `localStorage` del navegador (modo offline). Sin `npm run dev:all`, solo `npm run dev` sirve igual (offline).

Disponible en `http://localhost:5175/`.

Para el programa de **hormigon**:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\hormigon'; npm run dev"
```

Disponible en `http://localhost:5174/`.

Para el programa de **acero**:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\acero'; npm run dev"
```

Disponible en `http://localhost:5173/`.

## Deploy

Cada carpeta es un stack independiente con su propio `Dockerfile` y `docker-compose.yml`. `hormigon` y `acero`: `npm ci` + `npm run build`, servido con nginx. `viga-continua`: servido por Node (Express) que además corre la API de persistencia SQLite (ver nota abajo). Los compose usan `expose: 80` + healthcheck y NO publican puertos al host.

En Coolify, por cada app (viga-continua, hormigon, acero):

1. Nuevo recurso → **Docker Compose** como Build Pack.
2. Repositorio raiz y branch deseada.
3. **Base Directory** = la carpeta del proyecto (`viga-continua` | `hormigon` | `acero`).
4. **Docker Compose Location** = `docker-compose.yml`.
5. Asignar dominio a cada servicio.

> **Nota viga-continua**: su imagen ya NO usa nginx — el contenedor es Node y sirve `dist/` + la API de persistencia (SQLite). El compose declara el volumen `viga-continua-data` montado en `/app/data`; los datos sobreviven redeploys/recreaciones. Backend: `server/index.js` (Express + better-sqlite3), expone `GET /health`, `GET /api/storage`, `POST /api/storage/sync`. El frontend sincroniza localStorage con la API vía `src/lib/cloud-storage.ts` (shim con debounce + flush al cerrar; sin server cae a localStorage nativo).

> **Auth viga-continua**: registro abierto (username 3-30 chars alfanumérico/`_` + password ≥ 8 chars, hash scrypt con salt). Sesiones por cookie HttpOnly `vc_session` (30 días, server-side en tabla `sessions`). Endpoints `/api/auth/register|login|logout|me`. Storage aislado por usuario (tabla `kv` con `user_id`): cada cuenta solo ve sus datos. Rate limit 20 intentos/15 min por IP en auth. En el primer registro del server, las keys sin dueño del período sin auth se asignan a esa cuenta. El login exige la pantalla `AuthScreen` antes de la app; el shim de localStorage se instala recién tras autenticar.

> **Recuperación de contraseña viga-continua**: el registro pide email (obligatorio, único). Endpoints `/api/auth/forgot` (genera token de 1 h y manda mail con link `BASE_URL/?reset=<token>`) y `/api/auth/reset` (nueva password + invalida todas las sesiones del usuario; token de un solo uso). Envío con nodemailer vía SMTP de Hostinger. Variables de entorno (en dev en `viga-continua/.env` — gitignoreado; en Coolify definirlas en el servicio): `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `BASE_URL` (ej. `https://dominio`). Si falla el envío, el server loguea el link directo en consola (`[recuperacion] ...`). Respuesta de `/forgot` idéntica exista o no la cuenta (no filtra emails registrados).
