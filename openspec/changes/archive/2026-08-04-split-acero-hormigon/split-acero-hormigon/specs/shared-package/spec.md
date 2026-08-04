# Shared Package Specification

## Purpose

Extract genuinely shared code into `packages/shared/` (published as `@mascalculador/shared`) so that both `apps/steel/` and `apps/concrete/` import common types, storage utilities, hooks, and layout components from a single source of truth.

## Requirements

### Requirement: Shared package structure

`packages/shared/` MUST contain `storage.ts`, `types.d.ts`, `MainLayout.tsx`, `SavedBeams.tsx`, `SlabPlan.tsx`, and `useDecimalField.tsx`. It MUST expose them via `package.json` with `"name": "@mascalculador/shared"` and `"main": "./src/index.ts"`.

#### Scenario: Shared package is importable

- GIVEN `packages/shared/package.json` declares `"name": "@mascalculador/shared"` and `"main": "./src/index.ts"`
- AND the root `package.json` includes `packages/*` in workspaces
- WHEN `npm install` is run at root
- THEN `import { ... } from "@mascalculador/shared"` resolves from both `apps/steel/` and `apps/concrete/`

### Requirement: Both apps import from shared

Both `apps/steel/` and `apps/concrete/` MUST import the shared modules from `@mascalculador/shared`, not from relative paths to `packages/shared/` or from each other's directories.

#### Scenario: Steel app imports shared via package name

- GIVEN `apps/steel/src/` source files that previously imported from a local `src/lib/storage.ts`
- WHEN the import is updated
- THEN the import uses `import { ... } from "@mascalculador/shared"`
- AND TypeScript compilation (`tsc -b`) in `apps/steel/` passes

#### Scenario: Concrete app imports shared via package name

- GIVEN `apps/concrete/src/` source files that previously imported from a local copy
- WHEN the import is updated
- THEN the import uses `import { ... } from "@mascalculador/shared"`
- AND TypeScript compilation (`tsc -b`) in `apps/concrete/` passes

### Requirement: localStorage key prefixing

`storage.ts` MUST contain a helper function `key(app: string, name: string): string` that prefixes localStorage keys by app identifier. All localStorage keys in `storage.ts` MUST use this helper.

#### Scenario: Steel keys are prefixed

- GIVEN `storage.ts` is in `packages/shared/src/`
- WHEN a save function for steel beams is called with app `"steel"`
- THEN the localStorage key is `"steel:beam_saves"`, not `"beam_saves"`

#### Scenario: Concrete keys are prefixed

- GIVEN `storage.ts` is in `packages/shared/src/`
- WHEN a save function for concrete slabs is called with app `"concrete"`
- THEN the localStorage key is `"concrete:slab_saves"`, not `"slab_saves"`

### Requirement: Build integrity after extraction

Both apps MUST compile and build successfully after all shared imports are adjusted.

#### Scenario: Steel app builds with shared package

- GIVEN `apps/steel/` imports from `@mascalculador/shared`
- WHEN `npm run build` is executed in `apps/steel/`
- THEN the build completes with zero errors

#### Scenario: Concrete app builds with shared package

- GIVEN `apps/concrete/` imports from `@mascalculador/shared`
- WHEN `npm run build` is executed in `apps/concrete/`
- THEN the build completes with zero errors
