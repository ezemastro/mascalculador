# Viga Continua Results Save Specification

## Purpose

Add a "Guardar" / "Guardar corrección" button to the `VigaContinuaResults` screen so users can persist a named snapshot of the solved beam (input + envelope) and update the same id on subsequent visits. The button mirrors the form's save contract but persists the result envelope (a `BeamEnvelopeResult`) alongside the input. The envelope in the payload MUST be the value already rendered on screen at the moment of the click — the save handler MUST NOT re-trigger a solve.

## Requirements

### Requirement: "Guardar" button in results header

`VigaContinuaResults` SHALL render a "Guardar" / "Guardar corrección" button in its header action area. The label SHALL be "Guardar" when `loadedSaveId === null` and "Guardar corrección" when `loadedSaveId` is set.

#### Scenario: Cold-open results shows "Guardar"

- GIVEN the user reaches `/viga-continua-results` from a fresh form submission with no `loadedSaveId`
- WHEN the results screen mounts
- THEN the action button reads "Guardar"

#### Scenario: Results reached after a loaded beam shows "Guardar corrección"

- GIVEN the user submits a form whose `loadedSaveId === "abc"` (loaded from `<SavedBeams>` earlier in the session)
- WHEN the results screen mounts
- THEN the action button reads "Guardar corrección"

### Requirement: Mount-time seeding from location.state

`VigaContinuaResults` SHALL initialize its local `loadedSaveId` / `loadedSaveName` state from `location.state.loadedSaveId` / `location.state.loadedSaveName` on mount. A hard refresh of `/viga-continua-results` SHALL reset both to `null` because router state is not persisted across refreshes.

#### Scenario: Mount seeds from router state

- GIVEN `location.state.loadedSaveId === "abc"` and `loadedSaveName === "v1"`
- WHEN `VigaContinuaResults` mounts
- THEN local `loadedSaveId` state equals `"abc"` and `loadedSaveName` equals `"v1"`
- AND the button label reads "Guardar corrección"

#### Scenario: Hard refresh resets save state

- GIVEN the user hard-refreshes `/viga-continua-results`
- WHEN the results screen remounts
- THEN local `loadedSaveId === null` AND `loadedSaveName === null`
- AND the button label reads "Guardar"

### Requirement: First save persists input + envelope

When `loadedSaveId === null` and the user clicks "Guardar", the screen MUST prompt for a name via `window.prompt`, call `saveVigaContinua(name, { input, envelope })`, and on success MUST set BOTH local `loadedSaveId` AND `loadedSaveName` together. The envelope SHALL be the `BeamEnvelopeResult` already computed and rendered on screen at click time.

#### Scenario: First save from results

- GIVEN `loadedSaveId === null` and a solved envelope is on screen
- WHEN the user clicks "Guardar" and enters "v1"
- THEN `saveVigaContinua("v1", { input, envelope })` is called
- AND the button label switches to "Guardar corrección"
- AND `envelope` in the payload equals the on-screen envelope

#### Scenario: Duplicate name surfaces via alert

- GIVEN a save named "v1" of type "viga-continua" already exists
- WHEN `saveVigaContinua("v1", ...)` throws
- THEN `alert(error.message)` is shown
- AND no partial state mutation occurs

#### Scenario: Empty prompt is a no-op

- GIVEN `loadedSaveId === null`
- WHEN the user clicks "Guardar" and cancels the prompt
- THEN nothing is written AND `loadedSaveId` stays `null`

### Requirement: Re-save updates the same id silently

When `loadedSaveId` is set, clicking "Guardar corrección" MUST re-prompt for a name (consistency with sibling forms) and MUST call `updateVigaContinua(loadedSaveId, { input, envelope })` silently — no duplicate-name error, no second save created. Exactly one `window.prompt` call SHALL happen per click.

#### Scenario: Re-save overwrites the same id

- GIVEN `loadedSaveId === "abc"` and a re-computed envelope is on screen
- WHEN the user clicks "Guardar corrección" and enters "v1" (or any name) in the prompt
- THEN `updateVigaContinua("abc", { input, envelope })` is called
- AND no `Ya existe un elemento guardado` error is thrown
- AND exactly one entry with id `"abc"` exists in `getSavedVigasContinuas()`

#### Scenario: Single prompt per click

- GIVEN `loadedSaveId === "abc"`
- WHEN the user clicks "Guardar corrección"
- THEN exactly one `window.prompt` call happens
- AND no additional prompts fire for the same click

#### Scenario: Empty prompt on re-save aborts

- GIVEN `loadedSaveId === "abc"`
- WHEN the user clicks "Guardar corrección" and cancels the prompt
- THEN nothing is written AND the existing entry stays unchanged

### Requirement: Envelope snapshotted at click time

The envelope included in the save payload SHALL be the value already computed and rendered on screen at the moment the user clicks "Guardar". The save handler MUST NOT trigger a re-compute of the envelope (no `calculateBeamEnvelope` call inside the handler).

#### Scenario: Envelope payload equals on-screen value

- GIVEN the rendered envelope shows `spanMuPos[i] = M` for each span
- WHEN the user clicks "Guardar"
- THEN `envelope.spanMuPos[i]` in the payload equals `M`
- AND no `calculateBeamEnvelope` call happens inside the save handler
