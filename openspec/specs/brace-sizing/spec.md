# Brace Sizing Specification

## Purpose

Verify brace (puntal) sections against pure compression axial force per CIRSOC 301. Three predefined brace types with hardcoded profiles are checked independently from the column using existing angle and built-up section functions. The brace inherits the column's yield stress (Fy).

## Requirements

### Requirement: Brace type presets

The system MUST offer 3 predefined brace types with hardcoded profiles, selected via `tipoPuntal`.

| Type | Name | Chords | Diagonals/Montants | Dimensions |
|------|------|--------|-------------------|------------|
| 1 | Cruz | 2× L 2"×3/16" crossed | — | Each takes Pu/2 |
| 2 | Plano 25 cm | L 1½"×1/8" (2 chords) | L 1"×1/8" @25cm | 25 cm wide |
| 3 | Cuadrado 20 cm | L 1"×1/8" (4 chords) | L 1"×1/8" @20cm | 20×20 cm box |

#### Scenario: Type selection with default

- GIVEN the brace form is enabled
- WHEN the user opens the type selector
- THEN "Cruz (Tipo 1)" MUST be pre-selected
- AND all 3 types SHALL be available

### Requirement: Type 1 — Crossed angles verification

Type 1 MUST use `checkAngleCompForce()` per angle: Pu/2, K=1.0, L_pandeo = L_puntal, rz.

#### Scenario: Type 1 passes for realistic load

- GIVEN L_puntal = 3 m, V = 45 m/s, Fy = 235 MPa
- WHEN the brace verification runs
- THEN each L 2"×3/16" angle resists Pu/2
- AND `passesBrace` is true

#### Scenario: Type 1 fails for overload

- GIVEN Pu exceeds 2× the angle section capacity
- WHEN the verification runs
- THEN `passesBrace` is false

### Requirement: Type 2 — Flat lattice verification

Type 2 MUST use `calcBuiltUpSectionProps(nChords=2, hCol=0.25)` + `checkGlobalColumn()`. Diagonals SHALL be checked individually. Lateral bracing SHALL use Euler: λ_lim = π√(E/Fy), L_max = ry × λ_lim.

#### Scenario: Type 2 global and diagonal check

- GIVEN a realistic load on a Type 2 brace
- WHEN the verification runs
- THEN global stability is computed from the 2-chord built-up section
- AND diagonal members are verified individually
- AND required lateral bracing spacing is displayed

#### Scenario: Type 2 lateral bracing displayed

- GIVEN a Type 2 brace with known section properties
- WHEN the verification completes
- THEN the system SHALL display "Arriostramiento lateral requerido cada X cm"
- AND X = L_max derived from Euler λ_lim with the column's Fy

### Requirement: Type 3 — Square box verification

Type 3 MUST use `calcBuiltUpSectionProps(nChords=4, hCol=0.20, separacionCol=0.20)` + `checkGlobalColumn()`. Montants SHALL be checked individually.

#### Scenario: Type 3 global and montant check

- GIVEN a realistic load on a Type 3 brace
- WHEN the verification runs
- THEN global stability is computed from the 4-chord built-up section
- AND montants are verified individually
- AND `passesBrace` is true if both checks pass

#### Scenario: Type 3 montant failure

- GIVEN montant capacity is exceeded
- WHEN the verification runs
- THEN `passesBrace` is false
- AND the failure SHALL be attributed to the montant check

### Requirement: Independent pass/fail flag

The brace SHALL produce its own `passesBrace` flag. The column's `passes` MUST NOT change based on brace results.

#### Scenario: Brace fails while column passes

- GIVEN a column that passes but a brace that does not
- WHEN results are displayed
- THEN the column banner is green and the brace banner is red
- AND both indicators SHALL be clearly labeled as independent checks

### Requirement: Shared yield stress

The brace MUST inherit the column's Fy value. No separate brace Fy input SHALL exist.

#### Scenario: Fy propagation

- GIVEN column Fy = 235 MPa
- WHEN the brace calculation runs
- THEN all brace checks use Fy = 235 MPa
- AND changing the column Fy SHALL affect brace verification results
