# Proposal: Steel Beam Dead/Live Load Split

## Intent

Structural engineers design steel beams under LRFD: ultimate load U = 1.2·D + 1.6·L (dead + live). The calculator currently accepts a single `magnitude` per load, mixing D and L. This prevents proper profile selection and obscures per-load reactions.

## Scope

### In Scope
- Split `Load.magnitude` into `deadLoad` (D) and `liveLoad` (L) fields in `types.d.ts`
- Run elastic analysis twice (D-pass, L-pass) to compute per-load reactions, shear, and moment
- Combine via U = 1.2·D + 1.6·L for ultimate values (M_U, V_U, R_U)
- Display Ra_D, Rb_D, Ra_L, Rb_L in results summary cards
- Show M_U and V_U diagrams only (option B — no separate D/L diagrams)
- Feed M_U, V_U, and service moment (M_D + M_L) into `checkBeam()`
- Backward-compatible deserialization of old saves with single `magnitude`

### Out of Scope
- Separate D/L diagrams (explicitly declined — option B chosen)
- Applying this to columns, concrete, or slab calculators
- Test runner setup (strict_tdd: false)

## Capabilities

### New Capabilities
- `steel-beam-load-split`: independent dead/live load analysis with LRFD ultimate combination for steel beams

### Modified Capabilities
- None (no prior specs exist in `openspec/specs/`)

## Approach

**Types**: Extend `Load` with `deadLoad: number` and `liveLoad: number`. Keep `magnitude?: number` for backward compat. Add `BeamResultsPerLoad` with parallel arrays.

**Calculation**: Two-pass strategy. Call `calculateBeam()` twice — once with D loads, once with L loads. Both elastic analyses produce reactions, support moments, shear, and moment functions. Combine ultimate: `V_U = 1.2·V_D + 1.6·V_L`, `M_U = 1.2·M_D + 1.6·M_L`.

**Results UI**: Replace single `Reacción en Apoyo A/B` cards with a per-support card showing `Ra_D`, `Ra_L`, `Rb_D`, `Rb_L`. Shear and moment diagrams render from ultimate functions only.

**Design**: `Mu` and `Vu` become `M_U` and `V_U`. `serviceM` for deflection becomes `M_D + M_L` (unfactored), replacing the current `Mu / 1.4` heuristic.

**Migration**: In `FormPage`, when loading a saved beam, detect loads with `magnitude` but no `deadLoad`/`liveLoad`. Default: `deadLoad = magnitude, liveLoad = 0` (conservative).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/types.d.ts` | Modified | `Load` gets `deadLoad`/`liveLoad`; new `BeamResultsPerLoad` |
| `client/src/lib/beam-calculations.ts` | Modified | Two-pass analysis, LRFD combination, new return type |
| `client/src/lib/steel-design.ts` | Modified | Accept correct service moment (no internal changes needed) |
| `client/src/screens/FormPage.tsx` | Modified | D/L input fields, load migration, validation update |
| `client/src/screens/ResultsPage.tsx` | Modified | Split reaction cards, ultimate diagrams, design-call update |
| `client/src/lib/storage.ts` | None | Schema unchanged; migration handled at form load |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Old saved beams load with zero L → wrong results | Medium | Show migration notice; user can edit L field after load |
| Double analysis doubles computation time | Low | Elastic analysis is sub-ms; 200-pt Simpson × 2 is negligible |
| Load diagram still shows combined magnitude | Low | Load diagram renders `deadLoad + liveLoad` per load |

## Rollback Plan

Git revert the commit. `loads` array in localStorage has `magnitude` preserved (set alongside `deadLoad`/`liveLoad` on save), so rollback restores full functionality for old saves.

## Dependencies

- None (no external libraries or upstream changes)

## Success Criteria

- [ ] New beam with D=5 kN/m, L=3 kN/m on simple span 6 m produces U = 10.8 kN/m and reactions match hand calc
- [ ] Old saved beam loads without data loss and shows migration notice
- [ ] Shear and moment diagrams render correctly from ultimate functions only
- [ ] `tsc -b` passes with zero errors
