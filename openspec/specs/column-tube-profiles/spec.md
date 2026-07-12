# Column Tube Profiles Specification

## Purpose

Add square (SHS) and rectangular (RHS) structural hollow sections as a column profile type. Tube section properties are computed from geometry (outer dimensions h×b and wall thickness t) rather than tabulated values. The column calculator reuses the profile-agnostic `designColumn()` engine with zero changes.

## Requirements

### Requirement: Tube profile type selection

The system MUST allow the user to select "TUBO" as a profile type in the column form.

#### Scenario: User selects TUBO and picks a hollow section

- GIVEN the column form is displayed
- WHEN the user selects "TUBO" from the profile type dropdown
- THEN the profile selector SHALL display all tube profiles from the new `TUBO_PROFILES` catalog
- AND tube names SHALL use the format "□ 100×100×4" for square and "□ 200×100×5" for rectangular
- AND the gap input MUST be hidden

#### Scenario: Tube with default selection

- GIVEN the column form is displayed with TUBO profile type
- WHEN the user opens the tube selector
- THEN a default profile (□ 100×100×4) MUST be pre-selected

### Requirement: Tube property computation

The system MUST compute tube section properties from geometry using hollow rectangle formulas. Properties MUST include A, Ix, Iy, rx, ry, Zx, Zy, Sx, Sy, and peso.

#### Scenario: Square tube 100×100×4 properties

- GIVEN a tube profile "□ 100×100×4" with h=100 mm, b=100 mm, t=4 mm
- WHEN properties are computed
- THEN A = 2·t·(h + b − 2t) = 1536 mm²
- AND Ix = (b·h³ − (b−2t)·(h−2t)³) / 12 in mm⁴
- AND Zx ≈ 1.12·Sx (plastic modulus approximation)
- AND rx = √(Ix/A), ry = √(Iy/A)
- AND peso = A × 0.785 × 1e-4 in kg/m

#### Scenario: Rectangular tube 200×100×5 properties

- GIVEN a tube profile "□ 200×100×5" with h=200 mm, b=100 mm, t=5 mm
- WHEN properties are computed
- THEN A, Ix, Iy use the same hollow rectangle formulas with h≠b
- AND Sx = 2·Ix/h, Sy = 2·Iy/b
- AND Zx = 1.12·Sx (rounded to 1 decimal)

### Requirement: Tube catalog

The system MUST include a catalog of common Argentine market SHS/RHS sizes (per EN 10219 and local equivalents) with pre-computed properties.

#### Scenario: Square SHS sizes available

- GIVEN the tube catalog
- THEN it MUST include 40+ square profiles from 50×50×2.5 to 300×300×12
- AND properties MUST be pre-computed at definition time, not at runtime

#### Scenario: Rectangular RHS sizes available

- GIVEN the tube catalog
- THEN it MUST include 30 rectangular profiles from 100×50×3 to 300×200×10
- AND properties MUST be pre-computed at definition time

### Requirement: Calculation engine reuse

The system MUST use the existing `designColumn()` function for tube profiles. The calculation logic MUST NOT be modified.

#### Scenario: Pure compression with SHS 100×100×4

- GIVEN the user selects "□ 100×100×4", Fy=235 MPa, L=2500 mm, Kx=Ky=1.0
- WHEN Pu=80 kN, Mux=0, Muy=0
- THEN the interaction collapses to Pu/φPn (or Pu/(2·φPn) if Pr/Pc < 0.2)
- AND the result displays the tube name in the Perfil line

#### Scenario: Flexo-compression with RHS 200×100×5

- GIVEN the user selects "□ 200×100×5", Fy=235 MPa, L=3500 mm, Kx=Ky=1.0
- WHEN Pu=200 kN, Mux=30 kN·m, Muy=10 kN·m
- THEN φPn, φMnx, φMny, and the interaction ratio are computed correctly
- AND the full set of summary cards and steps are displayed

### Design Note — Property assumptions

- Plastic modulus Z ≈ 1.12·S (conservative HSS approximation, valid for typical compact sections per AISC Manual)
- Local buckling is not checked — all sections are assumed compact
- Properties are pre-computed at definition time, stored as `TubeData` objects, and read directly by results dispatch
