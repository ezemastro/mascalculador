# Delta for Slab Persistence

## MODIFIED Requirements

### Requirement: Backward-Compatible Per-Edge Deserialization

`loadSlab()` MUST return `SlabResult` records with the 8 D/L fields (`RD_izq`, `RL_izq`, `RD_der`, `RL_der`, `RD_arr`, `RL_arr`, `RD_aba`, `RL_aba`) as `undefined` when loading legacy saves that lack them. New saves MUST serialize all 12 per-edge fields (4 factored + 8 D/L) automatically via `JSON.stringify` without migration logic.
(Previously: Only 4 factored per-edge fields were covered by backward compatibility)

#### Scenario: Legacy slab without D/L fields

- GIVEN a saved slab from before the D/L split WHEN `loadSlab(id)` is called THEN the 8 D/L fields are `undefined` AND the 4 factored per-edge fields are intact

#### Scenario: New slab round-trips all 12 fields

- GIVEN a slab saved via `saveSlab()` with D/L reactions populated WHEN `loadSlab()` retrieves it THEN all 12 per-edge fields are present with their original numeric values
