# App Concrete Specification

## Purpose

Create an independent concrete (hormigon) application under `apps/concrete/` that contains only screens, routing, and libraries related to CIRSOC 201 reinforced concrete calculations, with no residual steel artifacts.

## Requirements

### Requirement: Concrete app isolation

`apps/concrete/` MUST contain only hormigon-specific screens and libraries. No steel screen files (FormPage, ResultsPage, PrintPage, ColumnForm, ColumnResults, ColumnPrintPage, CartelForm, CartelResults, CartelPrintPage) or steel libraries (beam-calculations, steel-design, column-calc, truss-calc, cartel-calc, profiles, angle-profiles, upn-profiles, tube-profiles) SHALL remain.

#### Scenario: No steel screens in concrete app

- GIVEN the `apps/concrete/src/screens/` directory
- WHEN inspected for a listing of all screen files
- THEN no file contains `FormPage`, `ResultsPage`, `PrintPage`, `ColumnForm`, `ColumnResults`, `ColumnPrintPage`, `CartelForm`, `CartelResults`, or `CartelPrintPage` in its name

#### Scenario: No steel libraries in concrete app

- GIVEN the `apps/concrete/src/lib/` directory
- WHEN inspected for a listing of all lib files
- THEN no file contains `beam-calculations`, `steel-design`, `column-calc`, `truss-calc`, `cartel-calc`, `profiles`, `angle-profiles`, `upn-profiles`, or `tube-profiles` in its name
- AND `constants.ts` (concrete-specific constants) is present

### Requirement: Concrete routing and navigation

The concrete app NavBar and router MUST expose only hormigon-specific routes: Bases, Losas H, Compat. Losas, Apoyos, Viga H, Columna H.

#### Scenario: NavBar shows only concrete links

- GIVEN the `apps/concrete/src/components/NavBar.tsx` component (or equivalent)
- WHEN rendered in the browser
- THEN only links for Bases, Losas H, Compat. Losas, Apoyos, Viga H, and Columna H are displayed
- AND no Acero-specific links (Viga Acero, Columnas, Carteles) appear

#### Scenario: Router resolves only concrete paths

- GIVEN the concrete app's route configuration
- WHEN a user navigates to any concrete route (e.g., `/bases`, `/losas`, `/compat-losa`, `/apoyos`, `/viga`, `/columna`)
- THEN the correct screen renders
- AND navigating to `/viga-acero` or `/cartel` returns a 404 or fallback

### Requirement: Build independence

`apps/concrete/` MUST compile independently with `npm run build`. The build MUST produce a valid production bundle for the hormigon-only app.

#### Scenario: Concrete app builds successfully

- GIVEN `apps/concrete/` with its own `vite.config.ts` on port 5174
- WHEN `npm run build` is executed in `apps/concrete/`
- THEN the build completes with zero errors
- AND the production bundle is output to `apps/concrete/dist/`

#### Scenario: Concrete dev server starts independently

- GIVEN the concrete app is configured with Vite on port 5174
- WHEN `npm run dev` is executed in `apps/concrete/`
- THEN the app is served at `http://localhost:5174`
- AND all hormigon screens are navigable
