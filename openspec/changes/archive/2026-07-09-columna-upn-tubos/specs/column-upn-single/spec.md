# Column UPN Single Specification

## Purpose

Add UPN single channel (C-shape) as a column profile type alongside the existing IPN and 2-UPN box options. UPN profiles use tabulated data from the existing `UPN_PROFILES` table — same source as 2-UPN but without the box assembly. The column calculator reuses the profile-agnostic `designColumn()` engine with zero changes.

## Requirements

### Requirement: UPN profile type selection

The system MUST allow the user to select "UPN" as a profile type in the column form.

#### Scenario: User selects UPN and picks a profile

- GIVEN the column form is displayed with profile type options IPN, 2-UPN, and UPN
- WHEN the user selects "UPN" from the profile type dropdown
- THEN the profile selector shows all 16 UPN profiles (UPN 80 through UPN 400) from `UPN_PROFILES`
- AND the gap/separation input field (used for 2-UPN box) MUST be hidden
- AND a single UPN dropdown replaces the gap input

#### Scenario: No UPN profile selected

- GIVEN the column form is displayed with UPN profile type selected
- WHEN no specific UPN profile has been chosen
- THEN the form MUST show a default selection (UPN 200)
- AND the calculate button MUST be enabled with the default

### Requirement: UPN property extraction

The system MUST extract section properties (Ag, Ix, Iy, rx, ry, Zx, Zy) from `UPNData` directly for single UPN without computing a box assembly.

#### Scenario: UPN 200 properties used directly

- GIVEN the user selects UPN 200
- WHEN the column results component reads profile data
- THEN Ag = 32.2 cm², Ix = 1910 cm⁴, Iy = 148 cm⁴ (from UPNData)
- AND rx, ry, Zx, Zy are read from tabulated values without modification
- AND `displayName` equals "UPN 200"

### Requirement: Calculation engine reuse

The system MUST use the existing `designColumn()` function for single UPN profiles. The calculation logic MUST NOT be modified.

#### Scenario: Flexo-compression with UPN 200

- GIVEN the user selects UPN 200, Fy=235 MPa, L=3000 mm, Kx=Ky=1.0
- WHEN Pu=100 kN, Mux=20 kN·m, Muy=5 kN·m
- THEN the calculator SHALL compute φPn, Pr/Pc, φMnx, φMny, and interaction ratio using `designColumn()`
- AND the result displays "Perfil: UPN 200" in the steps

#### Scenario: Pure compression with UPN 300

- GIVEN the user selects UPN 300, Fy=235 MPa, L=4000 mm
- WHEN Pu=500 kN, Mux=0, Muy=0
- THEN the interaction ratio equals Pu/φPn (or Pu/(2·φPn) if Pr/Pc < 0.2)
- AND moment contributions MUST be zero

### Requirement: Result display

The system MUST show the same result sections for single UPN as for IPN: φPn, Pr/Pc, φMnx, φMny, interaction ratio, and detailed calculation steps.

#### Scenario: Full result with summary cards and steps

- GIVEN the column calculator has completed a single UPN design
- WHEN the results page renders
- THEN it MUST display the four summary cards (φPn, Pr/Pc, φMnx, φMny)
- AND the interaction ratio with pass/fail
- AND the detailed calculation steps

### Design Note — Torsional stability

Single UPN channels are singly-symmetric (C-shaped) with low torsional stiffness (J). This spec assumes the column is laterally restrained against torsional buckling (Lb ≤ Lp). LTB checks for the weak axis are out of scope.
