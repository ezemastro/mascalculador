# Tasks: Wiring + CIRSOC Methodology Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~178 (28 + 150) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Phase A) → PR 2 (Phase B) |
| Delivery strategy | single-pr |
| Chain strategy | n/a |

Decision needed before apply: No (single PR, well under 400-line budget)
Chained PRs recommended: No (178 lines, works as single PR)
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Restore slab/concrete routing & nav | PR 1 | Independent, ~28 lines, merges to main |
| 2 | Fix CIRSOC methodology in slab-calc | PR 2 | Depends on PR 1 for routing context only |

## Phase 1: Foundation & Wiring

- [x] 1.1 Add `"free"` to `EdgeCondition` type union in `client/src/lib/slab-calc.ts`
- [x] 1.2 Add 4 imports (SlabForm, SlabResults, ConcreteForm, ConcreteResults) to `client/src/main.tsx`
- [x] 1.3 Add routes `/slab`, `/slab-results`, `/concrete`, `/concrete-results` to router in `main.tsx`
- [x] 1.4 Add nav links "Losas H°" → `/slab`, "Viga H°" → `/concrete` to NavBar

## Phase 2: Core Methodology

- [x] 2.1 Fix `isCrossed`: check `min(lx,ly)/max(lx,ly) > 0.5` AND 4 non-free edges
- [x] 2.2 Add `calcUnidirectionalMoments()` with beam-strip coef (8 simple, 12 fixed, 10 mixed, 2 cantilever)
- [x] 2.3 Insert unidirectional branch before Kalmanok dispatch; set zero moments for transverse
- [x] 2.4 Add continuity validation: `min(lx,ly)/max(lx,ly) >= 0.5` for "continuo" edges
- [x] 2.5 Add compatibilización de apoyos: standalone → empotramiento perfecto note

## Phase 3: Reinforcement Fixes

- [x] 3.1 In `designDir()`: add KaMax warning step when Ka > KaMax, compute As with KaMax
- [x] 3.2 In `designDir()`: enforce `AsReq = Math.max(AsReq, AsMin, AsTemp)` floor
- [x] 3.3 In `designDir()`: add `sMin = 80 mm` to steps output
- [x] 3.4 Fix h rounding: only `Math.ceil(h/10)*10` when `hInput === 0`; preserve user h
- [x] 3.5 Fix h formula: `h = dMin + cover` (remove `+ 10` padding)

## Phase 4: Verification

- [x] 4.1 `npm run build` — TypeScript strict mode passes cleanly
- [x] 4.2 Manual: navigate `/slab`, `/slab-results`, `/concrete`, `/concrete-results` render
- [x] 4.3 Manual: unidirectional case (lx=3m, ly=8m, all simple) → "Unidireccional"
- [x] 4.4 Manual: crossed case (lx=4m, ly=5m, all simple) → "Cruzada" with Kalmanok
- [x] 4.5 Manual: user h=200 preserved without rounding to nearest 10
