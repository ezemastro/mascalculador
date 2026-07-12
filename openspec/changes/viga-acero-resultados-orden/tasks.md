# Tasks: Viga Acero — Reordenamiento de Resultados y Predimensionamiento con Zx

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (combined) | ~420-540 |
| 400-line budget risk (combined) | High |
| Estimated changed lines (per PR) | PR #1 ~300; PR #2 ~155 |
| 400-line budget risk (per PR) | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 logic → PR #2 catalog |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | UI/calc/type changes; app keeps working with partial catalog | PR 1 | base = main; soft-warn fallback |
| 2 | IPN + UPN catalog completion | PR 2 | base = main after PR 1; pure tabulation |

## PR #1 — Logic slice (~300 LOC, base = main)

### Phase 1: Types
- [x] **1.1** `client/src/types.d.ts`: add `Lb1?`/`Lb2?` to `SteelDesignParams` (keep `Lb` legacy). `type Classification = "COMPACT" | "NON_COMPACT" | "SLENDER"` (string union, no enum). Extend `DesignResult` with `Mp`, `classification`, `lambdaF`, `lambdaW`, `lambdaPf`, `lambdaRf`, `lambdaPw`, `lambdaRw`, `MnFlange`, `MnWeb`, `MnLTB`, `Lp`, `Lr`, `Mr`, `Fe`, `Mcr`, `Md1`, `Md2`. Add optional `peso?`/`Sy?`/`Zy?`/`rx?` to `ProfileData`; `peso?`/`Sx?`/`Sy?`/`J?`/`Cw?`/`cwApprox?` to `UPNData`. _[trivial]_
- [x] **1.2** `client/src/lib/profiles.ts`: export `getD(p)=p.h` and `getBf(p)=p.b`; document `h`/`b` canonical. _[trivial, dep 1.1]_

### Phase 2: Engine — surface intermediates
- [x] **1.3** `client/src/lib/steel-design.ts`: `checkBeam(profile, params, serviceM, Mu)` — 4th param `Mu` (N·mm, signed). `Lb = Mu >= 0 ? (params.Lb1 ?? params.Lb) : (params.Lb2 ?? params.Lb)`. _[small, dep 1.1]_
- [x] **1.4** Same file: promote `Fe` (elastic-LTB block) to outer scope; derive `Mr = 0.7*Fy*Sx*1e3` N·mm. Expose `Mp`, `Lp`, `Lr`, `lambdaF`, `lambdaW`, `lambdaPf`, `lambdaRf`, `lambdaPw`, `lambdaRw`. _[small, dep 1.3]_
- [x] **1.5** Same file: compute `classification` per spec rule; expose on result. _[small, dep 1.4]_
- [x] **1.6** Same file: `Md1 = PHI_B*min(MnFlange, MnWeb)`; `Md2 = PHI_B*MnLTB(Lb)`; `Mcr = min(Fe*Sx*1e3, Mp)`. Expose `MnFlange`, `MnWeb`, `MnLTB`, `Md1`, `Md2`, `Mcr`. _[small, dep 1.4]_
- [x] **1.7** Same file: LTB fallback when `Cw == null` → set `Cw = 0`; comment documents conservative Mr/Mcr. _[small, dep 1.4]_

### Phase 3: FormPage
- [x] **1.8** `client/src/screens/FormPage.tsx`: add `Lb1`/`Lb2` state, default `totalLength*1000`. Legacy: `Lb1 = Lb2 = state?.designParams?.Lb`. Round-trip in `handleSave`/`handleSubmit`. _[small, dep 1.1]_
- [x] **1.9** Same file: render `Lb1` (mm), `Lb2` (mm) numeric inputs below `Cb`. _[small, dep 1.8]_
- [x] **1.10** Same file: `useMemo` for `Zx_req` keyed on `[loads, Fy, beamConfig]`; `Zx_req = |Mu|·1e6 / (0.9·Fy·1000)` cm³. Hidden when loads invalid. _[medium, dep 1.1]_
- [x] **1.11** Same file: soft-warn banner "Perfil bajo: Zx = X cm³, necesario ≥ Y cm³" when `selectedProfile.Zx < Zx_req`. Calcular NOT disabled. _[small, dep 1.10]_

### Phase 4: ResultsPage
- [x] **1.12** `client/src/screens/ResultsPage.tsx`: call `checkBeam` with signed `Mu`; pass `Lb1`/`Lb2` from `designParams`. _[small, dep 1.3]_
- [x] **1.13** Same file: introduce "Mostrar cálculos" above "Mostrar resultados" with (a) 17-field profile table via `getD`/`getBf`, (b) λ_p/λ_r audit for flange + web with formulas, (c) classification banner ("Compacta" / "No compacta" / "Con elementos esbeltos"), (d) LTB audit (Md1, Lp, Lr, Mr, Mcr, Md2) with formulas. Missing optional fields render "—" / "dato no disponible". _[medium, dep 1.6]_
- [x] **1.14** Same file: in "Mostrar resultados", red subdimensioned banner when `profile.Zx < Zx_req`; render `Mu` and `Md` in red. _[small, dep 1.13]_

### Phase 5: PR #1 verification
- [x] **1.15** `cd client && npm run build` passes. Manual smoke: 6 m UDL flow works; save/load round-trip preserves `Lb1`/`Lb2`. _[small, dep 1.14]_

## PR #2 — Catalog data slice (~155 LOC, base = main after PR #1)

### Phase 1: IPN catalog
- [ ] **2.1** `client/src/lib/profiles.ts`: confirm PR #1 added optional `peso?`/`Sy?`/`Zy?`/`rx?` to `ProfileData`. _[trivial, dep PR #1 merged]_
- [ ] **2.2** Same file: fill `peso` (kg/m) for 19 IPN entries (DIN 1025-1). _[small, dep 2.1]_
- [ ] **2.3** Same file: `d`/`bf` alias covered by `getD`/`getBf` (PR #1.2); no data fill (h/b canonical). _[trivial, dep 2.1]_
- [ ] **2.4** Same file: fill `Sy`, `Zy`, `rx` for 19 IPN entries (CIRSOC 301-05 / DIN 1025-1). _[small, dep 2.2]_
- [ ] **2.5** Same file: replace approximate `Cw` (e.g. IPN 80 = 0.1) with tabulated values; flag remaining approximations. _[small, dep 2.4]_

### Phase 2: UPN catalog
- [ ] **2.6** `client/src/lib/upn-profiles.ts`: confirm PR #1 added optional `peso?`/`Sx?`/`Sy?`/`J?`/`Cw?`/`cwApprox?` to `UPNData`. _[trivial, dep PR #1 merged]_
- [ ] **2.7** Same file: fill `peso` (kg/m) for 16 UPN entries (DIN 1026). _[small, dep 2.6]_
- [ ] **2.8** Same file: `d`/`bf` alias verified. _[trivial, dep 2.6]_
- [ ] **2.9** Same file: fill `Sx`, `Sy`, `J` for 16 entries. _[small, dep 2.7]_
- [ ] **2.10** Same file: compute `Cw` for 16 entries via `Iw = tf·bf³·(h-tf)²/4`; set `cwApprox = true` on every entry. _[small, dep 2.9]_

### Phase 3: PR #2 verification
- [ ] **2.11** `cd client && npm run build` passes. Manual smoke: every IPN/UPN entry shows new columns; no "dato no disponible" for completed entries. _[small, dep 2.10]_

## Dependency Graph

```
PR #1 (base = main)
  1.1 ─┬─ 1.2 helpers
       ├─ 1.3 checkBeam(Mu) ─┬─ 1.4 Mr/Fe/Mp/Lp/Lr/λ's ─┬─ 1.5 classification
       │                   │                          ├─ 1.6 Md1/Md2/Mcr
       │                   │                          └─ 1.7 LTB Cw fallback
       │                   └─ 1.12 ResultsPage call
       └─ 1.8 Lb1/Lb2 state ─ 1.9 inputs
  1.10 Zx_req useMemo ─ 1.11 soft-warn
  1.13 ResultsPage sections (deps 1.5, 1.6, 1.7) ─ 1.14 subdim banner
  → 1.15 verify ─► merge to main
                                  │
PR #2 (base = main after #1)      ▼
  2.1 IPN preconditions ─ 2.2 peso ─ 2.3 alias ─ 2.4 Sy/Zy/rx ─ 2.5 Cw
  2.6 UPN preconditions ─ 2.7 peso ─ 2.8 alias ─ 2.9 Sx/Sy/J ─ 2.10 Cw+cwApprox
  → 2.11 verify
```

## Risks for Apply

- **Lb1/Lb2 backward compat** (1.8, 1.15): stored beam with only `Lb` maps to `Lb1 = Lb2 = Lb`; round-trip covered.
- **Optional profile field fallbacks** (1.13, 1.7): missing fields render "—" / "dato no disponible"; Cw missing → 0 in Mr/Mcr (conservative).
- **Catalog data quality** (2.5, 2.10): UPN Cw via `Iw = tf·bf³·(h-tf)²/4` exact for double-T, approximate for channels; `cwApprox = true` flagged. Cross-check IPN `Cw` vs DIN 1025-1.
- **Build guards**: TypeScript strict + `verbatimModuleSyntax: true` + `erasableSyntaxOnly: true`. `import type` for type-only. No enums/namespaces — `Classification` is a string union. `cd client && npm run build` per 1.15, 2.11.
- **Alias discipline**: `h`/`b` canonical. `d`/`bf` only via `getD`/`getBf` (1.2). Do not rename engine field reads to `d`/`bf`.
