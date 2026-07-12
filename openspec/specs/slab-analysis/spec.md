# Slab Analysis Specification

## Purpose

Two-way and one-way RC slab design per CIRSOC 201-05. Crossed slabs use Kalmanok tables; unidirectional slabs use beam-strip moments; cantilevers use M = qu·L²/2. Continuous edges undergo support compatibilización.

## Requirements

### Requirement: Slab Routing
The system MUST render SlabForm at `/slab` and SlabResults at `/slab-results`. NavBar MUST show a "Losas H°" link to `/slab`.

- GIVEN the user navigates to `/slab` WHEN the app loads THEN SlabForm renders
- GIVEN SlabForm is submitted with valid input WHEN results are computed THEN the app navigates to `/slab-results` with SlabState
- GIVEN the user is on `/slab-results` WHEN clicking "Volver" THEN the app navigates to `/slab`

### Requirement: Slab Type Determination
The system MUST classify a slab as crossed, unidirectional, or cantilever based on edge conditions and aspect ratio. Edge condition "free" MUST NOT count as supported. The determination MUST be logged in steps output.

- GIVEN all 4 edges are non-free AND min(lx,ly)/max(lx,ly) > 0.5 THEN the slab is crossed
- GIVEN exactly 1 edge is supported AND all others are free THEN the slab is cantilever, M = qu·L²/2 at the fixed support
- GIVEN 2+ opposite edges are supported AND the slab is NOT crossed THEN it is unidirectional

### Requirement: Unidirectional Analysis
Unidirectional slabs MUST compute moments as M = qu·L²/coef where coef depends on support conditions. Kalmanok tables MUST NOT be used for unidirectional slabs. Distribution steel MUST satisfy As_dist ≥ 0.20·As_principal and s_max = min(3h, 300mm).

- GIVEN the slab is unidirectional AND simply supported THEN coef = 8
- GIVEN the slab is unidirectional AND fixed at both ends THEN coef = 12
- GIVEN the slab is unidirectional AND one end fixed, one simple THEN coef =... (per standard beam formula)
- GIVEN the slab is unidirectional AND distribution steel is computed THEN As_dist ≥ 0.20·As_principal AND s_max = min(3h, 300mm)

### Requirement: Support Compatibilización
Continuous edges MUST undergo momento compatibilización. When adjacent edges are "continuo", compare moments from each slab at the shared support. When M_support_2 / M_support_1 ≥ 0.6, average both moments. When < 0.6, re-calc treating the support as simple (not fixed). The decision MUST be documented in steps.

- GIVEN two adjacent continuous edges with M₂/M₁ ≥ 0.6 THEN average the support moments
- GIVEN two adjacent continuous edges with M₂/M₁ < 0.6 THEN re-calc with simple support assumption
- GIVEN compatibilización is performed THEN log ratio and decision in steps

### Requirement: Continuity Validation
An edge marked "continuo" MUST satisfy min(lx,ly)/max(lx,ly) ≥ 0.5 in the direction of continuity. The validation result MUST be logged in steps.

- GIVEN an edge is marked "continuo" AND the aspect ratio test passes THEN log "continuity validated"
- GIVEN an edge is marked "continuo" AND the aspect ratio fails THEN log a validation warning

### Requirement: KaMin Formula for fc > 30 MPa
For fc ≤ 30, KaMin = 1.4/(0.85·fc). For fc > 30, KaMin MUST use the correct CIRSOC 201-05 formula: 1/(3.4·√fc). The formula used MUST be logged in steps.

- GIVEN fc ≤ 30 THEN KaMin = 1.4/(0.85·fc)
- GIVEN fc > 30 THEN KaMin = 1/(3.4·√fc)

### Requirement: Over-Reinforcement Warning
When Ka > KaMax, the system MUST emit a prominent warning in steps recommending the user increase slab thickness h. The system MUST NOT design compression reinforcement for slabs. As MUST still be computed using KaMax for reference.

- GIVEN Ka > KaMax THEN add warning "Aumentar h" to steps
- GIVEN Ka > KaMax THEN compute As using KaMax (not compression steel)
- GIVEN Ka > KaMax THEN compression reinforcement MUST NOT be designed

### Requirement: Bar Spacing Validation
Main reinforcement spacing MUST respect s_max = min(2.5h, 25·barDiameter, 300mm) and s_min = 80mm. Distribution steel (unidirectional) MUST respect s_max = min(3h, 300mm). Both limits MUST be reported in steps.

- GIVEN main reinforcement is computed THEN s_max = min(2.5h, 25·dB, 300mm) and s_min = 80mm
- GIVEN distribution steel is computed (unidirectional) THEN s_max = min(3h, 300mm)

### Requirement: Height Preservation and Calculation
When the user provides h > 0, the system MUST use the value as-is without rounding to the nearest 10mm. When computing h automatically, the formula MUST be h = dMin + cover (not dMin + cover + 10).

- GIVEN user provides h > 0 THEN use h without rounding to nearest 10mm
- GIVEN h is auto-computed THEN h = dMin + cover

### Requirement: Negative Moment Exposure

The `DirectionResult` interface MUST include an optional `Mneg` field. The system MUST populate `Mneg` when the direction has a continuous or fixed edge condition and MUST leave it undefined for simple-supported edges.

- GIVEN a direction has a "continuo" or "empotrado" edge WHEN `designDir()` runs THEN `Mneg` is populated with the negative moment value
- GIVEN a direction has an "apoyo simple" edge WHEN `designDir()` runs THEN `Mneg` is undefined
- GIVEN a slab result with Mneg populated is saved via `saveSlab()` THEN the persisted record includes Mneg

### Requirement: Per-Edge Reaction Fields

The `SlabResult` interface MUST include four new fields: `RxIzq: number`, `RxDer: number`, `RyArr: number`, `RyAba: number` (kN/m). The existing `Rx: number` and `Ry: number` MUST remain for backward compatibility.

- GIVEN a slab is analyzed with Kalmanok table data WHEN `SlabResult` is returned THEN `RxIzq`, `RxDer`, `RyArr`, `RyAba` are populated with numeric kN/m values
- GIVEN a saved slab from before this change WHEN `loadSlab()` returns it THEN the 4 per-edge fields are `undefined` AND existing `Rx`, `Ry` are unaffected

### Requirement: Per-Edge Reaction Computation

Each Kalmanok analysis branch MUST compute all 4 per-edge reactions using the correct coefficient and formula per the CIRSOC table convention. CRx/CRy-type coefficients MUST use `R = C · qu · lShort`. CRex/CRey-type coefficients MUST use `R = C · qArea / edgeLength`. Symmetric cases (both edges same type in a direction) MUST split equally.

- GIVEN both X-edges share the same boundary type THEN `RxIzq = RxDer = aggregate_Rx / 2` (same for Y with RyArr/RyAba)
- GIVEN the table uses CRex/CRey for one edge and CRx/CRy for the opposite THEN the continuous edge uses the CRex/CRey formula and the simple edge uses the CRx/CRy formula
- GIVEN the support condition is 2ADJ THEN `RxIzq = CRx·qu·lShort`, `RxDer = CRx2·qu·lShort`, `RyArr = CRy0·qu·lShort`, `RyAba = CRy·qu·lShort`
- GIVEN the slab is unidirectional AND 2 opposite edges are supported THEN each supported edge gets `R = qu·span / 2`; unsupported edges get `0`

### Requirement: Per-Edge Reaction Display

The SlabResults screen MUST display 4 reaction cards replacing the 2 aggregate cards, labeled "Izquierdo" (RxIzq), "Derecho" (RxDer), "Arriba" (RyArr), "Abajo" (RyAba), each showing kN/m. Undefined fields from legacy saves MUST display "—".

- GIVEN a slab result with per-edge reactions WHEN SlabResults renders THEN 4 cards show the corresponding RxIzq/RxDer/RyArr/RyAba values in kN/m with edge labels
- GIVEN a legacy slab with per-edge fields `undefined` WHEN SlabResults renders THEN each of the 4 cards shows "—" instead of a numeric value
