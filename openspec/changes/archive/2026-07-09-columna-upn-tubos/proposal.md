# Proposal: Columna UPN Simple y Caños Estructurales

## Intent

Add **UPN single** (channel) and **SHS/RHS hollow sections** to the column calculator. Only IPN and 2UPN (box) exist today. CIRSOC 301-05 Ch. E/F/H is profile-agnostic — needs only Ag, Ix, Iy, Zx, Zy.

## Scope

### In Scope
- UPN single profile type using existing `UPN_PROFILES` tabulated data
- TUBO profile type with 40+ square/rectangular hollow sections (50×50 to 300×300 sq, 100×50 to 300×200 rect)
- New file `tube-profiles.ts`: geometry-computed A, Ix, Iy, Sx, Sy, Zx, Zy, rx, ry, peso
- ColumnForm: extend `profileType` union, add UPN and TUBO dropdowns
- ColumnResults: dispatch UPN and TUBO branches

### Out of Scope
- LTB check for UPN single (Lb ≤ Lp assumed)
- Local buckling classification for tubes (compact assumption)
- Other calculators (beam, concrete, slab)

## Capabilities

### New Capabilities
- `column-upn-single`: UPN channel type using tabulated UPNData directly
- `column-tube-profiles`: SHS/RHS catalog with computed section properties

### Modified Capabilities
- None (no column specs exist in openspec/specs/)

## Approach

**UPN single**: UPNData has Ag, Ix, Iy, Zx, Zy already. ColumnResults reads them directly — same pattern as IPN but from `UPN_PROFILES`. Gap input hidden for UPN single.

**TUBO**: `TubeData` interface with `h, b, t`. Properties from hollow rectangle formulas:
- A = 2·t·(h + b - 2t), Ix = (b·h³ - (b-2t)·(h-2t)³)/12
- Zx ≈ 1.12·Sx (HSS plastic modulus), rx = √(Ix/A)

All properties precomputed at definition time. `designColumn()` requires no changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/lib/tube-profiles.ts` | New | TubeData + TUBO_PROFILES (40+ sections, EN 10219) |
| `client/src/screens/ColumnForm.tsx` | Modified | Add "UPN" and "TUBO" to profileType |
| `client/src/screens/ColumnResults.tsx` | Modified | UPN single + TUBO dispatch branches |
| `client/src/lib/column-calc.ts` | None | Profile-agnostic engine |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Zx ≈ 1.12·Sx overestimates for thin-walled tubes | Low | Conservative for typical t/h; note in calc steps |
| UPN single torsional instability (low J) | Medium | Assume full lateral restraint; document assumption |
| Missing common Argentine tube sizes | Low | Verify against market catalogs |

## Rollback Plan

Git revert. No schema migrations or persisted state changes.

## Dependencies

- None. UPN_PROFILES already has all properties needed for single UPN.

## Success Criteria

- [ ] UPN 200, Fy=235, L=3000 mm, Pu=100 kN → correct φPn and ratio
- [ ] TUBO □ 100×100×4, same conditions → props match hand-calc within 1%
- [ ] Mux=Muy=0 → interaction collapses to Pr/Pc (compression only)
- [ ] IPN and 2UPN cases regression-free
- [ ] `tsc -b` passes; zero ESLint errors
