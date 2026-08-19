# Delta for Slab Form UX — hAdop / hPredim split

## Purpose

Extend `slab-ux-form` (archived under `2026-08-07-losa-ux-cuentas`, currently at `openspec/specs/slab-ux-form/spec.md`) so the user sees the auto-predimensioned `h` live while typing, and keeps their adopted `h` as a separate, persistent input. The engine still receives a single effective `h` in mm; the form does the substitution.

## Mirror to steel

Applies to both `apps/concrete` and `apps/steel`. `SlabForm.tsx` and `slab-calc.ts` are byte-identical today (verified by MD5) and MUST remain so. `SlabLastFormState` lives in `packages/shared/src/storage.ts`, consumed by both apps.

## MODIFIED Requirements

### Requirement: h field location

(Previously: `h` is the 5th input in "Condiciones de borde" with label `h (cm) — 0 = predimensionar` and no live preview.)

The system MUST render TWO fields in "Condiciones de borde" adjacent to the four edge selects:

1. A read-only display labeled `h predim (cm)` whose value derives from `predimCoef(lx, ly, edges)` (see ADDED `hPredim derivado`).
2. A numeric input labeled `h adop (cm) — 0 = usar predim`, positioned after the four edge selects, accepting cm with `0` meaning "fall back to predim".

`h adop` MUST NOT appear in "Dimensiones". `h predim` MUST NOT be a user-editable input.

#### Scenario: h adop + h predim in Condiciones de borde

- GIVEN the user opens `/slab`
- WHEN `SlabForm` renders
- THEN the "Condiciones de borde" section contains the four edge selects plus `h adop` (input) and `h predim` (read-only)
- AND "Dimensiones" contains exactly `lx`, `ly`, `cover`

#### Scenario: Predim available when h adop is 0

- GIVEN the user enters `h adop = 0` (cm)
- WHEN they submit and reach results
- THEN `result.h` equals the predimensioned value (matches prior `h = 0`)

## ADDED Requirements

### Requirement: hPredim derivado

`SlabForm` MUST compute `hPredim` (cm) in a `useMemo` over `lx`, `ly`, and the four `edge*` states using the same algorithm as the engine: derive `isCrossed` and `fixedEdges`, look up `predimCoef(fixedEdges, isCrossed)`, compute `dMin = (lightOrL / coefPredim) * 1000`, then `hPredimCm = ceil(Math.max(dMin + cover, 90) / 10 / 0.5) * 0.5`. The display MUST update in the same render after any change.

#### Scenario: h predim recalculates on edge change

- GIVEN `lx = 4, ly = 5`, all edges `simple` (coef = 50)
- WHEN the user changes `edgeX0` to `continuo` (coef = 55)
- THEN `h predim (cm)` decreases (smaller `dMin`)

### Requirement: hAdop input

`SlabForm` MUST render a numeric input for `hAdop` (cm), defaulting to `0` on first load and on `+ Nueva`. State persisted as `SlabLastFormState.hAdop`.

#### Scenario: Default and decimal input

- GIVEN the user opens `/slab` for the first time
- WHEN `SlabForm` renders
- THEN `h adop (cm)` shows `0` and accepts decimal cm

### Requirement: h efectivo para cálculo

At submit / save time the system MUST compute `hEfectivoMm = (hAdop > 0 ? hAdop : hPredim) * 10` and pass it as the engine's `h`.

#### Scenario: h adop > 0 overrides h predim

- GIVEN `h adop = 15` and `h predim = 9`
- WHEN the user submits
- THEN navigation state `h = 150` (mm)

#### Scenario: h adop = 0 falls back to h predim

- GIVEN `h adop = 0` and `h predim = 9.5`
- WHEN the user submits
- THEN navigation state `h = 95` (mm)

### Requirement: Persistencia hAdop

`SlabLastFormState` MUST include `hAdop: number` (cm). On load, if `hAdop === undefined` and legacy `h` is present, `loadLastSlabFormState` MUST return `hAdop = h / 10` (legacy `h` is mm). If both are missing, default to `0`. Auto-save MUST write `hAdop` and MUST NOT write a legacy `h` key.

#### Scenario: Round-trip new save

- GIVEN the user enters `h adop = 17.5` and reloads
- WHEN `SlabForm` re-renders from `lastForm`
- THEN `h adop` shows `17.5` (cm)

#### Scenario: Legacy save migrates

- GIVEN a `lastForm` JSON with `h: 150` (mm) and no `hAdop` key
- WHEN `loadLastSlabFormState()` is called
- THEN the consumer sees `hAdop = 15` (cm)

### Requirement: Reset en +Nueva

The `+ Nueva` button MUST reset `hAdop` to `0` and remove the `mascalculador_last_slab_form` localStorage entry.

#### Scenario: + Nueva resets and clears storage

- GIVEN the user has set `h adop = 22`
- WHEN they click `+ Nueva`
- THEN the input shows `0` AND the localStorage entry is removed

## Unchanged (carried over from the archived losa-ux-cuentas spec)

`Self-weight toggle`, `D sublabel conditional on toggle`, `D_total semantics`, `Flag persisted in SlabLastFormState` are NOT modified and continue to apply. Together with `Persistencia hAdop` they define the full `SlabLastFormState` shape (`includeSelfWeight`, `hAdop`, plus legacy fields).
