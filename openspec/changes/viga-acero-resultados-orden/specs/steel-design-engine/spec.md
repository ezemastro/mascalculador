# Steel Design Engine Specification

## Purpose

Extend the steel beam design engine (`checkBeam()`) so every intermediate
used in the AISC/CIRSOC 301-05 LTB and local-buckling audit is exposed on
`DesignResult`, the Lb selection respects moment sign, and the section
classification is reported as a single enum independent of `limitingState`.

## Requirements

### Requirement: DesignResult exposes audit intermediates

`DesignResult` MUST add: `Mp`, `Lp`, `Lr`, `MnFlange`, `MnWeb`, `MnLTB`,
`Fe`, `Mcr`, `Mr`, `Md1`, `Md2`, `classification` (enum `"COMPACT" |
"NON_COMPACT" | "SLENDER"`), `lambdaF`, `lambdaW`, `lambdaPf`, `lambdaRf`,
`lambdaPw`, `lambdaRw`. N·mm stays at the type level; cm³ inputs convert
via `×1e3` inside `checkBeam()` (pattern from bugfix #131). All fields MUST
be finite numbers for valid profile and Fy in {235, 275, 355}.

#### Scenario: All fields present and finite

- GIVEN a valid profile and `Fy = 235`
- WHEN `checkBeam()` returns
- THEN every named field is a finite `number` and `classification` is
  one of the three enum values

### Requirement: Lb selected by moment sign at |Mu| max

`checkBeam()` MUST receive `Mu` (N·mm) as an extra parameter. Effective
`Lb` equals `Mu ≥ 0 ? Lb1 : Lb2` evaluated at the `|Mu|` max section.
When `Mu = 0`, `Lb = Lb1`. Selection runs once per call.

#### Scenario: Positive moment picks Lb1

- GIVEN `Lb1 = 4000`, `Lb2 = 8000`, and `|Mu| max` section with
  `Mu = 30 kN·m` (sagging)
- WHEN `checkBeam()` runs
- THEN the LTB branch uses `Lb = 4000` mm

#### Scenario: Negative moment picks Lb2

- GIVEN `Lb1 = 4000`, `Lb2 = 8000`, and `|Mu| max` section with
  `Mu = -25 kN·m` (hogging)
- WHEN `checkBeam()` runs
- THEN the LTB branch uses `Lb = 8000` mm

### Requirement: Section classification enum

`classification` MUST equal `"COMPACT"` when `lambdaF ≤ lambdaPf` AND
`lambdaW ≤ lambdaPw`; `"SLENDER"` when `lambdaF > lambdaRf` OR
`lambdaW > lambdaRw`; `"NON_COMPACT"` otherwise. The enum is computed
once per call from the chosen Fy and the profile geometry.

#### Scenario: Compact when both λ below λ_p

- GIVEN `lambdaF = 4`, `lambdaPf = 9`, `lambdaW = 25`, `lambdaPw = 90`
- WHEN the engine classifies
- THEN `classification = "COMPACT"`

#### Scenario: Slender when any λ above λ_r

- GIVEN `lambdaW = 200 > lambdaRw`
- WHEN the engine classifies
- THEN `classification = "SLENDER"`

### Requirement: Mr and Mcr formulas for doubly-symmetric I

`Mr` MUST equal `0.7·Fy·Sx` (N·mm, Sx in cm³ ×1e3). `Mcr` MUST equal
`Fe · Sx`, where `Fe` is the elastic LTB stress from AISC F4-11. The
`Fe` value MUST be saved on `DesignResult`, not just used locally.

#### Scenario: Mr at Lb = Lr reduces to 0.7·Fy·Sx

- GIVEN the elastic-LTB branch with `Lb = Lr`
- WHEN the engine computes Mr
- THEN `Mr = 0.7·Fy·Sx·1e3` N·mm

### Requirement: Md1 covers local-buckling limit state

`Md1` MUST equal `φ · min(MnFlange, MnWeb)` for flange- and web-local
buckling. `MnFlange` and `MnWeb` follow the AISC F3-2 linear
interpolation between Mp and 0.7·Fy·Sx, applied only when the
respective element is non-compact. If both compact, `Md1 = φ · Mp`.

#### Scenario: Both compact

- GIVEN flange and web both compact
- WHEN the engine computes Md1
- THEN `Md1 = φ · Mp`

#### Scenario: Non-compact flange

- GIVEN `lambdaPf < lambdaF < lambdaRf`, web compact
- WHEN the engine computes Md1
- THEN `Md1 = φ · MnFlange`

### Requirement: Md2 covers LTB limit state

`Md2` MUST equal `φ · MnLTB(Lb)`. `MnLTB` follows the AISC elastic-LTB
expression with the F4-11 `Fe` and the call's `Cb`. The `Lb` argument
MUST be the sign-selected value. `Md2` MUST be computed for every
valid call.

#### Scenario: Inelastic range

- GIVEN `Lp < Lb ≤ Lr`, `Cb = 1.0`
- WHEN the engine computes Md2
- THEN `MnLTB` uses the inelastic interpolation and `Md2 = 0.9 · MnLTB`

#### Scenario: Elastic range

- GIVEN `Lb > Lr`
- WHEN the engine computes Md2
- THEN `MnLTB = min(Fe·Sx, Mp)` and `Md2 = 0.9 · MnLTB`
