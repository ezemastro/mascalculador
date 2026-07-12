# Slab Persistence Specification

## Purpose

Enable users to save individual slab design results to `localStorage` and load them later. Slab records are stored alongside beam/column saves using the same `mascalculador_beam_saves` key, differentiated by the `"losa"` type tag.

## Requirements

### Requirement: Losa Type in SavedBeam Union

The `SavedBeam.type` union MUST include `"losa"`. The `Props.type` union in `SavedBeams.tsx` MUST also include `"losa"`.

- GIVEN a slab is saved via `saveSlab()` THEN the resulting `SavedBeam` has `type: "losa"`
- GIVEN `getSavedSlabs()` is called THEN only beams with `type: "losa"` are returned

### Requirement: saveSlab

The system MUST provide a `saveSlab(name, input, result)` function that persists a slab design. It MUST accept a string name, a `SlabInput`, and a `SlabResult`, and store them in `localStorage` wrapped in the existing `saveBeam()` infrastructure.

- GIVEN `saveSlab("mi_losa", input, result)` is called THEN a new `SavedBeam` with `type: "losa"` exists in `localStorage`
- GIVEN the slab is persisted THEN the full `SlabInput` and `SlabResult` are retrievable via `loadSlab()`

### Requirement: getSavedSlabs

The system MUST provide a `getSavedSlabs()` function that returns all saved slabs as `SavedBeam[]`, filtered by `type: "losa"`.

- GIVEN there are 3 saved slabs and 2 saved beams WHEN `getSavedSlabs()` is called THEN exactly 3 results are returned

### Requirement: loadSlab

The system MUST provide a `loadSlab(id)` function that returns `SavedSlabData { input: SlabInput; result: SlabResult } | null` given a slab's ID.

- GIVEN a slab with the given ID exists WHEN `loadSlab(id)` is called THEN the full `SavedSlabData` is returned
- GIVEN no slab with the given ID exists WHEN `loadSlab(id)` is called THEN `null` is returned

### Requirement: deleteSlab

The system MUST provide a `deleteSlab(id)` function that removes a slab by its ID.

- GIVEN a slab with the given ID exists WHEN `deleteSlab(id)` is called THEN the slab is removed from storage
- GIVEN `loadSlab(id)` is called after deletion THEN `null` is returned

### Requirement: Backward-Compatible Per-Edge Deserialization

The `loadSlab()` function MUST return `SlabResult` records with `RxIzq`, `RxDer`, `RyArr`, `RyAba` as `undefined` when loading legacy saves that lack these fields. New saves MUST serialize all 4 fields automatically through the existing `JSON.stringify` path without migration logic.

- GIVEN a saved slab from before the per-edge change WHEN `loadSlab(id)` is called THEN the returned `SlabResult` has `RxIzq`, `RxDer`, `RyArr`, `RyAba` as `undefined` AND existing `Rx`, `Ry` are intact
- GIVEN a slab is saved via `saveSlab()` with per-edge reactions populated WHEN `loadSlab()` retrieves it THEN all 4 per-edge fields are present with their original numeric values
