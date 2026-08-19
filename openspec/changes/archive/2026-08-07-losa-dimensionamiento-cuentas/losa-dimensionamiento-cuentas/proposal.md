# Proposal: losa-dimensionamiento-cuentas

## Why
El usuario pidió ver la cuenta de dónde surge Ka (coeficiente adimensional de la resistencia de la sección a flexión) en "Ver cuentas completas" del SlabResults, no solo el valor final. Esto permite auditar el cálculo manualmente.

## What Changes
- Agregar helper `pushKaSteps(r: DirectionResult)` dentro de `designSlab` que empuja 3 líneas al array `st`:
  - `M_n = M_u / φ = X.XXX / 0.9 = Y.YYY kN·m/m`
  - `m_n = M_n·10⁶ / (0.85·f'c·b·d²) = ...` (adimensional)
  - `K_a = 1 - √(1 - 2·m_n) = W.WWWW`
- Invocar el helper en 6 call sites de `designSlab`:
  - dirX, dirY (direcciones principales)
  - supportX0, supportXL, supportY0, supportYL (apoyos continuos)
- Mirror byte-idéntico a `apps/steel/src/lib/slab-calc.ts`
- Commit en `feat/losa-ux-cuentas` (este commit se mergea junto con los cambios anteriores del mismo branch)

## Impact
- Solo se modifica el array `st` (texto del output). No cambian firmas, no cambian tipos, no cambia la lógica de cálculo.
- `designSupportMoment` permanece pura (sin side-effects al `st`).
- Output visible: 18 líneas adicionales en "Ver cuentas completas" (3 × 6 call sites).

## Risks
- Si los `DirectionResult` de apoyos continuos no tienen `d` propio, el helper hace fallback a un `d` global. Confirmado: los 4 supports setean `d` antes de invocar el helper, así que el fallback no se activa en la práctica.
- El commit queda en la branch `feat/losa-ux-cuentas` que ya está mergeada a main? NO — está commiteado en `feat/losa-ux-cuentas` (NO mergeada a main). El usuario decide merge strategy.

## Spec
Cubierto por `openspec/changes/losa-dimensionamiento-cuentas/specs/slab-dimensionamiento-cuentas/spec.md` (ya existía, sincronizado de la versión base en `openspec/specs/`).
