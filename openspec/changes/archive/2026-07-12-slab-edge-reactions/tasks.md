# Tasks: Per-Edge Slab Reactions

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation

- [x] 1.1 Add `RxIzq`, `RxDer`, `RyArr`, `RyAba` (all `number`) to `SlabResult` interface in `slab-calc.ts`

## Phase 2: Core — Per-Edge Computation

- [x] 2.1 4SIMPLE: `RxIzq=RxDer=CRx·qu·lS`, `RyArr=RyAba=CRy·qu·lS`
- [x] 2.2 1FIXED_X: `RxIzq=RxDer=CRx·qu·lS`, `RyAba=CRey·qu·lS`, `RyArr=CRy·qu·lS`
- [x] 2.3 1FIXED_Y: `RxIzq=CRey·qu·lS`, `RxDer=CRx·qu·lS`, `RyArr=RyAba=CRy·qu·lS`
- [x] 2.4 2FIXED_X: `RxIzq=RxDer=CRex·qA/lx`, `RyArr=RyAba=CRy·qu·lS`
- [x] 2.5 2FIXED_Y: `RxIzq=RxDer=CRx·qu·lS`, `RyArr=RyAba=CRey·qA/ly`
- [x] 2.6 2ADJ: remap CRx→simple X, CRx2→continuous X, CRy→simple Y, CRy0→continuous Y; detect `"continuo"` edges per design mapping
- [x] 2.7 3FIXED/3FIXED_Y: `RxIzq=CRex·qA/lx`, `RxDer=CRx·qu·lS`; `RyArr=CRey·qA/ly`, `RyAba=CRy·qu·lS`
- [x] 2.8 4FIXED: `RxIzq=RxDer=CRex·qA/lx`, `RyArr=RyAba=CRey·qA/ly`
- [x] 2.9 Unidirectional: X-supported → `RxIzq=RxDer=qu·lx/2`; Y-supported → `RyArr=RyAba=qu·ly/2`; unsupported → 0
- [x] 2.10 Update `return` statement and reaction steps to include all 4 per-edge values

## Phase 3: UI — Per-Edge Display

- [x] 3.1 Replace 2 aggregate Rx/Ry cards in `SlabResults.tsx` with 4 per-edge cards (edges: "Izquierdo", "Derecho", "Arriba", "Abajo")
- [x] 3.2 Add `RxIzq !== undefined ? RxIzq.toFixed(2) : "—"` fallback for legacy saves

## Phase 4: Verification

- [x] 4.1 Run `cd client && npm run build` — TypeScript strict mode passes with zero errors
- [x] 4.2 Manual check: symmetric cases verify RxIzq===RxDer (4SIMPLE), 2ADJ remapping swaps correctly per edges[]
