# P-Δ Amplification Specification

## Purpose

Compute second-order P-Δ effects for built-up columns: Euler buckling load, moment amplification, and initial geometric imperfection e₀.

## Requirements

### Requirement: Euler Buckling Load P_cm

The system MUST compute the Euler buckling load of the built-up section.

- GIVEN `Ag_total` (cm²), `λ₀`, and `E = 200000 MPa`
- WHEN computing P_cm
- THEN `P_cm = π² × E × Ag_total × 100 / λ₀²` (kN)

### Requirement: Moment Amplification

The system MUST amplify the first-order moment for P-Δ effects.

- GIVEN first-order moment `Mx` (kN·m), axial load `Pu` (kN), and Euler load `P_cm` (kN)
- WHEN computing amplified moment
- THEN `MsL = Mx × (1 / (1 − Pu / P_cm))` for the strong-axis bending

### Requirement: Initial Imperfection e₀

The system MUST include geometric imperfection in chord force distribution.

- GIVEN column height `L` (m) and axial load `Pu` (kN)
- WHEN computing imperfection moment
- THEN `e₀ = L / 500` (m), fixed value
- AND `M_e0 = Pu × e₀` (kN·m)

### Requirement: Chord Force Distribution

The system MUST compute the axial force per chord including amplified moment and imperfection.

- GIVEN `Pu`, `nChords` (2 for T2, 4 for T4), `MsL`, `M_e0`, and `hint` (cm)
- WHEN computing per-chord force
- THEN `Pu1 = Pu / nChords + (MsL + M_e0) / hint_cm` (kN per chord)

### Requirement: T4 Biaxial Distribution

For T4 columns, the system MUST distribute moments about both axes according to each chord's position.

- GIVEN T4 column with `Mx`, `My`, `Ix`, `Iy`, and chord positions
- WHEN computing per-chord forces
- THEN distribute `Mx` proportionally to `Ix` and `My` proportionally to `Iy`
- AND compute the resultant axial force per chord combining both axis contributions
