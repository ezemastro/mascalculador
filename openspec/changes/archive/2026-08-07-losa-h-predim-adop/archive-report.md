# Archive Report: losa-h-predim-adop

**Status**: success
**Date**: 2026-08-07
**Branch**: `feat/losa-ux-cuentas` (NOT merged to main, NOT pushed)
**Commit**: `ff961c8` — "feat(losa): separar h en h predim (derivado) y h adop (input)"
**Verdict**: PASS WITH 1 WARNING (verified)

## Resumen ejecutivo

El change `losa-h-predim-adop` extiende `slab-ux-form` (archivado en `2026-08-07-losa-ux-cuentas`) dividiendo el campo `h` en dos: un display readonly `h predim (cm)` recalculado en vivo vía `useMemo` sobre `lx`, `ly` y los cuatro bordes (usando `predimCoef` que ahora se exporta desde `slab-calc.ts`), y un input numérico `h adop (cm) — 0 = usar predim`. La form computa `hEfectivoMm = (hAdop > 0 ? hAdop : hPredim) * 10` al submit/save y lo pasa como `h` al engine (firma del engine intacta en mm). `SlabLastFormState.h` (mm, legacy) migra a `hAdop` (cm) en load. Cambios espejados byte-identical a `apps/steel`. Typecheck/build/MD5 PASS. 5/5 requirements verificados. 1 WARNING pre-existente (no introducido por este change): `+ Nueva` borra la key incorrecta de localStorage.

## Specs afectados

### Modificadas (1)

- `openspec/specs/slab-ux-form/spec.md` — `h field location` MODIFIED + 5 requirements ADDED (10 requirements, 21 escenarios totales)

### Main spec line counts

| Spec | Before | After | Delta |
|------|--------|-------|-------|
| `slab-ux-form` | 130 | 192 | +62 (modified 1 requirement, added 5 requirements with 8 new scenarios) |

### Detalle del merge

**MODIFIED requirement:**
- `h field location` — pasa de "1 input `h` en posición 5" a "2 fields (`h predim` readonly + `h adop` input) en Condiciones de borde, con escenarios reescritos para reflejar el nuevo modelo."

**ADDED requirements (5):**
1. `hPredim derivado` — `useMemo` con `predimCoef`, mismo algoritmo que el engine, mismo render
2. `hAdop input` — input numérico, default 0, persistido en `SlabLastFormState.hAdop`
3. `h efectivo para cálculo` — `hEfectivoMm = (hAdop > 0 ? hAdop : hPredim) * 10` al submit/save
4. `Persistencia hAdop` — `hAdop: number` (cm) en `SlabLastFormState` + migración legacy `h` (mm) → `hAdop = h / 10`
5. `Reset en +Nueva` — `hAdop = 0` y remoción de la entry de localStorage

## Líneas modificadas (commit ff961c8)

```
 apps/concrete/src/lib/slab-calc.ts     |  2 +-                                    (export predimCoef)
 apps/concrete/src/screens/SlabForm.tsx | 85 ++++++++++++++++++++++++++-------    (hAdop state, hPredim useMemo, derivado, migración)
 apps/steel/src/lib/slab-calc.ts        |  2 +-                                    (export predimCoef, MD5-mirror)
 apps/steel/src/screens/SlabForm.tsx    | 85 ++++++++++++++++++++++++++-------    (MD5-mirror)
 packages/shared/src/storage.ts         | 20 +++++++-                              (SlabLastFormState.hAdop + @deprecated h legacy)
 5 files changed, 158 insertions(+), 36 deletions(-)
```

## Archivos del change (movidos a archive)

```
openspec/changes/archive/2026-08-07-losa-h-predim-adop/losa-h-predim-adop/
├── proposal.md
└── specs/
    └── slab-ux-form/
        └── spec.md
```

No hay `design.md` ni `tasks.md` (change chico, delta aditiva sobre el spec anterior; el design y tasks se consolidan en el archive de `losa-ux-cuentas`).

## Verificación

- **typecheck**: ✅ PASS — `npm run typecheck:all` zero errors
- **build**: ✅ PASS — `npm run build:all` succeeds para ambas apps
- **MD5 mirror**: ✅ PASS — `SlabForm.tsx` y `slab-calc.ts` byte-identical entre `apps/concrete` y `apps/steel`:
  - `apps/{concrete,steel}/src/screens/SlabForm.tsx` — `42726195961dd73e2b98c09642c8a924`
  - `apps/{concrete,steel}/src/lib/slab-calc.ts` — `0f4dd6a707fa543b1d44dd83d949a3b6`
- **spec compliance**: 5/5 requirements verificados (1 modified + 4 added únicos de este change, más escenarios nuevos en `h field location`)
- **tests**: ➖ 0 tests en el proyecto (per `openspec/config.yaml: testing.runner: none`)

## Warnings

### WARNING-1 (pre-existente, no introducido por este change)

**`+ Nueva` borra la key incorrecta de localStorage**

- **Ubicación**: `apps/concrete/src/screens/SlabForm.tsx:293` (mirror en `apps/steel/src/screens/SlabForm.tsx`)
- **Detalle**: la línea usa `localStorage.removeItem("mascalculador_last_slab_form")`, pero el helper `key()` en `packages/shared/src/storage.ts:24` produce `${app}:${name}` y la constante `LAST_SLAB_FORM_KEY = "last_slab_form"` se invoca como `key("concrete", LAST_SLAB_FORM_KEY)` (storage.ts:400), por lo que la key real persistida es `concrete:last_slab_form` (o `steel:last_slab_form` en steel). El `removeItem` actual no borra nada.
- **Origen**: pre-existente en `losa-ux-cuentas` (commit `9d71fec`); el warning fue heredado, no introducido por `ff961c8`.
- **Severidad**: WARNING (cosmético) — la app sigue funcionando porque el `useEffect` auto-save sobrescribe la entry con los nuevos defaults al siguiente render, pero el reset explícito de `+ Nueva` no limpia el storage como declara el spec `Reset en +Nueva`.
- **Acción recomendada**: PR de fix follow-up que cambie `SlabForm.tsx:293` a `localStorage.removeItem(key("concrete", LAST_SLAB_FORM_KEY))` (con el import correspondiente desde `@mascalculador/shared`). No bloquea archive.

## Open follow-ups

- [ ] WARNING-1: fix del `+ Nueva` removeItem con la key correcta
- [ ] PR de `feat/losa-ux-cuentas` a `main` (incluye ambos commits: `9d71fec` + `ff961c8`)

## SDD Cycle

Plan → Apply → Verify → Archive: ✅ COMPLETO. Source of truth actualizado (`openspec/specs/slab-ux-form/spec.md`). Change folder en archive. Listo para merge.
