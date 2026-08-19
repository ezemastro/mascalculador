# Tasks: Losa UX, Cuentas y Adaptador a Viga

## Overview

This change closes six independent fronts in the Losa screen: form UX (h relocated + self-weight toggle), an honesty fix in the engine log, RD/RL reaction population with UI surfacing, an adapter rewrite to the orphan spec's contract, and `DirectionResult` audit-trail fields with a "Ver cuentas" details block. Every code change MUST be applied to both `apps/concrete` and `apps/steel` in the same commit (MD5-verified mirrors) because `apps/steel` ships byte-identical copies of the 4 affected files. Shared canonical types live in `packages/shared/src/slab-types.ts` and `packages/shared/src/storage.ts`.

The implementation order is type-first, engine-second, UI-last: Tasks 1-2 establish the type extensions, Task 4-5 wire the engine semantics, Tasks 6+8-9 populate the result fields, and Tasks 3+7+10 render the UI. Task 11 is the verification gate. Verification is `npm run lint:all && npm run typecheck:all && npm run build:all` (no test runner) plus MD5 mirror integrity.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~470 (includes mirror duplication ×2) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (size:exception approved, 800-line budget) |
| Delivery strategy | single-pr with size:exception |
| Chain strategy | size-exception |
| Decision needed before apply | No |
| Mirror required | Yes — 4 file pairs (slab-calc.ts, slab-to-beam.ts, SlabForm.tsx, SlabResults.tsx) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

Per design.md § "Work-unit commits", the change is structured as 5 reviewable commit units within a single PR (1: form+toggle+shared types, 2: log delete, 3: RD/RL+Ver D/L, 4: adapter rewrite, 5: coef/d+Ver cuentas). Each commit is independently compilable. No PR split required given the 800-line exception.

## Task List

### Task 1: Extend `DirectionResult` with `coef` and `d`
**Scope**: Add two new numeric fields to `DirectionResult` in canonical shared types and in the duplicated definitions inside each app's `slab-calc.ts`.
**Files**:
- `packages/shared/src/slab-types.ts` — add `coef: number; d: number;` to `DirectionResult` (2 lines)
- `apps/concrete/src/lib/slab-calc.ts` — mirror the same 2-line addition
- `apps/steel/src/lib/slab-calc.ts` — mirror (MD5 must match concrete after Task 1)

**Mirror**: yes (slab-calc.ts × 2; shared is canonical, no mirror)

**Acceptance criteria**:
- [x] `DirectionResult` interface in `packages/shared/src/slab-types.ts` declares `coef: number` and `d: number` (no `k1` field)
- [x] Same interface in `apps/concrete/src/lib/slab-calc.ts` matches
- [x] Same interface in `apps/steel/src/lib/slab-calc.ts` matches concrete MD5
- [x] `npm run typecheck:all` passes without errors

**Depends on**: none
**Estimated lines**: ~6 (2 × 3 files)
**Spec ref**: `slab-dimensionamiento-cuentas` § "DirectionResult gains coef and d"

### Task 2: Add `includeSelfWeight` to `SlabInput` and `SlabLastFormState`
**Scope**: Extend the input type and the persisted form-draft type with the new toggle flag. Backward-compat: missing key ⇒ `true`.
**Files**:
- `packages/shared/src/slab-types.ts` — add `includeSelfWeight: boolean;` to `SlabInput` (1 line)
- `apps/concrete/src/lib/slab-calc.ts` — mirror (1 line)
- `apps/steel/src/lib/slab-calc.ts` — mirror (1 line)
- `packages/shared/src/storage.ts` — add `includeSelfWeight?: boolean;` to `SlabLastFormState` (1 line)

**Mirror**: yes (slab-calc.ts × 2; shared is canonical)

**Acceptance criteria**:
- [x] `SlabInput` has `includeSelfWeight: boolean` in shared + both app mirrors
- [x] `SlabLastFormState` has optional `includeSelfWeight?: boolean`
- [x] Consumer code in `SlabForm` reads with default `true` when key missing (`?? true`)
- [x] `npm run typecheck:all` passes

**Depends on**: none
**Estimated lines**: ~4
**Spec ref**: `slab-ux-form` § "D_total semantics" + § "Flag persisted in SlabLastFormState"

### Task 3: Reorder `h` in `SlabForm` and add "Incluir peso propio" toggle
**Scope**: Move `h` from "Dimensiones" to "Condiciones de borde" (5th cell) with new label. Add a new controlled checkbox at the first position of "Cargas y materiales" with default ON. Wire sublabel of D to render conditionally from a `useMemo`/inline expression. Persist `includeSelfWeight` in `lastForm`.
**Files**:
- `apps/concrete/src/screens/SlabForm.tsx` — reorder + checkbox + sublabel + state + useEffect persistence (~35 lines)
- `apps/steel/src/screens/SlabForm.tsx` — byte-identical mirror (~35 lines)

**Mirror**: yes (SlabForm.tsx × 2)

**Acceptance criteria**:
- [x] "Condiciones de borde" section contains exactly 5 inputs in order: `edgeX0`, `edgeXL`, `edgeY0`, `edgeYL`, `h`
- [x] `h` field label reads `h (cm) — 0 = predimensionar`
- [x] "Dimensiones" section contains only `lx`, `ly`, `cover`
- [x] Checkbox "Incluir peso propio" is at first position of "Cargas y materiales", default checked on first load and on `+ Nueva` reset
- [x] D sublabel renders `adicional, peso propio calculado` when ON; `peso propio ya incluido en D` when OFF
- [x] `useEffect` for `saveLastSlabFormState` includes `includeSelfWeight` in the persisted object
- [x] MD5 of both `SlabForm.tsx` files remains identical after edit
- [x] `npm run typecheck:all` passes

**Depends on**: Task 2
**Estimated lines**: ~70 (35 × 2 mirrors)
**Spec ref**: `slab-ux-form` § "h field location" + § "Self-weight toggle" + § "D sublabel conditional on toggle"

### Task 4: Implement `includeSelfWeight` semantics in `designSlab`
**Scope**: Compute `D_total` from `includeSelfWeight` flag in `designSlab()`. Preserve the existing order: `h` is set from `hInput` or auto-predim BEFORE `gSelf` is computed (so `h=0` + ON computes `gSelf` after predim).
**Files**:
- `apps/concrete/src/lib/slab-calc.ts` — guard clause, D_total block, conditional step log (~10 lines)
- `apps/steel/src/lib/slab-calc.ts` — mirror (~10 lines)

**Mirror**: yes (slab-calc.ts × 2)

**Acceptance criteria**:
- [x] `const includeSelfWeight = input.includeSelfWeight ?? true;` line added near line 2180
- [x] `const gSelf = (h / 1000) * CONCRETE_DENSITY;` already present and used
- [x] `const DTotal = includeSelfWeight ? D + gSelf : D;` replaces the prior `D + gSelf` expression
- [x] Step log line reads `D total = D + gSelf (peso propio calculado)` when ON; `D total = D (peso propio ya incluido en D)` when OFF
- [x] `qu = max(1.4·D_total, 1.2·D_total + 1.6·L)` unchanged
- [x] `npm run typecheck:all` passes

**Depends on**: Task 2
**Estimated lines**: ~20 (10 × 2)
**Spec ref**: `slab-ux-form` § "D_total semantics" (4 scenarios)

### Task 5: Delete misleading compatibilization log line
**Scope**: Remove the single misleading `st.push(...)` line in `designSlab` that claims "se asume empotramiento perfecto". Header and per-edge continuity-validation lines stay.
**Files**:
- `apps/concrete/src/lib/slab-calc.ts` — delete 3 lines (the `st.push(` … `);` block) around line 2522
- `apps/steel/src/lib/slab-calc.ts` — mirror delete

**Mirror**: yes (slab-calc.ts × 2)

**Acceptance criteria**:
- [x] No line in `designSlab` body contains the string `se asume empotramiento perfecto`
- [x] `Compatibilización de apoyos:` header remains
- [x] Per-edge `continuidad validada` / `⚠️ no cumple continuidad — revisar` lines remain
- [x] `result.steps` for a slab with all-simple edges does NOT include the removed string
- [x] `result.steps` for a slab with continuous edges does NOT include the removed string
- [x] `npm run typecheck:all` passes

**Depends on**: none
**Estimated lines**: -6 net (3 deletions × 2 files)
**Spec ref**: `slab-analysis` § "Support Compatibilización" + REMOVED § "Compatibilización siempre ejecuta empotramiento perfecto"

### Task 6: Populate 8 `RD_*/RL_*` fields in `designSlab`
**Scope**: For each branch (unidirectional, crossed X dominant, crossed Y dominant), compute per-edge unfactored D and L reactions using the same Kalmanok coefficient the factored reaction used. Back out via `R / qu · D_total` (or `· L`). Round to 2 decimals.
**Files**:
- `apps/concrete/src/lib/slab-calc.ts` — populate `RD_izq, RL_izq, RD_der, RL_der, RD_arr, RL_arr, RD_aba, RL_aba` in the returned `SlabResult` literal (~40 lines)
- `apps/steel/src/lib/slab-calc.ts` — mirror (~40 lines)

**Mirror**: yes (slab-calc.ts × 2)

**Acceptance criteria**:
- [x] All 8 fields populated for any analyzed slab (regardless of edge conditions)
- [x] Formula: `RD_edge = (R_edge / qu) · D_total`, `RL_edge = (R_edge / qu) · L`
- [x] For unidirectional: `R_edge = coef · qu · lShort` ⇒ `RD_edge = coef · D_total · lShort`
- [x] For crossed: reuses the same `cf`/interpolation table the factored reaction block created
- [x] Values in kN/m, rounded to 2 decimals (`.toFixed(2)` not applied in engine; UI does formatting)
- [x] `npm run typecheck:all` passes

**Depends on**: Task 4 (D_total must be correct)
**Estimated lines**: ~80 (40 × 2)
**Spec ref**: `slab-dl-reactions` § ADDED § "D/L UI rendering" + `slab-ux-form` § "D_total semantics"

### Task 7: Render `<details> "Ver D/L">` in `SlabResults`
**Scope**: Below each of the 4 reaction cards, add a collapsible details block showing D and L values. Gate rendering on `hasSlabDL(result)` — all 4 details hidden together when legacy slab has undefined `RD_izq`/`RL_izq`.
**Files**:
- `apps/concrete/src/screens/SlabResults.tsx` — 4× `<details>` blocks + import of `hasSlabDL` if not already imported (~30 lines)
- `apps/steel/src/screens/SlabResults.tsx` — mirror (~30 lines)

**Mirror**: yes (SlabResults.tsx × 2)

**Acceptance criteria**:
- [x] Below each of the 4 reaction cards (Izquierdo/Derecho/Arriba/Abajo), a `<details>` element with `<summary>Ver D/L</summary>` renders when `hasSlabDL(result)` is true
- [x] Each expanded details shows two lines: `D: <RD> kN/m` and `L: <RL> kN/m`, formatted with `.toFixed(2)`
- [x] When `hasSlabDL(result)` is false (legacy slab), no `<details> "Ver D/L">` element renders for any of the 4 cards
- [x] Existing `R*Izq/Der/Arr/Aba` cards keep their current rendering (or `—` if legacy)
- [x] MD5 of both `SlabResults.tsx` files remains identical
- [x] `npm run typecheck:all` passes

**Depends on**: Task 6
**Estimated lines**: ~60 (30 × 2)
**Spec ref**: `slab-dl-reactions` § ADDED § "D/L UI rendering" (3 scenarios)

### Task 8: Refactor `slabReactionToBeamLoad` to the spec contract
**Scope**: Rewrite the function with string-edge signature, `Load` return type, `id` from `crypto.randomUUID()`, `Math.max(0, …)` clamp, NaN/Infinity rejection, and all-zero return-`null` guard. Remove legacy `EdgeIndex` numeric-edge signature.
**Files**:
- `apps/concrete/src/lib/slab-to-beam.ts` — rewrite (~25 lines net; keep `hasSlabDL` helper, remove legacy overload)
- `apps/steel/src/lib/slab-to-beam.ts` — mirror (~25 lines)

**Mirror**: yes (slab-to-beam.ts × 2)

**Acceptance criteria**:
- [x] Exported function signature: `slabReactionToBeamLoad(result: SlabResult, edge: "izq" | "der" | "arr" | "aba", start: number, end: number): Load | null`
- [x] Legacy `edge: 0 | 1 | 2 | 3` signature fully removed (TS error if any caller passes number)
- [x] Returned `Load` has `id: string` (length > 0, matches `crypto.randomUUID()` 8-4-4-4-12 format), `type: "distributed"`, `deadLoad: number`, `liveLoad: number`, `start: number`, `end: number`
- [x] `deadLoad = Math.max(0, Number(result[d]) || 0)` and analogously for `liveLoad`
- [x] If both clamp to 0 ⇒ returns `null`
- [x] If `!Number.isFinite(deadLoad || liveLoad)` ⇒ returns `null`
- [x] `Load` import path: `@mascalculador/shared/types` (already used)
- [x] `hasSlabDL` helper unchanged
- [x] No UI/component imports `slabReactionToBeamLoad` anywhere in `apps/concrete/src` or `apps/steel/src`
- [x] `npm run typecheck:all` passes

**Depends on**: Task 6 (testing/verifying needs RD/RL populated)
**Estimated lines**: ~50 (25 × 2)
**Spec ref**: `slab-to-beam-adapter` § ADDED (5 requirements, 12 scenarios)

### Task 9: Set `coef` and `d` on every `DirectionResult` returned by `designSlab`
**Scope**: After `dirX = designDir(Mx, …)` and `dirY = designDir(My, …)`, populate `coef` (1.4 or 1.2) and `d` (per-direction effective depth) on both. Also populate on the 4 `supportX0/XL/Y0/YL` results if present.
**Files**:
- `apps/concrete/src/lib/slab-calc.ts` — populate after line 2546-ish (~10 lines)
- `apps/steel/src/lib/slab-calc.ts` — mirror (~10 lines)

**Mirror**: yes (slab-calc.ts × 2)

**Acceptance criteria**:
- [x] `result.x.coef` and `result.y.coef` populated: `1.4` if `1.4·D_total >= 1.2·D_total + 1.6·L`; `1.2` otherwise
- [x] `result.x.d` and `result.y.d` populated: for unidirectional both equal `h - cover`; for crossed secondary direction (`Mx < My`) `x.d = h - cover - 10` and `y.d = h - cover`
- [x] `supportX0`, `supportXL`, `supportY0`, `supportYL` (if defined) also receive `coef` and `d`
- [x] No `k1` field assigned anywhere
- [x] `npm run typecheck:all` passes

**Depends on**: Task 1 (interface must declare fields) + Task 4 (coef depends on D_total)
**Estimated lines**: ~20 (10 × 2)
**Spec ref**: `slab-dimensionamiento-cuentas` § "DirectionResult gains coef and d" (5 scenarios)

### Task 10: Render `<details> "Ver cuentas">` in each `DirSection`
**Scope**: Inside each of the 2 `DirSection` cards (X and Y) in `SlabResults`, add a `<details>` block after the existing `Mu` / `As_req` / `mín` / `s_máx` lines and bar selector. Render the 10 lines per spec; for unidirectional, include line 10 (`As_dist ≥ 0.20·As_principal`). Never show a `k1 = …` line.
**Files**:
- `apps/concrete/src/screens/SlabResults.tsx` — 2× `<details>` with 10 lines each (~70 lines)
- `apps/steel/src/screens/SlabResults.tsx` — mirror (~70 lines)

**Mirror**: yes (SlabResults.tsx × 2)

**Acceptance criteria**:
- [x] Each `DirSection` (X and Y) renders a `<details>` with `<summary>Ver cuentas</summary>` after the existing `Repartición` block and bar selector
- [x] Expanded body shows exactly these 10 lines in order (when slab is unidirectional):
  1. `Mu = {Mu} kN·m/m` (2 decimals)
  2. `coef = {coef} (1.4 si CM dominante, 1.2 si CM+CV mixto)`
  3. `d = {d} mm` (integer)
  4. `Ka = Mu / (φ·b·d²·0.85·f'c) = {Ka}` (4–6 decimals or as the engine returns)
  5. `caseLabel = {caseLabel}` (verbatim)
  6. `As_req = {AsReq} mm²/m` (integer)
  7. `As_min = {AsMin} mm²/m` (integer)
  8. `As_temp = {AsTemp} mm²/m (si aplica)` (integer)
  9. `s_max = {sMax} mm` (integer)
  10. `As_dist ≥ 0.20·As_principal → {As_dist} mm²/m (s ≤ {s_max_dist} mm)` (integer)
- [x] When slab is crossed, line 10 is omitted (rendered conditionally)
- [x] No line in the details body contains the substring `k1 =` or `k₁ =`
- [x] MD5 of both `SlabResults.tsx` files remains identical
- [x] `npm run typecheck:all` passes

**Depends on**: Task 9 (needs `coef` and `d` populated on the result)
**Estimated lines**: ~140 (70 × 2)
**Spec ref**: `slab-dimensionamiento-cuentas` § "Ver cuentas details in DirSection" (4 scenarios) + § "As_dist formula for unidirectional"

### Task 11: Final verification and mirror-integrity check
**Scope**: Run the full CI-equivalent command chain and confirm MD5 of mirrored files is preserved. No code change.
**Files**: none (verification only)

**Mirror**: n/a

**Acceptance criteria**:
- [x] `npm run lint:all` passes with zero errors
- [x] `npm run typecheck:all` passes with zero errors
- [x] `npm run build:all` passes for both apps
- [x] `md5sum apps/{concrete,steel}/src/lib/slab-calc.ts` returns identical hashes
- [x] `md5sum apps/{concrete,steel}/src/lib/slab-to-beam.ts` returns identical hashes
- [x] `md5sum apps/{concrete,steel}/src/screens/SlabForm.tsx` returns identical hashes
- [x] `md5sum apps/{concrete,steel}/src/screens/SlabResults.tsx` returns identical hashes
- [x] Manual smoke per design.md § "Verification plan" (6 scenarios): h auto-predim + ON default, toggle OFF, "Ver cuentas completas" without empotramiento log, 4× Ver D/L, 2× Ver cuentas, steel app at `:5173/slab` identical to concrete
- [x] At `localhost:5173/slab` (steel) and `localhost:5174/slab` (concrete), form layout and results are identical

**Depends on**: Tasks 1-10
**Estimated lines**: 0 (no code)
**Spec ref**: proposal.md § "Success Criteria" (8 items)

## Implementation Order

1. **Foundation (Tasks 1-2)**: Pure type additions. Land first because Tasks 3-10 reference the new fields.
2. **Engine semantics (Tasks 4-5)**: `D_total` semantics + log delete. Independent of each other. Log delete is trivial (Task 5) and unblocks clean `steps` for smoke tests.
3. **Engine population (Task 6)**: RD/RL fields. Depends on `D_total` from Task 4.
4. **Engine result decoration (Task 9)**: `coef`/`d` on `DirectionResult`. Depends on Task 1's interface + Task 4's `D_total`.
5. **UI rendering — form (Task 3)**: Reorder + toggle. Depends on Task 2.
6. **UI rendering — results (Tasks 7, 10)**: Ver D/L + Ver cuentas. Depend on Tasks 6 and 9 respectively.
7. **Adapter (Task 8)**: Standalone refactor; can land anywhere after Task 6. Suggested last because no UI consumes it.
8. **Verification (Task 11)**: Gate.

## Breakdown

| Phase | Tasks | Focus |
|-------|-------|-------|
| Foundation | 1, 2 | Type extensions in shared + both app mirrors |
| Engine | 4, 5, 6, 9 | Semantics, log cleanup, RD/RL, coef/d |
| UI | 3, 7, 10 | Form reorder + toggle, Ver D/L, Ver cuentas |
| Adapter | 8 | `slabReactionToBeamLoad` rewrite |
| Verification | 11 | Lint + typecheck + build + MD5 + smoke |
| Total | 11 | |

## Risks

- **Mirror drift**: any missed sync between `apps/concrete` and `apps/steel` leaves the apps inconsistent. Mitigation: every task that touches a mirrored file explicitly checks MD5 in acceptance criteria.
- **Type order coupling**: Task 9 (set `coef`/`d` values) must land AFTER Task 1 (declare fields) and Task 4 (compute `D_total`). The dependency graph above enforces this; `sdd-apply` MUST NOT reorder.
- **Legacy slab JSON**: saved slabs from before this change have no `RD_*/RL_*` fields. `hasSlabDL` gates UI; `slabReactionToBeamLoad` returns `null`. No data migration needed (per design.md § "Migration / Backward compat").
- **cm↔mm debt**: form still mixes units in labels (e.g. `h (cm)` vs `h (mm)` in shared types). Out of scope; future change.
- **No automated tests**: verification is `lint + typecheck + build` plus manual smoke. A regression in the Whitney branch math would not be caught by CI. Mitigated by spec scenario coverage and the CIRSOC 201-05 formulas already in `designSupportMoment`.
- **Pre-existing dedup**: `DirectionResult` and `SlabInput` duplicated in 3 places. This change keeps them in sync; the dedup itself remains a future change.

## Next Step

Ready for `sdd-apply`. The 11-task plan is within the 800-line exception budget (~470 lines estimated), and the 5-commit work-unit structure inside a single PR is reviewable. No decision needed before apply (`size:exception` already approved, `Decision needed before apply: No`).
