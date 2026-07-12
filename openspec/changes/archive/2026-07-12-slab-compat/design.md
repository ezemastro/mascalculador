# Design: Slab Support Compatibilization

## Technical Approach

Add negative moment exposure to `DirectionResult`, slab persistence to `storage.ts`, and a `compatibilizeSlabs()` pure function that applies CIRSOC 201-05 rules (ratio ≥ 0.6 → average, otherwise → recalculate with edge as simple support). A new `/slab-compat` screen ties it together: select two saved slabs, auto-detect shared edge, trigger compat.

No new files beyond the screen — compat logic stays in `slab-calc.ts` to keep the domain cohesive.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Mneg into DirectionResult | A) Pass Mneg as parameter to `designDir()` | Clean signature, one arg change | **A** |
| | B) Mutate returned object after call | Hacky, breaks purity assumption | |
| CompatibilizeSlabs location | A) New file `slab-compat.ts` | More modular, extra import | **B** |
| | B) In `slab-calc.ts` | Co-located with domain, reuses `designSlab` | |
| Save slab via existing `saveBeam` | A) Dedicated `saveSlab()` wrapper | Clean API, uses same localStorage key | **A** |
| | B) Call `saveBeam` directly from screens | Leaks storage schema to UI | |
| SlabCompat screen data source | A) Use `SavedBeams` component | Works for listing, loses typed data | **B** |
| | B) Call `getSavedSlabs()` directly | Full `SlabInput`+`SlabResult` access, needed for compat | |

## Data Flow

```
SlabResults ──saveSlab()──▶ localStorage ──getSavedSlabs()──▶ SlabCompat
                                                                │
                                                    compatibilizeSlabs(A, B, edgeA, edgeB)
                                                                │
                                              ┌─────────────────┴─────────────────┐
                                         ratio ≥ 0.6                        ratio < 0.6
                                              │                                    │
                                         Mcompat = avg                     designSlab(modifiedInput)
                                                                               with edge="simple"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/slab-calc.ts` | Modify | Add `Mneg?: number` to `DirectionResult`, pass `Mneg` as 4th param to `designDir()`, add `compatibilizeSlabs()` + `detectSharedEdge()` |
| `client/src/lib/storage.ts` | Modify | Add `"losa"` to type union, `SavedSlabData` interface, `saveSlab/getSavedSlabs/loadSlab/deleteSlab()` |
| `client/src/components/SavedBeams.tsx` | Modify | Add `"losa"` to Props type union |
| `client/src/screens/SlabCompat.tsx` | Create | Slab compat screen: two selectors, auto-detect panel, result panel |
| `client/src/screens/SlabResults.tsx` | Modify | Add "Guardar" button that calls `saveSlab()` |
| `client/src/main.tsx` | Modify | Import + route `/slab-compat` + NavBar link |

## Interfaces / Contracts

```typescript
// slab-calc.ts — added to DirectionResult
Mneg?: number; // kN·m/m, undefined for simple-supported directions

// slab-calc.ts — added signature
function designDir(Mu: number, _dir: string, dB: number, Mneg?: number): DirectionResult

// slab-calc.ts — new exports
type EdgeIndex = 0 | 1 | 2 | 3; // X=0, X=L, Y=0, Y=L
interface CompatResult {
  compatOK: boolean; ratio: number;
  MnegA: number; MnegB: number;
  Mcompat?: number;
  recalculatedResult?: SlabResult;
  recalculatedSlab?: "A" | "B";
  message: string;
}
function compatibilizeSlabs(
  slabA: { input: SlabInput; result: SlabResult },
  slabB: { input: SlabInput; result: SlabResult },
  edgeA: EdgeIndex, edgeB: EdgeIndex,
): CompatResult

// storage.ts
interface SavedSlabData { input: SlabInput; result: SlabResult; }
function saveSlab(name: string, input: SlabInput, result: SlabResult): void
function getSavedSlabs(): SavedBeam[]
function loadSlab(id: string): SavedSlabData | null
function deleteSlab(id: string): void
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | Type errors, import resolution | `cd client && npm run build` |
| Manual | Save two slabs → open /slab-compat → verify auto-detect and compat | Full UI walkthrough |

No test runner configured — build verification is the quality gate.

## Migration / Rollout

No migration required. New `localStorage` records use the same key (`mascalculador_beam_saves`), `Mneg` is optional (back-compat), new route is additive. Rollback: revert commit.

## Open Questions

- None — all decisions resolved in this design.
