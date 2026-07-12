## Exploration: slab-edge-reactions

### Current State

The Kalmanok coefficient tables in `slab-calc.ts` contain per-edge reaction coefficients (CRx, CRy, CRex, CRey, CRy0, CRx2) but the current code discards per-edge specificity — it computes only two aggregate values `Rx` and `Ry` (reaction in kN/m for the X and Y directions). For symmetric support conditions (both edges in a direction have the same boundary type), Rx = Rx_Izq = Rx_Der and Ry = Ry_Arr = Ry_Aba, so nothing is lost. But for asymmetric support conditions (one edge fixed, the opposite simple), the code loses the per-edge distinction and uses whichever coefficient is available, often ignoring the other.

Edge mapping (per slab-edge-rename convention):
- edges[0] = Izquierdo (X=0) → Rx_Izq
- edges[1] = Derecho (X=Lx) → Rx_Der
- edges[2] = Arriba (Y=0) → Ry_Arr
- edges[3] = Abajo (Y=Ly) → Ry_Aba

### Kalmanok Table Interface Inventory

#### 1. KALMANOK_SIMPLE (4 simply supported edges) — line 66
- Coeffs: CRx, CRy
- Both X-edges symmetric (simple) → Rx_Izq = Rx_Der = CRx · qu · lShort
- Both Y-edges symmetric (simple) → Ry_Arr = Ry_Aba = CRy · qu · lShort
- **Currently**: `Rx = cf.CRx * qu * lShort; Ry = cf.CRy * qu * lShort`
- **Per-edge data NOT lost**: current Rx and Ry ARE per-edge values

#### 2. KALMANOK_1FIXED_X (1 continuous in X, 3 simple) — line 96
- Coeffs: CRx, CRey, CRy
- CRx → per-edge for both X-direction edges (symmetric — both simple)
- CRey → Y-edge continuous side
- CRy → opposite Y-edge (simple side)
- **Currently**: `Rx = cf.CRx * qu * lShort; Ry = cf.CRy * qu * lShort`
- **Per-edge data lost**: CRey (the continuous Y-edge reaction) is completely discarded

#### 3. KALMANOK_1FIXED_Y (1 continuous in Y, 3 simple) — line 296
- Coeffs: CRy, CRey, CRx (same set as 1FIXED_X, reordered)
- CRy → per-edge for both Y-direction edges
- CRey → X-edge continuous side
- CRx → opposite X-edge (simple side)
- **Currently**: `Rx = cf.CRx * qu * lShort; Ry = cf.CRy * qu * lShort`
- **Per-edge data lost**: CRey (the continuous X-edge reaction) is discarded

#### 4. KALMANOK_2FIXED_X (2 opposite continuous in X) — line 498
- Coeffs: CRy, CRex
- CRy → simple Y edges (both symmetric)
- CRex → both X-edges (continuous, symmetric) — Rx_Izq = Rx_Der = CRex · qArea / lx
- **Currently**: `Rx = (cf.CRex * qArea) / lx; Ry = cf.CRy * qu * lShort`
- **Per-edge data NOT lost** (both X-edges are symmetric fixed, both Y-edges are symmetric simple)

#### 5. KALMANOK_2FIXED_Y (2 opposite continuous in Y) — line 914
- Coeffs: CRx, CRey (mirror of 2FIXED_X)
- CRx → simple X edges (both symmetric)
- CRey → both Y-edges (continuous, symmetric)
- **Currently**: `Ry = (cf.CRey * qArea) / ly; Rx = cf.CRx * qu * lShort`
- **Per-edge data NOT lost** (mirror of 2FIXED_X)

#### 6. KALMANOK_2ADJ (2 adjacent continuous X=0,Y=0) — line 670
- Coeffs: CRx, CRy0, CRx2, CRy
- CRx → simple X-edge (X=Lx, edge[1])
- CRx2 → fixed X-edge (X=0, edge[0])
- CRy → simple Y-edge (Y=Ly, edge[3])
- CRy0 → fixed Y-edge (Y=0, edge[2])
- **Currently**: `Rx = cf.CRx * qu * lShort; Ry = cf.CRy * qu * lShort`
- **Per-edge data LOST**: CRy0 and CRx2 are completely discarded. Only the simple-side reactions are used, ignoring the adjacent continuous edges' larger reactions.

#### 7a. KALMANOK_3FIXED (3 continuous, X-simple) — line 1094
- Coeffs: CRex, CRx, CRey
- CRex → continuous X-edges
- CRx → simple X-edge
- CRey → continuous Y-edge
- **Currently**: `Rx = (cf.CRex * qArea) / lx; Ry = (cf.CRey * qArea) / ly`
- **Per-edge data LOST**: CRx (the simple X-edge reaction) is discarded — Rx uses CRex which covers both fixed X-edges

#### 7b. KALMANOK_3FIXED_Y (3 continuous, Y-simple) — line 1316
- Coeffs: CRex, CRey, CRy (mirror of 3FIXED)
- CRex → continuous X-edge
- CRey → continuous Y-edges
- CRy → simple Y-edge
- **Currently**: `Rx = (cf.CRex * qArea) / lx; Ry = (cf.CRey * qArea) / ly`
- **Per-edge data LOST**: CRy (the simple Y-edge reaction) is discarded

#### 8. KALMANOK_4FIXED (4 continuous) — line 1539
- Coeffs: CRex, CRey
- Both X-edges symmetric (continuous) → Rx_Izq = Rx_Der = CRex · qArea / lx
- Both Y-edges symmetric (continuous) → Ry_Arr = Ry_Aba = CRey · qArea / ly
- **Currently**: `Rx = (cf.CRex * qArea) / lx; Ry = (cf.CRey * qArea) / ly`
- **Per-edge data NOT lost** (all 4 edges continuous, symmetric per direction)

### Reaction Calculation Code (lines 2258-2303)

**Common pattern**: Each branch uses `interpolateKalmanok*` to get coefficients, then assigns `Rx` and `Ry` — typically choosing one coefficient per direction. For tables with asymmetric support conditions, the code hardcodes which coefficient to use, ignoring the others.

**Formula types observed**:
1. `R = C · qu · lShort` — used for CRx/CRy type coefficients (simple/aggregate edge reactions)
2. `R = C · qArea / edgeLength` — used for CRex/CRey type coefficients (fixed/continuous edge reactions), where qArea = qu · lShort²

**The two formula types produce different values for the same coefficient set**, which must be handled correctly when splitting per-edge reactions.

### SlabResult Interface & UI (lines 35-46, SlabResults.tsx)

**Current SlabResult:**
```typescript
interface SlabResult {
  d: number; h: number; qu: number;
  x: DirectionResult; y: DirectionResult;
  distX: DirectionResult; distY: DirectionResult;
  Rx: number; Ry: number;  // ← aggregate per-direction reactions
  steps: string[];
}
```

**Current UI (SlabResults.tsx lines 190-203):**
Shows Rx and Ry in two grid cards. DirSection shows Mu, AsReq per direction. No per-edge display.

### DirSection Component (line 24, inline in SlabResults.tsx)

DirSection receives `label`, `dir: DirectionResult`, `dist: DirectionResult`. It displays Mu, AsReq, and a bar-diameter/spacing selector. Moments are NOT shown per-edge — only the span moment (Mu) and optionally Mneg in the step trace. The question asks if moments should also be per-edge. **Moments are already split** (MnegX/MnegY hold continuous-edge negative moments), but they're not displayed in the summary cards — only in the step trace. Moments should remain as-is: the design already separates positive span moment (Mu) from negative support moment (Mneg). The missing piece is reactions.

### Affected Areas

- `client/src/lib/slab-calc.ts` — SlabResult interface, reaction calculation logic (lines 2258-2303), all 8 interpolation functions
- `client/src/screens/SlabResults.tsx` — display component, DirSection, Rx/Ry card display
- `client/src/lib/storage.ts` — likely stores SlabResult, would need migration for new fields

### Approaches

1. **Add per-edge fields to SlabResult** — most complete
   - Add `RxIzq`, `RxDer`, `RyArr`, `RyAba` to `SlabResult`
   - Compute each from the available coefficients in each table branch
   - Split symmetric cases: Rx_Izq = Rx_Der = Rx / 2 (when both edges same type)
   - Update UI to show 4 edge reactions in cards
   - Effort: Medium (clear but requires careful formula per table variant)

2. **Compute per-edge reactions inline in each `interpolateKalmanok*` function** (return richer object with all 4 edge reactions)
   - Embed the per-edge formula knowledge in each interpolation function
   - Less invasive to the calling code
   - Effort: Medium

### Recommendation

**Approach 1** — Add per-edge reaction fields (`RxIzq: number`, `RxDer: number`, `RyArr: number`, `RyAba: number`) to `SlabResult`. Compute each edge's reaction in the respective table branch using the appropriate coefficient and formula:

| Branch | RxIzq | RxDer | RyArr | RyAba |
|--------|-------|-------|-------|-------|
| SIMPLE | CRx·qu·lS | CRx·qu·lS | CRy·qu·lS | CRy·qu·lS |
| 1FIXED_X | CRx·qu·lS | CRx·qu·lS | CRey·qu·lS | CRy·qu·lS |
| 1FIXED_Y | CRx·qu·lS | CRx·qu·lS | CRy·qu·lS | CRey·qu·lS |
| 2FIXED_X | (CRex·qArea/lx)/2 | same | CRy·qu·lS | CRy·qu·lS |
| 2FIXED_Y | CRx·qu·lS | CRx·qu·lS | (CRey·qArea/ly)/2 | same |
| 2ADJ | CRx·qu·lS | CRx2·qu·lS | CRy0·qu·lS | CRy·qu·lS |
| 3FIXED | (CRex·qArea/lx)/2 | same | CRey·qArea/ly | CRey·qArea/ly |
| 3FIXED_Y | CRex·qArea/lx | CRex·qArea/lx | (CRey·qArea/ly)/2 | same |
| 4FIXED | (CRex·qArea/lx)/2 | same | (CRey·qArea/ly)/2 | same |

*Note: The exact formula per coefficient type (CRx vs CRex) needs verification in the design phase — CRx uses `R = C · qu · lShort` while CRex uses `R = C · qArea / edgeLength`. For tables where both X-edges are the same type, the aggregate Rx is split in half.*

### Edge-Ambiguity Note (critical for design)

For 2ADJ, the fixed edges must be adjacent (sharing a corner). The table assumes fixed edges at X=0 and Y=0. The code must map coefficients correctly based on which edges[] are continuo. If edges[0] (Izquierdo, X=0) and edges[2] (Arriba, Y=0) are continuo, mapping is direct. But if the user selects edges[1] (Derecho, X=Lx) and edges[3] (Abajo, Y=Ly) as continuo instead, the coefficient values swap (CRx↔CRx2, CRy↔CRy0).

### Unidirectional Case (lines 2111-2126)

Unidirectional slabs compute reactions differently (beam-strip method). The current code sets Rx or Ry to `qu * span / 2` based on which direction is supported. Per-edge reactions for unidirectional: the two supported edges in the load-bearing direction each get half the total.

### Risks

- **Coefficient-to-edge mapping ambiguity**: Especially for 2ADJ and 3FIXED variants, the relationship between table coefficients and physical edges depends on which specific edges are continuous. The mapping needs validation against the original Kalmanok / CIRSOC 201-05 tables.
- **Formula type mismatch**: Some coefficients use `R = C · qu · lShort` and others use `R = C · qArea / edgeLength`. Using the wrong formula produces incorrect results.
- **Unidirectional case**: Separate handling needed, as it uses beam-strip logic, not Kalmanok coefficients.
- **Backward compatibility**: Existing saved calculations will have old SlabResult shape. Storage migration may be needed.
- **Review budget**: The change touches the largest file in the project (slab-calc.ts, 2540 lines). Per-edge logic touches 8 table branches plus unidirectional. Estimated additions: ~80-120 lines in slab-calc.ts, ~60-80 in SlabResults.tsx. Total ~200 lines — within 400-line budget.

### Ready for Proposal

Yes — the exploration is complete. Move to `sdd-propose` for `slab-edge-reactions`. Key decisions for the proposal:
1. Which 4 fields to add to SlabResult
2. Exact formula per coefficient type for each table branch
3. How to handle the 2ADJ and 3FIXED edge-mapping ambiguity
4. Whether to keep backward-compatible Rx/Ry fields
