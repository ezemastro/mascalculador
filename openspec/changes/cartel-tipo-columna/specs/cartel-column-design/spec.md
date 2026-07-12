# Cartel Column Design Specification

## Purpose

Verify billboard columns by type: IPN flexocompression (T1), 2-chord truss (T2), or 4-chord box truss (T4). T3 (Cajón) removed. Wind/forces shared across all types.

## Requirements

### Requirement: Shared solicitation calculation

Wind, Fcol, Mbase, brace forces, and reactions MUST be identical regardless of `tipoColumna`.

#### Scenario: Wind identical across types

- GIVEN any `CartelInput` with valid parameters
- WHEN `calculateCartel()` executes
- THEN `WindResult`, `Fcol`, and `Mbase` MUST be identical for every `tipoColumna`

### Requirement: Tipo 1 — Simple IPN flexocompression

When `tipoColumna == 1`, the system MUST use `designColumn()` from `column-calc.ts` with a user-selected IPN profile.

#### Scenario: Buckling lengths and results

- GIVEN Tipo 1 with `sepCorreas = 1.5 m`, an IPN selected, `tienePuntal = true`, `hPuntal = 4 m`
- WHEN `calculateCartel()` runs
- THEN z‑z buckling length = `sepCorreas * 1000` mm, y‑y = `hPuntal * 1000` mm (with puntal)
- AND "Acero por columna" section MUST NOT render in results/print

#### Scenario: Strong-axis buckling without puntal

- GIVEN Tipo 1 with `tienePuntal = false`
- WHEN `calculateCartel()` runs
- THEN y‑y buckling length = `2.0 * alturaColumna * 1000` mm (K=2.0 cantilever)

### Requirement: Tipo 2 — Celosía 2 cordones

When `tipoColumna == 2`, truss behavior MUST match current code (no regression).

#### Scenario: Truss verification unchanged

- GIVEN `tipoColumna = 2` with valid inputs
- WHEN `calculateCartel()` runs
- THEN `checkAngleCompForce()` results MUST match pre-change output for identical inputs

### Requirement: Tipo 4 — Celosía completa 4 cordones

When `tipoColumna == 4`, the system MUST model 2 parallel trusses at Fcol/2 each, using 4 equal angle chords.

#### Scenario: Fcol split and doubled chords

- GIVEN `tipoColumna = 4` with valid profiles, `alturaColumna = 8 m`
- WHEN `calculateCartel()` runs
- THEN Fcol per plane = `Fcol / 2`, chords use same profile, `longCordones = 4 * alturaColumna`

### Requirement: Dynamic section title

Title in Form, Results, and Print MUST reflect `tipoColumna`.

#### Scenario: Titles per type

- GIVEN `tipoColumna = 1 | 2 | 4`
- WHEN rendering any cartel screen
- THEN heading is "Columna — Simple IPN" | "Columna — Celosía" | "Columna — Celosía completa"

### Requirement: Data model additions

`CartelFormState`, `CartelInput`, `CartelResult` SHALL add:
- `perfilIPN: string` — IPN profile for T1
- `separacionCol: number` — section depth for T4
- `flexoResult?: FlexoResult` — optional T1 result field

#### Scenario: New fields serialize

- GIVEN form filled for Tipo 1 with `perfilIPN = "IPN 200"`
- WHEN `CartelFormState` serializes to localStorage
- THEN `perfilIPN` is present, `separacionCol` absent (T1 does not use it)

### Requirement: Tipo 3 UI removal and migration

Tipo 3 (Cajón) MUST be removed from UI and types. Old saves with `tipoColumna = 3` SHALL remap to 2 silently.

#### Scenario: No T3 button, old data migrates

- GIVEN `CartelForm` rendering type buttons
- THEN no "Cajón" button (type 3) is rendered
- AND stored state with `tipoColumna = 3` loads as `tipoColumna = 2`

### Requirement: Print page parity

`CartelPrintPage` MUST mirror Results per type (geometry, verification, steel table).

#### Scenario: T1 omits steel, T4 shows depth

- GIVEN `tipoColumna = 1`
- WHEN `CartelPrintPage` renders
- THEN "Acero por columna" section is omitted

- GIVEN `tipoColumna = 4` with `separacionCol = 0.6 m`
- WHEN `CartelPrintPage` renders geometry
- THEN `separacionCol` appears in the geometry table
