# Delta for Slab Analysis

## MODIFIED Requirements

### Requirement: Per-Edge Reaction Fields

The `SlabResult` interface MUST include 4 factored per-edge fields (`RxIzq`, `RxDer`, `RyArr`, `RyAba`, kN/m via `qu`) AND 8 unfactored D/L fields (`RD_izq`, `RL_izq`, `RD_der`, `RL_der`, `RD_arr`, `RL_arr`, `RD_aba`, `RL_aba`, kN/m via `q_D`/`q_L`). Legacy aggregate `Rx`, `Ry` MUST remain.
(Previously: Only 4 factored per-edge fields existed)

#### Scenario: New analysis populates all 12

- GIVEN a slab analyzed with Kalmanok table data WHEN `SlabResult` is returned THEN all 12 per-edge fields are numeric AND existing `Rx`, `Ry` are intact

#### Scenario: Legacy slab from before D/L split

- GIVEN a slab saved before the D/L split WHEN `loadSlab()` returns it THEN the 8 D/L fields are `undefined` AND the 4 factored fields remain

### Requirement: Per-Edge Reaction Computation

Each analysis branch MUST compute 4 factored (via `qu`) AND 8 unfactored D/L reactions (via `q_D`/`q_L`) using the same coefficients and formulas. CRx/CRy type uses `R = C·q·lShort`. CRex/CRey type uses `R = C·qArea/edgeLength`. Symmetric cases split equally.
(Previously: Only factored per-edge computations existed)

#### Scenario: D/L computation mirrors qu branch

- GIVEN a Kalmanok branch with `RxIzq = CRx·qu·lShort` THEN `RD_izq = CRx·q_D·lShort` AND `RL_izq = CRx·q_L·lShort`

#### Scenario: Unidirectional D/L

- GIVEN a unidirectional slab with 2 opposite edges supported THEN each edge gets `R_D = q_D·span/2` AND `R_L = q_L·span/2`

## ADDED Requirements

### Requirement: Send-to-Beam Button

SlabResults MUST render an "Enviar a viga" button per edge card. Clicking it MUST call `slabReactionToBeamLoad` and navigate to FormPage (`/`) with the load in router state. Legacy slabs (RD/RL undefined) MUST disable the button and show a warning.

#### Scenario: Button navigates with load

- GIVEN a valid slab result WHEN clicking "Enviar a viga" on an edge THEN navigates to `/` with `{ slabId, edge, load }` in `location.state`

#### Scenario: Legacy slab disables button

- GIVEN a legacy slab (RD/RL undefined) THEN button is disabled AND shows "Recalcular primero — D/L no disponible"

### Requirement: FormPage Slab Import

FormPage MUST include an "Importar carga de losa" section. The user selects a saved slab from storage, picks an edge, and clicks "Agregar carga". The system MUST call `slabReactionToBeamLoad` and append the resulting `Load`. Legacy slabs MUST disable the edge selector and show a warning.

#### Scenario: Import from saved slab

- GIVEN a saved slab with valid RD/RL AND user selects slab + edge "izquierdo" AND clicks "Agregar carga" THEN a distributed `Load` is added with `deadLoad = RD_izq, liveLoad = RL_izq`

#### Scenario: Legacy slab warning

- GIVEN user selects a legacy slab in the import section THEN inline warning "Recalcular primero — D/L no disponible" appears AND edge selector is disabled

#### Scenario: Validation prevents incomplete import

- GIVEN no slab selected OR no edge chosen THEN the "Agregar carga" button is disabled
