# Tasks: Steel Beam Dead/Live Load Split

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Types & Data Model

- [x] **1.1** Extend `Load` (`client/src/types.d.ts`): add required `deadLoad`, `liveLoad`; make `magnitude?` optional. Add `BeamResultsDual` (`d`, `l`, `shearForceU`, `bendingMomentU`, `maxMomentU`, `maxShearU`, `criticalPointsU`). ✓ tsc clean. Cx: trivial.

## Phase 2: Calculation Engine

- [x] **2.1** Add `calculateBeamDual(config, loads)` in `client/src/lib/beam-calculations.ts`: build D-only and L-only `Load[]` copies, call `calculateBeam()` twice, return `BeamResultsDual`. ✓ tsc clean; `calculateBeam` untouched. Dep: 1.1. Cx: small.
- [x] **2.2** LRFD combine: `V_U = 1.2·V_D + 1.6·V_L`, `M_U = 1.2·M_D + 1.6·M_L`; derive `maxShearU`, `maxMomentU`, `criticalPointsU`. ✓ 4 m @ D=100, L=200 → `M_U_max=880`. Dep: 2.1. Cx: small.

## Phase 3: Form Input

- [x] **3.1** Replace magnitude input with side-by-side D and L numeric inputs per load; new loads init with `deadLoad: 0, liveLoad: 0`. ✓ two inputs per row. Dep: 1.1. Cx: small.
- [x] **3.2** `updateLoad()` patches target D/L. Validation: `loads.every(l => l.deadLoad > 0 || l.liveLoad > 0)`. ✓ all-zero row disables submit. Dep: 3.1. Cx: trivial.
- [x] **3.3** `handleSave()` writes `magnitude = deadLoad + liveLoad` for legacy readers. ✓ saved records include `magnitude`. Dep: 3.2. Cx: trivial.

## Phase 4: Results Output

- [x] **4.1** Switch to `calculateBeamDual`; destructure `d`, `l`, `shearForceU`, `bendingMomentU`, `maxMomentU`, `maxShearU`, `criticalPointsU`. ✓ tsc clean. Dep: 2.2. Cx: trivial.
- [x] **4.2** Rewrite reaction cards — per support show `Ra_D`/`Ra_L` (or `Rb_D`/`Rb_L`) from `d.reactions`/`l.reactions`. ✓ D and L visible per support. Dep: 4.1. Cx: small.
- [x] **4.3** Switch shear/moment diagrams to `shearForceU`/`bendingMomentU`/`criticalPointsU`/`maxMomentU`. ✓ only ultimate functions plotted. Dep: 4.1. Cx: small.
- [x] **4.4** Design check: `Mu = maxMomentU`, `Vu = maxShearU`, `serviceM = (d.maxMoment.value + l.maxMoment.value) * 1e6`. Truss uses `maxMomentU`/`maxShearU`. ✓ deflection uses unfactored D+L. Dep: 4.1. Cx: small.
- [x] **4.5** Load diagram renders `deadLoad + liveLoad` per load. ✓ load diagram shows combined magnitude. Dep: 4.1. Cx: trivial.

## Phase 5: Legacy Migration

- [x] **5.1** Add `migrateLoads(rawLoads)`: patch legacy `{magnitude}` to `{deadLoad: magnitude, liveLoad: 0, magnitude}`; return `{ loads, migrated }`. ✓ legacy → `migrated=true`. Dep: 1.1. Cx: small.
- [x] **5.2** Wire into `SavedBeams.onLoad`; inline banner on `migrated === true` ("Cargas migradas: magnitudes previas asignadas a D; ajustá L si corresponde."). ✓ banner appears, loads editable. Dep: 5.1. Cx: small.

## Phase 6: Hand-Verification & Polish

- [x] **6.1** `npx tsc --noEmit` from `client/`; expect zero errors. ✓ tsc clean. Dep: 5.2. Cx: trivial.
- [x] **6.2** Fixture A (kg): span 4 m, D=100, L=200 → `Ra_D=Rb_D=200`, `Ra_L=Rb_L=400`, `M_U_max=880`. ✓ matches hand calc. Dep: 6.1. Cx: small.
- [x] **6.3** Fixture B (kN): span 6 m, D=5, L=3 → `w_U=10.8`, `M_U_max=48.6 kN·m`. ✓ matches hand calc. Dep: 6.1. Cx: small.
- [x] **6.4** Migration smoke: legacy save → banner + editable D/L. ✓ no console errors. Dep: 6.1. Cx: small.
- [x] **6.5** `npx prettier --write` + `npx eslint .` on changed files. ✓ clean. Dep: 6.1. Cx: trivial.
