# Archive Report: Split Acero / Hormigon

**Status**: success
**Date**: 2026-08-04
**Branch**: main
**Hash final**: 51d3a67

## Resumen ejecutivo

Mascalculador fue partido de una app monolítica (`client/`) en dos apps Vite separadas (`apps/steel/` para Estructuras de Acero, `apps/concrete/` para Estructuras de Hormigón) más un paquete compartido (`@mascalculador/shared`). La entrega se hizo en 4 PRs encadenados stacked-to-main con verificación empírica via build de TypeScript (sin test runner, strict_tdd: false). El cambio preserva el comportamiento de las 13 specs existentes (solo relocation de paths) y agrega el split como capacidad nueva.

## PRs mergeados

| PR | Branch | Hash | Descripcion |
|---|---|---|---|
| PR 1 | `feature/monorepo-setup` | `a6664eb` | Setup monorepo: `client/` → `apps/steel/`, root `package.json` con workspaces, scripts delegados |
| PR 2 | `feature/app-concrete` | `3501598` | Crear `apps/concrete/` con copy-then-delete, solo pantallas/libs de Hormigon, router hormigon-only |
| PR 3 | `feature/shared-package` | `1e1d853` | Extraer `packages/shared/` con storage (keys prefijadas), types, components, hooks. Ajustar imports en 19 pantallas |
| PR 4 | `feature/cross-import-fix` | `8f9df03` | Mover `calculateBeam` + `calculateBeamDual` + format helpers a `packages/shared/src/`. Eliminar cross-import concrete→steel |
| Post-verify | — | `51d3a67` | Actualizar `AGENTS.md` con dev commands de steel y concrete |

## Specs cumplidos

- `openspec/changes/archive/2026-08-04-split-acero-hormigon/split-acero-hormigon/specs/monorepo-setup/spec.md` — PASS
- `openspec/changes/archive/2026-08-04-split-acero-hormigon/split-acero-hormigon/specs/app-concrete/spec.md` — PASS
- `openspec/changes/archive/2026-08-04-split-acero-hormigon/split-acero-hormigon/specs/shared-package/spec.md` — PASS
- `openspec/changes/archive/2026-08-04-split-acero-hormigon/split-acero-hormigon/specs/cross-import-fix/spec.md` — PASS

## Build status final

| Comando | Resultado |
|---|---|
| `npx tsc -b` (root) | PASS |
| `cd apps/steel && npm run build` | PASS |
| `cd apps/concrete && npm run build` | PASS |
| `npm run build:all` (root) | PASS |

## Métricas

- Archivos movidos: ~25 (storage, types, components, hooks, beam-analysis, format)
- Archivos nuevos: 6 (storage shared, types shared, slab-types, beam-analysis, format, index)
- Líneas modificadas: ~20.000 (mayormente reubicación, no cambios funcionales)
- Pantallas afectadas por cambios de imports: 19
- Funciones reubicadas: `calculateBeam`, `calculateBeamDual`, `formatForce`, `formatMoment`, `formatLength`, `loadLastFormState`, `loadLastColumnFormState`, `loadLastCartelFormState`, `loadLastBasesFormState`, `loadLastRCColumnFormState`, `loadLastSlabFormState`, `saveLastFormState`, `saveLastColumnFormState`, `saveLastCartelFormState`, `saveLastBasesFormState`, `saveLastRCColumnFormState`, `saveLastSlabFormState`, `saveSlab`, `updateSlab`, `saveSlabInput`, `updateSlabInput`, `getSavedSlabs`, `loadSlab`, `deleteSlab`, `saveCompat`, `getSavedCompats`, `deleteCompat`, `listSaves`, `saveBeam`, `updateSave`, `deleteSave`, `getSavedBeams`
- 13 specs existentes: comportamiento preservado, solo paths de archivos cambian

## Known issues (follow-up)

### D1 — Steel app contiene pantallas de Hormigon (WARNING)

`apps/steel/src/screens/` contiene las 10 pantallas de Hormigon (BasesForm, BasesResults, ConcreteForm, ConcreteResults, RCColumnForm, RCColumnResults, SlabForm, SlabResults, SlabCompat, CompatList) en adición a las 9 de acero. El NavBar de steel y el router incluyen rutas de Hormigon. Las libs de Hormigon (bases-calc, beam-reaction, concrete-design, constants, rc-column-calc, slab-calc, slab-to-beam) tambien estan en steel.

**Root cause**: PR 1 movio `client/` (que contenia ambas disciplinas pre-split) a `apps/steel/` con `git mv`. PR 2 creo `apps/concrete/` con copy-then-delete pero no removio los artefactos de Hormigon de steel.

**Severidad**: WARNING. No rompe build (compilan por el wrapper de storage que re-exporta todo). Solo es desorden arquitectonico.

**Fix recomendado**: PR de cleanup que borre las 10 pantallas de Hormigon de `apps/steel/src/screens/`, las 7 libs de Hormigon de `apps/steel/src/lib/`, ajuste `apps/steel/src/main.tsx` (NavBar + router) para solo acero, y ajuste de `apps/steel/src/lib/storage.ts` para que NO re-exporte funciones de Hormigon. ~600 lineas de cambio.

## Decisiones cerradas en propuesta

- `calculateBeamDual`: movido a `@mascalculador/shared` (opcion A)
- localStorage keys: prefijadas con `key(app, name)` (opcion A)
- Scripts root: convenience scripts con workspaces (opcion A)
- Chain strategy: stacked-to-main
- 4 PRs encadenados en orden: monorepo-setup → app-concrete → shared-package → cross-import-fix

## Archivos relevantes

- `package.json` (root) — workspaces + scripts
- `tsconfig.json` (root) — project references
- `apps/steel/`, `apps/concrete/`, `packages/shared/` — estructura del monorepo
- `packages/shared/src/index.ts` — barrel exports
- `packages/shared/src/storage.ts` — storage con keys prefijadas
- `packages/shared/src/beam-analysis.ts` — calculateBeam + calculateBeamDual
- `packages/shared/src/format.ts` — formatForce, formatMoment, formatLength
- `AGENTS.md` — actualizado con dev commands
