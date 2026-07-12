# Proposal: Tipo de Columna Functional Branching

## Intent

`tipoColumna` (1–4) is selected in the UI but NEVER branches calculation logic — all 4 types compute identically as a 2-chord truss. This is a missing feature, not a bug: the UI promises 4 different column types but delivers one. This change makes each type functional.

## Scope

### In Scope
- **Tipo 1 (Simple IPN)**: IPN profile dropdown, flexocompression via `designColumn()` from `column-calc.ts`, buckling lengths per axis (weak = `sepCorreas`, strong = `hPuntal` or K=2.0 × `alturaColumna`)
- **Tipo 2 (Celosía 2 cordones)**: Unchanged — current truss logic preserved
- **Tipo 3 (Cajón)**: DELETE — remove button, UI references, form fields. Mark deprecated in types
- **Tipo 4 (Celosía completa)**: 4 equal chords via same angle profile, "separación" depth field, treats 2 parallel trusses at Fcol/2 each
- Dynamic section title per `tipoColumna` ("Columna — Simple IPN", "Columna — Celosía", "Columna — Celosía completa")
- Conditional rendering: Tipo 1 hides "Acero por columna" steel-lengths table in Results and Print
- All changes mirrored in CartelForm, CartelResults, and CartelPrintPage

### Out of Scope
- Wind calculation changes — untouched
- Brace/puntal model changes — untouched
- Storage migration for old saves (behavioral shift documented, not migrated)

## Capabilities

### New Capabilities
None. This modifies the existing cartel calculator.

### Modified Capabilities
- **cartel-column-design**: Column verification branches on `tipoColumna`. Tipo 1 uses `designColumn()`; Tipo 4 extends truss to 4 chords; Tipo 2 path is identical to current.

## Approach

Branch inside `calculateCartel()` after shared wind/force calculations (which do NOT change):

| Tipo | Verification | Key reuse |
|------|-------------|-----------|
| 1 | `designColumn()` with IPN profile | `column-calc.ts`, `profiles.ts` |
| 2 | Existing truss (extracted to helper) | `checkAngleCompForce()` |
| 4 | 2-parallel truss helper, Fcol/2 per plane | Same angle check, doubled chords |

`CartelResult` gains optional `flexoResult` field for Tipo 1. `CartelState`/`CartelInput` gain `perfilIPN` (string) and `separacionCol` (number). Tipo 3 removed from button UI, type value, and all references.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/lib/cartel-calc.ts` | Modified | Branch on `tipoColumna`; add T1/T4 paths; refactor T2 to helper |
| `client/src/lib/storage.ts` | Modified | Add `perfilIPN`, `separacionCol` to `CartelFormState` |
| `client/src/screens/CartelForm.tsx` | Modified | Dynamic title; conditional fields per type; delete T3 button; add IPN dropdown, separación field |
| `client/src/screens/CartelResults.tsx` | Modified | T1: flexocompression card; hide "Acero por columna" table |
| `client/src/screens/CartelPrintPage.tsx` | Modified | Dynamic geometry, verification, steel sections per type |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Old saves with `tipoColumna=1` change behavior (was truss, now flexocompression) | High | Document break; T2 saves are safe |
| Old saves with `tipoColumna=3` become un-renderable | Medium | Default to Tipo 2 on load if value=3 detected |
| No test runner available | Medium | Manual regression with edge-case saves per type |

## Rollback Plan

Revert the commit. The T2 path remains identical to current code — only additive branching was added.

## Dependencies

- `column-calc.ts` (`designColumn`) — already stable and in use by column calculator
- `profiles.ts` (`IPN_PROFILES`) — already stable

## Success Criteria

- [ ] T1 form shows IPN dropdown, computes flexocompression, hides "Acero por columna"
- [ ] T2 behaves identically to current (no regression)
- [ ] T3 button absent from UI; old T3 data defaults to T2 on load
- [ ] T4 form shows separación field, computes 4-chord truss with Fcol/2 per plane
- [ ] Section title changes dynamically per selection
- [ ] Print page mirrors all per-type behavior (geometry table, verification table, steel table)
- [ ] Build passes: `cd client && npm run build`

---

## Proposal Question Round

The following assumptions need review before specs:

1. **Tipo 4 force model**: 2 parallel trusses at Fcol/2 each — simplified, ignores torsional coupling. Is this acceptable for a first slice, or should biaxial distribution be modeled now?

2. **Tipo 1 strong-axis buckling without puntal**: K = 2.0 × `alturaColumna`. Should this be the user-facing default, or should it be K = 1.0 (ideal cantilever) with the user entering K explicitly?

3. **Tipo 3 deleted data**: Old saves with `tipoColumna: 3` — silently remap to Tipo 2 on load, or show a warning toast explaining the type was removed? The save data itself contains truss-compatible fields (profiles, hCol, aCol) so remapping is lossless for their current truss behavior.
