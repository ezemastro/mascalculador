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
