# Design: Brace Sizing (Dimensionado de Puntal)

## Technical Approach

Add `checkBrace()` to `cartel-calc.ts` — a pure function that takes `(Pu, tipo, Fy, L_m)` and returns a `BraceCheckResult`. Called from `calculateCartel()` after `calcForces()` when `tienePuntal && brace`. Does NOT modify `calcForces()` — it remains pure statics. Each brace type uses existing functions (`checkAngleCompForce`, `calcBuiltUpSectionProps`, `checkGlobalColumn`) with hardcoded profiles.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Verification entry point | New `checkBrace()` called from `calculateCartel()` after forces | Inline in `calculateCartel()` or inside `calcForces()` | Keeps statics pure. `calcForces()` stays unchanged. Encapsulates 3 type branches in one function. |
| Result type | Single `BraceCheckResult` with optional fields per type (`chkAngle?`, `globalCheck?`, `lateralBracing_cm?`) | Separate types per brace variant | Matches existing pattern (e.g., `CartelResult` has optional `flexoResult`, `globalCheck`). Single field on `CartelResult` — `braceCheck: BraceCheckResult \| null`. |
| tipoPuntal type | `number` (1\|2\|3) | String enum | Follows `tipoColumna` convention already established in the codebase. |
| Lateral bracing formula | λ_lim = π√(E/Fy), L_max_mm = ry_cm × 10 × λ_lim / K, K=1.0, E=200000 MPa | Tabulated CIRSOC values | Same E used throughout codebase. Euler buckling derivation is standard and conservative. |
| Brace pass/fail | Independent `passesBrace` flag; does NOT affect `passes` (column) | Merged into single pass/fail | Spec requirement: green column + red brace is valid. Two independent banners in results. |
| Default tipoPuntal | 1 (Cruz) | None / undefined | Backward-compatible: saved states without `tipoPuntal` default to Type 1 on load. |

## Data Flow

```
CartelForm ──tipoPuntal──→ CartelState ──navigate──→ CartelResults
                                                         │
                                                  calculateCartel(state)
                                                    ├─ calcWind()
                                                    ├─ calcForces() → {forces, brace}
                                                    ├─ checkBrace(Pu, tipo, Fy, L)  ← NEW
                                                    │    ├─ Type 1: checkAngleCompForce ×2
                                                    │    ├─ Type 2: builtUpSection + globalCheck + lateral
                                                    │    └─ Type 3: builtUpSection + globalCheck + montant
                                                    └─ existing column verification
                                                         │
                                                    CartelResult.braceCheck
                                                         │
                                              ┌──────────┼──────────┐
                                              ▼          ▼          ▼
                                        CartelResults  PrintPage   storage.ts
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/cartel-calc.ts` | Modify | Add `BraceCheckResult` type, `checkBrace()` function. Add `tipoPuntal` to `CartelInput`. Add `braceCheck` to `CartelResult`. Call `checkBrace()` in `calculateCartel()`. Append brace steps to `steps` string. |
| `client/src/screens/CartelForm.tsx` | Modify | Add `tipoPuntal` state (default 1), type selector UI (3 card buttons, visible when `tienePuntal`). Wire into `CartelState`, `handleSubmit`, `handleSave`, `handleLoad`, auto-save. |
| `client/src/screens/CartelResults.tsx` | Modify | Add brace verification banner (green/red, independent from column). Display `braceCheck` details when present. |
| `client/src/screens/CartelPrintPage.tsx` | Modify | Add brace verification section to print layout (table with per-type fields). Show `tipoPuntal` name in inputs table. Handle `SavedCartelPrintout` defaults. |
| `client/src/lib/storage.ts` | Modify | Add `tipoPuntal?: number` to `CartelFormState`. Auto-save in `CartelForm.tsx` includes it. |

## Interfaces

```typescript
// New type — cartel-calc.ts
export interface BraceCheckResult {
  tipo: 1 | 2 | 3;
  chkAngle?: AngleVerification;       // Type 1: single-angle check (Pu/2)
  chkAngle2?: AngleVerification;      // Type 1: second angle (identical, for display)
  globalCheck?: GlobalColumnCheck;    // Type 2 & 3: built-up buckling
  chkDiagonal?: AngleVerification;    // Type 2: diagonal member
  chkMontant?: AngleVerification;     // Type 3: montant member
  lateralBracing_cm?: number;         // Type 2: required lateral spacing
  ratioBrace: number;
  passesBrace: boolean;
}

// Modified types
export interface CartelInput { /* ...existing... */ tipoPuntal: number; }
export interface CartelResult { /* ...existing... */ braceCheck: BraceCheckResult | null; }
export interface CartelFormState { /* ...existing... */ tipoPuntal?: number; }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | TypeScript compilation | `cd client && npm run build` — no regressions |
| Manual | Success criteria from proposal | V=45 m/s, hPuntal=3m, dPuntal=2m — all 3 types pass; Type 2 shows lateral bracing; independent banners |
| Manual | Edge cases | No brace (tienePuntal=false) → braceCheck=null; Fy=355 → tighter lateral bracing; invalid tipoPuntal → throw |

No test runner configured. Verification is manual + build check.

## Migration / Rollout

`tipoPuntal` is additive. Old saved states without it default to Type 1 (Cruz) in `loadLastCartelFormState()` and `handleLoad()`. No migration needed. Rollback: revert 5 files.

## Open Questions

- [ ] Should the Type 2 lateral bracing check also verify the diagonal's rz (weak-axis) buckling? Proposal says "diagonals checked individually" — confirmed as `checkAngleCompForce` with L_pandeo=d_diag and K=1.0.
