# Slab D/L Reactions Specification

## Purpose

Define 8 unfactored D/L-separated reaction fields per edge in `SlabResult`, enabling slab-to-beam load transfer without double-majoration.

## Requirements

### Requirement: D/L Reaction Fields

`SlabResult` MUST expose `RD_izq`, `RL_izq`, `RD_der`, `RL_der`, `RD_arr`, `RL_arr`, `RD_aba`, `RL_aba` (kN/m). Existing factored fields (`RxIzq`, `RxDer`, `RyArr`, `RyAba` via `qu`) and aggregate `Rx`, `Ry` MUST remain unchanged.

#### Scenario: New analysis populates D/L

- GIVEN a slab analyzed with Kalmanok data WHEN `SlabResult` is returned THEN all 8 D/L fields are numeric AND existing factored fields are intact

#### Scenario: Legacy save returns undefined

- GIVEN a slab saved before this change WHEN `loadSlab()` returns it THEN all 8 D/L fields are `undefined` AND existing per-edge fields remain

### Requirement: D/L Computation Formula

Each D/L reaction MUST use the same coefficient and formula as the `qu` reaction but substitute `q_D = D_total` for the D pass and `q_L = L` for the L pass. No LRFD factors apply. Self-weight (`gSelf`) counts as D.

#### Scenario: D reaction mirrors qu formula

- GIVEN `CRx = 0.35, lShort = 4 m, D_total = 5 kN/m², L = 3 kN/m²` THEN `RD_izq = 0.35 · 5 · 4 = 7 kN/m` AND `RL_izq = 0.35 · 3 · 4 = 4.2 kN/m`

#### Scenario: Self-weight is dead load

- GIVEN `gSelf = 2.5 kN/m²` AND superimposed dead = 1.5 kN/m² THEN `D_total = 4 kN/m²` (gSelf included) AND `L` is unaffected
