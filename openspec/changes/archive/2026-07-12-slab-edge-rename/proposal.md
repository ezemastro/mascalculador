# Proposal: Rename Edge Labels & Rewrite detectSharedEdge

## Intent

`detectSharedEdge` compares `lx`/`ly` dimensions, which produces false matches for slabs with coincidental dimensions but different continuity. Edge labels (`X=0`, `X=L`, `Y=0`, `Y=L`) are cryptic for structural engineers. Edge selectors in SlabCompat are hidden when detection is "unambiguous," blocking manual overrides.

## Scope

### In Scope
- Rewrite `detectSharedEdge` to check facing-edge **continuity conditions** instead of dimension equality
- Rename `EdgeIndex` labels to orientation-based: Izquierdo / Derecho / Arriba / Abajo
- Make edge selectors **always visible** in SlabCompat (not only when ambiguous)
- Update `dirName` array in `designSlab()` validation messages
- Update slab form labels in SlabForm.tsx
- Update EDGE_LABELS in SlabCompat.tsx
- Update `slab-compat` spec (EdgeIndex + detectSharedEdge requirements)

### Out of Scope
- SVG drawing order in SlabPlan.tsx (current order already matches Option A mapping)
- `compatibilizeSlabs` logic (unchanged)
- Archived specs
- User-facing edge labels in print views

## Capabilities

### Modified Capabilities
- `slab-compat`: EdgeIndex labels change from coordinate to orientation; detectSharedEdge switches from dimension-based to continuity-based detection; edge selectors become always-visible

## Approach

**detectSharedEdge rewrite**: Check paired facing-edge continuity:
- X-axis: `A.edges[1]==="continuo" && B.edges[0]==="continuo"` (A left of B) OR reverse (A right of B)
- Y-axis: `A.edges[3]==="continuo" && B.edges[2]==="continuo"` (A below B) OR reverse (A above B)
- Auto-detect when exactly one pair is valid; ambiguous when multiple; null when none

**Label rename** (Option A mapping):

| Index | Old | New | SVG position |
|-------|-----|-----|-------------|
| 0 | X=0 | Izquierdo | Left vertical |
| 1 | X=L | Derecho | Right vertical |
| 2 | Y=0 | Arriba | Top horizontal |
| 3 | Y=L | Abajo | Bottom horizontal |

This mapping matches the existing SlabPlan.tsx SVG drawing order — no SVG changes needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/lib/slab-calc.ts` | Modified | EdgeIndex comment (L48), dirName array (L2313), detectSharedEdge (L2424-2464) |
| `client/src/screens/SlabCompat.tsx` | Modified | EDGE_LABELS (L7-12), remove `{detection.ambiguous &&}` guard (L87) |
| `client/src/screens/SlabForm.tsx` | Modified | Border condition labels (L169-172) |
| `client/src/components/SlabPlan.tsx` | None | SVG order unchanged — verified compatible |
| `openspec/specs/slab-compat/spec.md` | Modified | EdgeIndex and detectSharedEdge requirements |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Continuity-based detection produces different results for existing slab pairs | Low | Users select edge manually if auto-detect is wrong; no data migration needed |
| Label rename confuses returning users | Low | Spanish orientation labels are more intuitive than coordinate notation |
| `compatibilizeSlabs` uses `edgeA <= 1` for direction (index-based) | Low | Indices unchanged — only labels rename |

## Rollback Plan

Revert the 3 source files + spec to previous commit. No data migration, no DB changes.

## Dependencies

None.

## Success Criteria

- [ ] `detectSharedEdge` returns correct facing-edge pairs for slabs with matching continuity
- [ ] Edge selectors visible in SlabCompat regardless of detection ambiguity
- [ ] Existing `compatibilizeSlabs` produces identical results with same edge indices
- [ ] `cd client && npm run build` passes with zero errors
