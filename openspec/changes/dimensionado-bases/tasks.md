# Tasks: Dimensionado de Bases

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1500-1700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (calc) → PR2 (storage+routing) → PR3 (form) → PR4 (results) |
| Delivery strategy | chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: Resolved
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units: PR1 (calc) → PR2 (storage+routing) → PR3 (form) → PR4 (results)

## Phase 1: Calc Module

- [x] **1.1** Create `client/src/lib/bases-calc.ts` with `BaseType`, `MedianeraSubType`, `BaseInput`, `BaseResult` types per design §3. ~40 LOC.
- [x] **1.2** `step1_Dimensions` (Areq, B=L=√A, h predim), `step2_Pu`, `step3_Kamin`, `step4_Qu`. ~50 LOC.
- [x] **1.3** `step5_Bending` (kx,ky,Mux,Muy), `step6_Nominal` (Mn=Mu/0.9), `step7_EffectiveDepth` (d=max((B-cx)/3,(L-cy)/3)). ~60 LOC.
- [x] **1.4** `step8_Punching` (b0,Vu,φVc), `step9_BeamShear` (Vux,Vuy,φVc). ~70 LOC.
- [x] **1.5** `step10_Steel` (mn,ka,As,AsMin), `step11_TotalHeight`, `step12_Heel`, `step13_Spacing`. Assemble `designCentrada()` with 13-step `steps[]`. ~100 LOC.
- [x] **1.6** `designVigaFundacion()`: 7 steps (Pu,e,qu,Mu,Mnv,As_viga,shear). ~80 LOC.
- [x] **1.7** `designTensor()`: 6 steps (Pu,e,Tu=Pu·e/H,Ru=μ·PD,friction,As_tensor). ~70 LOC.
- [x] **1.8** `designBase()` dispatcher: validate qa≤0→throw. Route by type/subType. Populate `steps[]`,`warnings[]`,`errors[]`. `tryDesignBase()` wrapper. ~90 LOC.
- [x] **1.9** `cd client && npm run build` passes. ~0 LOC.

## Phase 2: Storage + Routing

- [x] **2.1** Add `"bases"` to `SavedBeam.type` union in `storage.ts` (3 lines) and `SavedBeams.tsx` Props.type (1 line). ~4 LOC.
- [x] **2.2** Add `LAST_BASES_FORM_KEY`, `BasesFormState` interface, `saveLastBasesFormState()`, `loadLastBasesFormState()` following existing pattern. ~45 LOC.
- [x] **2.3** In `main.tsx`: import BasesForm/BasesResults, add routes `/bases`,`/bases-results`, NavBar `<Link to="/bases">Bases</Link>`. ~8 LOC.
- [x] **2.4** Placeholder screens: `BasesForm.tsx` + `BasesResults.tsx` returning "próximamente". ~20 LOC.
- [x] **2.5** `npm run build` passes; navigate to `/bases` shows placeholder. ~0 LOC.

## Phase 3: BasesForm

- [ ] **3.1** Skeleton: `useState` for all `BasesFormState` fields, `useEffect` auto-save (mountedRef guard), init: router→loadLast→defaults. ~60 LOC.
- [ ] **3.2** Suelo (qa,Df), Materiales (fc,fy selects), Cargas (PD,PL) with `<DecimalInput>`. ~50 LOC.
- [ ] **3.3** Columna: cx,cy + "Cargar columna guardada" dropdown via `listSaves().filter(s=>s.type==="rc-columna")` with defensive typeof. ~60 LOC.
- [ ] **3.4** Tipo: Centrada/Medianera + conditional sub-selector (Viga/Tensor) + Lcol/H/μ. Geometría: auto-predim `useMemo(step1_Dimensions)` with override inputs. ~70 LOC.
- [ ] **3.5** Armado (cover,rebD). `<SavedBeams type="bases">`. "Guardar datos" → `saveBeam()`. Submit: validate→navigate to results with `{state:{input,name,saveId}}`. ~100 LOC.
- [ ] **3.6** Smoke: fill form, auto-save persists on reload, submit navigates. ~0 LOC.

## Phase 4: BasesResults + Polish

- [ ] **4.1** Skeleton: read `location.state`, missing→instructional message. `useMemo(designBase)`, try/catch→error card. ~50 LOC.
- [ ] **4.2** Resumen (B×L×h,Pu,qu,d), Verificación badges (punchOK,beamShearOK,sepOK,heelOK), Armadura (AsX/Y,AsMin,db,nb,sep). ~90 LOC.
- [ ] **4.3** Medianera conditional (e,Mu,Tu/Ru,As_sup,h_viga,FrictionOK). "Ver cuentas" collapsible. Warnings/errors cards. Buttons: guardar/editar. ~100 LOC.
- [ ] **4.4** `npm run lint` fix new issues. `npm run build` 0 errors. Smoke: centrada 13 steps, medianera-viga, medianera-tensor, column dropdown, save/reload. ~0 LOC.
