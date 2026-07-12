# column-save Specification

## Purpose

Enable users to save, list, load, and delete column configurations in localStorage, replicating the beam save pattern from `FormPage`.

## Requirements

### Requirement: Save column configuration

The system MUST provide a "Guardar" button in `ColumnForm` that prompts the user for a name and persists the current `ColumnState` to localStorage.

#### Scenario: Save a column with valid inputs

- GIVEN the user has filled all column form fields (profileType, profileName, Pu, Mux, Muy, L, Kx, Ky, Fy)
- WHEN the user clicks "Guardar" and enters "columna eje 5" in the prompt
- THEN `saveBeam("columna eje 5", "columna", { ...ColumnState })` is called
- AND the entry appears in the `SavedBeams` list filtered by type "columna"

#### Scenario: Cancel or empty name on save

- GIVEN the user has filled column form fields
- WHEN the user clicks "Guardar" and cancels the prompt or enters an empty name
- THEN nothing is saved to localStorage
- AND no entry appears in the `SavedBeams` list

#### Scenario: Column data payload includes all fields

- GIVEN the user saves a column configuration
- WHEN inspecting the saved data
- THEN it MUST include profileType, profileName, upnName, upnGap, tubeName, armadaBf, armadaTf, armadaHw, armadaTw, cajonH, cajonB, cajonT, Pu, Mux, Muy, L, Kx, Ky, Fy

### Requirement: Load saved column

The system MUST provide a "Cargar" button next to each saved column entry that restores all form fields from the saved data.

#### Scenario: Load saved column restores all fields

- GIVEN there is a saved column named "columna eje 5"
- WHEN the user clicks "Cargar" on that entry
- THEN all form fields (profileType, profileName, dimensions, loads, Kx, Ky, L, Fy) are set to the saved values
- AND the `SavedBeams` accordion closes

### Requirement: Delete saved column

The system MUST provide an "Eliminar" button next to each saved column entry that removes it from localStorage.

#### Scenario: Delete removes entry

- GIVEN there is a saved column named "columna eje 5"
- WHEN the user clicks "Eliminar" on that entry
- THEN `deleteSave(id)` is called
- AND the entry is removed from localStorage
- AND the entry disappears from the `SavedBeams` list

### Requirement: Extend storage types

The system MUST extend the `SavedBeam.type` union in `storage.ts` to include `"columna"`.

#### Scenario: Beam saves unchanged

- GIVEN existing beam saves exist with type `"acero"` or `"hormigon"`
- WHEN the file is modified
- THEN existing `saveBeam()`, `listSaves()`, and `deleteSave()` calls for beams MUST continue to work unchanged

### Requirement: SavedBeams component type extension

The `SavedBeams` component MUST accept `"columna"` in its `type` prop union and MUST display a context-appropriate heading ("Columnas guardadas" instead of "Vigas guardadas").

#### Scenario: SavedBeams shows "Columnas guardadas"

- GIVEN `SavedBeams` is rendered with `type="columna"`
- WHEN the accordion header displays
- THEN it reads "Columnas guardadas" instead of "Vigas guardadas"

#### Scenario: SavedBeams filters by type

- GIVEN column saves exist alongside beam saves
- WHEN `SavedBeams` renders with `type="columna"`
- THEN only entries with `type === "columna"` appear in the list
