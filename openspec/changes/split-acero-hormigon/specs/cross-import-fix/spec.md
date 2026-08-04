# Cross-Import Fix Specification

## Purpose

Resolve the cross-app import where `apps/concrete/src/lib/beam-reaction.ts` imports `calculateBeamDual` from `apps/steel/src/lib/beam-calculations.ts`. Move the shared elastic beam analysis function to `@mascalculador/shared` so both apps can consume it without inter-app dependencies.

## Requirements

### Requirement: calculateBeamDual in shared

`calculateBeamDual` MUST live in `packages/shared/src/beam-analysis.ts`. It MUST be exported from the shared package entry point.

#### Scenario: Function is importable from shared

- GIVEN `packages/shared/src/beam-analysis.ts` exports `calculateBeamDual`
- WHEN an import statement `import { calculateBeamDual } from "@mascalculador/shared"` is resolved
- THEN the import succeeds
- AND the function signature matches the original (`(beamLength: number, leftLoad: number, rightLoad: number, leftDist: number, rightDist: number) => { ... }`)

### Requirement: Steel app imports from shared

`apps/steel/src/lib/beam-calculations.ts` MUST import `calculateBeamDual` from `@mascalculador/shared` (or re-export it from there). The beam calculation behavior MUST be identical to the pre-move version.

#### Scenario: Steel beam calculations unchanged

- GIVEN `apps/steel/src/lib/beam-calculations.ts` imports from `@mascalculador/shared`
- WHEN the steel app's beam form is submitted with the same inputs as before the move
- THEN the calculated results are identical to the pre-move behavior

### Requirement: Concrete app imports from shared

`apps/concrete/src/lib/beam-reaction.ts` MUST import `calculateBeamDual` from `@mascalculador/shared`. It MUST NOT import from `apps/steel/` or any path under `../steel/`.

#### Scenario: beam-reaction.ts has no steel imports

- GIVEN `apps/concrete/src/lib/beam-reaction.ts`
- WHEN searched for import statements containing `"steel"`, `"../steel"`, or `"../../steel"`
- THEN no matches are found
- AND the file contains `import ... from "@mascalculador/shared"` for `calculateBeamDual`

#### Scenario: Slab-to-beam adapter still works

- GIVEN `apps/concrete/src/lib/beam-reaction.ts` imports `calculateBeamDual` from shared
- WHEN the concrete app calculates beam reactions from slab loads
- THEN the reaction values are identical to the pre-move behavior

### Requirement: Build integrity

Both apps MUST compile and build successfully after the cross-import is resolved.

#### Scenario: Steel app builds

- GIVEN `apps/steel/` imports `calculateBeamDual` from `@mascalculador/shared`
- WHEN `npm run build` is executed in `apps/steel/`
- THEN the build completes with zero errors

#### Scenario: Concrete app builds

- GIVEN `apps/concrete/` imports `calculateBeamDual` from `@mascalculador/shared`
- WHEN `npm run build` is executed in `apps/concrete/`
- THEN the build completes with zero errors
