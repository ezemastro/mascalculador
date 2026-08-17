# Tasks: Viga Continua — Modo Pórtico + Mejoras Compartidas

## §1. Work Breakdown

**Locked split**: PR1 → PR2 → PR3 → PR4, `stacked-to-main`. No deviation is justified: proposal, design, and dependency order all converge on four autonomous slices. The WIP decision in §6 executes before PR1.

## PR1 — Foundations + Routing + Selector + Shared UI Stubs

### 1.1 — Portico domain contracts ✅ (applied 2026-08-16, PR1 sub-slice)
- **Action**: Create the strict domain model, result shapes, support semantics, and validation contract for pórtico state.
- **Requirements covered**: R-portico-types, R-portico-supports, R-portico-results, R-portico-y-axis, R-portico-m-plus-convention.
- **Files**:
  - `viga-continua/src/lib/portico.ts` (new, ~70 LOC)
- **Acceptance**:
  - [x] `PorticoState`, force/displacement/reaction outputs, and `"hinge" | "fixed"` supports are strongly typed; Y is positive downward.
  - [ ] `validatePorticoState` rejects duplicate IDs, bad references, zero-length bars, invalid load ranges, missing supports, and mechanisms before assembly. *(deferred to PR2 per orchestrator directive — types-only PR1 scope)*
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: PR1 landed types only (no `validatePorticoState`); the richer `E/A/I`, point/distributed split, and result shapes also land in PR2 alongside the solver. See PR1 deviation note below.

### 1.2 — Dual persistence and saved-list support ✅ (applied 2026-08-16, PR1 sub-slice)
- **Action**: Add `"portico"` save typing, autosave helpers, named CRUD helpers, and the `SavedBeams` summary branch.
- **Requirements covered**: R-portico-persistence.
- **Files**:
  - `viga-continua/shared/src/storage.ts` (modified, +85 LOC)
  - `viga-continua/shared/src/SavedBeams.tsx` (modified, +18 LOC)
- **Acceptance**:
  - [x] `savePorticoInput({ name, input })` round-trips `{ name, input }` under `type = "portico"`; `saveLastPorticoFormState` persists after every change; `loadLastPorticoFormState` returns `null` on absence/parse error.
  - [x] Saved items render the label `Pórtico · Nodos: N, Barras: M` (count derived from `data.input.nodes/bars.length`); missing `portico` data returns an empty list.
  - [ ] `updatePorticoInput(id, state)`, `loadPorticoInput(id)`, `deletePorticoInput(id)`, `getSavedPorticoInputs()` *(deferred to PR3 — required when `PorticoForm` wires the editor's named saves). The current PR1 helper set still meets the autosave + persistence-shape acceptance criteria.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Mirror existing beam behavior; generic storage must remain app-agnostic. `PorticoState` here is a structural persistence shell declared inline in `shared/src/storage.ts` (shared/ never imports from src/, per the dependency-direction rule in §1.1). PR2/3 will consolidate by promoting the canonical types to `shared/src/portico-types.ts`.
```ts
savePorticoInput(name, state)            // ✅ PR1
updatePorticoInput(id, state)            // ⏳ PR3
loadPorticoInput(id)                     // ⏳ PR3
deletePorticoInput(id)                   // ⏳ PR3
getSavedPorticoInputs()                  // ⏳ PR3 (replaces via `getSavedBeams("concrete", "portico")`)
saveLastPorticoFormState(state)          // ✅ PR1
loadLastPorticoFormState(): PorticoState | null  // ✅ PR1
```

### 1.3 — Mode-aware entry and result routing
- **Action**: Add the selector, URL-mode entry wrapper, state-mode result wrapper, and current route registration.
- **Requirements covered**: R-routing-mode-selector, R-routing-portico-routes, R-routing-path-correction.
- **Files**:
  - `viga-continua/src/components/ModeSelector.tsx` (new, ~25 LOC)
  - `viga-continua/src/components/MainEntry.tsx` (new, ~30 LOC) *(deferred to PR4 per PR1 micro-scope)*
  - `viga-continua/src/components/ResultsWrapper.tsx` (new, ~20 LOC) *(deferred to PR4 per PR1 micro-scope)*
  - `viga-continua/src/viga-continua-main.tsx` (modified, +20 LOC) *(URL-mode contract documented as JSDoc block)*
- **Acceptance**:
  - [x] `/` and `/viga-continua?mode=portico` select the correct branch, while default mode renders beam; reload preserves `?mode=portico`.
  - [x] `/viga-continua-results` branches on `location.state.mode`; routing contains no stale `apps/concrete` reference.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: PR1 inlines mode branching inside `VigaContinuaForm` / `VigaContinuaResults` (per orchestrator micro-scope). The `MainEntry` / `ResultsWrapper` components land in PR4 to swap in the final pórtico implementations.

### 1.4 — Beam Nueva and operational selector
- **Action**: Put `ModeSelector` and confirmed `Nueva` reset behavior above the existing beam editor while preserving the beam flow.
- **Requirements covered**: R-beam-nueva, R-routing-mode-selector, R-portico-nueva-shared.
- **Files**:
  - `viga-continua/src/screens/VigaContinuaForm.tsx` (modified, +45 LOC)
- **Acceptance**:
  - [x] Canceling `Nueva` preserves the current state; confirming resets a single 1 m span with no loads.
  - [x] Beam mode still calculates and saves exactly as before; selecting Pórtico shows the PR1 operational placeholder.
  - [ ] *(POC)* Autosave after confirming `Nueva` is wired to `saveLastVigaContinuaFormState` (a viga-continua last-form helper does not yet exist in `shared/src/storage.ts`; PR1 ships the reset only — PR4 task 4.5 unifies beam + pórtico autosave under the shared module).
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: This intentionally keeps Pórtico functional but trivial until PR3.

### 1.5 — Beam Envolvente/Servicio stub
- **Action**: Add a default-on Envolvente/Servicio toggle that changes beam result labels without adding a second solver.
- **Requirements covered**: R-beam-env-toggle, R-portico-env-toggle-shared.
- **Files**:
  - `viga-continua/src/screens/VigaContinuaResults.tsx` (modified, +30 LOC)
- **Acceptance**:
  - [x] Envolvente is selected on first render and displays ULS.
  - [x] Servicio displays D and L separately with the matching legend (POC: values still flow through `calculateBeamEnvelope` with the opposite family zeroed — labels read "Servicio — D y L por separado (POC)").
  - [x] Toggling changes only the rendered result slice and leaves the existing beam save/back behavior intact.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: PR1 ships the toggle + D/L table split + pórtico placeholder branch. PR4 task 4.4 promotes the helper to a proper cached `uls | slsD | slsL` triple and wires `EnvToggle` extraction. The Mafs diagrams in PR1 still render the ULS envelope in both modes (POC limitation, documented inline).

## PR2 — Pórtico 2-D Stiffness Solver

### 2.1 — Conventions, element matrix, and loads ✅ (applied 2026-08-17, PR2a)
- **Action**: Document M+/Y conventions and implement the local 6×6 EAN frame element plus point/distributed equivalent nodal loads.
- **Requirements covered**: R-portico-solver, R-portico-supports, R-portico-y-axis, R-portico-m-plus-convention.
- **Files**:
  - `viga-continua/src/lib/portico-analysis.ts` (new, +120 LOC)
- **Acceptance**:
  - Inclined loads decompose to global `fx/fy` before local axial/transverse projection; distributed load integration is deterministic.
  - The transformed matrix is symmetric to `1e-9`, the singular free system is rejected, and top-of-file JSDoc locks Y-down and M+.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Use partial pivoting; no numerical dependency and no internal size cap.

### 2.2 — Global assembly, constraints, and three-mode solve ✅ (applied 2026-08-17, PR2a)
- **Action**: Assemble `K`, apply hinge/fixed boundary conditions, and solve ULS plus D/L service modes against the same stiffness matrix.
- **Requirements covered**: R-portico-types, R-portico-solver, R-portico-supports, R-portico-y-axis.
- **Files**:
  - `viga-continua/src/lib/portico-analysis.ts` (new, +180 LOC)
- **Acceptance**:
  - `uls = 1.2D + 1.6L` uses all loads together; `slsD` and `slsL` are unfactored and independently solved.
  - Six-DOF numbering and support constraints match `portico.ts`; a singular mechanism throws a structured error.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Keep `solvePortico` pure: no I/O, globals, or form cap.

### 2.3 — Reactions, internal forces, and M+ samples ✅ (applied 2026-08-17, PR2b)
- **Action**: Recover constrained reactions and endpoint/intermediate `N/V/M` forces with the 11 locked samples per bar.
- **Requirements covered**: R-portico-results, R-portico-m-plus-convention, R-portico-y-axis.
- **Files**:
  - `viga-continua/src/lib/portico-analysis.ts` (new, +140 LOC)
- **Acceptance**:
  - Reaction output and M+ signs satisfy `M = r × F`; every bar exposes both endpoints and 11 samples.
  - Cantilever magnitude `|M|=P·L` and equilibrium signs are preserved without flipping end-B forces.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: End-B forces act on the support, so preserve the documented sign flip.
```ts
recoverInternalForces(K, u, F, dofMap)
```

### 2.4 — Three hand-calculated smoke fixtures ✅ (applied 2026-08-17, PR2b)
- **Action**: Add a standalone `tsx` runbook asserting cantilever, symmetric frame, and inclined-load reactions to 0.1%.
- **Requirements covered**: R-portico-solver, R-portico-supports, R-portico-results.
- **Files**:
  - `viga-continua/scripts/portico-smoke.ts` (new, ~80 LOC)
- **Acceptance**:
  - Ménsula: `Fy_A=10 kN`, `|Mz_A|=30 kN·m`; symmetric: `Fy_A=Fy_C=10`, `Fx_A=0`.
  - Inclined: `ΣFy=15`, `ΣFx=-25.98`; all three commands print a passing checkpoint.
- **Verification**:
```bash
npx tsx scripts/portico-smoke.ts
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Run from `viga-continua/`; this is the required smoke substitute, not a new test runner.

## PR3 — PorticoForm Editor

### 3.1 — Default geometry factory
- **Action**: Isolate the precarged 3-node/2-bar/2-support/1-load example and the Y-positive-down hint.
- **Requirements covered**: R-portico-default-geometry, R-portico-y-axis, R-portico-limits.
- **Files**:
  - `viga-continua/src/lib/portico-defaults.ts` (new, ~30 LOC)
- **Acceptance**:
  - Factory returns `A(0,0)`, `B(2,3)`, `C(4,0)`, two bars, hinge/fixed bases, and the specified inclined example load.
  - Two calls produce independent immutable defaults; downstream cloning creates unique form IDs.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: This is the locked PR3 budget cut from §7.

### 3.2 — Form shell, hydration, autosave, and named saves
- **Action**: Build `PorticoForm` state lifecycle, default/autosave hydration, CRUD wiring, and the Pórtico `SavedBeams` panel.
- **Requirements covered**: R-portico-persistence, R-portico-default-geometry, R-portico-nueva-shared.
- **Files**:
  - `viga-continua/src/screens/PorticoForm.tsx` (new, +170 LOC)
- **Acceptance**:
  - First mount shows the default; subsequent mounts restore `last_portico_form`; every change persists.
  - Named save/load/delete round-trips and is filtered by `type = "portico"`.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Shared storage accepts structural input; import domain types only in the app screen.

### 3.3 — Node and bar editors
- **Action**: Add editable node IDs/coords and bar endpoints plus `E`, `A`, and `I` using existing numeric/format primitives.
- **Requirements covered**: R-portico-types, R-portico-default-geometry, R-portico-y-axis, R-portico-limits.
- **Files**:
  - `viga-continua/src/screens/PorticoForm.tsx` (new, +80 LOC)
- **Acceptance**:
  - Add/remove rows preserves unique IDs; editing node Y visibly states `Y positivo hacia abajo`.
  - Bar endpoint selectors use only existing nodes and retain the design's non-design `A=1e-2`, `I=1e-4` placeholders.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: `DecimalInput` and `format*` are mandatory reuse points.

### 3.4 — Support and load editors
- **Action**: Add hinge/fixed support rows and point/distributed D/L, angle, `a`, and optional `b` load rows with add/remove controls.
- **Requirements covered**: R-portico-supports, R-portico-solver, R-portico-limits.
- **Files**:
  - `viga-continua/src/screens/PorticoForm.tsx` (new, +90 LOC)
- **Acceptance**:
  - Add controls disable at 5 nodes, 5 bars, 5 supports, and 5 loads; removing restores availability.
  - Support rows reference nodes only, while load rows reference bars and expose every field required by `PorticoBarLoad`.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Validate only on submit so valid editing remains frictionless.

### 3.5 — Nueva, validation, and submit
- **Action**: Add confirmed reset, `validatePorticoState` errors, and navigation to the common results route with pórtico state.
- **Requirements covered**: R-portico-nueva-shared, R-portico-persistence, R-portico-supports, R-routing-portico-routes.
- **Files**:
  - `viga-continua/src/screens/PorticoForm.tsx` (new, +60 LOC)
- **Acceptance**:
  - Canceling confirmation preserves state; confirming resets the factory defaults and autosaves them.
  - Invalid input blocks submit with a specific validation error; valid submit reaches `/viga-continua-results` with `{ mode: "portico", state }`.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Keep import paths `../lib/portico.ts` and `../lib/portico-analysis.ts` available for PR4.

## PR4 — PorticoResults + Final Shared Toggle

### 4.1 — Solve once and render result mode
- **Action**: Add the shared toggle, solve once to `{ uls, slsD, slsL }`, and render the selected slice with structured error handling.
- **Requirements covered**: R-portico-results, R-portico-env-toggle-shared, R-portico-solver, R-routing-portico-routes.
- **Files**:
  - `viga-continua/src/components/EnvToggle.tsx` (new, ~20 LOC)
  - `viga-continua/src/screens/PorticoResults.tsx` (new, +85 LOC)
- **Acceptance**:
  - Envolvente is default and labels ULS; Servicio renders D and L columns/legend from the same cached results.
  - Toggle changes do not re-solve; validation/singular errors render a structured banner instead of a blank screen.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**:
```ts
const solved = solvePortico(state, "uls");
solved.uls;
solved.slsD;
solved.slsL;
```

### 4.2 — Mafs frame geometry and deformed shape
- **Action**: Render nodes, bars, support glyphs, load arrows, and ×50 exaggerated deformed geometry in a 700×400 Mafs view.
- **Requirements covered**: R-portico-diagram, R-portico-y-axis, R-portico-supports, R-portico-results.
- **Files**:
  - `viga-continua/src/screens/PorticoResults.tsx` (new, +120 LOC)
- **Acceptance**:
  - Mafs maps world Y directly downward; hinge and fixed supports have distinguishable glyphs.
  - Undeformed and deformed shapes are both visible, and back navigation works without resolving state.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Y increases down in both input hint and render call.

### 4.3 — M+ overlay, reactions, and mandatory legends
- **Action**: Plot each bar's 11-sample M+ curve on the tensioned side and add reaction/legend sections visible in the initial viewport.
- **Requirements covered**: R-portico-results, R-portico-diagram, R-portico-m-plus-convention, R-portico-y-axis, R-portico-env-toggle-shared.
- **Files**:
  - `viga-continua/src/screens/PorticoResults.tsx` (new, +120 LOC)
- **Acceptance**:
  - Every bar renders 11 samples, signs match the locked convention, and reactions include signed `Fx/Fy/Mz`.
  - Initial viewport visibly states M+ tension below, vector `→ +x`, and `Y positivo hacia abajo`; Servicio legend says D/L separately.
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Do not replace the JSDoc-required sign text with a vague “positive moment” label.

### 4.4 — Apply the shared toggle to beam results
- **Action**: Add the service-result calculation to the envelope module and refactor beam results to cache ULS/D/L slices before rendering.
- **Requirements covered**: R-beam-env-toggle, R-portico-env-toggle-shared.
- **Files**:
  - `viga-continua/src/lib/beam-envelope.ts` (modified, +30 LOC)
  - `viga-continua/src/screens/VigaContinuaResults.tsx` (modified, +80 LOC)
- **Acceptance**:
  - Default Envolvente remains `U=1.2D+1.6L`; Servicio renders D and L separately with the correct legend.
  - Existing beam envelopes, save flow, back flow, and support reactions remain intact; toggling performs no re-solve.
- **Verification**:
```bash
npx tsx scripts/portico-smoke.ts
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: Reuse `calculateBeam`; do not add dependencies or rewrite its algorithm.

### 4.5 — Replace placeholders and complete branch wiring
- **Action**: Replace the Pórtico placeholders with final form/results components and finalize the result-state branch.
- **Requirements covered**: R-routing-portico-routes, R-routing-mode-selector, R-routing-path-correction.
- **Files**:
  - `viga-continua/src/components/MainEntry.tsx` (modified, +5 LOC)
  - `viga-continua/src/components/ResultsWrapper.tsx` (modified, +10 LOC)
- **Acceptance**:
  - Beam state and Pórtico state both reach the expected result component; no placeholder route remains.
  - `/` `/viga-continua` `/viga-continua-results` compile without stale `apps/concrete` imports.
- **Verification**:
```bash
npx tsx scripts/portico-smoke.ts
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: This is the last stacked commit; retain independent rollback semantics.

## §2. Task Item Templates

````markdown
## <PR>.N — <short name>
- **Action**: <clear implementation action>
- **Requirements covered**: R-...
- **Files**:
  - `path/to/file.ts` (new | modified, ~LOC delta)
- **Acceptance**:
  - <observable result>
  - <observable result>
- **Verification**:
```bash
npm run lint:all && npm run typecheck:all && npm run build:all
```
- **Notes**: <constraints, dependencies, symbol refs>
````

## §3. Cross-PR Dependencies

- **PR2 → PR1**: consumes `PorticoState`, validation, result contracts, persistence types, and route entry contracts.
- **PR3 → PR1 + PR2**: consumes types, storage, `validatePorticoState`, and the locked solver import contract before submit wiring.
- **PR4 → PR1 + PR2 + PR3**: consumes placeholders, default state, solver output, and form navigation state.

## §4. Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

| PR | Forecast LOC | 400-line risk | Chained recommended | Decision needed |
|----|--------------|---------------|---------------------|-----------------|
| PR1 | ~280 | Low | Yes | No |
| PR2 | ~520 | High | Yes | **Yes — activate PR2a/PR2b split** |
| PR3 | ~430 | Med | Yes | No — defaults extraction is locked |
| PR4 | ~470 | Med | Yes | No — MafsFrame extraction is locked |

- **PR2 checkpoint**: from `viga-continua/`, run all three fixtures with `npx tsx scripts/portico-smoke.ts`, then root lint/typecheck/build.
- **PR4 checkpoint**: rerun the same three fixtures plus the default Pórtico Mafs/legend manual pass and both beam toggle modes.

## §5. PR Boundary Semantics

- Every PR is one focused git commit and is pushed/merged in order under `stacked-to-main`.
- Each PR must pass `npm run lint:all && npm run typecheck:all && npm run build:all`; all prior PR tests/checks remain green.
- Titles use repository convention, e.g. `feat(portico): add domain contracts and routing`.

## §6. WIP-Commit Decision (LOCKED)

- **Strategy A — Pre-PR1 cleanup commit (recommended and locked)** is selected. `git status`/`git diff` currently show 316 changed lines across six Viga Continua files (`SavedBeams.tsx`, `storage.ts`, `VigaContinuaForm.tsx`, `VigaContinuaResults.tsx`, `viga-continua-main.tsx`, `vite.config.ts`).
- That relevant WIP is committed first on the feature branch; PR1 starts from a clean PR1 diff. Unrelated losa changes are excluded.
- Reason: isolates unrelated work, keeps PR1 reviewable, and makes rollback/revert safer.

## §7. `size:exception` Trigger

- **PR2**: locked fallback is **PR2a + PR2b**, not `size:exception`. Cut `portico-analysis.ts` at planned lines **1–300**, immediately after `gaussSolve`/basic three-mode solve and before `recoverInternalForces`; PR2b owns planned lines **301–520** plus `scripts/portico-smoke.ts` lines **1–80**.
- **PR3**: locked fallback is `portico-defaults.ts` lines **1–30**; `PorticoForm.tsx` cuts at planned line **40**, immediately after `createDefaultPorticoState()`, before editor rendering. If still over budget, cut to PR3a lines **1–210** (shell/nodes/bars) and PR3b lines **211–430** (supports/loads/actions).
- **PR4**: locked fallback is to add `components/MafsFrame.tsx` lines **1–100** in PR1, then replace `VigaContinuaResults.tsx` current lines **319–455** with the shared frame. PR4 keeps Pórtico overlay/reactions/legend; if still over 400, cut `PorticoResults.tsx` at planned lines **1–220 / 221–370** for PR4a/PR4b.

## §8. Definition of Done (overall change)

- All four PRs merge stacked-to-main and retain the documented per-PR rollback boundaries.
- Final root lint, typecheck, and build are green; beam mode remains backward-compatible.
- All 50 scenarios across the three delta specs are mapped to observable verification evidence.
- The three Pórtico fixtures match hand calculations within 0.1%, including the inclined-load equilibrium.
- `sdd-archive` writes its archive report and merges the three delta specs: `portico-analysis`, `viga-continua-analysis`, and `viga-continua-routing`.

## §9. Out of Scope for Tasks

- No unit-test runner or dependency addition; only the required standalone smoke script.
- No mirror to `hormigon/` or refactor of legacy `apps/concrete` mirrors.
- No reinforced-concrete dimensioning.
- No cap increase beyond 5 nodes, 5 bars, 5 supports, and 5 loads.
- No inclined supports, skew boundary conditions, or internal hinges.
- No live-load patterning in the pórtico solver; ULS factors all D/L simultaneously.
