# Edge Cases Specification

## Purpose

Define error handling and guard clauses for invalid or edge-case inputs to the Grupo 4 verification pipeline.

## Requirements

### Requirement: Zero Section Width

The system MUST reject `hCol = 0` for built-up section computation.

- GIVEN `hCol = 0`
- WHEN computing built-up section properties
- THEN throw `Error("hCol must be > 0 for built-up section")`

### Requirement: Zero Panel Height

The system MUST reject `aCol = 0` for chord buckling computation.

- GIVEN `aCol = 0`
- WHEN computing chord or modified slenderness
- THEN throw `Error("aCol must be > 0 for chord buckling check")`

### Requirement: Profile Not Found

The system MUST fail gracefully when a profile is not found.

- GIVEN `perfilCordon`, `perfilDiagonal`, or `perfilMontante` not found in `ANGLE_PROFILES`
- WHEN computing built-up section properties or verification
- THEN throw `Error("Perfil {name} no encontrado")`

### Requirement: Zero Radius of Gyration

The system MUST handle `rz = 0` on angle profiles without division errors.

- GIVEN an angle with `rz = 0` in `ANGLE_PROFILES`
- WHEN computing `KL/r`
- THEN return `KLr = 999` (existing behavior, preserved)

### Requirement: Missing T4 Separation

The system MUST reject missing or zero `separacionCol` for T4 columns.

- GIVEN `tipoColumna === 4` with `separacionCol = 0` or `undefined`
- WHEN computing T4 properties
- THEN throw `Error("separacionCol is required for T4 columns")`

### Requirement: Invalid Panel Count

The system MUST handle `nPaneles < 1`.

- GIVEN inputs that produce `nPaneles < 1`
- WHEN computing geometry
- THEN throw `Error("nPaneles must be >= 1")`
