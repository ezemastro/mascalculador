# Tasks: Cartel — Tipo de Columna Branching

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

## Phase 1: Foundation — Data model + helpers

- [x] 1.1 `storage.ts`: Add `perfilIPN?: string`, `separacionCol?: number` to `CartelFormState`
- [x] 1.2 `cartel-calc.ts`: Add `perfilIPN?`, `separacionCol?` to `CartelInput`; add `flexoResult?: ColumnCheck` to `CartelResult`
- [x] 1.3 `cartel-calc.ts`: Extract existing truss verification block into `checkTruss2Chords(input, forces): { chkCordon, chkDiag, chkMont, ratioColumna }` helper

## Phase 2: Core calculation — Branching

- [x] 2.1 `cartel-calc.ts`: Import `designColumn` from `column-calc`, `IPN_PROFILES` from `profiles`
- [x] 2.2 `cartel-calc.ts`: Add T1 branch — find IPN profile, derive Kx/Ky from `tienePuntal/hPuntal/sepCorreas`, call `designColumn` with Pu≈0, Mux=Mbase, Muy=0
- [x] 2.3 `cartel-calc.ts`: Add T4 branch — call `checkTruss2Chords` ×2 at Fcol/2 per plane, set `longCordones = 4 * alturaColumna`
- [x] 2.4 `cartel-calc.ts`: In `calculateCartel()`, switch on `tipoColumna` after shared wind+forces: T1→designColumn, T2→checkTruss2Chords, T4→branch×2
- [x] 2.5 `cartel-calc.ts`: Generate type-specific step text (T1: flexocompression, T4: 4 chords / Fcol/2)

## Phase 3: UI Form changes

- [x] 3.1 `CartelForm.tsx`: Add `perfilIPN`, `separacionCol` state + defaults + auto-save deps + handleSave + handleSubmit + handleLoad
- [x] 3.2 `CartelForm.tsx`: Add IPN profile dropdown `<select>` from `IPN_PROFILES` — visible only when `tipoColumna === 1`
- [x] 3.3 `CartelForm.tsx`: Add `separacionCol` input — visible only when `tipoColumna === 4`
- [x] 3.4 `CartelForm.tsx`: Hide `hCol`/`aCol`/`perfilCordon`/`perfilDiagonal`/`perfilMontante` when `tipoColumna === 1`
- [x] 3.5 `CartelForm.tsx`: Remove Tipo 3 button (lines 368–389); remap `tipoColumna === 3 → 2` in `handleLoad`

## Phase 4: UI Results + Print changes

- [x] 4.1 `CartelResults.tsx`: Dynamic verification banner per type (T1: "flexocompresión", T2/T4: "reticulado")
- [x] 4.2 `CartelResults.tsx`: T1: show `flexoResult` card (ratio, limitState, KL/r per axis); hide "Acero por columna" section
- [x] 4.3 `CartelResults.tsx`: T4: adapt steel table (4× cordones, `separacionCol` in geometry)
- [x] 4.4 `CartelPrintPage.tsx`: Mirror all Results per-type conditionals in NavCartelPrintout + SavedCartelPrintout

## Phase 5: Verification

- [x] 5.1 Run `cd client && npm run build` — TypeScript compilation must pass
- [ ] 5.2 Manual: T1 flow — select IPN 200, verify flexo card + no steel table
- [ ] 5.3 Manual: T2 regression — compare ratio output vs pre-change for identical inputs
- [ ] 5.4 Manual: T3 migration — load old save with tipoColumna=3, verify silent remap to T2
- [ ] 5.5 Manual: T4 flow — set separacionCol, verify 4-chord steel output
