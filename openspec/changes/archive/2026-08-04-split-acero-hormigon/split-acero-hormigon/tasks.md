# Tasks: Split Acero / Hormigon

4 PRs stacked-to-main, copy-then-delete. Verify each via `npm run build` + `tsc -b`.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

---

## PR 1: Monorepo Setup (`feature/monorepo-setup` → main)

- [x] 1.1 `git mv client apps/steel`
- [x] 1.2 Root `package.json`: workspaces `["apps/*","packages/*"]`, scripts `dev:steel`,`dev:concrete`,`build:all`,`typecheck:all`,`lint:all`, devDep `concurrently`
- [x] 1.3 Root `tsconfig.json`: `"files":[]`, ref `./apps/steel`
- [x] 1.4 `apps/steel/package.json` name → `"steel-app"`
- [x] 1.5 `npm install` from root; `npm run build` in steel passes
- [x] 1.6 Update `AGENTS.md`: steel path `apps/steel`, add concrete entry

---

## PR 2: App Hormigon (`feature/app-concrete` → PR 1)

- [x] 2.1 `cp -r apps/steel apps/concrete`; rename pkg to `"concrete-app"`; vite port → 5174
- [x] 2.2 Delete steel screens: FormPage,ResultsPage,PrintPage,ColumnForm,ColumnResults,ColumnPrintPage,CartelForm,CartelResults,CartelPrintPage
- [x] 2.3 Delete steel libs: steel-design,column-calc,truss-calc,cartel-calc,profiles,angle-profiles,upn-profiles,tube-profiles. Keep `beam-calculations.ts` (til PR4) and `constants.ts`
- [x] 2.4 Rewrite `main.tsx`: router only `/bases`,`/losas`,`/compat-losa`,`/apoyos`,`/viga`,`/columna`
- [x] 2.5 Rewrite `NavBar.tsx`: only concrete links. `index.html` title → "Calculadora de Hormigon"
- [x] 2.6 Root config: add `./apps/concrete` tsconfig ref + `dev:concrete` script
- [x] 2.7 `npm run build` + `npm run dev` in concrete: serves at `:5174`, only concrete screens

---

## PR 3: Shared Package (`feature/shared-package` → PR 2)

- [ ] 3.1 Create `packages/shared/` with `package.json` (`@mascalculador/shared`, main `./src/index.ts`) and `tsconfig.json` (composite+declaration)
- [ ] 3.2 Move `storage.ts` → shared; add `key(app,name)`; prefix all 8 STORAGE_KEY constants; add `app` param to 12 shared fns; hardcode app in discipline-specific fns
- [ ] 3.3 Move `types.d.ts`,`MainLayout.tsx`,`SavedBeams.tsx`,`SlabPlan.tsx`,`useDecimalField.tsx` → shared; create barrel `index.ts`
- [ ] 3.4 Both apps: add `"@mascalculador/shared":"workspace:*"` dep, vite alias, tsconfig ref to `../shared`. Run `npm install`
- [ ] 3.5 Replace all local storage/types/component/hook imports → `@mascalculador/shared` in 9 steel screens (+`"steel"` arg) and 10 concrete screens (+`"concrete"` arg)
- [ ] 3.6 Delete originals from both `apps/*/src/` (storage,types,components,hooks)
- [ ] 3.7 `tsc -b` clean; `npm run build` in both apps passes

---

## PR 4: Cross-import Fix (`feature/cross-import-fix` → PR 3)

- [ ] 4.1 Move `calculateBeamDual`+types from steel `beam-calculations.ts` → `packages/shared/src/beam-analysis.ts`; add re-export in shared barrel
- [ ] 4.2 `apps/steel/.../beam-calculations.ts`: import from shared, re-export. Remove local fn
- [ ] 4.3 `apps/concrete/.../beam-reaction.ts`: import from `@mascalculador/shared` instead of steel path
- [ ] 4.4 Delete `apps/concrete/src/lib/beam-calculations.ts`
- [ ] 4.5 Verify: `grep -r "steel" apps/concrete/src/` zero imports; `tsc -b` clean; both apps build
