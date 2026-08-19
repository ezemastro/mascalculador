# Viga Continua Persistence Specification

## Purpose

Enable users to save individual viga-continua analysis configurations to `localStorage`, list them in `<SavedBeams>`, and re-save them in place. Saves live alongside other concrete-app saves (slabs, bases, columns, pórtico) under `app="concrete"`, differentiated by the new `"viga-continua"` type tag so names don't collide across types. The form MUST mirror the canonical "Guardar" pattern used by the other six forms (re-prompt on re-save, set `loadedSaveId` AND `loadedSaveName` together).

## Requirements

### Requirement: `"viga-continua"` in SaveType union

The `SaveType` union in `viga-continua/shared/src/storage.ts` MUST include `"viga-continua"`. The `SavedBeams` component's `type` prop union MUST also include `"viga-continua"`. Existing members SHALL remain unchanged.

#### Scenario: New tag accepted by TypeScript

- GIVEN a `SaveType` value
- WHEN the literal `"viga-continua"` is assigned
- THEN TS compilation succeeds AND no other member is removed

#### Scenario: SavedBeams filters by new tag

- GIVEN `<SavedBeams app="concrete" type="viga-continua" />` mounts
- WHEN the component renders
- THEN the header reads "Vigas guardadas"
- AND the list filters entries by `type === "viga-continua"`

### Requirement: Per-app storage wrapper

`viga-continua/src/lib/storage.ts` (NEW) MUST hardcode `app="concrete"` and re-export every viga-continua persistence helper, mirroring `hormigon/src/lib/storage.ts`. The wrapper MUST NOT expose any function that lets callers pass a different `app`.

#### Scenario: Wrapper hardcodes concrete app

- GIVEN `viga-continua/src/lib/storage.ts`
- WHEN `saveVigaContinuaInput("v1", input)` runs via the wrapper
- THEN the underlying call is `saveBeam("concrete", "v1", "viga-continua", ...)`

### Requirement: VigaContinuaLastFormState auto-persist

`VigaContinuaLastFormState` MUST carry every field of `VigaContinuaState` (including optional `loadedSaveId` / `loadedSaveName`). `saveLastVigaContinuaFormState(state)` MUST write to the `concrete:vigaContinuaLastFormState` key and silently swallow quota errors. `loadLastVigaContinuaFormState()` MUST return the parsed state or `null`.

#### Scenario: Auto-persist on every change

- GIVEN the user edits any field in `VigaContinuaForm`
- WHEN the form re-renders
- THEN `saveLastVigaContinuaFormState(currentState)` runs
- AND the key is updated

#### Scenario: Hard refresh restores last state

- GIVEN the user reloads `/viga-continua` after editing
- WHEN `VigaContinuaForm` mounts
- THEN `loadLastVigaContinuaFormState()` returns the last state
- AND fields initialize from it (priority: router state > last form > defaults)

### Requirement: Named-save helpers (input-only)

`saveVigaContinuaInput(name, input)` MUST persist `{ input }` under `type="viga-continua"` and throw on duplicate `(name, type)`. `updateVigaContinuaInput(id, input)` MUST overwrite the same id silently. `getSavedVigasContinuas()` MUST return entries where `type === "viga-continua"`. `loadVigaContinua(id)` MUST return `{ input } | null`. `deleteVigaContinua(id)` MUST remove the entry.

#### Scenario: First save creates a new entry

- GIVEN no prior save named "v1" of type "viga-continua"
- WHEN `saveVigaContinuaInput("v1", input)` runs
- THEN a new `SavedBeam` with `type="viga-continua"` and `data.input` exists
- AND `getSavedVigasContinuas()` returns it

#### Scenario: Duplicate name throws

- GIVEN a save named "v1" of type "viga-continua" exists
- WHEN `saveVigaContinuaInput("v1", input)` runs
- THEN an error containing `Ya existe un elemento guardado con el nombre "v1"` is thrown

#### Scenario: Update overwrites silently

- GIVEN an existing save with id `abc` and type "viga-continua"
- WHEN `updateVigaContinuaInput("abc", input)` runs
- THEN `data.input` is overwritten AND id/name are preserved AND no error is thrown

### Requirement: `<SavedBeams>` mount in VigaContinuaForm

`VigaContinuaForm` SHALL mount `<SavedBeams app="concrete" type="viga-continua" onLoad={...} />`. The `onLoad` callback MUST hydrate every field from `data.input` AND MUST set BOTH `loadedSaveId` AND `loadedSaveName` together — the `BasesForm` regression (only `loadedSaveName`) is explicitly forbidden.

#### Scenario: Selecting a saved beam hydrates the form

- GIVEN a saved viga-continua with id "abc" and name "v1"
- WHEN the user clicks "Cargar" on that entry
- THEN `spans`, `supportTypes`, and `loads` are populated from `data.input`
- AND `loadedSaveId === "abc"` AND `loadedSaveName === "v1"`

#### Scenario: Only-name bug produces duplicate error

- GIVEN the `onLoad` callback sets `loadedSaveName` but NOT `loadedSaveId`
- WHEN the user clicks "Guardar" twice with the same name
- THEN the second click throws a duplicate-name error
- AND this regression pattern is explicitly disallowed

### Requirement: "Guardar" button contract in the form

The form SHALL render a button labeled `"Guardar"` when `loadedSaveId === null` and `"Guardar corrección"` when `loadedSaveId` is set. Clicking when `loadedSaveId === null` MUST prompt via `window.prompt`, call `saveVigaContinuaInput(name, currentInput)`, and on success MUST set BOTH `loadedSaveId` AND `loadedSaveName` together. Clicking when `loadedSaveId` is set MUST re-prompt for a name (consistency with sibling forms) and MUST call `updateVigaContinuaInput(loadedSaveId, currentInput)` silently. Any thrown error SHALL surface via `alert(error.message)` with no partial state mutation.

#### Scenario: First save prompts and label switches

- GIVEN `loadedSaveId === null`
- WHEN the user clicks "Guardar" and enters "v1"
- THEN `saveVigaContinuaInput("v1", input)` runs
- AND the button label becomes "Guardar corrección"

#### Scenario: Re-save updates silently

- GIVEN `loadedSaveId === "abc"` and `loadedSaveName === "v1"`
- WHEN the user clicks "Guardar corrección" and enters any name
- THEN `updateVigaContinuaInput("abc", input)` runs
- AND no duplicate-name error is thrown

#### Scenario: Empty prompt is a no-op

- GIVEN any `loadedSaveId` state
- WHEN the user clicks the button and cancels the prompt
- THEN nothing is written AND no state changes

### Requirement: Saved-name affordance

When `loadedSaveId` is set, the form SHALL display a visible affordance naming the loaded save (e.g. `"Viga guardada: <name>"` in the header subtitle, or a badge next to the button). The affordance SHALL NOT appear when `loadedSaveId === null`.

#### Scenario: Subtitle shows loaded name

- GIVEN `loadedSaveId === "abc"` and `loadedSaveName === "v1"`
- WHEN `VigaContinuaForm` renders
- THEN the header subtitle contains the literal "v1"

#### Scenario: No affordance when no save loaded

- GIVEN `loadedSaveId === null`
- WHEN `VigaContinuaForm` renders
- THEN no "viga guardada" string appears in the header
