# Delta for slab-dl-reactions

## Mirror to steel

This change applies to **both** `apps/concrete` and `apps/steel`. The files in `apps/steel/src/screens/SlabResults.tsx` and `apps/steel/src/lib/slab-calc.ts` are byte-identical mirrors of their `apps/concrete` counterparts (verified by MD5). The steel app also exposes a `/slab` route serving these copies, so the 8 `RD_*/RL_*` fields MUST be populated in `designSlab()` for both apps, and the `<details> "Ver D/L">` rendering MUST be present in `SlabResults` for both apps. The change MUST be applied to both in the same commit.

## ADDED Requirements

### Requirement: D/L UI rendering

The `SlabResults` screen MUST render a `<details>` element labeled `Ver D/L` directly below each of the 4 reaction cards (Izquierdo, Derecho, Arriba, Abajo) WHEN the corresponding `RD_<edge>` and `RL_<edge>` fields are numeric. The `<details>` MUST contain exactly two lines:
- `D: <value> kN/m` formatted to 2 decimal places
- `L: <value> kN/m` formatted to 2 decimal places

#### Scenario: D/L details shown for new analysis

- GIVEN a slab analyzed with all 8 D/L fields populated
- WHEN `SlabResults` renders
- THEN below each of the 4 reaction cards, a `<details> "Ver D/L">` element renders
- AND expanding it shows two lines: `D: <RD> kN/m` and `L: <RL> kN/m` with the expected numeric values

#### Scenario: D/L details hidden for legacy slab

- GIVEN a slab loaded from `loadSlab()` where all 8 `RD_<edge>` / `RL_<edge>` fields are `undefined`
- WHEN `SlabResults` renders
- THEN no `<details> "Ver D/L">` element is rendered for any of the 4 reaction cards
- AND the cards continue to show the existing factored `R*<edge>` values (or `—` if also legacy)

#### Scenario: D/L details depend on hasSlabDL helper

- GIVEN any `SlabResult`
- WHEN the rendering decision is made
- THEN it MUST be based on the existing `hasSlabDL(result)` helper from `slab-to-beam.ts` (returning `true` iff `RD_izq` and `RL_izq` are not `undefined`)
- AND the same predicate MUST apply to all 4 cards (any-undefined → hide all)
