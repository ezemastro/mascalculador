# Proposal: Expose Per-Edge Slab Reactions

## Intent

The Kalmanok tables have per-edge reaction coefficients (CRx, CRy, CRex, CRey, CRx2, CRy0), but the code discards them — only aggregate `Rx` and `Ry` are computed. For asymmetric support conditions (2ADJ, 3FIXED, 1FIXED_X, 1FIXED_Y), the per-edge distinction is lost. Structural engineers need per-edge reactions to design support beams and verify load paths.

## Scope

### In Scope
- Add `RxIzq`, `RxDer`, `RyArr`, `RyAba` (kN/m) to `SlabResult`
- Compute per-edge reactions from existing table coefficients in all 8 Kalmanok branches + unidirectional case
- Display 4 edge-reaction cards in SlabResults UI
- **Keep** existing `Rx: number, Ry: number` for backward compatibility

### Out of Scope
- Per-edge moments — already covered by `Mneg` in `DirectionResult`
- Edge annotation on SlabPlan SVG (future enhancement)
- Storage migration — new fields auto-serialized, old saves load with `undefined` (UI treats as `N/A`)

## Capabilities

### New Capabilities
None — modifying existing slab behavior.

### Modified Capabilities
- `slab-analysis` — `SlabResult` gains per-edge reaction fields; reaction computation branches emit all 4 edge values using correct formula per coefficient type
- `slab-persistence` — new fields serialized automatically; old saves gracefully degrade (existing `Rx`/`Ry` unaffected)

## Approach

Follow the per-edge formula table from exploration:

- **CRx/CRy-type**: `R_edge = C · qu · lShort` (used for simple-edge and aggregate coefficients)
- **CRex/CRey-type**: `R_edge = C · qArea / edgeLength` (used for fixed/continuous-edge coefficients)
- **Symmetric edges** (both edges same type in a direction): split aggregate equally: `R_each = R_total / 2`
- **2ADJ (2 adjacent continuous)**: `RxIzq = CRx·qu·lS, RxDer = CRx2·qu·lS, RyArr = CRy0·qu·lS, RyAba = CRy·qu·lS`

The computation lives in each `interpolateKalmanok*` branch, not in a separate function — the mapping between coefficients and edges is table-specific. Unidirectional case: supported edges get `qu·span/2` each.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/slab-calc.ts` SlabResult | Modified | +4 `number` fields |
| `lib/slab-calc.ts` calc branches | Modified | ~8 branches + unidirectional: compute per-edge |
| `screens/SlabResults.tsx` | Modified | Replace 2 Rx/Ry cards with 4 edge cards |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 2ADJ coefficient-to-edge swap when fixed edges are at Derecho+Abajo | Low | Verify `edges[]` mapping; CRx2/CRy0 always map to X=0/Y=0 fixed edges per table convention |
| Formula type mismatch (CRx vs CRex) | Low | Exploration table documents correct formula per coefficient type; verify in design |
| Old saves with undefined per-edge fields crash UI | Low | UI fallback: undefined → show "—" |

## Rollback Plan

Revert SlabResult to 2-field interface, remove per-edge computation blocks, restore original 2-card UI. One commit reversal.

## Dependencies

None — uses existing table data and coefficients.

## Success Criteria

- [ ] All 8 Kalmanok branches produce 4 per-edge reaction values
- [ ] Symmetric cases: `RxIzq === RxDer` and `RyArr === RyAba`
- [ ] 2ADJ/3FIXED/1FIXED_x branches use both CRx/CRx2 and CRy/CRy0 coefficient pairs
- [ ] Sum of per-edge reactions in X direction ≈ total X reaction from aggregate coefficients
- [ ] Unidirectional case: supported edges each get half the total
- [ ] UI shows 4 edge-labeled reaction cards (Izq/Der/Arr/Aba)
- [ ] Old saved slabs load without errors (per-edge fields undefined → display "—")
