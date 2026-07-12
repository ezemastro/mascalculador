# Results Display Specification

## Purpose

Define the order and content of the steel beam ResultsPage sections. The
flexure audit (profile characteristics → classification → LTB
intermediates) MUST appear before the pass/fail summary cards. Every
derived value MUST expose its inputs and formula; no "black box" outputs.

## Requirements

### Requirement: "Mostrar cálculos" precedes "Mostrar resultados"

The flexure section MUST be titled "Mostrar cálculos" and render above
"Mostrar resultados". "Mostrar cálculos" MUST contain, in order: (1)
"Características del perfil" table, (2) λ of flange and web with formulas,
(3) classification banner, (4) LTB audit (Md1, Lp, Lr, Mr, Mcr, Md2)
with formulas. "Mostrar resultados" shows Mu, Md, and the flexure ratio.

#### Scenario: Section order on render

- GIVEN a solved steel beam
- WHEN the user opens ResultsPage
- THEN "Mostrar cálculos" appears above "Mostrar resultados"

### Requirement: Profile characteristics table

The first subsection MUST be a table titled "Características del perfil"
listing: d, bf, tf, tw, A, peso, Ix, Iy, Zx, Sx, Zy, Sy, rx, ry, J, Cw,
ho. Each value MUST carry its unit and source (`d = profile.h`,
`bf = profile.b`).

#### Scenario: Every field rendered

- GIVEN a selected IPN 200
- WHEN the table renders
- THEN all 17 fields appear with numeric values and units

### Requirement: λ_p of flange and web with formulas

"Mostrar cálculos" MUST display, separately for flange and web, the
actual λ, λ_p, and λ_r with formula and substituted values. Flange:
`λ_f = b / (2·t_f)`, `λ_pf = 0.38·√(E/F_y)`, `λ_rf = 1.0·√(E/F_y)`. Web:
`λ_w = (h − 2·t_f) / t_w`, `λ_pw = 3.76·√(E/F_y)`,
`λ_rw = 5.70·√(E/F_y)`.

#### Scenario: Flange and web shown

- GIVEN `b = 90`, `t_f = 11.3`, `h = 200`, `t_w = 7.5`, `F_y = 235`
- WHEN the section renders
- THEN `λ_f = 3.98`, `λ_pf = 9.15`, `λ_rf = 24.08` and
  `λ_w = 23.65`, `λ_pw = 90.55`, `λ_rw = 137.30` all appear

### Requirement: Classification banner

A banner MUST read "Compacta / No compacta / Con elementos esbeltos"
plus the criteria. Label: "Compacta" when both `λ_f ≤ λ_pf` AND
`λ_w ≤ λ_pw`; "Con elementos esbeltos" when either `λ_f > λ_rf` OR
`λ_w > λ_rw`; "No compacta" otherwise.

#### Scenario: Compact banner

- GIVEN every λ below its λ_p
- WHEN the banner renders
- THEN it reads "Compacta" with the criteria

#### Scenario: Slender banner

- GIVEN `λ_w > λ_rw`
- WHEN the banner renders
- THEN it reads "Con elementos esbeltos"

### Requirement: LTB audit with formulas

"Mostrar cálculos" MUST show, in order, Md1, Lp, Lr, Mr, Mcr, Md2.
Each MUST show formula, substituted values, and result. Md1 = φ ·
min(MnFlange, MnWeb) for local-buckling. Md2 = φ · MnLTB(Lb) for LTB.
Mr and Mcr derive from the chosen Lb per the engine spec.

#### Scenario: Audit order and visibility

- GIVEN a solved beam
- WHEN the section renders
- THEN Md1, Lp, Lr, Mr, Mcr, Md2 appear in that order with formulas,
  AND no toggle hides them

### Requirement: "Mostrar resultados" shows Mu and Md

"Mostrar resultados" MUST display `Mu` and `Md = φ·Mn` first, in kN·m,
plus ratio `Mu / Md` with pass/fail mark. The existing Corte and
Deformación cards from Verificación MUST remain unchanged.

#### Scenario: Mu and Md in kN·m

- GIVEN `Mu = 48.6 kN·m`, `Md = 96.4 kN·m`
- WHEN the section renders
- THEN both show in kN·m and ratio reads 0.50 with "✓"

#### Scenario: Shear and deflection unchanged

- GIVEN any valid beam
- WHEN the user scrolls past flexure
- THEN Corte and Deformación cards are present and identical to before

### Requirement: Subdimensioned profile banner on results page

When the selected profile has `Zx < Zx_req`, the ResultsPage MUST render a
red banner at the top of "Mostrar resultados" with the text equivalent to
"Perfil subdimensionado: Zx = X cm³, necesario ≥ Y cm³". The banner MUST
highlight the `Md < Mu` account visually (e.g. red color on the affected
fields) so the failure mode is unambiguous.

#### Scenario: Banner when subdimensioned

- GIVEN `Zx_req = 230 cm³` and a selected IPN 180 (Zx = 189 cm³) with
  computed `Mu = 48.6 kN·m` and `Md = 36.0 kN·m`
- WHEN the results page renders
- THEN the banner reads "Perfil subdimensionado: Zx = 189 cm³, necesario ≥ 230 cm³"
- AND `Mu` and `Md` are displayed in red to flag the failure

#### Scenario: No banner when adequately sized

- GIVEN `Zx_req = 230 cm³` and a selected IPN 200 (Zx = 251 cm³) with
  `Mu = 48.6 kN·m` and `Md = 96.4 kN·m`
- WHEN the results page renders
- THEN no subdimensioned banner is shown
- AND `Mu` and `Md` are displayed in normal color
