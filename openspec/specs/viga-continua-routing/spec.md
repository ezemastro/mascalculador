# Viga Continua Routing Specification

## Purpose

Routing and navigation wiring for the new Viga Continua analysis-only tool in `apps/concrete`. Makes `VigaContinuaForm` and `VigaContinuaResults` reachable via dedicated routes and a navbar link, distinct from the Viga H° RC design tool.

## Requirements

### Requirement: Viga Continua Routing

The system MUST render `VigaContinuaForm` at `/viga-continua` and `VigaContinuaResults` at `/viga-continua-results`. The NavBar MUST show a "Viga Continua" link to `/viga-continua`, distinct from the existing "Viga H°" link.

#### Scenario: Form route renders

- GIVEN the user navigates to `/viga-continua`
- WHEN the app loads
- THEN `VigaContinuaForm` renders

#### Scenario: Results route renders

- GIVEN `VigaContinuaForm` is submitted with valid input
- WHEN results are computed
- THEN the app navigates to `/viga-continua-results` with the analysis state

#### Scenario: Navbar shows distinct link

- GIVEN the NavBar renders
- WHEN inspected
- THEN a "Viga Continua" link to `/viga-continua` is present
- AND it is distinct from the "Viga H°" link

### Requirement: Route Wiring Location

Both routes MUST be registered in `apps/concrete/src/main.tsx` alongside the existing concrete routes.

#### Scenario: Routes registered in main.tsx

- GIVEN `apps/concrete/src/main.tsx`
- WHEN inspected
- THEN `/viga-continua` maps to `VigaContinuaForm`
- AND `/viga-continua-results` maps to `VigaContinuaResults`

### Requirement: Back Navigation

The results screen MUST provide a way to return to the form, preserving the analysis-only, stateless flow.

#### Scenario: Return to form

- GIVEN the user is on `/viga-continua-results`
- WHEN clicking the back control
- THEN the app navigates to `/viga-continua`

### Requirement: Mode selector (Viga Continua / Pórtico)

The form screen SHALL show a `ModeSelector` at the top with two options: `Viga Continua` and `Pórtico`. The default selection SHALL be `Viga Continua`. The selected mode SHALL be persisted in the URL as a query parameter `?mode=portico` (or omitted for the default) so deep-linking works.

#### Scenario: Default mode on first open

- GIVEN the user navigates to `/viga-continua` with no query string
- WHEN the form screen renders
- THEN the `ModeSelector` shows `Viga Continua` selected
- AND the beam form is rendered

#### Scenario: Mode persisted in URL

- GIVEN the user selects `Pórtico` in the `ModeSelector`
- WHEN the URL is inspected
- THEN it carries `?mode=portico`
- AND reloading the page re-opens in pórtico mode

#### Scenario: Deep-link to pórtico mode

- GIVEN the user navigates directly to `/viga-continua?mode=portico`
- WHEN the form screen renders
- THEN the `ModeSelector` shows `Pórtico` selected
- AND the pórtico form is rendered

### Requirement: Pórtico routing

Submitting the pórtico form SHALL navigate to `/viga-continua-results` with `mode: "portico"` carried in `location.state`. The results component SHALL branch on this flag and render `PorticoResults` instead of `VigaContinuaResults`.

#### Scenario: Pórtico submit reaches the right results component

- GIVEN the user submits the pórtico form with valid input
- WHEN the app navigates
- THEN the URL is `/viga-continua-results` and `location.state.mode === "portico"`
- AND `PorticoResults` mounts

#### Scenario: Beam submit keeps beam results

- GIVEN the user submits the beam form
- WHEN the app navigates
- THEN the URL is `/viga-continua-results` and `location.state.mode === "viga-continua"` (or undefined)
- AND `VigaContinuaResults` mounts

### Requirement: Path correction — `apps/concrete` → `viga-continua/`

Stale references to the legacy `apps/concrete` path SHALL be replaced with the current standalone location `viga-continua/`. Both routes (form + results) SHALL be registered in `viga-continua/src/viga-continua-main.tsx` alongside the other viga-continua routes.

#### Scenario: Routes registered in the current entry

- GIVEN `viga-continua/src/viga-continua-main.tsx`
- WHEN inspected
- THEN `/viga-continua` maps to the form entry wrapper
- AND `/viga-continua-results` maps to the results entry wrapper
- AND no reference to `apps/concrete` remains in routing files
