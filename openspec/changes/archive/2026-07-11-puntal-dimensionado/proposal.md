# Proposal: Brace Sizing (Dimensionado de Puntal)

## Intent

`brace.axilPuntal` is computed but never verified against a section. Users can't tell if their brace resists the load. Add 3 pre-defined brace types in pure compression (CIRSOC 301), with independent pass/fail from the column.

## Scope

### In Scope
- **Type 1 — Cruz**: 2x L 2"×3/16" crossed. Each takes Pu/2, K=1.0, L_pandeo=L_puntal. `checkAngleCompForce()` with rz
- **Type 2 — Plano (25 cm)**: Chords L 1½"×1/8", diagonals L 1"×1/8" @25 cm. `calcBuiltUpSectionProps(nChords=2)` + `checkGlobalColumn()`. Compute lateral bracing: λ_lim=π√(E/Fy), L_max=ry×λ_lim
- **Type 3 — Cuadrado (20 cm)**: 4x L 1"×1/8" chords, montants L 1"×1/8" @20 cm. `calcBuiltUpSectionProps(nChords=4)` + `checkGlobalColumn()` + montant check
- `BraceCheck` type, `passesBrace` flag, verification cards in results
- Brace type selector in form, persistence in storage, print page updates

### Out of Scope
- Custom brace profiles (3 hardcoded types only)
- Brace-to-column interaction check
- Separate Fy — brace inherits column's Fy

## Capabilities

### New Capabilities
- `brace-sizing`: Verify brace section against pure compression. Covers Type 1 (crossed angles), Type 2 (flat lattice + lateral bracing calc), Type 3 (square box lattice).

### Modified Capabilities
- None

## Approach

New functions `checkBraceType1/2/3()` reuse `checkAngleCompForce`, `calcBuiltUpSectionProps`, `checkGlobalColumn`. Called from `calculateCartel()` when `tienePuntal && brace`. Add `tipoPuntal` to `CartelInput`, `CartelState`, `CartelFormState`. Independent green/red banner in results.

## Affected Areas

| Area | Impact |
|------|--------|
| `client/src/lib/cartel-calc.ts` | Modified — BraceCheck + checkBrace*() + wire into calculateCartel |
| `client/src/screens/CartelForm.tsx` | Modified — tipoPuntal selector |
| `client/src/screens/CartelResults.tsx` | Modified — brace verification cards |
| `client/src/screens/CartelPrintPage.tsx` | Modified — print layout |
| `client/src/lib/storage.ts` | Modified — persist tipoPuntal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Lateral bracing yields impractical spacing | Low | Euler conservative; validate with sample inputs |
| Profiles missing from table | Low | All 3 confirmed present |

## Rollback Plan

Revert 5 files. `tipoPuntal` is additive — old saved states without it default to Type 1.

## Dependencies

None. All functions and profiles exist. Fy inherited from column.

## Success Criteria

- [ ] Realistic input (V=45 m/s, hPuntal=3m, dPuntal=2m) passes all types
- [ ] Type 2 shows "Arriostramiento lateral requerido cada X cm"
- [ ] Brace banner independent from column banner
- [ ] `passesBrace=false` does NOT affect column `passes`
- [ ] Print page includes brace verification section
- [ ] `tipoPuntal` persists across sessions
