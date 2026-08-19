# Slab Form UX Specification

## Mirror to steel

This change applies to **both** `apps/concrete` and `apps/steel`. The files in `apps/steel/src/screens/SlabForm.tsx`, `apps/steel/src/lib/slab-calc.ts`, and `apps/steel/src/lib/storage.ts` are byte-identical mirrors of their `apps/concrete` counterparts (verified by MD5). The steel app also exposes a `/slab` route serving these copies, so the form reorganization and toggle MUST be applied to both apps in the same commit. The shared types in `packages/shared/src/slab-types.ts` and `packages/shared/src/storage.ts` are the canonical source and are consumed by both apps via `@mascalculador/shared`.

## Purpose

Reorganize the `SlabForm` so `h` sits inside "Condiciones de borde" alongside its semantic peers (the edge conditions that govern whether `h` is auto-predimensioned), and introduce an explicit "Incluir peso propio" toggle so the meaning of the `D` input is unambiguous.

## Requirements

### Requirement: h field location

The system MUST render the `h` field inside the "Condiciones de borde" section, positioned as the 5th input after the four edge-condition selects, with the label `h (cm) — 0 = predimensionar`. The `h` field MUST NOT appear in the "Dimensiones" section.

#### Scenario: h appears in Condiciones de borde

- GIVEN the user opens `/slab`
- WHEN `SlabForm` renders
- THEN the "Condiciones de borde" section contains exactly 5 inputs in this order: `edgeX0`, `edgeXL`, `edgeY0`, `edgeYL`, `h`

#### Scenario: h absent from Dimensiones

- GIVEN the user opens `/slab`
- WHEN `SlabForm` renders
- THEN the "Dimensiones" section contains exactly 3 inputs: `lx`, `ly`, `cover` (no `h`)

#### Scenario: Predimension auto-fill remains available

- GIVEN the user enters `h = 0` (cm) in the form
- WHEN they submit and reach results
- THEN `result.h` equals the auto-predimensioned value (not 0)

### Requirement: Self-weight toggle

The system MUST render a checkbox labeled `Incluir peso propio` inside the "Cargas y materiales" section. The checkbox default value MUST be `true` (checked) on first load (no `lastForm`) and on explicit `+ Nueva` reset. The state MUST be persisted as part of `SlabLastFormState`.

#### Scenario: Toggle default state on first load

- GIVEN the user opens `/slab` for the first time (no `lastForm`)
- WHEN `SlabForm` renders
- THEN the "Incluir peso propio" checkbox is checked

#### Scenario: Toggle round-trips through lastForm

- GIVEN the user unchecks "Incluir peso propio" and reloads the page
- WHEN `SlabForm` re-renders from `lastForm`
- THEN the checkbox is unchecked

#### Scenario: + Nueva resets to default ON

- GIVEN the user has unchecked "Incluir peso propio"
- WHEN they click "+ Nueva"
- THEN the checkbox is checked again

### Requirement: D sublabel conditional on toggle

The sublabel rendered immediately under the `D` field MUST be:
- `adicional, peso propio calculado` when "Incluir peso propio" is checked
- `peso propio ya incluido en D` when "Incluir peso propio" is unchecked

#### Scenario: D sublabel ON

- GIVEN "Incluir peso propio" is checked
- WHEN `SlabForm` renders
- THEN the `D` sublabel reads "adicional, peso propio calculado"

#### Scenario: D sublabel OFF

- GIVEN "Incluir peso propio" is unchecked
- WHEN `SlabForm` renders
- THEN the `D` sublabel reads "peso propio ya incluido en D"

### Requirement: D_total semantics

`SlabInput` MUST gain `includeSelfWeight: boolean`. The system MUST compute `D_total` in `designSlab()` as:
- `D + gSelf` when `includeSelfWeight === true`
- `D` when `includeSelfWeight === false`

where `gSelf = (h / 1000) * CONCRETE_DENSITY` and `CONCRETE_DENSITY = 25 kN/m³`. The ultimate load MUST then be `qu = max(1.4·D_total, 1.2·D_total + 1.6·L)`. The `coef` recorded in `DirectionResult` MUST be `1.4` when `1.4·D_total >= 1.2·D_total + 1.6·L` (CM dominant) and `1.2` otherwise (CM+CV mix).

#### Scenario: ON sums self-weight

- GIVEN `h = 200 mm, D = 1.5 kN/m², L = 2.0 kN/m², includeSelfWeight = true`
- WHEN `designSlab()` runs
- THEN `D_total = 1.5 + 0.2·25 = 6.5 kN/m²`
- AND `qu = max(1.4·6.5, 1.2·6.5 + 1.6·2.0) = max(9.1, 11.0) = 11.0 kN/m²`
- AND `coef = 1.2` (CM+CV mix governs)

#### Scenario: OFF uses D as total

- GIVEN `h = 200 mm, D = 6.5 kN/m², L = 2.0 kN/m², includeSelfWeight = false`
- WHEN `designSlab()` runs
- THEN `D_total = 6.5 kN/m²`
- AND `qu = max(1.4·6.5, 1.2·6.5 + 1.6·2.0) = max(9.1, 11.0) = 11.0 kN/m²`
- AND the steps log states `D_total = D (peso propio ya incluido en D)`

#### Scenario: ON with CM-dominant case yields coef 1.4

- GIVEN `h = 100 mm, D = 8.0 kN/m², L = 1.0 kN/m², includeSelfWeight = true`
- WHEN `designSlab()` runs
- THEN `D_total = 8.0 + 0.1·25 = 10.5 kN/m²`
- AND `qu = max(1.4·10.5, 1.2·10.5 + 1.6·1.0) = max(14.7, 14.2) = 14.7 kN/m²`
- AND `coef = 1.4` (CM dominant)

#### Scenario: ON with h=0 computes gSelf AFTER predimensioning

- GIVEN `h = 0` (user opts in to auto-predimension), `D = 1.5 kN/m², L = 2.0 kN/m², includeSelfWeight = true`
- WHEN `designSlab()` runs
- THEN `h` is first auto-predimensioned to some positive value (e.g. `90 mm` when `dMin + cover` is below the regulatory minimum)
- AND `gSelf = (h_adopted / 1000) · 25` is computed AFTER `h_adopted` is set (NOT before)
- AND `D_total = D + gSelf` uses the adopted `h`, not the user-input 0
- AND the steps log shows the adopted `h` BEFORE the line `Peso propio = h · 25`

### Requirement: Flag persisted in SlabLastFormState

`SlabLastFormState` MUST include `includeSelfWeight: boolean` (default `true` when missing in stored JSON for backward compat). The auto-save `useEffect` in `SlabForm` MUST include `includeSelfWeight` in the persisted object.

#### Scenario: Auto-save persists flag

- GIVEN the user toggles "Incluir peso propio" off
- WHEN the form re-renders
- THEN the `mascalculador_last_slab_form` localStorage entry includes `includeSelfWeight: false`

#### Scenario: Backward-compat default ON

- GIVEN a `lastForm` JSON without the `includeSelfWeight` key (legacy save)
- WHEN `loadLastSlabFormState()` is called
- THEN the consumer treats the flag as `true` (default ON)
