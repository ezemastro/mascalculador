# Proposal: Viga Acero — Reordenamiento de Resultados y Predimensionamiento con Zx

## Intent

The steel beam calculation engine (`steel-design.ts`) already computes section classification, Lp/Lr, Mn in 4 states, and all intermediate LTB values internally — but `DesignResult` exposes only the final `phiMn` and `limitingState`. The ResultsPage surfaces flexure, shear, and deflection in a flat Verificación card, burying the detailed LTB breakdown behind a `<details>` toggle. Structural engineers need the full CIRSOC/AISC audit trail (λ_p, classification label, Md1, Lp, Lr, Mr, Mcr, Md2) visible by section, plus a live Zx preview on the data screen so they can preselect a profile before calculating.

## Scope

### In Scope
- **Zx live preview** on FormPage: compute `Zx_req = Mu / (0.9·Fy)` in cm³ from current loads, shown above the profile selector
- **Profile gate**: "Calcular" button disabled until selected profile Zx ≥ Zx_req
- **Lb1 / Lb2** fields added to FormPage, defaulting to total length × 1000 mm
- **Lb by moment sign**: at `|Mu|` max section, `Lb = Mu ≥ 0 ? Lb1 : Lb2`
- **ResultsPage reorder**: profile characteristics (d, bf, tf, tw, A, weight, Ix, Iy, Zx, Sx, Zy, Sy, rx, ry, J, Cw, ho) → λ_f, λ_w with calcs → classification label (Compacta/No compacta/Esbelta) → Mu/Md → Md1, Lp, Lr, Mr, Mcr, Md2 with step-by-step formulas
- **IPN catalog completion**: add `d`, `bf`, `Sy`, `Zy`, `rx`, `peso` (kg/m) to `ProfileData`
- **UPN catalog completion**: add `Sx`, `Sy`, `Zy`, `J`, `Cw`, `peso` to `UPNData`; compute `Cw` via `Iw = tf·bf³·(d-tf)²/4` where table data missing
- **Viga Acero only** — no other calculator tabs touched functionally

### Out of Scope
- Corte (shear) and Deformación (deflection) panels: remain in current Verificación section unchanged
- Hormigón, Losa, Columna, Cartel calculators
- Per-section LTB selection (single `|Mu|` max check only, per user decision)
- Moment diagram label normalization (separate change)
- Double UPN profiles

## Capabilities

### New Capabilities
- `steel-beam-zx-preview`: live Zx_req computation in FormPage with profile selection gate
- `steel-beam-ltb-audit`: exposed LTB intermediate results (Md1, Lp, Lr, Mr, Mcr, Md2) with classification label in ResultsPage

### Modified Capabilities
- `steel-beam-load-split`: `SteelDesignParams` extended with `Lb1`/`Lb2`; Lb selection by moment sign at `checkBeam()` entry

## Approach

1. **Types**: add `Lb1`, `Lb2` to `SteelDesignParams`. Extend `DesignResult` with `classification`, `lambdaF`, `lambdaW`, `Mp`, `Lp`, `Lr`, `Md1`, `Mr`, `Mcr`, `Md2`, `Fe`, `profileSummary`.
2. **Profiles**: add `d`, `bf`, `Sy`, `Zy`, `rx`, `peso` to `ProfileData`. Map existing `h`→`d`, `b`→`bf` as aliases. Complete IPN arrays and UPN arrays.
3. **Engine**: `checkBeam()` selects `Lb` by sign of `Mu` param (new parameter). Expose all computed intermediates in `DesignResult`.
4. **FormPage**: useEffect calls `calculateBeamDual` to get `Mu` → compute `Zx_req`. Disable "Calcular" unless profile Zx ≥ Zx_req. Add Lb1/Lb2 inputs.
5. **ResultsPage**: two sections — "Mostrar cálculos" (profile + classification) and "Mostrar resultados" (Mu/Md + LTB audit). "Mostrar cálculos" first, "Mostrar resultados" after.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/types.d.ts` | Modified | Add `Lb1`, `Lb2` to `SteelDesignParams` |
| `client/src/lib/steel-design.ts` | Modified | Expose intermediates; Lb-by-sign selection; `Mu` param |
| `client/src/lib/profiles.ts` | Modified | Add `d`, `bf`, `Sy`, `Zy`, `rx`, `peso`; complete IPN arrays |
| `client/src/lib/upn-profiles.ts` | Modified | Add `Sx`, `Sy`, `Zy`, `J`, `Cw`, `peso`; complete UPN arrays |
| `client/src/screens/FormPage.tsx` | Modified | Lb1/Lb2 inputs; Zx preview; profile gate; state init |
| `client/src/screens/ResultsPage.tsx` | Modified | Reorder sections; expose classification + LTB audit |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Zx_req recompute on every keystroke → perf hit | Low | `calculateBeamDual` is ~200pt Simpson, sub-ms; memoize via `useMemo` with load/spans deps |
| UPN `Cw` formula approximate for channels (not doubly-symmetric) | Medium | Flag as "aprox." in UI; document `Iw = tf·bf³·(d-tf)²/4` for double-T; note channel warping is asymmetric |
| cm³ vs mm³ regression (ref: bug #131) | Low | All new exposed values stay in cm³ at type level; `checkBeam()` conversion pattern (`×1e3`) is proven |
| Old saved beams lack Lb1/Lb2 → design breaks | Low | Default both to `totalLength * 1000` (same as current Lb default); backward-compatible |

## Rollback Plan

Git revert the commit. `SteelDesignParams.Lb` remains present for backward deserialization (Lb = max(Lb1, Lb2) on rollback). No localStorage migration needed — Lb1/Lb2 are optional fields.

## Dependencies

- None. Prior change `steel-beam-dead-live-load-split` provides `BeamResultsDual` that FormPage already accesses for `Mu`.

## Success Criteria

- [ ] IPN 180, Fy=235, L=6 m, D=5 kN/m, L=3 kN/m: Zx_req visible and profile gate engages
- [ ] IPN 180 Zx=189 cm³ ≥ Zx_req → "Calcular" enabled; IPN 80 Zx=23 cm³ → disabled
- [ ] ResultsPage shows profile table, λ calcs, classification label, then Mu/Md/Lp/Lr/Mr/Mcr/Md2 in order
- [ ] IPN/UPN catalogs have all fields filled; `d`/`bf` aliases resolve correctly
- [ ] `tsc -b` passes; ESLint zero errors
