# AGENTS.md

## Encender el programa

El repositorio tiene **3 proyectos independientes** (cada uno autocontenido con su propio `package.json`, `shared/` vendado y Dockerfile):

- **`viga-continua/`** — Analisis de vigas continuas (envolventes Mu/Vu). Puerto `5175`.
- **`hormigon/`** — Estructuras de Hormigon (Viga H, Viga Continua, Bases, Losas, Columna H). Puerto `5174`.
- **`acero/`** — Estructuras de Acero (Viga Acero, Columnas, Carteles). Puerto `5173`.

Cuando el usuario pida encender/entrar/arrancar el programa de **viga continua**, usar:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\viga-continua'; npm run dev"
```

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

Cada carpeta es un stack independiente con su propio `Dockerfile` y `docker-compose.yml` (build `npm ci` + `npm run build`, servido con nginx). Los compose usan `expose: 80` + healthcheck y NO publican puertos al host.

En Coolify, por cada app (viga-continua, hormigon, acero):

1. Nuevo recurso → **Docker Compose** como Build Pack.
2. Repositorio raiz y branch deseada.
3. **Base Directory** = la carpeta del proyecto (`viga-continua` | `hormigon` | `acero`).
4. **Docker Compose Location** = `docker-compose.yml`.
5. Asignar dominio a cada servicio.
