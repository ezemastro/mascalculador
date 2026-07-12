# Proposal: Slab Support Compatibilization

## Intent

Enable post-hoc compatibilización of support moments between two independently-designed adjacent RC slabs per CIRSOC 201-05. Users calculate each slab separately (continuous edges treated as fixed), then pair saved results via a new tool that detects the shared edge and applies compatibility rules.

## Scope

### In Scope
- `MnegX`/`MnegY` optional fields on `SlabResult`, populated by `designSlab()`
- `"losa"` type added to `SavedBeam` union + `saveSlab`/`getSavedSlabs` helpers
- `compatibilizeSlabs()` pure function: auto-detect shared edge, ratio threshold (0.6), averaging or simple-support recalculation
- `SlabCompat` screen: select two saved slabs, visualize shared edge, trigger compat, show results
- Route `/slab-compat` + NavBar link

### Out of Scope
- Multi-slab chain (>2 slabs)
- In-design compatibilización (V1 is post-hoc only)
- PDF/print of compatibilized results

## Capabilities

### New Capabilities
- `slab-persistence`: Save/load individual slab design results with full SlabInput + SlabResult
- `slab-compat`: Post-hoc compatibilización of two independent slabs, auto-detecting shared edge and applying CIRSOC 201-05 rules

### Modified Capabilities
- `slab-analysis`: `SlabResult` gains optional `MnegX`/`MnegY`; existing "Support Compatibilización" spec requirement is fulfilled by `compatibilizeSlabs()`

## Approach

**Foundation**: Expose negative moments (currently local vars inside `designSlab()`) as optional fields on `SlabResult`. Backward-compatible — no existing consumer breaks.

**Persistence**: Extend `SavedBeam`/`localStorage` pattern. Add `"losa"` type, wrap `saveBeam`/`listSaves` with typed slab helpers.

**Algorithm**: New `client/src/lib/slab-compat.ts`. Compares `lx`/`ly` to auto-detect shared edge (manual fallback). Ratio ≥ 0.6 → average; < 0.6 → recalculate slab with edge changed to `"simple"` via `designSlab()`.

**UI**: New screen at `/slab-compat` — dropdown selectors for saved slabs, edge visualization, result panel with before/after comparison.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/lib/slab-calc.ts` | Modified | Add MnegX/Y to SlabResult, populate in designSlab() |
| `client/src/lib/storage.ts` | Modified | Add `"losa"` type, slab save/load helpers |
| `client/src/lib/slab-compat.ts` | New | compatibilizeSlabs() + edge detection |
| `client/src/screens/SlabCompat.tsx` | New | Screen: select, visualize, compute compat |
| `client/src/screens/SlabResults.tsx` | Modified | "Guardar" button |
| `client/src/main.tsx` | Modified | Route + NavBar link |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mneg undefined for simple-supported edges | Medium | Guard: skip compat if either edge lacks Mneg |
| User pairs slabs that don't share an edge | Low | Auto-detect fails → manual selector |
| Recalculated slab shows larger span moments | Low | Expected; show before/after comparison |

## Rollback Plan

Revert commit. `localStorage` keys are additive — no migration needed. New `SlabResult` fields are optional; removing `SlabCompat` import and route restores prior state without data corruption.

## Dependencies

None — self-contained within existing slab calc and storage infrastructure.

## Success Criteria

- [ ] User can save slab results with name + full input/result
- [ ] Two saved slabs → shared edge detected → CIRSOC compat rules applied
- [ ] Ratio ≥ 0.6 → averaged moment; ratio < 0.6 → recalculated slab shown
- [ ] Existing `/slab` and `/slab-results` routes unchanged
- [ ] `tsc -b` passes with zero new errors
