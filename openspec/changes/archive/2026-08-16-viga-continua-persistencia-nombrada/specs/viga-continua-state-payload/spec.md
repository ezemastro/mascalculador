# Viga Continua State Payload Specification

## Purpose

Define the shape of `VigaContinuaState` and how it travels between the form and the results screen via React Router's `location.state`. The state carries the analysis inputs (`spans`, `supportTypes`, `loads`) and, when a save is loaded or in-flight, the optional `loadedSaveId` and `loadedSaveName` so the results screen can re-save the same id without prompting twice for the same beam. Setting both fields together is a hard contract: the `BasesForm` regression (only `loadedSaveName`) is explicitly disallowed.

## Requirements

### Requirement: VigaContinuaState optional save fields

`VigaContinuaState` MUST extend its current shape with two optional fields: `loadedSaveId?: string` and `loadedSaveName?: string`. These fields SHALL be present when the state was produced by a `<SavedBeams>.onLoad` hydration or a previous successful "Guardar" click; they SHALL be absent (or `undefined`) on a cold open. No other fields of `VigaContinuaState` SHALL change shape.

#### Scenario: Cold open has no save fields

- GIVEN the user navigates to `/viga-continua` for the first time
- WHEN the form initializes
- THEN `loadedSaveId` and `loadedSaveName` are `undefined`
- AND the form behaves like a fresh analysis

#### Scenario: Hydrated state carries both fields together

- GIVEN the user selects a saved beam in `<SavedBeams>`
- WHEN the form populates
- THEN `loadedSaveId` equals the saved id AND `loadedSaveName` equals the saved name
- AND no code path sets one without the other

### Requirement: State travels via location.state

Submitting the form MUST pass `VigaContinuaState` (including any optional save fields) via `location.state` to `/viga-continua-results`. The results screen SHALL read these fields from `location.state` on mount and seed its local `loadedSaveId` / `loadedSaveName` state from them. Router state is intentionally lossy across hard refreshes — that limitation is accepted and documented.

#### Scenario: Form → Results carries loadedSaveId

- GIVEN the user submits a form whose `loadedSaveId === "abc"`
- WHEN the app navigates to `/viga-continua-results`
- THEN `location.state.loadedSaveId === "abc"`
- AND the results screen's local `loadedSaveId` initializes to `"abc"`
- AND the results "Guardar" button label is "Guardar corrección"

#### Scenario: Hard refresh of results loses save fields

- GIVEN the user reaches `/viga-continua-results` from a submit
- WHEN the user hard-refreshes that route
- THEN `location.state` is empty
- AND the results screen initializes with `loadedSaveId === null`
- AND the "Guardar" button label falls back to "Guardar" (a new save will be created on click)

### Requirement: Form hydration sets both fields from every source

`VigaContinuaForm` MUST hydrate `loadedSaveId` and `loadedSaveName` together from any source that produces them: the `<SavedBeams>.onLoad` callback, the `useEffect` that restores `loadLastVigaContinuaFormState` (when it carries them), and the `handleSave` callback after a successful first save. Setting only one of the two SHALL NOT happen.

#### Scenario: Saved beam load sets both fields

- GIVEN the `<SavedBeams>` `onLoad` callback fires with `{ id: "abc", name: "v1" }`
- WHEN the callback completes
- THEN `loadedSaveId === "abc"` AND `loadedSaveName === "v1"`
- AND subsequent "Guardar" clicks behave as updates (no duplicate-name error)

#### Scenario: First save seeds both fields

- GIVEN `loadedSaveId === null`
- WHEN `handleSave` successfully calls `saveVigaContinuaInput(...)`
- THEN `setLoadedSaveId(returned.id)` AND `setLoadedSaveName(promptedName)` are called
- AND the next click triggers an update, not a new save

#### Scenario: Auto-persist does not invent a save id

- GIVEN `loadLastVigaContinuaFormState()` returns a state without `loadedSaveId`
- WHEN the form mounts from that auto-save
- THEN the form does NOT auto-promote the user into "edit existing" mode
- AND `loadedSaveId` stays `null`
