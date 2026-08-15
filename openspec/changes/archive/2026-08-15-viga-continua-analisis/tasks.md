# Tasks: Viga Continua — Continuous Beam Structural Analysis

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 additions across 4 files |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-always (user pre-authorized autonomous resolution) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

> The user instructed the orchestrator to resolve autonomously (no questions). Since the estimate exceeds 400 lines, the orchestrator auto-resolves to stacked-to-main slices. No further decision required.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `viga-continua.ts` types + `VigaContinuaForm.tsx` | PR 1 | base main; ~380 lines |
| 2 | `VigaContinuaResults.tsx` | PR 2 | base main after PR 1; ~310 lines |
| 3 | `main.tsx` routing/nav | PR 3 | base main; ~6 lines; smoke test |

## Phase 1: Foundation (Types + Form)

- [x] 1.1 Create `apps/concrete/src/lib/viga-continua.ts` — `AnalysisLoad = EnvelopeLoad & { id: string }`, `VigaContinuaState { spans, supportTypes, loads }`. Deps: none. ~20 lines. ✓ `tsc` passes; imports `EnvelopeLoad` (beam-envelope) + `SupportType` (shared); no RC coupling.

- [x] 1.2 Create `apps/concrete/src/screens/VigaContinuaForm.tsx` — span count selector `[1,2,3,4,5]`, span-length inputs, `spanCount+1` support selectors (Articulado/Empotrado, Libre only at the two ends). Deps: 1.1. ~180 lines. ✓ 5 selectable (spec: five spans selectable); interior support has no "Libre" (interior support cannot be libre); end supports offer "Libre".

- [x] 1.3 Extend `VigaContinuaForm.tsx` — D/L loads editor (point/distributed, D/L, position or start/end), validation (spans>0 ∧ ≥1 non-free support ∧ ≥1 load with D+L>0), submit → `navigate("/viga-continua-results", { state })`. Deps: 1.2. ~180 lines. ✓ point & distributed D/L (load input with D and L); no section/f'c/fy inputs (no section inputs); no self-weight toggle (no self-weight toggle); no save control (no save).

## Phase 2: Core Implementation (Results)

- [x] 2.1 Create `apps/concrete/src/screens/VigaContinuaResults.tsx` — read `location.state as VigaContinuaState | null` (null → "No hay datos" + Volver); call `calculateBeamEnvelope(spans, supportTypes, loads, 0)`; render reactions D/L per support (unfactored, "sin factorar"), per-span `spanVu` (U) and `spanMuPos` (Mu+), interior `supportMuNeg.slice(1, nSpans)` (Mu−). Deps: 1.1, beam-envelope. ~180 lines. ✓ reactions unfactored (unfactored reactions returned); Vu/Mu+/Mu− per spec (Vu and Mu computed); no RC outputs (no design outputs); reuse solver (reuse shared solver).

- [x] 2.2 Extend `VigaContinuaResults.tsx` — Mafs shear + moment diagrams reusing `peak`, `supportTriangle`, `clampX`, `labelH`; label envelopes "U = 1.2·D + 1.6·L". Deps: 2.1. ~130 lines. ✓ diagrams render across beam length (Mafs diagrams render); envelopes labeled factored, reactions "sin factorar" (factored vs unfactored labeling).

## Phase 3: Integration (Routing)

- [x] 3.1 Modify `apps/concrete/src/main.tsx` — import both screens, NavBar "Viga Continua" link → `/viga-continua`, register routes `/viga-continua` → `VigaContinuaForm` and `/viga-continua-results` → `VigaContinuaResults`. Deps: 1.2, 1.3, 2.1, 2.2. ~6 lines. ✓ form route renders; results route renders; distinct navbar link (routing spec).

## Phase 4: Verification

- [x] 4.1 Run `npm run lint:all` + `npm run typecheck:all` + `npm run build:all`; smoke test `/viga-continua` (5 spans, mixed supports, D/L loads, 2⁵=32 patterns) → diagrams render, "← Volver" returns to form. Deps: all. 0 lines. ✓ static checks green for apps/concrete scope (new files lint-clean, `apps/concrete` tsc+vite build passes); `lint:all`/`typecheck:all`/`build:all` at root still fail on PRE-EXISTING `apps/steel/src/screens/BasesForm.tsx` type errors + pre-existing prettier/react-hooks violations in unrelated files (not introduced by this change). Browser smoke test not run (no headless browser in this environment). No RC output.
