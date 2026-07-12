# Delta for Slab Persistence

## ADDED Requirements

### Requirement: Backward-Compatible Per-Edge Deserialization

The `loadSlab()` function MUST return `SlabResult` records with `RxIzq`, `RxDer`, `RyArr`, `RyAba` as `undefined` when loading legacy saves that lack these fields. New saves MUST serialize all 4 fields automatically through the existing `JSON.stringify` path without migration logic.

#### Scenario: Legacy slab loads gracefully

- GIVEN a saved slab from before the per-edge change WHEN `loadSlab(id)` is called THEN the returned `SlabResult` has `RxIzq`, `RxDer`, `RyArr`, `RyAba` as `undefined` AND existing `Rx`, `Ry` are intact

#### Scenario: New slab round-trips all fields

- GIVEN a slab is saved via `saveSlab()` with per-edge reactions populated WHEN `loadSlab()` retrieves it THEN all 4 per-edge fields are present with their original numeric values
