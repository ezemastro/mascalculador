# Tasks: CIRSOC 301 Grupo 4 — Columnas T2/T4 Celosía

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~410–620 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: calc engine + φc → PR 2: UI + build |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Calc engine: types, φc, 5 new functions, T2/T4 pipeline | PR 1 | base=main. Tests: `npm run build` type check |
| 2 | UI: Form (KGlobal), Results + Print (GlobalColumnCheck card) | PR 2 | depends on PR 1 interfaces. Build + smoke |

## Phase 1: Foundation — Types, Interfaces, φc

- [x] 1.1 Add `BuiltUpSection` interface to `cartel-calc.ts` (Ag_cm2, Jx_cm4, Jy_cm4, rx_cm, ry_cm, hint_cm)
- [x] 1.2 Add `GlobalColumnCheck` interface to `cartel-calc.ts` (Ag_cm2, rx/ry, lambda0/1/M, lambdaC, Fcr_MPa, phiPn_kN, Pu_kN, ratio, passes)
- [x] 1.3 Add `KGlobal?: number` to `CartelInput` + `CartelState` (default 1.0)
- [x] 1.4 Add `globalCheck?: GlobalColumnCheck` to `CartelResult`
- [x] 1.5 Change `φc = 0.9` → `0.85` in `checkAngleCompForce()`, update `phiPn = 0.85 * Pn`

## Phase 2: Core — Grupo 4 Calc Pipeline

- [x] 2.1 Implement `calcBuiltUpSectionProps(chord, hCol, nChords, separacionCol)` — Steiner A_tot, J_x/J_y, r_x/r_y, hint. Validate hCol>0, throw on unknown profile
- [x] 2.2 Implement `calcModifiedSlenderness(K, L, rx, aCol, rz)` — λ₀, λ₁, λₘ per CIRSOC 301. Guard rz=0 → KLr=999
- [x] 2.3 Implement `calcPdeltaChordForce(Pu, Pcm, Mmax, nChords, hint_m)` — MsL amplification, e₀=L/500, M_e0, Pu1 per chord
- [x] 2.4 Implement `calcBeta(Pu, Pcm)` — β = (π/400)·1/(1−Pu/Pcm). Apply Veu = β·Fcol, Nu_dig = Veu/sinα
- [x] 2.5 Implement `checkGlobalColumn(builtUp, K, L, Pu, Fy)` — λ_global, λc_global, F_cr E3, φPn = 0.85·F_cr·Atot/10, ratio
- [x] 2.6 Compute Pcm = π²·200000·Ag_cm2·100 / λ₀² in T2/T4 `calculateCartel` branch
- [x] 2.7 Replace T2 `calculateCartel` branch: built-up → λ_m → Pcm → P-Δ → chord λ_c/F_cr → globalCheck
- [x] 2.8 Replace T4 `calculateCartel` branch: same pipeline with Steiner both axes, per-chord Mx/My distribution
- [x] 2.9 Update steps text for T2/T4: add Grupo 4 sections (Steiner, λ_m, P-Δ, chord λ_c, β/Veu/Nu_dig, global), φc 0.85
- [x] 2.10 Guard clause: T4 missing/zero separacionCol → throw Error

## Phase 3: UI — Form, Results, Print

- [x] 3.1 Add KGlobal number input to `CartelForm.tsx`; show only for tipoColumna 2/4; wire to state
- [x] 3.2 Persist KGlobal in save/load/handleLoad
- [x] 3.3 Update φc label 0.90→0.85 in `CartelResults.tsx` and steps header
- [x] 3.4 Add `GlobalColumnCheck` card to `CartelResults.tsx`; render only for T2/T4 (globalCheck exists)
- [x] 3.5 Mirror φc labels + GlobalColumnCheck card in `CartelPrintPage.tsx`

## Phase 4: Verification

- [x] 4.1 `cd client && npx tsc -b` — zero type errors
- [x] 4.2 `cd client && npm run build` — build passes
- [ ] 4.3 Smoke check: load T2 form, set values, verify global card renders, φc=0.85 in labels and steps
- [ ] 4.4 Smoke check: T1 path unchanged — no GlobalColumnCheck in result
