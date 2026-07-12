# Steel Beam Load Split Specification

## Purpose

Define how the steel beam calculator carries independent dead (D) and live (L)
load magnitudes. Per-load elastic analyses combine via U = 1.2·D + 1.6·L to
drive reactions, shear, moment, and design.

## Requirements

### Requirement: Load type carries independent D and L

`Load` MUST include `deadLoad: number` and `liveLoad: number`. `magnitude`
MAY remain as an optional field equal to `deadLoad + liveLoad`. Both MUST be
non-negative finite numbers.

#### Scenario: New load carries both fields

- GIVEN a new load with `deadLoad = 5` and `liveLoad = 3`
- WHEN the load is serialized
- THEN both fields persist; `magnitude` (if present) equals 8

#### Scenario: Legacy load migrates from magnitude

- GIVEN a saved record with `magnitude = 8` and no D/L fields
- WHEN the form loads the record
- THEN `deadLoad = 8`, `liveLoad = 0`, with a migration notice

### Requirement: Form accepts D and L independently

Each load row MUST render two numeric inputs labeled "D" and "L". Submission
MUST be disabled when BOTH `deadLoad` and `liveLoad` are <= 0.

#### Scenario: At least one of D or L is positive

- GIVEN a load with D = 5, L = 3 OR D = 0, L = 5
- WHEN the user submits
- THEN the form validates and navigates to results

#### Scenario: Both D and L are zero

- GIVEN a load with D = 0 and L = 0
- WHEN the user attempts to submit
- THEN the submit button is disabled

### Requirement: Two-pass elastic analysis per load

The solver MUST run elastic analysis twice: once with each load's `deadLoad`
and once with `liveLoad`. Results MUST include per-support per-load reactions
(`Ra_D`, `Rb_D`, `Ra_L`, `Rb_L` — extended for multi-span).

#### Scenario: Simple span, distributed D and L

- GIVEN a simply supported beam, L = 4 m, D = 100 kg/m, L = 200 kg/m
- WHEN the analysis runs
- THEN Ra_D = Rb_D = 200 kg; Ra_L = Rb_L = 400 kg
- AND M_D_max = 200 kg·m, M_L_max = 400 kg·m at midspan

### Requirement: LRFD ultimate combination

Ultimate functions MUST equal `V_U(x) = 1.2·V_D(x) + 1.6·V_L(x)` and
`M_U(x) = 1.2·M_D(x) + 1.6·M_L(x)`. `maxShear` and `maxMoment` reported
downstream MUST derive from these functions.

#### Scenario: Combination on a uniform span

- GIVEN the L = 4 m, D = 100 kg/m, L = 200 kg/m case (V_D_max = 200, V_L_max = 400)
- WHEN combination runs
- THEN V_U_max = 880 kg; M_U_max = 880 kg·m
- AND for the kN fixture (D=5, L=3, span 6 m): w_U = 1.2·5 + 1.6·3 = 10.8 kN/m

### Requirement: Ultimate-only diagrams

Shear and moment diagrams MUST render from `V_U` and `M_U` only — no
per-load diagrams (option B).

#### Scenario: Diagram source

- GIVEN a solved beam
- WHEN the user views the diagrams
- THEN both plot ultimate functions; no per-load plots appear

### Requirement: Design check consumes ultimate demand and service moment

`checkBeam()` MUST receive `M_U` and `V_U` as ultimate demand. The service
moment for deflection MUST equal `M_D + M_L` (unfactored), replacing the prior
`/ 1.4` heuristic. Other design internals (LRFD limits, Lb, Cb, deflection
limit) MUST remain unchanged.

#### Scenario: Service moment is unfactored

- GIVEN M_D_max = 2 kN·m and M_L_max = 1 kN·m
- WHEN `checkBeam()` is called
- THEN the service moment passed for deflection equals 3 kN·m

### Requirement: Persistence preserves D and L

Saved beam records MUST round-trip `deadLoad` and `liveLoad` per load through
the storage layer. `magnitude` SHOULD be preserved alongside for legacy
readers.

#### Scenario: Save and reload preserves D and L

- GIVEN a beam whose loads all have `deadLoad` and `liveLoad`
- WHEN the user saves the beam and reloads it from the saved list
- THEN loads retain their `deadLoad` and `liveLoad` values
