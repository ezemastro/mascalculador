# AGENTS.md

## Encender el programa

El proyecto es un monorepo con dos apps Vite separadas:

- **`apps/steel/`** — Estructuras de Acero (Viga Acero, Columnas, Carteles). Puerto `5173`.
- **`apps/concrete/`** — Estructuras de Hormigon (Bases, Losas, Compat Losas, Viga H, Columna H). Puerto `5174`.

Cuando el usuario pida encender/entrar/arrancar el programa de **acero**, usar:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\apps\steel'; npm run dev"
```

Disponible en `http://localhost:5173/`.

Para el programa de **hormigon**:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\apps\concrete'; npm run dev"
```

Disponible en `http://localhost:5174/`.

Para levantar ambas en simultaneo desde la raiz del monorepo:

```powershell
npm run dev
```

(Equivalente a `npm run dev:steel && npm run dev:concrete` en paralelo via `concurrently`.)
