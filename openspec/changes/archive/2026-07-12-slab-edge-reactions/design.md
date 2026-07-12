# Design: Per-Edge Slab Reactions

## Technical Approach

Add 4 per-edge reaction fields (`RxIzq`, `RxDer`, `RyArr`, `RyAba`) to `SlabResult`, compute them inside each Kalmanok branch using the correct formula per coefficient type, display 4 cards in the UI, and keep existing `Rx`/`Ry` for backward compat.

Two formula types govern the computation:
- **CRx/CRy-type** (`R = C · qu · lShort`): used for simple edges and for coefficients without the `e` suffix (CRx, CRy, CRx2, CRy0)
- **CRex/CRey-type** (`R = C · qArea / edgeLength`, where `qArea = qu · lShort²`): used for continuous/fixed edges with the `e` suffix

## Architecture Decisions

### Decision: Per-branch computation with explicit per-edge variables

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline in each `if` branch | Direct, readable, follows existing pattern | **Chosen** |
| Separate `computeEdgeReactions()` helper | Reusable, but obscures branch-specific coefficient availability | Rejected |

**Rationale**: Each table has different coefficient sets — a helper would need a complex union type. Inline computation in each branch matches the existing style and keeps the coefficient-to-edge mapping auditable.

### Decision: 2ADJ coefficient-to-edge mapping

**Choice**: CRx2 maps to the **continuous** X edge, CRx to the **simple** X edge. CRy0 maps to the **continuous** Y edge, CRy to the **simple** Y edge. Remap based on which `edges[]` are `"continuo"`.

**Rationale**: Inspection of coefficient values at ratio=0.5 confirms CRx2=0.967 > CRx=0.35 — the continuous short edge takes more load. Same pattern holds for CRy0 vs CRy. The table convention (continuous at X=0 and Y=0) is remapped to whichever edges the user marks "continuo".

### Decision: Aggressive split for 1FIXED branches

**Choice**: CRx in 1FIXED_X applies equally to both X edges (same `qu·lShort` formula). The Y edges split: `CRey` (adjacent to continuous X edge) gets the higher value, `CRy` gets the lower.

**Rationale**: The 1FIXED_X table provides only one X coefficient — no per-edge X split data. Both X edges get the same value. The table's CRey/CRy distinction is for Y-edge asymmetry caused by the continuous X edge's rotational restraint. Load balance check at ratio=1.0 (CRx=0.166, CRey=0.433, CRy=0.235 → 2×0.166 + 0.433 + 0.235 = 1.0) confirms the per-edge interpretation.

## Per-Branch Edge Reaction Table

| Branch | RxIzq | RxDer | RyArr | RyAba |
|--------|-------|-------|-------|-------|
| 4SIMPLE | CRx·qu·lS | same | CRy·qu·lS | same |
| 1FIXED_X | CRx·qu·lS | same | CRy·qu·lS | CRey·qu·lS |
| 1FIXED_Y | CRey·qu·lS | CRx·qu·lS | CRy·qu·lS | same |
| 2FIXED_X | CRex·qA/lx | same | CRy·qu·lS | same |
| 2FIXED_Y | CRx·qu·lS | same | CRey·qA/ly | same |
| 2ADJ | mapped* | mapped* | mapped* | mapped* |
| 3FIXED | CRex·qA/lx | CRx·qu·lS | CRey·qA/ly | same |
| 3FIXED_Y | CRex·qA/lx | same | CRey·qA/ly | CRy·qu·lS |
| 4FIXED | CRex·qA/lx | same | CRey·qA/ly | same |
| Unidir X | qu·lx/2 | same | 0 | 0 |
| Unidir Y | 0 | 0 | qu·ly/2 | same |

`qA = qu · lShort²`, `lS = lShort`

**2ADJ mapping***: CRx2 → continuous X edge, CRx → simple X edge, CRy0 → continuous Y edge, CRy → simple Y edge. All use `qu·lS` formula. Detect which 2 edges are `"continuo"` and assign accordingly.

## Data Flow

```
User enters slab → designSlab() computes per-edge in branch → SlabResult{ RxIzq, RxDer, RyArr, RyAba }
    → SlabResults.tsx reads fields → 4 cards with edge labels
    → saveSlab() serializes all fields via JSON.stringify
    → loadSlab() retrieves old saves (fields undefined) → UI shows "—"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/slab-calc.ts` | Modify | +4 fields to SlabResult; per-edge computation in 8 Kalmanok branches + unidirectional; return statement updated |
| `client/src/screens/SlabResults.tsx` | Modify | Replace 2 Rx/Ry cards with 4 per-edge cards; handle `undefined` for legacy saves |

## Interfaces / Contracts

```typescript
export interface SlabResult {
  // existing fields unchanged...
  Rx: number;       // keep — aggregate X reaction (backward compat)
  Ry: number;       // keep — aggregate Y reaction (backward compat)
  RxIzq: number;    // NEW: kN/m at edge[0] (Izquierdo)
  RxDer: number;    // NEW: kN/m at edge[1] (Derecho)
  RyArr: number;    // NEW: kN/m at edge[2] (Arriba)
  RyAba: number;    // NEW: kN/m at edge[3] (Abajo)
}
```

UI fallback pattern:
```tsx
{result.RxIzq !== undefined ? result.RxIzq.toFixed(2) : "—"} kN/m
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | Symmetric cases: RxIzq===RxDer, RyArr===RyAba | Pre-computed check values at key ratios |
| Manual | 2ADJ with Izquierdo+Arriba vs Derecho+Abajo | Verify edge remapping swaps values correctly |
| Manual | Legacy save load | Save a slab before the change, reload → "—" displayed |
| Build | TypeScript strict mode | `cd client && npm run build` — no errors |

## Migration / Rollout

No migration required. New fields auto-serialized by `JSON.stringify`. Old saves: fields are `undefined` after `JSON.parse`, UI checks for `undefined` and displays "—". `Rx`/`Ry` remain populated from old data.

## Open Questions

- [ ] Is CRey in 1FIXED_X/Y a distributed edge reaction (qu·lShort) or a corner concentration (qArea/ly)? Current design uses qu·lShort per exploration load-balance check. Verify against original CIRSOC 201-05 table documentation.
