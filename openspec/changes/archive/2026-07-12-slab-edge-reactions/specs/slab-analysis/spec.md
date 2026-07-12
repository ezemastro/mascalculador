# Delta for Slab Analysis

## ADDED Requirements

### Requirement: Per-Edge Reaction Fields

The `SlabResult` interface MUST include four new fields: `RxIzq: number`, `RxDer: number`, `RyArr: number`, `RyAba: number` (kN/m). The existing `Rx: number` and `Ry: number` MUST remain for backward compatibility.

#### Scenario: New calculation populates all 4 fields

- GIVEN a slab is analyzed with Kalmanok table data WHEN `SlabResult` is returned THEN `RxIzq`, `RxDer`, `RyArr`, `RyAba` are populated with numeric kN/m values

#### Scenario: Legacy save loads safely

- GIVEN a saved slab from before this change WHEN `loadSlab()` returns it THEN the 4 per-edge fields are `undefined` AND existing `Rx`, `Ry` are unaffected

### Requirement: Per-Edge Reaction Computation

Each Kalmanok analysis branch MUST compute all 4 per-edge reactions using the correct coefficient and formula per the CIRSOC table convention. CRx/CRy-type coefficients MUST use `R = C · qu · lShort`. CRex/CRey-type coefficients MUST use `R = C · qArea / edgeLength`. Symmetric cases (both edges same type in a direction) MUST split equally.

#### Scenario: Symmetric cases (4SIMPLE, 2FIXED_X, 2FIXED_Y, 4FIXED)

- GIVEN both X-edges share the same boundary type THEN `RxIzq = RxDer = aggregate_Rx / 2` (same for Y with RyArr/RyAba)

#### Scenario: Asymmetric with CRex (1FIXED_X, 1FIXED_Y, 3FIXED)

- GIVEN the table uses CRex/CRey for one edge and CRx/CRy for the opposite THEN the continuous edge uses the CRex/CRey formula and the simple edge uses the CRx/CRy formula

#### Scenario: 2ADJ (2 adjacent continuous)

- GIVEN the support condition is 2ADJ THEN `RxIzq = CRx·qu·lShort`, `RxDer = CRx2·qu·lShort`, `RyArr = CRy0·qu·lShort`, `RyAba = CRy·qu·lShort`

#### Scenario: Unidirectional slab

- GIVEN the slab is unidirectional AND 2 opposite edges are supported THEN each supported edge gets `R = qu·span / 2`; unsupported edges get `0`

### Requirement: Per-Edge Reaction Display

The SlabResults screen MUST display 4 reaction cards replacing the 2 aggregate cards, labeled "Izquierdo" (RxIzq), "Derecho" (RxDer), "Arriba" (RyArr), "Abajo" (RyAba), each showing kN/m. Undefined fields from legacy saves MUST display "—".

#### Scenario: 4 edge cards render with values

- GIVEN a slab result with per-edge reactions WHEN SlabResults renders THEN 4 cards show the corresponding RxIzq/RxDer/RyArr/RyAba values in kN/m with edge labels

#### Scenario: Legacy save shows placeholder

- GIVEN a legacy slab with per-edge fields `undefined` WHEN SlabResults renders THEN each of the 4 cards shows "—" instead of a numeric value
