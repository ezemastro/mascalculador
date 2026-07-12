# Beam Data Sheet Specification

## Purpose

Define the user-facing data sheet (FormPage) for steel beam input: independent
Lb1 / Lb2 fields, the live Zx_req preview that derives the required plastic
modulus from current loads, and a soft-warn UX where the chosen profile's
Zx adequacy is surfaced as a visible banner (not a hard disable) on both
the form and the results page. The "Calcular" button is enabled as soon
as any profile is selected; subdimensioned selections still allow
calculation so the engineer can audit the result.

## Requirements

### Requirement: Lb1 and Lb2 inputs alongside Lb and Cb

The Dimensionamiento (CIRSOC 301-05) section MUST render two numeric inputs
`Lb1` (mm) and `Lb2` (mm) in addition to the existing `Cb`. Both MUST be
non-negative finite numbers. The single `Lb` field MAY be retained for
backward deserialization of legacy saved beams.

#### Scenario: Default values match total span

- GIVEN a beam with a single 6 m span
- WHEN the form is opened with no prior state
- THEN `Lb1 = 6000` mm and `Lb2 = 6000` mm

#### Scenario: Multi-span default

- GIVEN two spans of 4 m and 3 m
- WHEN the form is opened
- THEN `Lb1 = 7000` mm and `Lb2 = 7000` mm (total × 1000)

#### Scenario: Legacy record with only Lb

- GIVEN a saved beam with `Lb = 5500` mm and no Lb1/Lb2
- WHEN the form loads the record
- THEN `Lb1 = 5500` and `Lb2 = 5500` (Lb carried into both)

### Requirement: Cb remains user-editable

`Cb` MUST stay editable with default 1.0 and minimum 1.0, exactly as today.
The steel design engine MUST receive the chosen `Cb` value.

#### Scenario: Cb default

- GIVEN a fresh form
- WHEN the user does not change `Cb`
- THEN `Cb = 1.0` is passed to `checkBeam()`

### Requirement: Live Zx_req preview from current loads

The form MUST compute and display `Zx_req` (cm³) as soon as the loads are
complete and the beam is valid. The formula MUST be `Zx_req = Mu / (0.9·Fy)`
where `Mu` is the absolute ultimate moment in kN·m (from
`calculateBeamDual`) and `Fy` is the selected yield strength in MPa. Unit
handling: `Mu (kN·m) × 10^6 / (0.9 × Fy (MPa)) → mm³`, then `/ 1000 → cm³`.

#### Scenario: Simply supported, UDL

- GIVEN L = 6 m, D = 5 kN/m, L = 3 kN/m, Fy = 235 MPa
- WHEN loads are valid
- THEN `w_U = 1.2·5 + 1.6·3 = 10.8 kN/m`; `Mu = 10.8·6²/8 = 48.6 kN·m`
- AND `Zx_req = 48.6·10^6 / (0.9·235·1000) ≈ 230 cm³`

#### Scenario: Preview absent when loads incomplete

- GIVEN an empty or invalid load list
- WHEN the form renders
- THEN `Zx_req` is hidden and the gate does not engage

### Requirement: Calcular button enabled when any profile is selected (soft-warn)

The `Calcular` button MUST be enabled as soon as all data is valid AND any
profile is selected, regardless of whether `profile.Zx ≥ Zx_req`. The form
MUST NOT hard-disable the button on subdimensioned selections; the engineer
is allowed to run the calculation to inspect the actual `Md < Mu` result.

#### Scenario: Profile meets requirement

- GIVEN `Zx_req = 230 cm³` and a selected IPN 200 (Zx = 251 cm³)
- WHEN the user clicks `Calcular`
- THEN the form submits and navigates to results

#### Scenario: Profile below requirement still calculates

- GIVEN `Zx_req = 230 cm³` and a selected IPN 180 (Zx = 189 cm³)
- WHEN the user clicks `Calcular`
- THEN the form submits and navigates to results
- AND the results page renders the subdimensioned warning banner

### Requirement: Inline warning on the form when profile Zx is below Zx_req

When the selected profile has `Zx < Zx_req`, the form MUST show a visible
warning banner naming the profile, the chosen `Zx`, and the required
`Zx_req`, with text equivalent to "Perfil bajo: Zx elegido = X cm³,
necesario ≥ Y cm³". The banner is informational; it does not block
submission.

#### Scenario: Warning content

- GIVEN a profile with `Zx = 189 cm³` and `Zx_req = 230 cm³`
- WHEN the form renders
- THEN the banner reads "Perfil bajo: Zx = 189 cm³, necesario ≥ 230 cm³"

#### Scenario: No warning when profile meets requirement

- GIVEN a profile with `Zx = 251 cm³` and `Zx_req = 230 cm³`
- WHEN the form renders
- THEN no warning banner is shown
