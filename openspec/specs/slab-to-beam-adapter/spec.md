# Slab-to-Beam Adapter Specification

## Purpose

Convert `SlabResult` per-edge D/L reactions into `Load[]` entries for the steel beam calculator, preserving independent D and L magnitudes.

## Requirements

### Requirement: slabReactionToBeamLoad

The system MUST export `slabReactionToBeamLoad(result: SlabResult, edge: Edge, start: number, end: number): Load | null`. `Edge` is `"izq" | "der" | "arr" | "aba"`. The returned `Load` MUST have `type: "distributed"`.

#### Scenario: Valid conversion

- GIVEN `RD_izq = 12.5, RL_izq = 8.3, start = 0, end = 4` WHEN called with `edge: "izq"` THEN returns `{ type: "distributed", deadLoad: 12.5, liveLoad: 8.3, start: 0, end: 4 }`

#### Scenario: Legacy slab returns null

- GIVEN a legacy result where any RD/RL is `undefined` WHEN called THEN returns `null`

### Requirement: Edge-to-Field Mapping

Each edge MUST map to its D/L pair: `"izq"` → `RD_izq/RL_izq`, `"der"` → `RD_der/RL_der`, `"arr"` → `RD_arr/RL_arr`, `"aba"` → `RD_aba/RL_aba`.

#### Scenario: All 4 edges map correctly

- GIVEN a result with all 8 fields populated WHEN calling for each edge THEN the correct D/L pair is returned

### Requirement: Non-Negative Output

Both `deadLoad` and `liveLoad` in the returned `Load` MUST be non-negative finite numbers. Negative values MUST be clamped to zero.

#### Scenario: Negative RD clamped to zero

- GIVEN `RD_izq = -2` (theoretical tension) WHEN called THEN `deadLoad` is 0
