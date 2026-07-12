# column-print Specification

## Purpose

Provide an A4 print-friendly planilla for column results, replicating the beam print pattern from `PrintPage`.

## Requirements

### Requirement: Print button in results

The system MUST provide an "Imprimir" button in `ColumnResults` that navigates to `/column-print` passing `ColumnState` via router state.

#### Scenario: Navigate to print with state

- GIVEN the user has submitted column form and is viewing results
- WHEN the user clicks "Imprimir"
- THEN the browser navigates to `/column-print` with `ColumnState` in `location.state`

#### Scenario: Print button disabled or hidden when no valid state

- GIVEN `ColumnResults` has no valid state
- WHEN rendering the empty/no-data view
- THEN the "Imprimir" button MUST NOT be rendered

### Requirement: Print page with nav state

The system MUST provide a `ColumnPrintPage` component at route `/column-print` that recalculates results from `ColumnState` using the column calculation engine.

#### Scenario: Recalculate and render planilla

- GIVEN `ColumnPrintPage` receives a valid `ColumnState` via router state
- WHEN the component mounts
- THEN it MUST recalculate results using `designColumn()` (or `computeBuiltUpI`/`computeBuiltUpBox` for built-up profiles)
- AND render an A4 planilla showing: profile info, input summary, results (φPn, φMnx, φMny, P_u/P_c ratio), interaction ratio, pasó/no pasó
- AND the detailed steps from `result.steps` MUST be rendered

### Requirement: Print page fallback to saved columns

The system MUST show a list of saved columns (type `"columna"`) when no router state is present, allowing the user to select one for printing.

#### Scenario: No nav state shows saved columns

- GIVEN the user navigates directly to `/column-print` without state
- WHEN the component renders
- THEN it MUST display `SavedBeams` filtered by `type="columna"` for selection
- AND selecting a saved column MUST recalculate and render the planilla

### Requirement: Call window.print on mount

The system MUST call `window.print()` when the planilla is rendered and ready.

#### Scenario: Print dialog opens

- GIVEN `ColumnPrintPage` has rendered the planilla (either from nav state or saved selection)
- WHEN the component mounts or selection changes
- THEN `window.print()` is called to open the browser print dialog
- AND the print layout uses A4 format with 12mm margins via `@media print` CSS
