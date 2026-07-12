# Design: Wiring + CIRSOC Methodology Fixes

## Technical Approach

Two independent work units. **Phase A** adds 4 imports, 4 routes, and 2 `<Link>`s to `main.tsx` — pure wiring, zero logic risk. **Phase B** adds a unidirectional branch and compatibilización step to `designSlab()` before the Kalmanok table dispatch, plus fixes to the `designDir()` inner function. No new files, no API surface change: `SlabInput`/`SlabResult`/`DirectionResult` remain stable.

> Decision and spec alignment: each decision below maps to one or more spec requirements. Where a decision resolves ambiguity between the proposal and spec language, the spec requirement takes priority.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| **isCrossed guard** | A: Keep ratio-only check | Simple but wrong — 3-free-edge slabs incorrectly classified as crossed | B: `min(lx,ly)/max(lx,ly) > 0.5 AND all 4 edges non-free` |
| | **B: 4-edge + ratio check** | Correct per CIRSOC; isCrossed=false for any unsupported edge | |
| **Unidirectional moments** | A: Fall through to Kalmanok (current) | Wrong methodology — overestimates Mx in unidirectional | B: Branch to beam-strip before table dispatch |
| | **B: `calcUnidirectionalMoments()`** internal helper | Correct M=qu·L²/coef; coef=8 simple, 12 fixed, 10 mixed | |
| **KaMin for fc>30** | A: `1/(3.4*fc)` (current) | Missing √fc per 201-05 §10.5 | C: Use existing `AsMin = max(√fc/(4fy)·bw·d, 1.4/fy·bw·d)` as floor |
| | B: `1/(3.4*√fc)` | Ambiguous interpretation | |
| | **C: Direct AsMin comparison** | Already correct per §10.5.1; avoids formula question entirely | |
| **Ka > KaMax** | A: Silent double-reinforcement (current) | Compression steel in slabs is impractical | B: Warn + compute As with KaMax |
| | **B: Warning-only** | Structural safety preserved; user fixes by increasing h | |

## Data Flow (Phase B)

```
designSlab(input)
  │
  ├─ isCrossed? ──YES──► Kalmanok tables (unchanged)
  │                        │
  │                        ├─ compatibilización: for edges === "continuo", log ratio;
  │                        │  standalone → empotramiento perfecto note in steps
  │                        │
  │                        ├─ designDir(Mx, dBarX) → dirX
  │                        ├─ designDir(My, dBarY) → dirY
  │                        │
  │                        └─ distX, distY = repartición (0.20·As for unidirectional only)
  │
  └─ NO ──► calcUnidirectionalMoments(edges, qu, l_span)
               │
               ├─ M_pos, M_neg per coef
               ├─ M_transverse = 0 (repartición only)
               └─ designDir() → single direction result
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/main.tsx` | Modify | +4 imports (SlabForm, SlabResults, ConcreteForm, ConcreteResults), +4 routes (`/slab`, `/slab-results`, `/concrete`, `/concrete-results`), +2  `<Link>`s ("Losas H°", "Viga H°") |
| `client/src/lib/slab-calc.ts` | Modify | `isCrossed` guard, `calcUnidirectionalMoments()` helper, compatibilización post-processing, `designDir()`: AsMin floor + KaMax warning, h rounding guard, cover formula `dMin+cover`, sMin=80mm in steps |

## Interfaces / Contracts

Existing interfaces unchanged. `DirectionResult` unchanged — `sMin` reported via `steps` only.

```typescript
// Internal helper (not exported)
function calcUnidirectionalMoments(
  edges: readonly EdgeCondition[],
  qu: number,
  L: number,  // span in m
  lx: number,
  ly: number
): { M_pos: number; M_neg: number | null; dirLabel: string }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | TypeScript strict mode | `cd client && npm run build` — passes = all types/calls align |
| Manual | Routing | Navigate `/slab`, `/slab-results`, `/concrete`, `/concrete-results` |
| Manual | IsCrossed | 3-free-edge slab → "Unidireccional" in steps |
| Manual | Unidirectional | Simply supported unidirectional → M = qu·L²/8 in steps |
| Manual | h preservation | h=200 → output h=200 (no rounding) |

No test runner exists (`strict_tdd: false`). Build + manual verification is the verification path per `openspec/config.yaml`.

## Migration / Rollout

- **Chained PR #1** (Phase A, ~28 lines): wiring only — merge first, verify independently
- **Chained PR #2** (Phase B, ~150 lines): methodology fixes — depends on #1 only for routing context

Rollback: `git revert` per PR. Each is a self-contained commit.

## Open Questions

- None. All methodology decisions resolved per CIRSOC 201-05 references in the orchestrator's task brief.
