## Exploration: Slab Support Compatibilization (slab-compat)

### Current State

The app calculates reinforced concrete slabs (losas de H°A°) using CIRSOC 201-05. A single slab can be designed via `designSlab()` in `slab-calc.ts` with user-specified edge conditions. There is **no persistence of slab results**, no way to reference two slabs together, and no compatibility algorithm implemented. The compatibilización TODO at line 2306 of `slab-calc.ts` says:

> *"TODO: When adjacent slab data becomes available, perform full compatibilización (average support moments when M2/M1 ≥ 0.6, else re-calc as simple support)."*

---

### Affected Areas

| Path | Why It's Affected |
|------|-------------------|
| `client/src/lib/storage.ts` | Need to add `"losa"` to `SavedBeam.type` union and a save/load pattern for slabs |
| `client/src/lib/slab-calc.ts` | Need to export negative moments (`MnegX`, `MnegY`) from `DirectionResult` — currently local-only; plus new `compatibilizeSlabs()` function |
| `client/src/screens/SlabResults.tsx` | Need a "Guardar" button to persist slab results |
| `client/src/screens/SlabForm.tsx` | `SlabState` needs an ID/name field for post-save referencing |
| `client/src/components/SavedBeams.tsx` | Need to support `"losa"` type filter; minor adaptation or a new component |
| `client/src/main.tsx` | Add `/slab-compat` route and `SlabCompat` component import |
| `client/src/screens/SlabCompat.tsx` | **New file** — the compat view: select two saved slabs, detect shared edge, show results |
| `client/src/lib/slab-compat.ts` | **New file** — pure logic for compatibilización algorithm |
| `openspec/specs/slab-analysis/spec.md` | The existing spec already defines compatibilización requirements (lines 31-36) |

---

### Approaches

#### Part A — Persistence: Adding `"losa"` type

The existing `SavedBeam` system in `storage.ts` uses a flat `localStorage` array with `type: "acero" | "hormigon" | "columna" | "cartel"`. Adding `"losa"` is straightforward.

**What to store**: `{ input: SlabInput, result: SlabResult, name: string }` in the `data` field. Both interfaces are fully JSON-serializable.

**Save pattern** (from `ConcreteForm.tsx`): `prompt("Nombre para guardar...")` → `saveBeam(name, "losa", { input, result })`.

**Load pattern**: `listSaves().filter(s => s.type === "losa")` → cast `data` → navigate with that state.

**Effort**: Low — 3 files: `storage.ts` (type union), `SlabResults.tsx` (save button), `SlabForm.tsx` (load via SavedBeams)

#### Part B — Data Model: Exposing negative moments

**Current problem**: `DirectionResult` has NO `Mneg` field. Negative moments (`MnegX`, `MnegY`) are computed as local variables inside `designSlab()` and only logged in `steps[]`. The compat algorithm needs them.

**Options**:

1. **Add `Mneg` to `DirectionResult`** (recommended) — Add `MnegX: number` and `MnegY: number` to `SlabResult` directly (not per-direction), since negative moment is per-edge, not per-span direction. This is the cleanest approach: `SlabResult` gets `MnegX: number` and `MnegY: number`.

2. **Extract from steps** — Parse the steps string array. Fragile and terrible, don't do this.

3. **Store entire `designSlab` intermediate state** — Too coupled to internal implementation.

**Recommended**: Add `MnegX` and `MnegY` to `SlabResult`. Update `designSlab()` to populate them.

**Effort**: Medium — modifies `SlabResult` interface (impacts results screen), adds assignment in ~7 branches of `designSlab()`.

#### Part C — Navigation

Adding a route is trivial:
- Import `SlabCompat` component
- Add `{ path: "/slab-compat", Component: SlabCompat }` to the router's children array
- Add `<Link to="/slab-compat">Compatibilizar</Link>` to NavBar

**Effort**: Low

#### Part D — UI for Compat View

**Option A: Manual edge matching (V1)** — User selects which edge of slab A connects to which edge of slab B via dropdowns. Simpler to build, works for any slab pair regardless of geometry.

**Option B: Auto-detect shared edge** — Compare lx/ly dimensions to detect which edges share a boundary. More complex but better UX. Could do both (auto-detect as default, allow manual override).

**Recommended**: Start with **Option B (auto-detect)** since the geometry comparison is straightforward: if `lx_A === lx_B` they share their X-edges; if `ly_A === ly_B` they share their Y-edges. If both match, pick by adjacency. Fallback to manual selection.

**UI Layout**: 
- Left panel: Slab A plan view (reuse `SlabPlan` component)
- Right panel: Slab B plan view
- Center: Shared edge indicator, ratio display
- Result: M_compat and/or "Recalculating slab X..." message
- "Aplicar compatibilización" button

**Effort**: Medium-High — new screen component, edge selection UX, result display

#### Part E — Compatibility Algorithm

The core function signature:

```typescript
interface CompatibilityResult {
  compatible: boolean;
  ratio: number;
  Mcompat: number | null; // average moment if compatible
  recalculated: boolean; // true if we re-ran one slab
  recalculatedSlab: "A" | "B" | null;
  recalculatedResult: SlabResult | null;
  steps: string[];
}

function compatibilizeSlabs(
  slabA: SlabResult,
  slabB: SlabResult,
  inputA: SlabInput,
  inputB: SlabInput,
  edgeA: EdgeIndex, // 0=X0, 1=XL, 2=Y0, 3=YL
  edgeB: EdgeIndex,
): CompatibilityResult
```

**Algorithm**:
1. Get M_neg from each slab at the shared edge
   - Edge 0 or 1 (X edges) → `slab.MnegX`
   - Edge 2 or 3 (Y edges) → `slab.MnegY`
2. `big = max(MnegA, MnegB)`, `small = min(MnegA, MnegB)`
3. `ratio = small / big`
4. If `ratio >= 0.6` → compatible → `Mcompat = (MnegA + MnegB) / 2`
5. If `ratio < 0.6` → **not compatible** → identify which slab has `small` moment
   - Modify its `SlabInput` changing that edge to `"simple"`
   - Re-run `designSlab()` with modified input
   - Return new result as `recalculatedResult`
6. Both slabs keep their span moments (Mx, My) unchanged

**Important nuance**: After re-calculation with simple support, the span moment of the recalculated slab will INCREASE (since the edge is no longer fixed). This is expected behavior — the user needs to see the updated reinforcement requirements.

**Edge cases**:
- What if both edges are already "simple"? → Can't happen in compat context (they'd already be simple)
- What if the shared edge is "free"? → Invalid state, shouldn't reach compat
- What about slabs with different dimensions? → Auto-detect fails, manual selection required

**Effort**: Medium — pure function, testable, ~80 lines of logic plus helpers

#### Part F — Storage Integration

Create helper functions in `storage.ts`:

```typescript
type SavedBeam = {
  id: string;
  name: string;
  type: "acero" | "hormigon" | "columna" | "cartel" | "losa";
  date: string;
  data: Record<string, unknown>;
};

// Slab-specific helpers
function saveSlab(name: string, input: SlabInput, result: SlabResult): SavedBeam;
function getSavedSlabs(): { beam: SavedBeam, input: SlabInput, result: SlabResult }[];
```

**Effort**: Low — wrapper around existing `saveBeam`/`listSaves`

---

### Recommendation

**Phase 1 — Foundation (low effort, no-breaking):**
1. Add `MnegX` and `MnegY` to `SlabResult` in `slab-calc.ts`
2. Add `"losa"` to the `SavedBeam.type` union in `storage.ts`
3. Add "Guardar" button to `SlabResults.tsx` (follow beam save pattern)
4. Make `SavedBeams` component accept `"losa"` type

**Phase 2 — Core Logic:**
5. Create `client/src/lib/slab-compat.ts` with `compatibilizeSlabs()` function
6. Create auto-detect logic for shared edges

**Phase 3 — UI:**
7. Create `client/src/screens/SlabCompat.tsx` — the compat view
8. Add `/slab-compat` route to `main.tsx` + NavBar link
9. Wire edge selection and "Aplicar compatibilización" flow

**Deliver as**: Single PR (~250-350 lines), or 2 chained PRs (Phase 1 → Phases 2+3)

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `DirectionResult` change breaks existing results display | Medium | Medium | Add MnegX/MnegY as optional at first, or update display to show them |
| User confusion about manual edge matching | Low | Low | Auto-detect when possible, show SVG plan with highlighted shared edge |
| Re-calculated slab has very different reinforcement | Medium | Low | Show before/after comparison — this is expected behavior |
| Slab name collision in localStorage | Low | Low | Existing ID system handles this via `Date.now() + random` |

---

### Ready for Proposal

**Yes.** The scope is well-understood, the codebase patterns are clear, and the implementation can be broken into phases.

The orchestrator should tell the user:
- The changes are additive — no existing functionality breaks
- Phase 1 is low-risk infrastructure (add `"losa"` type, expose Mneg)
- The compat algorithm follows CIRSOC 201-05 exactly as specified
- V1 uses auto-detect + manual fallback for shared edge identification
- Re-calculation updates one slab's edge from fixed to simple and re-runs `designSlab()`
