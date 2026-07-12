# Design: Tipo de Columna Functional Branching

## Technical Approach

Branch inside `calculateCartel()` after shared wind/force calculations (unchanged). At verification step, switch on `tipoColumna`: T1 uses `designColumn()` with IPN profile, T2 runs existing truss logic (extracted to `checkTruss2Chords()` helper), T4 applies same helper at Fcol/2 per plane × 2.

Wind, Fcol, Mbase, and brace forces remain **identical** across all types — guaranteed by running `calcWind()` + `calcForces()` before the branch.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Branch point | Branch inside `calculateCartel` vs separate `calculateCartelT1/T2/T4` functions | Branch inside `calculateCartel` | Shared geometry/wind/force logic is re-entrant; separate functions duplicate the pre-branch code. Single entry point keeps `CartelForm`/`CartelResults` unchanged. |
| T1 buckling model | Single `L` with K-factors vs separate Lx/Ly in `designColumn` | Single `L = alturaColumna*1000` mm with Kx, Ky derived | `designColumn()` already accepts `Kx*L` and `Ky*L`. Kx = `Lb_strong/alturaColumna`, Ky = `Lb_weak/alturaColumna`. No API change needed. |
| T1 axis mapping | Spec uses y-y(strong), z-z(weak); code uses x-x(strong), y-y(weak) | Map spec→code: strong→Kx/rx, weak→Ky/ry | IPN profiles have rx (strong) > ry (weak). `designColumn` uses Kx→rx, Ky→ry. Mapping is mechanical. |
| T4 force model | 2 parallel planes at Fcol/2 each | Accepted | Simplification per proposal Q1. Each plane = independent T2 truss. Chord force Nchord/2, diagonal force Ndiag/2, montante force Nmont/2 per plane. |
| T3 removal | Silent remap vs warning toast | Silent remap to T2 in `handleLoad` | Old saves had truss-compatible fields (angles, hCol, aCol). Remapping is lossless for calculation. No UX churn. |
| CartelResult extension | Union type vs optional `flexoResult` field | Optional `flexoResult?: ColumnCheck` | Backward-compatible. T2/T4 return null. T1 populates it. UI gates on presence. |

## Data Flow

```
CartelInput ─→ calculateCartel()
                 │
                 ├─ calcWind()      ← shared (all types)
                 ├─ calcForces()    ← shared (all types)
                 ├─ Geometry        ← shared (all types)
                 │
                 └─ switch(tipoColumna)
                    ├─ 1: designColumn(IPN, Lb_strong, Lb_weak, Mbase)
                    │      └─ flexoResult: ColumnCheck
                    ├─ 2: checkTruss2Chords(angles, Nchord, Ndiag, Nmont)
                    │      └─ chkCordon, chkDiag, chkMont (current)
                    └─ 4: checkTruss2Chords × 2 (Fcol/2 per plane)
                           └─ chkBars × 2, longCordones=4×h
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/cartel-calc.ts` | Modify | Add `perfilIPN`, `separacionCol` to `CartelInput`. Add `flexoResult` to `CartelResult`. Extract `checkTruss2Chords()` helper from existing verification block. Add T1 branch (IPN lookup → designColumn with derived Kx/Ky). Add T4 branch (checkTruss2Chords ×2 with halved forces, quadrupled chord steel). Generate type-specific step text. |
| `client/src/lib/storage.ts` | Modify | Add `perfilIPN?: string`, `separacionCol?: number` to `CartelFormState`. |
| `client/src/screens/CartelForm.tsx` | Modify | Add `perfilIPN?: string`, `separacionCol?: number` to `CartelState`. Add IPN dropdown (T1), separacionCol field (T4), per-type conditional field visibility. Remove T3 button (lines 368-389). In `handleLoad`: remap `tipoColumna === 3 → 2`. In `handleSave` and `handleSubmit`: include new fields. In `saveLastCartelFormState` effect: include new fields. |
| `client/src/screens/CartelResults.tsx` | Modify | Dynamic verification banner per type (T1: "Verificación flexocompresión", T2/T4: "Verificación reticulado"). T1: show `flexoResult` card (ratio, limit state, KL/r per axis). T1: hide "Acero por columna" section. T4: adapt steel table (4× cordones). |
| `client/src/screens/CartelPrintPage.tsx` | Modify | Mirror Results per-type logic. T1: geometry table shows IPN profile + buckling lengths, verification table shows flexocompression, steel table omitted. T2 unchanged. T4: geometry includes `separacionCol`, steel shows 4 chords. |

## Interfaces / Contracts

```typescript
// cartel-calc.ts — additions to CartelInput
perfilIPN?: string;        // "IPN 200" — Tipo 1 only
separacionCol?: number;    // m — section depth, Tipo 4 only

// cartel-calc.ts — addition to CartelResult
flexoResult?: ColumnCheck; // from column-calc.ts — Tipo 1 only

// storage.ts — additions to CartelFormState
perfilIPN?: string;
separacionCol?: number;
```

`ColumnCheck` is already exported from `column-calc.ts` (lines 338-359). No new exports needed.

## T1: Buckling Length Derivation

```typescript
// Input: alturaColumna (m), sepCorreas (m), tienePuntal, hPuntal (m)
// Output: Kx, Ky for designColumn's ColumnInput

const L_mm = alturaColumna * 1000;
const Lb_strong = tienePuntal ? hPuntal : 2.0 * alturaColumna; // m
const Lb_weak = sepCorreas; // m

const Kx = Lb_strong / alturaColumna; // strong-axis effective length factor
const Ky = Lb_weak / alturaColumna;   // weak-axis effective length factor
// designColumn: KL_strong = Kx * L_mm, KL_weak = Ky * L_mm
```

Axial load Pu ≈ 0 (self-weight negligible for billboard column). Bending Mux = Mbase (kN·m, about strong axis from wind). Muy ≈ 0.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | TypeScript compilation | `cd client && npm run build` |
| Manual | T1 form→result→print flow | IPN 200, verify flexo card shows, steel table absent |
| Manual | T2 regression | Any saved cartel with Tipo 2, verify identical ratio output |
| Manual | T3 migration | Load old save with tipoColumna=3, verify remaps to 2 |
| Manual | T4 workflow | Select T4, set separacionCol, verify 4-chord steel output |

No test runner available (config `strict_tdd: false`).

## Migration / Rollout

No data migration. Old saves: T2 identical output, T1/T4 change behavior (was truss → now correct), T3 silently remapped to T2. Rollback: revert commit.

## Open Questions

None. All proposal questions resolved by spec and orchestrator technical decisions.
