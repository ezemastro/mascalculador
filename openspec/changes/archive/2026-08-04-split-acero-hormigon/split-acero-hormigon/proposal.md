# Proposal: Split Acero / Hormigon en Apps Independientes

## Why

La aplicacion actual mezcla calculo de acero (CIRSOC 301) y hormigon (CIRSOC 201) en un solo entry point `client/`. Esto genera tres problemas:

1. **Acoplamiento de librerias**: `beam-reaction.ts` (hormigon) importa `calculateBeamDual` de `beam-calculations.ts` (acero). Cualquier cambio en el motor de vigas de acero puede romper el flujo de losa→viga.
2. **Experiencia de usuario confusa**: un ingeniero estructural que solo trabaja con hormigon navega entre pantallas de acero que no le interesan. El menu y ruteo son unicos para ambas disciplinas.
3. **storage.ts monolito**: 18 funciones mezclan keys de localStorage para acero y hormigon en un solo archivo. Agregar persistencia a un nuevo calculo requiere tocar este archivo compartido, con riesgo de colision de nombres.

La solucion es separar en dos aplicaciones independientes, cada una con su propio dev server, ruteo, y scope de responsabilidad, compartiendo solo lo genuinamente comun via un paquete `@mascalculador/shared`.

## What Changes

### PR 1: Setup monorepo (`feature/monorepo-setup`, ~500 lineas)
- Mover `client/` → `apps/steel/`
- Crear root `package.json` con workspaces (`apps/*`, `packages/*`)
- Validar que `npm run dev` en `apps/steel/` compila y sirve la app de acero

### PR 2: Crear app Hormigon (`feature/app-concrete`, ~10.000 lineas)
- Copiar `apps/steel/` completo a `apps/concrete/`
- Borrar pantallas de acero (FormPage, ResultsPage, PrintPage, ColumnForm, ColumnResults, ColumnPrintPage, CartelForm, CartelResults, CartelPrintPage)
- Borrar libs de acero (beam-calculations, steel-design, column-calc, truss-calc, cartel-calc, profiles, angle-profiles, upn-profiles, tube-profiles)
- Ajustar ruteo y menu para solo pantallas de hormigon
- Validar build independiente

### PR 3: Extraer paquete compartido (`feature/shared-package`, ~3.000 lineas)
- Crear `packages/shared/` con `package.json` (`name: "@mascalculador/shared"`)
- Mover `storage.ts`, `types.d.ts`, `MainLayout.tsx`, `SavedBeams.tsx`, `SlabPlan.tsx`, `useDecimalField.tsx`
- Ambos `apps/steel/` y `apps/concrete/` importan de `@mascalculador/shared`
- Ajustar paths de import en todas las pantallas y libs

### PR 4: Resolver cross-import (`feature/cross-import-fix`, ~500 lineas)
- `beam-reaction.ts` (concrete) importa `calculateBeamDual` de `beam-calculations.ts` (steel)
- Opcion A: mover `calculateBeamDual` a `@mascalculador/shared`
- Opcion B: duplicar la funcion en `apps/concrete/` (la funcion es generica: analisis elastico de vigas)
- Smoke tests finales y verificacion de build en ambas apps

**Cadena de merge**: `feature/monorepo-setup` → `feature/app-concrete` → `feature/shared-package` → `feature/cross-import-fix` → `main`

## Impact

### Archivos reubicados

| Desde | Hacia | Cantidad |
|-------|-------|----------|
| `client/src/screens/*Acero*` | `apps/steel/src/screens/` | 9 pantallas |
| `client/src/screens/*Hormigon*` | `apps/concrete/src/screens/` | 10 pantallas |
| `client/src/lib/*Acero*` | `apps/steel/src/lib/` | 9 archivos |
| `client/src/lib/*Hormigon*` | `apps/concrete/src/lib/` | 8 archivos |
| `client/src/lib/storage.ts` | `packages/shared/src/` | compartido |
| `client/src/types.d.ts` | `packages/shared/src/` | compartido |
| `client/src/components/*` | `packages/shared/src/` | 3 componentes |
| `client/src/hooks/*` | `packages/shared/src/` | 1 hook |

### Especificaciones afectadas

Todas las specs existentes en `openspec/specs/` cambian de ubicacion fisica pero **no de comportamiento**:

- Acero: `steel-beam-load-split`, `column-persistence`, `column-save`, `column-print`, `column-upn-single`, `column-tube-profiles`, `brace-sizing`
- Hormigon: `slab-analysis`, `slab-compat`, `slab-dl-reactions`, `slab-persistence`, `slab-to-beam-adapter`, `concrete-beam-routing`

### Usuarios

- Ingenieros de acero: acceden via `http://localhost:5173` (app steel)
- Ingenieros de hormigon: acceden via `http://localhost:5174` (app concrete)
- localStorage por dominio: los datos guardados en steel son independientes de concrete (mismo host, puertos distintos)

## Out of Scope

- Nuevas features o pantallas de calculo
- Refactor de logica de calculo (formulas intactas)
- Setup de test runner (strict_tdd: false, sin cambios)
- Cambios en la UI/UX de pantallas existentes
- Separacion de `storage.ts` por dominio (sigue siendo un archivo unico con funciones para ambas disciplinas)
- Migracion automatica de datos entre apps (el usuario re-ingresa o exporta manualmente)

## Approach

**Estrategia de monorepo**: npm workspaces nativos. Sin Nx, Turborepo, ni Lerna. El root `package.json` define `workspaces: ["apps/*", "packages/*"]` y scripts delegados (`dev:steel`, `dev:concrete`, `build:all`).

**Estrategia de split**: "copy-then-delete". PR 2 copia la app de acero entera a concrete y despues borra lo que no pertenece. Esto minimiza el riesgo de perder archivos o configuraciones necesarias (Vite, TS, ESLint, Tailwind).

**Estrategia de shared**: paquete interno `@mascalculador/shared` con `"main": "./src/index.ts"` y `"types": "./src/index.ts"`. Sin build step (Vite resuelve TS directamente). Ambos apps lo referencian via `workspace:*`.

**Estrategia de cross-import**: `calculateBeamDual` es una funcion generica de analisis elastico (no especifica de acero). Se mueve a `@mascalculador/shared/src/beam-analysis.ts`. `beam-reaction.ts` importa de ahi. `beam-calculations.ts` tambien puede importar de shared si se desea DRY, pero no es obligatorio en este cambio.

**Estrategia de Vite**: cada app tiene su propio `vite.config.ts`. `apps/steel/` usa puerto 5173, `apps/concrete/` usa puerto 5174. Ambos heredan la config base (rolldown-vite, React SWC plugin, Tailwind).

## Capabilities

### New Capabilities

- None (cambio estructural, sin nuevas capacidades funcionales)

### Modified Capabilities

- None (las 13 specs existentes mantienen comportamiento; solo cambian paths de archivos)

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `calculateBeamDual` cross-import rompe al separar apps | High | PR 4 dedicado exclusivamente a resolverlo. Mover a shared antes de que los imports fallen. |
| localStorage keys colisionan entre apps | Medium | Las dos apps corren en puertos distintos (5173 vs 5174) → dominios distintos para localStorage. Sin embargo, si un usuario corre ambas en el mismo puerto en produccion, keys de storage.ts (ej: `slab_saves`) son identicas. Short-term: aceptar. Long-term: prefijar keys por app. |
| `types.d.ts` pierde sincronia entre apps | Medium | Centralizar en `@mascalculador/shared` como fuente unica de verdad. Ambas apps importan los mismos tipos. |
| Vite config divergente entre apps | Low | PR 2 copia de steel → concrete, garantizando base identica. PR 3 solo ajusta alias de shared. |
| `constants.ts` no es realmente compartido | Low | Este archivo contiene constantes de hormigon (gamma_c, gamma_s, etc.). Va a `apps/concrete/src/lib/`. Si acero lo necesita, se evalua en PR 3. |
| Chained PRs bloquean si uno falla CI | Medium | Cada PR es autocontenido y verificable: `npm run build` en la app afectada. Si PR 2 falla, PR 3 y 4 esperan sin perder trabajo. |
| `storage.ts` tiene TODO de todas las disciplinas mezcladas | Medium | No se separa en este cambio (out of scope). El TODO se mantiene. Si una disciplina agrega persistencia, no deberia tocar keys de la otra, pero el archivo sigue siendo shared. |

## Rollback Plan

Cada PR revierte independientemente con `git revert`:
- **PR 1**: `git revert` + mover `apps/steel/` de vuelta a `client/` (un solo `git mv`). Root `package.json` se elimina.
- **PR 2**: `git revert` borra `apps/concrete/`. `apps/steel/` intacto.
- **PR 3**: `git revert` restaura imports locales en ambas apps. `packages/shared/` queda huerfano pero inofensivo.
- **PR 4**: `git revert` restaura cross-import original. Ningun otro archivo afectado.

En el peor caso (los 4 PRs mergeados y se necesita rollback total): revertir en orden inverso (PR 4 → PR 3 → PR 2 → PR 1).

## Dependencies

- `openspec/specs/steel-beam-load-split`: `Load.deadLoad`/`liveLoad` se preserva en `types.d.ts` → shared
- `openspec/specs/slab-to-beam-adapter`: usa `calculateBeamDual` → requiere PR 4 para resolver
- `openspec/specs/slab-dl-reactions`: `SlabResult` con campos D/L separados → types en shared
- Ninguna dependencia externa nueva (npm packages sin cambios)

## Migration

### Para el desarrollador
- `npm install` en root instala dependencias de todas las apps y packages
- `npm run dev:steel` lanza acero en `:5173`
- `npm run dev:concrete` lanza hormigon en `:5174`
- El viejo `client/` desaparece; el build command `cd client && npm run build` se reemplaza por `npm run build:all`

### Para el usuario
- Cambio transparente: dos URLs en vez de una
- Datos guardados en localStorage: cada app tiene su propio storage (puertos distintos)
- Si el usuario usaba la app unificada, los datos de acero y hormigon estaban mezclados en el mismo localStorage. Post-split, acero en `:5173` solo ve datos de acero, hormigon en `:5174` solo ve datos de hormigon. Los datos legacy del monolito quedan en el dominio original (ej: `localhost:5173` si ahi corria antes) pero mezclados — el usuario decide si los necesita.
- No hay script de migracion automatica de datos legacy

### AGENTS.md
Actualizar el comando `Start-Process` para reflejar la nueva ubicacion: `C:\Users\marce\mascalculador\apps\steel` para acero. Agregar entrada equivalente para hormigon.

## Success Criteria

- [ ] `npm run build` en `apps/steel/` compila sin errores
- [ ] `npm run build` en `apps/concrete/` compila sin errores
- [ ] `npm run dev:steel` sirve la app en `localhost:5173` con solo pantallas de acero
- [ ] `npm run dev:concrete` sirve la app en `localhost:5174` con solo pantallas de hormigon
- [ ] `@mascalculador/shared` es importable desde ambas apps sin errores de TS
- [ ] `beam-reaction.ts` en concrete no importa nada de `apps/steel/`
- [ ] `tsc -b` pasa en root, `apps/steel/`, `apps/concrete/`, y `packages/shared/`
- [ ] ESLint cero errores en todos los workspaces
- [ ] `openspec/specs/` (13 specs) no requieren cambios de contenido — solo relocation paths

---

## Decisiones (resueltas 2026-08-03)

Las 3 preguntas abiertas fueron resueltas por el usuario con las siguientes opciones:

**1. `calculateBeamDual` → MOVER a `@mascalculador/shared`** (opcion A)
- La funcion es generica (analisis elastico de viga), no especifica de acero.
- Vive en `packages/shared/src/beam-analysis.ts`.
- `apps/steel/src/lib/beam-calculations.ts` importa de ahi (mismo comportamiento).
- `apps/concrete/src/lib/beam-reaction.ts` importa de ahi (resuelve el cross-import).
- Esto es parte del PR 4.

**2. localStorage keys → PREFIJAR AHORA** (opcion A)
- Keys con prefijo por app: `steel:` para acero, `concrete:` para hormigon.
- Ejemplos: `steel:beam_saves`, `concrete:slab_saves`, `concrete:bases_saves`.
- Implementado en `packages/shared/src/storage.ts` con un helper `key(app, name)`.
- Cambio mecanico, agregado al PR 3 (shared package) cuando storage.ts se mueve.
- Nota: datos legacy del monolito (`beam_saves` sin prefijo) quedan en el localStorage original pero no se leen — el usuario re-ingresa o exporta.

**3. Scripts root → CONVENIENCE SCRIPTS** (opcion A)
- Root `package.json` tiene `workspaces: ["apps/*", "packages/*"]`.
- Scripts: `dev` (ambas en paralelo via `concurrently`), `dev:steel`, `dev:concrete`, `build:all`, `lint:all`, `typecheck:all`.
- AGENTS.md se actualiza con los nuevos comandos `dev:steel` y `dev:concrete`.
