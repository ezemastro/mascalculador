# Design: Split Acero / Hormigon en Apps Independientes

## Executive Summary

The monolithic `client/` becomes a three-workspace monorepo: `apps/steel/` (CIRSOC 301), `apps/concrete/` (CIRSOC 201), and `packages/shared/` (`@mascalculador/shared`). Steel is the reference app -- `client/` moves directly to `apps/steel/` with zero functional changes (PR 1). Concrete bootstraps from a steel copy, then removes all steel artifacts (PR 2). Shared code extracts into a workspace package consumed by both apps (PR 3). The cross-import of `calculateBeamDual` from concrete into steel resolves by moving the function to shared (PR 4).

The `copy-then-delete` strategy for concrete eliminates the risk of missing config files. npm workspaces native support (no Turborepo/Nx/Lerna) keeps tooling minimal. Vite resolves TS directly from the shared package with `"main": "./src/index.ts"` -- no build step, no source maps to configure.

## Repository Structure (target)

```
mascalculador/
  package.json              # workspaces: ["apps/*", "packages/*"]
  tsconfig.json             # references: apps/*, packages/shared
  AGENTS.md
  openspec/

  apps/
    steel/
      package.json          # name: "steel-app", private: true
      vite.config.ts        # port 5173, alias @mascalculador/shared
      tsconfig.json         # references ../shared
      tsconfig.app.json     # composite: true (moved from old client/)
      tsconfig.node.json
      index.html
      eslint.config.js
      src/
        main.tsx            # NavBar + router: acero only
        screens/            # FormPage, ResultsPage, PrintPage, ColumnForm,
                            # ColumnResults, ColumnPrintPage, CartelForm,
                            # CartelResults, CartelPrintPage
        lib/                # beam-calculations, steel-design, column-calc,
                            # truss-calc, cartel-calc, profiles,
                            # angle-profiles, upn-profiles, tube-profiles
        types.d.ts          # removed (imports from shared)
        components/         # removed (imports from shared)
        hooks/              # removed (imports from shared)

    concrete/
      package.json          # name: "concrete-app", private: true
      vite.config.ts        # port 5174, alias @mascalculador/shared
      tsconfig.json         # references ../shared
      tsconfig.app.json     # composite: true
      tsconfig.node.json
      index.html
      eslint.config.js
      src/
        main.tsx            # NavBar + router: hormigon only
        screens/            # BasesForm, BasesResults, SlabForm, SlabResults,
                            # SlabCompat, CompatList, ConcreteForm,
                            # ConcreteResults, RCColumnForm, RCColumnResults
        lib/                # bases-calc, concrete-design, rc-column-calc,
                            # slab-calc, slab-to-beam, beam-reaction,
                            # constants
        types.d.ts          # removed (imports from shared)

  packages/
    shared/
      package.json          # name: "@mascalculador/shared", main: "./src/index.ts"
      tsconfig.json         # composite: true, declaration: true
      src/
        index.ts            # barrel re-exports
        storage.ts          # localStorage + key() helper
        types.d.ts          # BeamConfig, Load, SupportType, etc.
        beam-analysis.ts    # calculateBeamDual (moved from steel)
        MainLayout.tsx
        SavedBeams.tsx
        SlabPlan.tsx
        useDecimalField.tsx
```

## Workspace Strategy

Root `package.json` defines `workspaces: ["apps/*", "packages/*"]` and convenience scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:steel\" \"npm run dev:concrete\"",
    "dev:steel": "npm run dev -w apps/steel",
    "dev:concrete": "npm run dev -w apps/concrete",
    "build:all": "npm run build -w apps/steel && npm run build -w apps/concrete",
    "typecheck:all": "tsc -b",
    "lint:all": "npm run lint -w apps/steel && npm run lint -w apps/concrete"
  }
}
```

Common dependencies (react, react-dom, react-router, mafs, tailwindcss, @tailwindcss/vite) stay in each app's `package.json`. They are NOT hoisted to root -- each app declares its own to preserve the exact version pinning from the current `client/package.json`. `@mascalculador/shared` is declared as `"@mascalculador/shared": "workspace:*"` in both apps.

Dev dependencies (@types/*, eslint, prettier, typescript, rolldown-vite, @vitejs/plugin-react-swc) are duplicated per app. This avoids root-level devDep hoisting complexity while the app count is low (2).

## Vite Configuration Per App

`apps/steel/vite.config.ts` is the current `client/vite.config.ts` unchanged, plus a Vite `resolve.alias` entry:

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@mascalculador/shared": path.resolve(__dirname, "../../packages/shared/src") },
  },
  server: { port: 5173 },
});
```

`apps/concrete/vite.config.ts` is identical except `server.port: 5174`. The alias points `@mascalculador/shared` to `packages/shared/src` so Vite resolves TS directly without an intermediate build step. `packages/shared/package.json` exports `"main": "./src/index.ts"` and `"types": "./src/index.ts"` to satisfy both bundler and typechecker resolution.

## TypeScript Strategy

Root `tsconfig.json` is project references only:

```json
{
  "files": [],
  "references": [
    { "path": "./apps/steel" },
    { "path": "./apps/concrete" },
    { "path": "./packages/shared" }
  ]
}
```

Each app wraps its current two-reference structure (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`) with `composite: true` on `tsconfig.app.json`. `packages/shared/tsconfig.json` uses `composite: true` + `declaration: true` so consuming apps see type information. `tsc -b` from root compiles shared first (dependency of both apps), then the apps in parallel.

## Per-PR Decisions

### PR 1: monorepo-setup
`git mv client/ apps/steel/` (preserves git history). Create root `package.json` with workspaces. Update `apps/steel/package.json` name to `"steel-app"`. Add `dev:steel` script. Adjust paths in `apps/steel/tsconfig.json` references (from `./tsconfig.app.json` stays, no change needed -- relative paths hold). Verify: `npm run dev` in `apps/steel/` serves all steel screens at `:5173`. Update `AGENTS.md` with `apps/steel` path.

### PR 2: app-concrete
`cp -r apps/steel/ apps/concrete/`. Delete from `apps/concrete/src/screens/`: `FormPage.tsx`, `ResultsPage.tsx`, `PrintPage.tsx`, `ColumnForm.tsx`, `ColumnResults.tsx`, `ColumnPrintPage.tsx`, `CartelForm.tsx`, `CartelResults.tsx`, `CartelPrintPage.tsx`. Delete from `apps/concrete/src/lib/`: `beam-calculations.ts`, `steel-design.ts`, `column-calc.ts`, `truss-calc.ts`, `cartel-calc.ts`, `profiles.ts`, `angle-profiles.ts`, `upn-profiles.ts`, `tube-profiles.ts`. Keep `constants.ts` (concrete-specific: gamma_c, gamma_s). Rewrite `main.tsx`: NavBar shows only Bases, Losas H, Compat. Losas, Apoyos, Viga H, Columna H; router defines only concrete paths. Set `vite.config.ts` port to 5174. Add `dev:concrete` root script. Verify: `npm run build` in `apps/concrete/` passes.

### PR 3: shared-package
Create `packages/shared/package.json` with `name: "@mascalculador/shared"`, `main: "./src/index.ts"`. Move `client/src/lib/storage.ts` → `packages/shared/src/storage.ts` (add `key()` helper, prefix all keys). Move `client/src/types.d.ts` → `packages/shared/src/types.d.ts`. Move `client/src/components/MainLayout.tsx` → `packages/shared/src/MainLayout.tsx`. Move `client/src/components/SavedBeams.tsx` → `packages/shared/src/SavedBeams.tsx`. Move `client/src/components/SlabPlan.tsx` → `packages/shared/src/SlabPlan.tsx`. Move `client/src/hooks/useDecimalField.tsx` → `packages/shared/src/useDecimalField.tsx`. Create `packages/shared/src/index.ts` with re-exports. Update ALL import paths in both apps from local paths to `@mascalculador/shared`. Delete original files from `apps/steel/` and `apps/concrete/`. Verify: `tsc -b` passes, both apps build.

### PR 4: cross-import-fix
Move `calculateBeamDual` from `apps/steel/src/lib/beam-calculations.ts` to `packages/shared/src/beam-analysis.ts`. Add re-export in `packages/shared/src/index.ts`. Update `apps/steel/src/lib/beam-calculations.ts`: import from `@mascalculador/shared`, re-export `{ calculateBeamDual }`. Update `apps/concrete/src/lib/beam-reaction.ts`: import `calculateBeamDual` from `@mascalculador/shared`. Verify: grep for `../steel` or `../../steel` in `apps/concrete/` returns zero matches. Both apps build.

## Storage Keys with Prefixing

Helper in `packages/shared/src/storage.ts`:

```ts
export function key(app: "steel" | "concrete", name: string): string {
  return `${app}:${name}`;
}
```

Current keys → prefixed mapping:

| Current constant | App | New value via `key()` |
|---|---|---|
| `KEY = "mascalculador_beam_saves"` | dynamic | `key(app, "mascalculador_beam_saves")` |
| `LAST_FORM_KEY = "mascalculador_last_form"` | steel | `key("steel", "mascalculador_last_form")` |
| `LAST_COLUMN_FORM_KEY = "mascalculador_last_column_form"` | steel | `key("steel", "mascalculador_last_column_form")` |
| `LAST_CARTEL_FORM_KEY = "mascalculador_last_cartel_form"` | steel | `key("steel", "mascalculador_last_cartel_form")` |
| `LAST_BASES_FORM_KEY = "mascalculador_last_bases_form"` | concrete | `key("concrete", "mascalculador_last_bases_form")` |
| `LAST_RC_COLUMN_FORM_KEY = "mascalculador_last_rc_column_form"` | concrete | `key("concrete", "mascalculador_last_rc_column_form")` |
| `LAST_SLAB_FORM_KEY = "mascalculador_last_slab_form"` | concrete | `key("concrete", "mascalculador_last_slab_form")` |
| `COMPAT_KEY = "saved-compats"` | concrete | `key("concrete", "saved-compats")` |

Functions that need an `app` parameter added to their signature: `listSaves`, `writeSaves` (private), `saveBeam`, `updateSave`, `deleteSave`, `getSavedBeams`, `saveSlab`, `updateSlab`, `saveSlabInput`, `updateSlabInput`, `getSavedSlabs`, `loadSlab`, `deleteSlab`. Discipline-specific functions (`saveLastFormState`, `saveLastBasesFormState`, `saveCompat`, etc.) hardcode their app in the `key()` call. All callsites across ~18 screens/components must add the `app` argument -- this is a mechanical search-and-replace.

## Cross-Import Resolution

`calculateBeamDual` is a generic elastic beam analysis function (two-pass LRFD: 1.2D + 1.6L). It takes `BeamConfig` + `Load[]` and returns `BeamResultsDual`. No steel-specific logic. Exists in `beam-calculations.ts` alongside steel-specific `calculateBeam()`, `migrateLoads()`, `formatForce()`. Only `calculateBeamDual` moves to shared; `calculateBeam()` stays in steel. `beam-reaction.ts` in concrete imports from `@mascalculador/shared` directly. `beam-calculations.ts` in steel re-exports to avoid breaking internal consumers.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Copy-then-delete leaves a steel file in concrete | PR 2 has an explicit delete checklist; verify with `ls apps/concrete/src/lib/ | grep -E 'beam-calc|steel-design|column-calc|truss|cartel|profiles'` |
| Import path change causes type errors | `tsc -b` in PR 3 catches all broken imports |
| `storage.ts` signature change breaks every screen | Single mechanical refactor: add `app` param to shared functions, update callsites. PR 3 scoped to this task. |
| Two apps, two `node_modules/`, install drift | `package-lock.json` at root (npm workspaces hoisted), exact versions pinned |
| `types.d.ts` definitions diverge between apps | Single source of truth in `@mascalculador/shared`; both apps import same types |

## Execution Plan

```
feature/monorepo-setup (PR 1)
    |
    v
feature/app-concrete (PR 2)
    |
    v
feature/shared-package (PR 3)
    |
    v
feature/cross-import-fix (PR 4)
    |
    v
  main
```

Each branch is stacked on the previous. PR 1 targets main; PR 2 targets the PR 1 branch; PR 3 targets PR 2; PR 4 targets PR 3. Each PR is independently mergeable and revertible. Merge order is sequential: 1 → 2 → 3 → 4. Verification at each stage: `npm run build` in the affected app(s) passes, `tsc -b` passes, no cross-app imports exist. No test runner involved (strict_tdd: false was set at init and remains unchanged).

## Success Criteria

- [ ] `npm run build` passes in `apps/steel/` and `apps/concrete/`
- [ ] `tsc -b` from root compiles all 3 workspaces
- [ ] `npm run dev:steel` serves steel at `localhost:5173`
- [ ] `npm run dev:concrete` serves concrete at `localhost:5174`
- [ ] `@mascalculador/shared` is importable from both apps
- [ ] `apps/concrete/` has zero imports referencing `apps/steel/`
- [ ] ESLint passes in both apps
- [ ] AGENTS.md references `apps/steel` and `apps/concrete`
- [ ] Zero behavioural changes in any of the 13 existing specs
