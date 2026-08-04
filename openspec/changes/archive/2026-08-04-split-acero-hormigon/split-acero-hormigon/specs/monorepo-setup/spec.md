# Monorepo Setup Specification

## Purpose

Establish the npm workspaces monorepo structure for mascalculador, relocating the existing steel app under `apps/steel/` and configuring root-level scripts for development and build across workspaces.

## Requirements

### Requirement: Root workspace configuration

The monorepo root MUST define npm workspaces for `apps/*` and `packages/*` in `package.json`. The root `package.json` MUST include convenience scripts for development, build, lint, and type-check across workspaces.

#### Scenario: Root installs all workspace dependencies

- GIVEN the root `package.json` with `workspaces: ["apps/*", "packages/*"]`
- WHEN `npm install` is run at the project root
- THEN all dependencies for `apps/steel/` are installed
- AND `node_modules/` is hoisted for shared packages

#### Scenario: Root scripts delegate to workspaces

- GIVEN the root `package.json` with scripts `dev:steel`, `dev:concrete`, `build:all`, `lint:all`, `typecheck:all`
- WHEN `npm run dev:steel` is executed at root
- THEN the command delegates to `npm run dev -w apps/steel`
- AND the Vite dev server starts on port 5173

### Requirement: Steel app preservation

The `client/` directory MUST be moved to `apps/steel/` without functional changes. The existing steel app screens, libs, and routing MUST remain intact.

#### Scenario: Steel app compiles after relocation

- GIVEN `apps/steel/` contains the full contents formerly at `client/`
- WHEN `npm run build` is executed in `apps/steel/`
- THEN the build completes with zero errors
- AND the production bundle is output to `apps/steel/dist/`

#### Scenario: Dev server serves steel app unchanged

- GIVEN `apps/steel/` is configured with its own `vite.config.ts` on port 5173
- WHEN `npm run dev` is executed in `apps/steel/`
- THEN the app is served at `http://localhost:5173`
- AND all steel screens (Viga, Columnas, Carteles) are navigable

### Requirement: AGENTS.md updated

The AGENTS.md file MUST reflect the new `apps/steel/` path in the `Start-Process` command. A concrete app entry MUST also be present for the `dev:concrete` command.

#### Scenario: AGENTS.md points to new steel path

- GIVEN the project AGENTS.md file
- WHEN read
- THEN the steel start command references `C:\Users\marce\mascalculador\apps\steel`
- AND a concrete start command references `C:\Users\marce\mascalculador\apps\concrete`
