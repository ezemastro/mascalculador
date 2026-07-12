# Tasks: Brace Sizing (Dimensionado de Puntal)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — Types & Interfaces

- [x] 1.1 Add `BraceCheckResult` type to `cartel-calc.ts` with optional fields per brace type
- [x] 1.2 Add `tipoPuntal: number` to `CartelInput`
- [x] 1.3 Add `braceCheck: BraceCheckResult | null` to `CartelResult`
- [x] 1.4 Add `tipoPuntal?: number` to `CartelFormState` in `storage.ts`

## Phase 2: Brace Calculation Logic

- [x] 2.1 Create `checkBrace()` in `cartel-calc.ts` — Type 1 branch: 2× L 2"×3/16" using `checkAngleCompForce(Pu/2, K=1.0, L_puntal, rz)`
- [x] 2.2 Add Type 2 branch: built-up (hCol=0.25, chords L 1½"×1/8") + `checkGlobalColumn()` + diagonal check + lateral bracing `λ_lim = π√(E/Fy)`
- [x] 2.3 Add Type 3 branch: built-up (20×20cm, chords L 1"×1/8") + `checkGlobalColumn()` + montant check
- [x] 2.4 Wire `checkBrace()` into `calculateCartel()` after forces; append brace steps to `steps` string

## Phase 3: UI — Form, Results & Print

- [x] 3.1 Add `tipoPuntal` useState(default 1) + 3-card type selector to `CartelForm.tsx` (visible when `tienePuntal`)
- [x] 3.2 Wire `tipoPuntal` through handleSubmit, handleSave, handleLoad, and auto-save effect
- [x] 3.3 Add brace verification banner (green/red, independent from column) + check details to `CartelResults.tsx`
- [x] 3.4 Add brace verification table to `CartelPrintPage.tsx` nav-state + saved-cartel defaults
