# column-persistence Specification

## Purpose

Ensure column form input values survive navigation and page refresh, replicating the beam form persistence pattern.

## Requirements

### Requirement: Auto-save form state on change

The system MUST automatically save the current `ColumnState` to localStorage key `"mascalculador_last_column_form"` on every state change via a `useEffect`.

#### Scenario: Auto-save on field change

- GIVEN the user is editing column form fields
- WHEN the user changes any field (profile type, load, dimension, Fy, etc.)
- THEN `saveLastColumnFormState(ColumnState)` is called
- AND the value at localStorage key `"mascalculador_last_column_form"` is updated

### Requirement: Init hierarchy — state > lastForm > defaults

The system MUST initialize `ColumnForm` state using a priority chain: router state > last saved form > hardcoded defaults.

#### Scenario: Router state takes priority

- GIVEN the user navigates back from `ColumnResults` via "← Volver" with `ColumnState` in router state
- WHEN `ColumnForm` mounts
- THEN all fields are initialized from router state, not from localStorage

#### Scenario: Refresh restores last form

- GIVEN the user has previously filled column form fields
- WHEN the user refreshes the page (F5)
- THEN all fields are restored from `"mascalculador_last_column_form"` in localStorage
- AND the form shows the last entered values

#### Scenario: Clean session shows defaults

- GIVEN the user navigates to `/columns` directly with no prior session and no router state
- WHEN `ColumnForm` mounts
- THEN the form shows hardcoded defaults (IPN 200, Pu=100, Mux=20, Muy=5, L=3000, Kx=1.0, Ky=1.0, Fy=235)

### Requirement: Back navigation passes state

The system MUST pass the full `ColumnState` back when navigating from `ColumnResults` to `/columns` via "← Volver".

#### Scenario: Back navigation preserves state

- GIVEN the user is viewing column results
- WHEN the user clicks "← Volver"
- THEN `navigate("/columns", { state: fullColumnState })` is called
- AND the form shows the same values as before submission

#### Scenario: Auto-save triggered after loading saved column

- GIVEN the user loads a saved column via "Cargar"
- WHEN the form fields are restored
- THEN the `useEffect` auto-save fires
- AND `"mascalculador_last_column_form"` is updated with the loaded values
