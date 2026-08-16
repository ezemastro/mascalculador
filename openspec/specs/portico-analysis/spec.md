# Pórtico Analysis Specification

## Purpose

Two-dimensional plane-frame analysis (pórtico) for the viga-continua app: given nodes, bars (6 DOF per bar: ux, uy, θz at each end), supports (hinge | fixed) and bar loads (point + distributed, possibly inclined), solve by direct-stiffness method and render displaced-shape and moment diagrams with Mafs. Loads carry dead (D) and live (L) parts; the solver returns ULS combined (U = 1.2·D + 1.6·L) and SLS separated (D and L each unfactored). No reinforced-concrete design.

## Requirements

### Requirement: Portico domain types

The pórtico module SHALL define `PorticoNode`, `PorticoBar`, `PorticoBarLoad`, `PorticoSupport`, `PorticoState` and `PorticoSupportKind = "hinge" | "fixed"`. `PorticoState` SHALL carry `nodes[]`, `bars[]`, `loads[]`, `supports[]` and be the persistence target.

#### Scenario: Types discriminate the support kind

- GIVEN the portico module is imported
- WHEN `PorticoSupportKind` is inspected
- THEN it is the literal union `"hinge" | "fixed"`
- AND `PorticoState` includes `nodes`, `bars`, `loads`, `supports` collections

### Requirement: 2-D direct-stiffness solver

The solver SHALL assemble a local 6×6 K per bar, transform to global axes via the cosine matrix of the bar angle, apply support DOFs as prescribed-zero, integrate equivalent nodal forces from distributed loads (decomposing any inclined load into global fx and fy first), and resolve `K·u = F`. ULS SHALL apply `U = 1.2·D + 1.6·L` to all loads simultaneously (NO patterning). SLS SHALL return D and L separately (unfactored). The solver SHALL be pure (no I/O, no globals) and SHALL carry no internal bar/DOF cap.

#### Scenario: Mensula — cantilever with vertical point load at tip

- GIVEN one bar (L = 3 m, fixed at start, free at end) with vertical point load P = 10 kN at the tip
- WHEN the solver runs in ULS mode with D = P and L = 0
- THEN `M` at the fixed end equals `P·L = 30 kN·m`
- AND the vertical reaction at the fixed support equals `P` upward

#### Scenario: Pórtico simétrico — 2 columns + ridge beam + vertical point load at ridge

- GIVEN a 3-node frame (2 columns L = 3 m, ridge beam L = 4 m), left hinge + right fixed supports, vertical point load P = 20 kN at the ridge
- WHEN the solver runs in ULS mode
- THEN vertical reactions at both supports equal `P/2 = 10 kN`
- AND horizontal reaction at the hinge is 0

#### Scenario: Carga inclinada en cumbrera — decomposition into global axes

- GIVEN the symmetric pórtico above with one inclined load at the ridge: intensity = 30 kN, angle = 30° below horizontal
- WHEN the solver runs in ULS mode
- THEN the global force components are `fx = 30·cos(30°) ≈ 25.98 kN` and `fy = 30·sin(30°) = 15 kN`
- AND the sum of vertical reactions equals 15 kN (global ΣFy = 0 holds)

### Requirement: Pórtico results shape

The solver SHALL return: per-node displacements `(u, v, θ)`, per-support reactions `(Fx, Fy, Mz)` with the sign convention of R-m-plus, and per-bar internal forces at both endpoints plus at least 5 intermediate samples (M, V, N) suitable for diagram plotting.

#### Scenario: Per-bar samples sufficient for diagram

- GIVEN a solved pórtico
- WHEN the result object is inspected
- THEN every bar has `start` and `end` force tuples
- AND every bar carries at least 5 intermediate `(s, M, V, N)` samples

### Requirement: M+ sign convention

`M+` SHALL mean "fiber tensioned at the bottom of a beam span and moment vector pointing to +x". The convention SHALL be documented in the solver JSDoc AND SHALL be rendered as a visible legend in the Mafs diagram AND in the reactions table — visible without scrolling.

#### Scenario: Legend visible on results

- GIVEN a rendered `PorticoResults`
- WHEN the page mounts
- THEN the Mafs canvas and the reactions table each carry the inline legend "M+ = fibra inferior traccionada, vector → +x"
- AND the legend sits in the initial viewport

### Requirement: Y-axis positive downward

The Y axis SHALL be positive downward (matches screen pixel coordinates). The convention SHALL be documented at the solver entry point and at the Mafs rendering call. Input node Y values SHALL increase downward from the origin.

#### Scenario: Y-positive-down on render

- GIVEN a node at world coordinate `(0, 4)`
- WHEN the Mafs canvas renders
- THEN the node is drawn 4 Mafs units below the origin
- AND the y-axis tick labels increase downward

### Requirement: Supports only at nodes

Supports SHALL attach ONLY to existing nodes; there are no internal hinges along a bar. A hinge SHALL constrain `u` and `v` and free `θz`; a fixed support SHALL constrain all three DOFs. The solver SHALL reject any state where a support references a non-existent node id.

#### Scenario: Hinge vs fixed DOF count

- GIVEN a hinge at node N and a fixed support at node M
- WHEN the assembled DOF count is computed
- THEN the hinge removes 2 DOFs (`u`, `v`) and the fixed support removes 3 DOFs (`u`, `v`, `θz`)

#### Scenario: Support on missing node rejected

- GIVEN a `PorticoState` whose `supports[]` references a non-existent node id
- WHEN the solver validates inputs
- THEN it returns a structured error and does not attempt to solve

### Requirement: Default geometry

On first open (no auto-saved state), and after the user clicks "Nueva" and confirms, the default `PorticoState` SHALL be the precarged example: 3 nodes (left foot, ridge, right foot), 2 bars (column-foot → ridge and ridge → column-foot), 2 supports (left hinge, right fixed), and 1 inclined example load at the ridge.

#### Scenario: First open shows precarged example

- GIVEN a fresh `localStorage` with no last portico state
- WHEN `PorticoForm` mounts
- THEN the editor is pre-populated with 3 nodes, 2 bars, 2 supports, and 1 example inclined load

### Requirement: Dual persistence

Portico state SHALL persist dual-style, mirroring beam mode: auto-save of the last form state on every change, plus named saves listed in the `SavedBeams` panel. `shared/src/storage.ts` SHALL extend the `SaveType` union with `"portico"` and SHALL expose `savePortico`, `loadLastPorticoFormState`, and `saveLastPorticoFormState` helpers following the existing viga-continua pattern. `SavedBeams` SHALL accept `type = "portico"`.

#### Scenario: Auto-save restores last form on reload

- GIVEN the user edits the pórtico state and reloads the page
- WHEN `PorticoForm` mounts
- THEN the editor restores the last auto-saved state

#### Scenario: Named save round-trip

- GIVEN the user names and saves the current pórtico state, then reloads
- WHEN `SavedBeams` renders
- THEN the named save appears with `type = "portico"`
- AND selecting it loads that state into the editor

### Requirement: UX caps and solver scalability

`PorticoForm` SHALL enforce a UX cap of 5 bars, 5 nodes, and 5 supports (disabling the `+` control when the limit is hit). The solver SHALL carry no internal cap — matrix math accepts arbitrary bar and DOF counts when called programmatically.

#### Scenario: UX cap disables the add button

- GIVEN a state already at 5 bars
- WHEN `PorticoForm` renders
- THEN the `+ bar` button is disabled

#### Scenario: Solver accepts > 5 bars via direct call

- GIVEN a programmatic state with 8 bars, 6 nodes, and 6 supports (bypassing the form)
- WHEN the solver runs
- THEN it solves without throwing a size-limit error

### Requirement: Mafs diagram

`PorticoResults` SHALL render with Mafs: the undeformed geometry, a deformed-shape overlay using solved nodal displacements (visually exaggerated), and a per-bar moment diagram where the `M+` curve is plotted on the tensioned side (bottom fiber).

#### Scenario: Diagram renders deformed shape and M+

- GIVEN a solved pórtico
- WHEN `PorticoResults` mounts
- THEN the Mafs canvas draws the undeformed geometry, the deformed shape, and per-bar M+ moment curves
- AND the M+ curve sits on the bottom fiber of each beam

### Requirement: Envolvente / Servicio toggle (shared)

The results screen (BOTH beam and pórtico modes) SHALL show a toggle between `Envolvente` (ULS = 1.2·D + 1.6·L) and `Servicio` (SLS, D and L separately). Toggling SHALL re-render diagrams and the reactions table from the already-computed solve set — no re-solve is performed.

#### Scenario: Toggle to Envolvente renders ULS

- GIVEN a solved pórtico (or beam) with both ULS and SLS results cached
- WHEN the user toggles to `Envolvente`
- THEN diagrams and the reactions table render the ULS values
- AND values are labeled `U = 1.2·D + 1.6·L`

#### Scenario: Toggle to Servicio renders D and L separately

- GIVEN a solved pórtico (or beam)
- WHEN the user toggles to `Servicio`
- THEN the reactions table shows D and L columns separately (unfactored)
- AND the diagram legend updates to `Servicio — D y L por separado`

### Requirement: Nueva button (shared)

The form (BOTH beam and pórtico modes) SHALL show a `Nueva` button. Clicking it SHALL open a confirmation prompt; on confirm the state SHALL be cleared and reset to defaults: beam mode = single-span 1 m, no loads; pórtico mode = the precarged example per R-default-geometry. Cancelling the confirmation SHALL leave the current state untouched.

#### Scenario: Nueva resets beam mode

- GIVEN the user edits a multi-span beam with loads
- WHEN the user clicks `Nueva` and confirms
- THEN `VigaContinuaForm` clears the state and re-populates a single-span 1 m with no loads

#### Scenario: Cancelled confirmation preserves state

- GIVEN the user clicks `Nueva`
- WHEN the confirmation dialog is dismissed
- THEN the current state is preserved verbatim