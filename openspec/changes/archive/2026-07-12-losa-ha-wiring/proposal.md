# Proposal: Wiring + CIRSOC Methodology Fixes

## Intent
Restore slab (`/slab`) and concrete beam (`/concrete`) routes removed from `main.tsx` via uncommitted changes, and fix 10 CIRSOC 201-05 methodology bugs in `slab-calc.ts` that compromise structural correctness.

## Scope

### In Scope
- **Phase A — Wiring (~28 lines, low risk)**: Restore 4 imports (SlabForm, SlabResults, ConcreteForm, ConcreteResults), 4 routes, 2 nav links in `client/src/main.tsx`.
- **Phase B — Methodology fixes (~100+ lines, slab-calc.ts)**:
  - CRITICAL: `isCrossed` requires 4 non-free edges; unidirectional uses beam strip `M=qu·L²/coef` instead of Kalmanok; compatibilización de apoyos for continuous edges
  - MEDIUM: continuity `lx/ly≥0.5` validation; cantilever case `M=qu·L²/2`; KaMin fix (`1/(3.4·√fc)` for fc>30); Ka>KaMax warns instead of silent double-reinforcement; sMin≥80mm
  - COSMETIC: preserve user h (no rounding); `h=dMin+cover` (remove +10mm)

### Out of Scope
- Concrete beam logic changes, new UI, test suite, additional Kalmanok table variants

## Capabilities

### New Capabilities
- `slab-analysis`: Two-way and one-way RC slab design per CIRSOC 201-05 with Kalmanok tables, beam strip, and compatibilización
- `concrete-beam-routing`: `/concrete` → `/concrete-results` route for existing calculator

### Modified Capabilities
- None

## Approach
**Phase A**: Single-file edit to `main.tsx` — 4 import lines, 4 route entries in `createBrowserRouter`, 2 `<Link>` elements in NavBar. No logic changes.

**Phase B**: Surgical fixes to `slab-calc.ts`:
1. Rewrite `isCrossed` with 4-edge support guard
2. Branch unidirectional path to beam-strip analysis (coef 8/10/12 per support condition)
3. Add compatibilización: average moments at shared supports when `Ma2/Ma1≥0.6`, else shed to simple
4. Validate `lx/ly≥0.5` in continuity direction
5. Add cantilever path
6-10. Fix KaMin formula, Ka>KaMax warning, sMin, h calc, h rounding

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `client/src/main.tsx` | Modified | +4 imports, +4 routes, +2 nav links |
| `client/src/lib/slab-calc.ts` | Modified | isCrossed, unidirectional, compatibilización, KaMin, h calc, sMin, warnings |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Break existing crossed-slab output | Medium | Phase A ships first (independent); preserve Kalmanok path for crossed |
| √fc KaMin misapplied | Low | Document in steps; user verified against CIRSOC |
| Beam-strip coefficients edge cases | Medium | Log assumed coefficients; add step trace |

## Rollback Plan
**Phase A**: `git revert` single commit. **Phase B**: `git revert` slab-calc commit; original Kalmanok-only code preserved.

## Dependencies
None.

## Success Criteria
- [ ] `/slab`, `/slab-results`, `/concrete`, `/concrete-results` routes resolve
- [ ] "Losas H°" and "Viga H°" visible in NavBar
- [ ] `isCrossed` rejects slabs with any "free" edge
- [ ] Unidirectional uses beam strip, not Kalmanok
- [ ] Compatibilización averages moments at continuous edges
- [ ] h input preserved without rounding; `h = dMin + cover`
- [ ] `KaMin = 1/(3.4·√fc)` for fc>30
- [ ] `tsc -b` passes
