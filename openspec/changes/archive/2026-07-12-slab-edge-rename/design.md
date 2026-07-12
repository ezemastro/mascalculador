# Design: Rename Edge Labels & Rewrite detectSharedEdge

## Technical Approach

Rewrite `detectSharedEdge` to check **facing-edge continuity conditions** (4 canonical pairs) instead of dimension equality. Rename `EdgeIndex` labels from coordinate-based (`X=0`, `X=L`, `Y=0`, `Y=L`) to orientation-based (`Izquierdo`, `Derecho`, `Arriba`, `Abajo`). Make edge selectors always visible in SlabCompat, with pre-fill when detection is unambiguous.

Edge indices (0-3) are unchanged — labels and detection algorithm are the only changes. `compatibilizeSlabs` continues using `edgeA <= 1` for direction, unaffected.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Continuity-based detection (facing-edge pairs) | Requires "continuo" edges to be correctly set; no false matches from coincidental dimensions | **Chosen** — semantically correct |
| Keep dimension-based + add continuity filter | More conservative but still has false-positive dimension matches | Rejected — continuity alone is sufficient |
| Hide edge selectors for unambiguous detection | Reduces UI noise but blocks manual override | Rejected — per spec, selectors always visible |

## Data Flow

```
SlabCompat selectors onChange
        │
        ▼
detectSharedEdge(slabA.input, slabB.input)
        │
        ├── 1 pair → unambiguous → pre-fill useEffect → setEdgeA/B
        ├── 2+ pairs → ambiguous → selectors show all candidates
        └── 0 pairs → null → "Compatibilizar" disabled
                               │
                               ▼
                       compatibilizeSlabs(slabA, slabB, edgeA, edgeB)
                               │
                               ▼
                        CompatResult (ratio, Mneg, Mcompat...)
```

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `client/src/lib/slab-calc.ts` | Modify | 48, 2313, 2424-2464 | EdgeIndex comment; dirName labels; rewrite detectSharedEdge |
| `client/src/screens/SlabCompat.tsx` | Modify | 7-12, 83-107 | EDGE_LABELS rename; remove ambiguous guard; add pre-fill useEffect |
| `client/src/screens/SlabForm.tsx` | Modify | 169-172 | Border condition labels (keep parentheses for context) |
| `client/src/components/SlabPlan.tsx` | None | — | SVG drawing order already matches index mapping |

## Key Implementation Details

### detectSharedEdge new algorithm (pseudocode)

```
pairs = []
if A.edges[1]==="continuo" && B.edges[0]==="continuo" → X, edgeA:1, edgeB:0
if A.edges[0]==="continuo" && B.edges[1]==="continuo" → X, edgeA:0, edgeB:1
if A.edges[3]==="continuo" && B.edges[2]==="continuo" → Y, edgeA:3, edgeB:2
if A.edges[2]==="continuo" && B.edges[3]==="continuo" → Y, edgeA:2, edgeB:3
return 1 pair → {direction, ambiguous:false, edgesA:[eA], edgesB:[eB], message}
       2+ pairs → {direction:"X", ambiguous:true, edgesA:[...], edgesB:[...], message}
       0 pairs → null
```

### SlabCompat pre-fill (new useEffect)

```tsx
useEffect(() => {
  if (detection && !detection.ambiguous) {
    setEdgeA(detection.edgesA[0]);
    setEdgeB(detection.edgesB[0]);
  }
}, [detection]);
```

Selectors rendered unconditionally (remove `{detection.ambiguous && ...}` wrapper). The pre-fill updates only when detection is unambiguous; user can override manually afterwards.

### EDGE_LABELS mapping

| Index | Old | New |
|-------|-----|-----|
| 0 | `X = 0` | `Izquierdo` |
| 1 | `X = L` | `Derecho` |
| 2 | `Y = 0` | `Arriba` |
| 3 | `Y = L` | `Abajo` |

### SlabForm label mapping

Old → New:
- `Borde izquierdo (X=0)` → `Borde izquierdo (Izquierdo)`
- `Borde derecho (X=L)` → `Borde derecho (Derecho)`
- `Borde superior (Y=0)` → `Borde superior (Arriba)`
- `Borde inferior (Y=L)` → `Borde inferior (Abajo)`

Note: keep parenthetical references for user orientation during transition.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Manual | detectSharedEdge edge cases | Test 4 canonical pairs, 2+ simultaneous, none |
| Manual | compatibilizeSlabs with new edges | Verify same-edge-index pairs produce identical CompatResult |
| Manual | SlabCompat pre-fill UX | Select matching slabs, verify auto-fill, verify manual override |
| Manual | Label consistency | Check EDGE_LABELS, SlabForm labels, dirName validation messages |
| Build | TypeScript | `cd client && npm run build` — zero errors |

## Migration / Rollout

No migration required. No DB changes. No data migration. Rollback: revert 3 source files to previous commit.

## Open Questions

None.
