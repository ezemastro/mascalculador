# Built-up Section Properties Specification

## Purpose

Compute Steiner section properties (A_tot, J_x, J_y, r_x, r_y) for T2 (2-chord) and T4 (4-chord) built-up columns using chord angle profiles.

## Requirements

### Requirement: T2 Steiner Properties

For T2 columns, the system MUST compute built-up section properties from 2 chord angles in a single plane.

- GIVEN a T2 column with `hCol > 0` and a valid `perfilCordon`
- WHEN computing built-up section properties
- THEN `hint = hCol × 1000 − 2 × xg × 10` (mm), where `xg` is the angle's centroid distance in cm
- AND `Jx = 2 × [Ix_angle × 10⁴ + A_angle × 100 × (hint / 2)²]` (mm⁴)
- AND `Atot = 2 × A_angle` (cm²)
- AND `rx = √(Jx / Atot)` converted from mm to cm

### Requirement: T4 Steiner Properties

For T4 columns, the system MUST compute built-up section properties from 4 chord angles in two orthogonal planes.

- GIVEN a T4 column with `hCol > 0`, `separacionCol > 0`, and a valid `perfilCordon`
- WHEN computing built-up section properties
- THEN compute `Jx` and `Atot` as in T2 for the front-face (2 chords)
- AND compute `Jy` using `separacionCol` for the side-face (2 chords)
- AND compute `rx` and `ry` as global radii of gyration from the full 4-chord Steiner inertia
- AND each chord's position contributes `I_angle + A × d²` about each axis

### Requirement: Input Validation

The system MUST validate inputs before Steiner computation.

- GIVEN `hCol = 0`
- WHEN computing built-up section properties
- THEN throw `Error("hCol must be > 0 for built-up section")`

- GIVEN a `perfilCordon` not found in `ANGLE_PROFILES`
- WHEN computing built-up section properties
- THEN throw `Error("Perfil perfilCordon no encontrado")`
