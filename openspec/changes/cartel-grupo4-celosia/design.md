# Design: CIRSOC 301 Grupo 4 — Columnas T2/T4 Celosía

## Technical Approach

Replace simplified T2/T4 verification (`Nchord = M/h`, `K=1.0`, `φc=0.90`) with full CIRSOC 301 Grupo 4 pipeline: Steiner built-up properties → modified slenderness λₘ → P-Δ amplification → per-element buckling → global column check.

Five new functions in `cartel-calc.ts`, called from T2/T4 branches after shared `calcWind`/`calcForces`. φc hardcode changes from 0.90 to 0.85 in `checkAngleCompForce`. New `KGlobal` field added to input (default 1.0). `GlobalColumnCheck` appended to `CartelResult` (undefined for T1). Wind, forces, and T1 path unchanged.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| φc for all angles | Parameter vs hardcode | Hardcode 0.90→0.85 | User confirmed. T1 already has 0.85 in `column-calc.ts`. Consistent across codebase. |
| K global default | 0.65 / 0.80 / 1.00 | 1.00 | CIRSOC 301-05 App. E: pinned-pinned, sway prevented → K=1.0. User-configurable in form. |
| β coefficient | Various CIRSOC clauses | β = (π/400) · 1/(1−Pu/Pcm) | User confirmed. Applied to diagonal shear amplification. |
| Diagonal shear Veu | β·Pu vs β·Fcol | β·Fcol | Fcol = total lateral shear per column (already computed). Equivalent to Qx in spec. |
| Steiner units | mm vs cm | cm | Matches existing `AngleData` (xg, Ix, A in cm). `hint = hCol·100 − 2·xg` [cm]. |
| Montantes | Full Grupo 4 vs φc only | φc→0.85 only | User confirmed. No λₘ or P-Δ applied. Uses existing `checkAngleCompForce` with `K=1.0`, `L=hCol`. |
| T4 modeling | 2 planes vs 3D built-up | 3D built-up, Steiner both axes | User confirmed. rx, ry from full 4-chord section; global check biaxial. |
| e₀ | Configurable vs fixed | L/500, fixed | User confirmed. |

## Interfaces

```typescript
interface BuiltUpSection {
  Ag_cm2: number; Jx_cm4: number; Jy_cm4: number;
  rx_cm: number; ry_cm: number; hint_cm: number;
}

interface GlobalColumnCheck {
  Ag_cm2: number; rx_cm: number; ry_cm: number;
  lambda0: number; lambda1: number; lambdaM: number;
  lambdaC: number; Fcr_MPa: number; phiPn_kN: number;
  Pu_kN: number; ratio: number; passes: boolean;
}
```

**Modified existing**:
- `CartelInput` + `CartelState`: add `KGlobal?: number`
- `CartelResult`: add `globalCheck?: GlobalColumnCheck`
- `checkAngleCompForce`: φc 0.90→0.85 (hardcode, no signature change)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/cartel-calc.ts` | Modify | Add `calcBuiltUpSectionProps`, `calcModifiedSlenderness`, `calcPdeltaChordForce`, `calcBeta`, `checkGlobalColumn`. Change φc to 0.85. Replace T2/T4 `calculateCartel` branch with Grupo 4 pipeline. Populate `globalCheck`. Update steps text for new sections. |
| `client/src/screens/CartelForm.tsx` | Modify | Add `KGlobal` state (default 1.0). Number input visible for tipoColumna 2/4. Persist in save/load/handleLoad. |
| `client/src/screens/CartelResults.tsx` | Modify | φc label 0.90→0.85. Add `GlobalColumnCheck` card below per-bar cards for T2/T4. |
| `client/src/screens/CartelPrintPage.tsx` | Modify | Mirror global check card + φc label update. |

## Data Flow

```
calcWind → calcForces → {if tipo 2|4}
  ├─ calcBuiltUpSectionProps(chord, hCol, nChords, separacionCol) → builtUp
  ├─ calcModifiedSlenderness(KGlobal, L, rx, aCol, rz) → {λ₀, λ₁, λₘ}
  ├─ Pcm = π²·200000·Ag_cm2·100 / λ₀²  [kN]
  ├─ calcPdeltaChordForce(Pu=pesoPropio, Pcm, Mmax, nChords, hint_m, L) → Pu1
  ├─ checkAngleCompForce(cord, Fy, aCol·1000, 1.0, Pu1) → chkCordon
  ├─ β = calcBeta(Pu, Pcm); Veu = β·Fcol; Nu_dig = Veu/sinα
  ├─ checkAngleCompForce(diag, Fy, dDiag·1000, 1.0, Nu_dig) → chkDiag
  ├─ checkAngleCompForce(mont, Fy, hCol·1000, 1.0, Nmont) → chkMont
  ├─ checkGlobalColumn(builtUp, KGlobal, L, Pu, Fy) → globalCheck
  └─ ratioColumna = max(chord, diag, mont, global)
```

Key formulas:
- **Steiner T2**: `hint = hCol·100−2·xg`, `Jx = 2[Ix + A·(hint/2)²]`
- **Steiner T4**: `hint_frente`, `hint_costado = sepCol·100−2·xg`; `Ix_global`, `Iy_global` per user-provided formulas
- **λ₀**: `K·L·1000 / (rx·10)`; **λ₁**: `aCol·1000 / (rz·10)`; **λₘ**: `√(λ₀²+λ₁²)`
- **e₀**: `L/500`; **MsL**: `Mmax / (1 − Pu/Pcm)`; **M_total**: `MsL + Pu·e₀`
- **Pu1**: `Pu/n + M_total / hint_m` (n=2 for T2, n=4 for T4)
- λ_c, F_cr, φPn: existing E3 formulas with φc=0.85

## Testing Strategy

| What | How |
|------|-----|
| Build integrity | `cd client && npm run build` |
| Steiner hand-check | T2: L 2"×1/4", hCol=0.5m → hint=46.9cm, Jx ≈ 6719 cm⁴ |
| λₘ sanity | λ₀≈20, λ₁≈40 → λₘ ≈ 44.7 (between, weighted toward larger) |
| P-Δ stress | Pu→Pcm → MsL→∞ → guard Pu<Pcm |
| Guard clauses | hCol=0, aCol=0, unknown profile, rz=0 (KLr=999), T4 missing separacionCol |
| UI smoke | T2 form → result page shows global card; φc=0.85 in labels and steps |

## Open Questions

- [ ] **T4 My**: Currently `My=0` (Mmax is strong-axis only). Reserved for future wind direction input. Documented: v1 distributes Mx only.
- [ ] **T4 side-face diagonals**: Only front-plane diagonals (`dDiag`) are checked. Side-face diagonals (`dDiagSide`) use same Nu_dig but may need independent verification in future.
- [ ] **Pcm unit verification**: `Ag_cm2·100` conversion should yield kN. Validate with hand calculation for representative T2 case before merging.
