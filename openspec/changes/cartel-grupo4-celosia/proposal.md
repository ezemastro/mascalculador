# Proposal: Verificación CIRSOC 301 Grupo 4 para columnas T2/T4

## Intent

Replace simplified T2/T4 truss verification (Nchord=Mmax/hCol, K=1.0, φc=0.90) with full CIRSOC 301 Grupo 4: Steiner section properties, modified slenderness, P-Δ amplification, chord/diagonal buckling per φc=0.85, and global column check.

## Scope

**In**: Steiner (A_tot, J_x, r_min) for T2+T4; λ_m = √(λ₀²+λ₁²); P-Δ with Euler P_cm and initial e₀; chord compressión λ_c/F_cr per E3, φc=0.85; diagonal shear with β coefficient; global column buckling; `GlobalColumnCheck` in `CartelResult`; UI card in Results/Print; φc 0.90→0.85 in `checkAngleCompForce`.

**Out**: Wind, forces, geometry — unchanged. T1 IPN, brace/puntal — untouched. No storage migration.

## Capabilities

### Modified Capabilities

- **cartel-column-design**: T2/T4 requirements replaced by Grupo 4. T1, shared forces, UI rules, and print parity unchanged.

## Approach

Five new functions in `cartel-calc.ts`, called from T2/T4 branches after shared wind/forces:

- `calcBuiltUpSectionProps` — Steiner from chord xg
- `calcModifiedSlenderness` — λ_m
- `calcPdeltaMoments` — Euler P_cm, e₀, amplified moments
- `calcBeta` — shear amplification per CIRSOC 301
- `checkGlobalColumn` — macroscopic buckling φPn_global

Flow: wind → forces → if T2/T4: built-up → λ_m → P-Δ → chord check → diagonal check → global → result.

## Affected Areas

| Area | Impact |
|------|--------|
| `client/src/lib/cartel-calc.ts` | 5 new functions; replace T2/T4; φc→0.85 |
| `client/src/screens/CartelResults.tsx` | Global check card; φc labels |
| `client/src/screens/CartelPrintPage.tsx` | Mirror global check + φc |

## Risks

| Risk | Mitigation |
|------|------------|
| β formula ambiguous in CIRSOC | User confirms clause; document in code |
| e₀ default may not match norm | Configurable with fallback |
| φc drop breaks existing results | Documented; more conservative = safer |
| Zero-value geometry edge cases | Guard clauses + throws |

## Rollback Plan

Revert commit. T2/T4 path self-contained — no schema or storage change.

## Dependencies

`ANGLE_PROFILES` (AngleData with xg), `ColumnForces`, `WindResult` — all stable.

## Success Criteria

- [ ] Chord uses λ_c with φc=0.85, not simplified Nchord=M/h
- [ ] Steiner A_tot, J_x, r_min match hand calc
- [ ] P-Δ yields M_sL > Mmax when Pu nears P_cm
- [ ] Global check renders in Results and Print
- [ ] Build passes: `cd client && npm run build`

---

## Proposal Question Round

1. **β coefficient**: ¿Cláusula CIRSOC 301 que define β? ¿β = 1/(1−Pu/P_cm) o función tabulada de λ_m?
2. **K global**: ¿K=0.8 fijo para celosía o campo configurable por usuario como en T1?
3. **Excentricidad e₀**: ¿L/500 o imperfección equivalente de curva de pandeo (α·e₀)?
4. **Montantes**: ¿Solo φc→0.85 o Grupo 4 modifica también Nmont?
5. **T4 3D**: ¿2 planos independientes con interacción biaxial, o sección armada 3D completa?
