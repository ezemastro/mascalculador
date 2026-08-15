# Design: Viga Continua — Continuous Beam Structural Analysis

## Technical Approach

Add an analysis-only two-screen flow to `apps/concrete` that reuses the existing envelope pipeline unchanged. `VigaContinuaForm` collects spans (1–5), support types, and D/L loads; on submit it navigates to `VigaContinuaResults` with the state via `location.state`. Results call `calculateBeamEnvelope(spans, supportTypes, loads, 0)` (self-weight hardcoded 0) and render reactions D/L, Vu, Mu+/Mu−, and Mafs diagrams. No RC design, no persistence, no self-weight toggle. The change is fully additive: existing Viga H° files are untouched.

## Architecture Decisions

| Decision | Options considered | Choice | Rationale |
|---|---|---|---|
| Component reuse vs duplication | (a) Extract load-editor/support-selector/Mafs into `packages/shared` or `apps/concrete/src/components`; (b) copy+strip from `ConcreteForm`/`ConcreteResults` | **Copy+strip** | Extracting would touch `ConcreteForm.tsx`/`ConcreteResults.tsx` and risk destabilizing Viga H° (the proposal's rollback relies on "fully additive"). Copying ~300 lines is acceptable v1 cost; extraction is deferred to a follow-up once both pages are stable. |
| Single load type | (a) reuse `ConcreteLoad`; (b) reuse `EnvelopeLoad`; (c) new standalone type | **`AnalysisLoad = EnvelopeLoad & { id: string }`** in new `apps/concrete/src/lib/viga-continua.ts` | `EnvelopeLoad` (in `beam-envelope.ts`) is the exact shape `calculateBeamEnvelope` consumes; `ConcreteResults` currently maps `ConcreteLoad → EnvelopeLoad` (lines 120–127) precisely because `ConcreteLoad` carries an `id`. Adding only `id` for React keys eliminates that mapping layer entirely for the new page. The three existing near-duplicate shapes (`ConcreteLoad`, `EnvelopeLoad`, inline map in `beam-reaction.ts`) are left as-is (out of scope), noted for a future cleanup. |
| supportMuNeg selection | `supportMuNeg` is sized `supportPositions.length` (= nSpans+1) and includes end supports | Display interior only: `supportMuNeg.slice(1, nSpans)` (0-based idx 1..nSpans−1) | Spec requires Mu− "per interior support". End supports are excluded even though a `fixed` end support yields a nonzero `supportMuNeg[0]`/`[nSpans]` (hogging fixed-end moment) — deliberate scope decision, flagged below. |
| Diagram rendering | (a) extract shared `<EnvelopeDiagram>`; (b) copy `ConcreteResults` Mafs block verbatim | **Copy the Mafs block**, local to `VigaContinuaResults` | Consistent with the copy+strip decision; keeps rollback trivial. Reuses the same helpers (`peak`, `supportTriangle`, `clampX`, `labelH`). |
| Types location | (a) `packages/shared/src/types.ts`; (b) local `apps/concrete/src/lib/viga-continua.ts` | **Local to `apps/concrete`** | `calculateBeamEnvelope`/`EnvelopeLoad` already live in `apps/concrete/src/lib`; `shared` is for cross-app code. Avoids coupling to RC types (`ConcreteState`, `designConcreteDetailed`). |

## Data Flow

```
VigaContinuaForm
  ├─ spanCount 1–5, spanLengths[], supportTypes[] (spanCount+1), loads[]
  └─ valid? (spans>0 ∧ ≥1 non-free support ∧ ≥1 load with D+L>0)
        │ navigate("/viga-continua-results", { state: VigaContinuaState })
        ▼
VigaContinuaResults
  ├─ location.state as VigaContinuaState | null   (null → "No hay datos" + Volver)
  └─ calculateBeamEnvelope(spans, supportTypes, loads, 0)
        ├─ reactionsD/L (unfactored) → cards "sin factorar"
        ├─ spanVu, spanMuPos, supportMuNeg[1..n−1] → per-span/interior cards "U"
        └─ shearPos/Neg, momentPos/Neg fn() → Mafs diagrams (factored)
```

No save; "← Volver" navigates back to `/viga-continua` (stateless, does not preserve inputs — acceptable per spec).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/concrete/src/lib/viga-continua.ts` | Create | `AnalysisLoad` (EnvelopeLoad + id), `VigaContinuaState` |
| `apps/concrete/src/screens/VigaContinuaForm.tsx` | Create | Analysis-only form (spans 1–5, supports, D/L loads) |
| `apps/concrete/src/screens/VigaContinuaResults.tsx` | Create | Envelope results + Mafs diagrams |
| `apps/concrete/src/main.tsx` | Modify | Navbar "Viga Continua" link + 2 routes |

## Interfaces / Contracts

```ts
// apps/concrete/src/lib/viga-continua.ts
import type { EnvelopeLoad } from "./beam-envelope";
import type { SupportType } from "@mascalculador/shared";

export interface AnalysisLoad extends EnvelopeLoad { id: string; }
export interface VigaContinuaState {
  spans: number[];            // 1..5 entries, all > 0
  supportTypes: SupportType[]; // length = spans.length + 1
  loads: AnalysisLoad[];      // ≥1 with D + L > 0
}
// Results reuse BeamEnvelopeResult from beam-envelope.ts (no new result type).
```

`calculateBeamEnvelope` is called with `loads` passed straight through (no mapping) and `selfWeight = 0`.

## Testing Strategy

No test runner configured (`testing.runner: none`, `strict_tdd: false`). Verification is manual + static: `eslint .`, `tsc -b`, and a smoke test at `/viga-continua` (5 spans, mixed supports, D/L loads) confirming 2⁵=32 patterns compute and diagrams render. Numeric-correctness spot checks against hand-calculated single-span reactions.

| Layer | What | Approach |
|-------|------|-----------|
| Static | Types, lint | `tsc -b` + `eslint .` |
| Manual | 5-span envelope, labeling, routing | Smoke test in browser |

## Migration / Rollout

No migration required. Fully additive — rollback = revert `main.tsx` diff and delete 3 new files.

## Open Questions

- [ ] `spanVu` is defined as "max Vu per span" via `shearMax` (absolute value). Confirm the results screen should display the unsigned magnitude (as `ConcreteResults` does) rather than signed max.
- [ ] "← Volver" is stateless (loses form inputs on return) — acceptable for v1, or should state round-trip back like Viga H°'s "Volver"?
