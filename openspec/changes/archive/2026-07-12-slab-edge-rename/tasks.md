# Tasks: Rename Edge Labels & Rewrite detectSharedEdge

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~70-90 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: slab-calc.ts — EdgeIndex & detectSharedEdge

- [x] 1.1 Update `EdgeIndex` comment from `// X=0, X=L, Y=0, Y=L` to `// 0=Izquierdo, 1=Derecho, 2=Arriba, 3=Abajo` (slab-calc.ts:48)
- [x] 1.2 Update `dirName` array in `designSlab()` from `["X=0","X=L","Y=0","Y=L"]` to `["Izquierdo","Derecho","Arriba","Abajo"]` (slab-calc.ts:2314)
- [x] 1.3 Rewrite `detectSharedEdge()` to check 4 canonical facing-edge continuity pairs instead of dimension equality (slab-calc.ts:2424-2464). Remove `eps` tolerance. Use `A.edges[1]/B.edges[0]`, `A.edges[0]/B.edges[1]`, `A.edges[3]/B.edges[2]`, `A.edges[2]/B.edges[3]` pairs

## Phase 2: UI labels & edge selectors

- [x] 2.1 Rename `EDGE_LABELS` in SlabCompat.tsx: `0:"Izquierdo"`, `1:"Derecho"`, `2:"Arriba"`, `3:"Abajo"` (SlabCompat.tsx:7-12)
- [x] 2.2 Remove `{detection.ambiguous && ...}` guard — render edge selectors unconditionally when detection is non-null (SlabCompat.tsx:87)
- [x] 2.3 Add `useEffect` that pre-fills `edgeA`/`edgeB` when `detection` is non-null and `!detection.ambiguous` (SlabCompat.tsx, after `useMemo` block)
- [x] 2.4 Update SlabForm.tsx labels: `"Borde izquierdo (Izquierdo)"`, `"Borde derecho (Derecho)"`, `"Borde superior (Arriba)"`, `"Borde inferior (Abajo)"` (SlabForm.tsx:169-172)

## Phase 3: Spec update

- [x] 3.1 Apply delta spec to main spec at `openspec/specs/slab-compat/spec.md`: replace EdgeIndex mapping in Requirement: EdgeIndex Type, replace detectSharedEdge requirement with continuity-based algorithm, update SlabCompat Screen requirement to reflect always-visible selectors + pre-fill

## Phase 4: Verification

- [x] 4.1 Run `cd client && npm run build` — 3 pre-existing errors in SlabPlan.tsx and SlabResults.tsx (untouched by this change). Zero errors from changed files (slab-calc.ts, SlabCompat.tsx, SlabForm.tsx).
- [x] 4.2 Manual check: labels show Izquierdo/Derecho/Arriba/Abajo in compat selectors and SlabForm
- [x] 4.3 Manual check: detectSharedEdge returns correct pair for 4 continuity combinations
- [x] 4.4 Manual check: edge selectors always visible, pre-fill works for unambiguous detection
