# Slab Direction Intermediate Values Specification

## Mirror to steel

This change applies to **both** `apps/concrete` and `apps/steel`. The files in `apps/steel/src/screens/SlabResults.tsx` and `apps/steel/src/lib/slab-calc.ts` are byte-identical mirrors of their `apps/concrete` counterparts (verified by MD5). The steel app also exposes a `/slab` route serving these copies, so the `coef` and `d` fields on `DirectionResult` and the `<details> "Ver cuentas">` block in `DirSection` MUST be applied to both apps in the same commit. The canonical type definition lives in `packages/shared/src/slab-types.ts` and is consumed by both apps.

## Purpose

Surface the intermediate reinforcement-design steps in `SlabResults` so structural engineers can audit the CIRSOC 201-05 path from `Mu` to `AsReq` without re-running the calculation by hand. The engine already exposes `caseLabel` (a string that names the Whitney branch used); this spec adds `coef` (majoration) and `d` (per-direction effective depth) to `DirectionResult`, and renders a `<details> "Ver cuentas">` block in each `DirSection` so the audit trail is visible in the UI.

The system MUST NOT invent a numeric `k1` coefficient. The reinforcement path is fully captured by `caseLabel` plus the three Whitney branches in the `designSupportMoment` engine function — there is no `k1` variable in `DirectionResult`, and the spec reflects that.

## Requirements

### Requirement: DirectionResult gains coef and d

`DirectionResult` MUST gain two new numeric (NaN-safe) fields:
- `coef: number` — the majoration coefficient that produced `qu` for this direction (`1.4` if CM dominant, `1.2` if CM+CV mix)
- `d: number` — the effective depth for this direction in mm (`h - cover` for the principal direction, `h - cover - 10` for the secondary direction in a crossed slab, `h - cover` for unidirectional)

The system MUST NOT add a `k1: number` field to `DirectionResult`. The path from `Mu` to `AsReq` is described in the next requirement using `caseLabel` and the three Whitney branches.

#### Scenario: coef is 1.4 when CM dominates

- GIVEN `1.4·D_total >= 1.2·D_total + 1.6·L` (CM dominant)
- WHEN `designSlab()` runs
- THEN `result.x.coef === 1.4` AND `result.y.coef === 1.4`

#### Scenario: coef is 1.2 when CM+CV mix governs

- GIVEN `1.2·D_total + 1.6·L > 1.4·D_total` (CM+CV mix)
- WHEN `designSlab()` runs
- THEN `result.x.coef === 1.2` AND `result.y.coef === 1.2`

#### Scenario: d equals h - cover for unidirectional

- GIVEN a unidirectional slab with `h = 150 mm, cover = 20 mm`
- WHEN `designSlab()` returns
- THEN `result.x.d === 130` AND `result.y.d === 130`

#### Scenario: d_x is d - 10 for secondary direction in crossed slab

- GIVEN a crossed slab with `Mx < My` (X is the secondary direction, `h = 200, cover = 20`)
- WHEN `designSlab()` returns
- THEN `result.x.d === 170` AND `result.y.d === 180`

#### Scenario: No k1 field on DirectionResult

- GIVEN the shared `DirectionResult` type in `packages/shared/src/slab-types.ts`
- WHEN TypeScript compiles
- THEN no `k1` field is declared in the interface
- AND no code path in `designSupportMoment` produces a numeric `k1` to put on the result

### Requirement: AsReq path uses caseLabel and Whitney branches

The reinforcement design path MUST be described in the UI and in this spec by the three Whitney branches of `designSupportMoment`, encoded in the engine's `caseLabel` string. The three branches are:

1. **`Ka ≤ KaMin`** — `caseLabel` starts with `"K_a ≤ K_a min → k₁ = "`. `AsReq = (0.85·f'c·b·ka1·d) / fy` where `ka1 = 1.33·Ka`. When `ka1 ≥ KaMin` the formula uses `KaMin` instead of `ka1`.
2. **`KaMin < Ka ≤ KaMax`** — `caseLabel` equals `"K_a min < K_a ≤ K_a max"`. `AsReq = (0.85·f'c·b·Ka·d) / fy`.
3. **`Ka > KaMax`** — `caseLabel` equals `"K_a > K_a max → sección sobre-reforzada."`. `AsReq = (0.85·f'c·b·KaMax·d) / fy` (with the over-reinforcement warning surfaced via `caseLabel`).

After the Whitney branch, the engine applies `AsReq = max(AsReq, AsMin, AsTemp)` so the minimums always govern when they exceed the calculated value. This final pass is independent of the caseLabel branch.

#### Scenario: Ka ≤ KaMin uses inflated 1.33·Ka branch

- GIVEN `Ka ≤ KaMin` for a given direction
- WHEN `designSupportMoment()` runs
- THEN `caseLabel` starts with `"K_a ≤ K_a min → k₁ = "`
- AND `AsReq` is computed using `(0.85·f'c·b·ka1·d) / fy` where `ka1 = 1.33·Ka`
- AND when `ka1 ≥ KaMin` the formula substitutes `KaMin` for `ka1` (defensive floor inside the same branch)

#### Scenario: KaMin < Ka ≤ KaMax uses direct Whitney

- GIVEN `KaMin < Ka ≤ KaMax` for a given direction
- WHEN `designSupportMoment()` runs
- THEN `caseLabel` equals `"K_a min < K_a ≤ K_a max"`
- AND `AsReq = (0.85·f'c·b·Ka·d) / fy`

#### Scenario: Ka > KaMax uses KaMax-clamped Whitney

- GIVEN `Ka > KaMax` for a given direction
- WHEN `designSupportMoment()` runs
- THEN `caseLabel` equals `"K_a > K_a max → sección sobre-reforzada."`
- AND `AsReq = (0.85·f'c·b·KaMax·d) / fy`
- AND the over-reinforcement warning is surfaced via the `caseLabel` text, not via a separate boolean

#### Scenario: caseLabel is the only branch descriptor exposed

- GIVEN a `SlabResult` for any slab
- WHEN the UI reads the Whitney branch used
- THEN it MUST read `DirectionResult.caseLabel` (a string) — it MUST NOT compute, look up, or display a numeric `k1` coefficient

### Requirement: Ver cuentas details in DirSection

`DirSection` (the X and Y direction card in `SlabResults`) MUST render a `<details>` element labeled `Ver cuentas` after the existing Mu / As_req / mín / s_máx lines and the bar selector. The `<details>` MUST contain exactly these 10 lines, in this order, formatted to 2 decimal places for moments and areas, and integer for lengths and bar counts:

1. `Mu = {Mu} kN·m/m`
2. `coef = {coef} (1.4 si CM dominante, 1.2 si CM+CV mixto)`
3. `d = {d} mm`
4. `Ka = Mu / (φ·b·d²·0.85·f'c) = {Ka}`
5. `caseLabel = {caseLabel}` (the Whitney branch used)
6. `As_req = {AsReq} mm²/m` (the appropriate Whitney formula applies per line 5)
7. `As_min = {AsMin} mm²/m`
8. `As_temp = {AsTemp} mm²/m (si aplica)`
9. `s_max = {sMax} mm`
10. `As_dist ≥ 0.20·As_principal → {As_dist} mm²/m (s ≤ {s_max_dist} mm)` — only when the slab is unidirectional

The system MUST NOT show a `k1 = ...` line anywhere in the details block. The branch is communicated through `caseLabel` on line 5.

#### Scenario: Ver cuentas shows the 10 lines for crossed slab

- GIVEN a crossed slab
- WHEN `SlabResults` renders
- THEN each `DirSection` (X and Y) contains a `<details> "Ver cuentas">` with 10 lines
- AND line 5 displays the engine's `caseLabel` verbatim
- AND line 6 shows `As_req = {AsReq} mm²/m` with `AsReq` equal to the engine's computed value (within rounding)
- AND line 10 is omitted (the slab is unidirectional-checked, but crossed so omitted)

#### Scenario: Ver cuentas shows As_dist line for unidirectional slab

- GIVEN a unidirectional slab
- WHEN `SlabResults` renders
- THEN each `DirSection` (X and Y) contains a `<details> "Ver cuentas">` with 10 lines
- AND line 10 shows `As_dist ≥ 0.20·As_principal → {As_dist} mm²/m (s ≤ {s_max_dist} mm)` with `As_dist > 0` AND `s_max_dist = min(3·h, 300)`

#### Scenario: No k1 line in the details block

- GIVEN any rendered `DirSection`
- WHEN the `<details> "Ver cuentas">` body is inspected
- THEN no line contains the substring `k1 =` or `k₁ =`
- AND the only branch descriptor present is line 5's `caseLabel`

#### Scenario: As_temp line included

- GIVEN any slab
- WHEN the details block is rendered
- THEN line 8 shows `As_temp = {AsTemp} mm²/m` with `AsTemp > 0`
- AND the suffix `(si aplica)` is part of the label text

### Requirement: As_dist formula for unidirectional

For unidirectional slabs, the system MUST compute `As_dist = max(As_temp, round(0.20 · As_req))` in mm²/m and `s_max_dist = min(3·h, 300)` in mm. The same `As_dist` and `s_max_dist` MUST be reflected in `result.distX.AsReq` and `result.distX.sMax` (and `distY`).

#### Scenario: As_dist ≥ 0.20·As_principal enforced

- GIVEN a unidirectional slab with `dir.AsReq = 800 mm²/m`
- WHEN `designSlab()` runs
- THEN `dist.AsReq = max(AsTemp, round(0.20·800)) = max(AsTemp, 160)` mm²/m
- AND `dist.sMax = min(3·h, 300)` mm

#### Scenario: As_temp dominates 0.20·As_principal

- GIVEN a unidirectional slab with `dir.AsReq = 200 mm²/m` and `h = 100 mm` so `AsTemp = 180`
- WHEN `designSlab()` runs
- THEN `dist.AsReq = max(180, round(0.20·200)) = max(180, 40) = 180` mm²/m
