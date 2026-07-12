# Tasks: Slab Support Compatibilization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~308 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full slab compat feature | PR 1 | Single PR, all phases in order |

## Phase 1: Foundation — Mneg Exposure

- [x] 1.1 Add `Mneg?: number` to `DirectionResult` interface in `slab-calc.ts`
- [x] 1.2 Add optional 4th param `Mneg?: number` to `designDir()` signature
- [x] 1.3 Populate `Mneg` in the `DirectionResult` object returned by `designDir()`
- [x] 1.4 Pass `MnegX`/`MnegY` locals to the two `designDir()` call sites (lines 2365–2366)

## Phase 2: Slab Persistence

- [x] 2.1 Add `"losa"` to `SavedBeam.type` union in `storage.ts` AND to `Props.type` union in `SavedBeams.tsx`
- [x] 2.2 Create `SavedSlabData` interface `{ input: SlabInput; result: SlabResult }` in `storage.ts`
- [x] 2.3 Implement `saveSlab(name, input, result): void`
- [x] 2.4 Implement `getSavedSlabs(): SavedBeam[]` — filter by `"losa"`
- [x] 2.5 Implement `loadSlab(id): SavedSlabData | null`
- [x] 2.6 Implement `deleteSlab(id): void` (wrapper around existing `deleteSave`)

## Phase 3: Compat Algorithm

- [x] 3.1 Define `type EdgeIndex = 0 | 1 | 2 | 3` in `slab-calc.ts`
- [x] 3.2 Define `CompatResult` interface in `slab-calc.ts`
- [x] 3.3 Implement `detectSharedEdge(inputA, inputB)` — returns shared direction `"X"|"Y"` or `null` (ambiguous when both match)
- [x] 3.4 Implement `compatibilizeSlabs(slabA, slabB, edgeA, edgeB)`: get Mneg from each DirectionResult at shared edge, compute ratio, if ≥0.6 average, else modify weaker slab input → `designSlab()` with edge set to `"simple"`

## Phase 4: SlabCompat Screen UI

- [x] 4.1 Create `client/src/screens/SlabCompat.tsx`: load saved slabs on mount, two dropdowns for A/B, auto-detect shared edge, manual edge selector when ambiguous, "Compatibilizar" button, results panel showing ratio/verdict/Mneg/Mcompat or recalculated result
- [x] 4.2 Add "Guardar" button to `SlabResults.tsx` that prompts for a name and calls `saveSlab()`

## Phase 5: Wiring

- [x] 5.1 Import `SlabCompat` and add route `{ path: "/slab-compat", Component: SlabCompat }` in `main.tsx`
- [x] 5.2 Add NavBar link for "Compat. Losas" in `main.tsx`

## Phase 6: Verification

- [x] 6.1 Run `cd client && npm run build` — TypeScript strict mode must pass with zero new errors
- [ ] 6.2 Manual test: design two adjacent slabs with shared edge, save both, open /slab-compat, verify edge detection and compat result
