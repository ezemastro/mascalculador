## Exploration: Losas de HºAº — Wiring + Methodology Audit

### Current State

The project has fully implemented slab (`slab-calc.ts`, `SlabForm.tsx`, `SlabResults.tsx`, `SlabPlan.tsx`) and concrete beam (`concrete-design.ts`, `ConcreteForm.tsx`, `ConcreteResults.tsx`) functionality from commit `f03c0a4`. However, uncommitted changes to `main.tsx` removed ALL wiring — the imports, routes, and nav links for `/slab`, `/slab-results`, `/concrete`, `/concrete-results` are gone. The files still exist but are unreachable.

The slab calculation engine (`slab-calc.ts`, 2275 lines) implements a CIRSOC 201-05 design with:
- Kalmanok coefficient tables for 8 support configurations (simple, 1-fixed-X, 1-fixed-Y, 2-fixed-X, 2-adjacent, 2-fixed-Y, 3-fixed, 4-fixed)
- Predimensioning, load analysis, ultimate load, moment calculation, reinforcement design
- Distribution reinforcement for unidirectional slabs

---

### Affected Areas

| File | Lines | Role |
|------|-------|------|
| `client/src/main.tsx` | 94 | Router + nav — imports, routes, links for slab/concrete REMOVED |
| `client/src/lib/slab-calc.ts` | 2275 | Slab design engine — methodology issues identified |
| `client/src/screens/SlabForm.tsx` | 233 | Slab input form — navigates to `/slab-results` (route missing) |
| `client/src/screens/SlabResults.tsx` | 190 | Slab results display — navigates to `/slab` (route missing) |
| `client/src/components/SlabPlan.tsx` | 158 | SVG slab plan view — no wiring issues, pure component |
| `client/src/screens/ConcreteForm.tsx` | 499 | Concrete beam form — navigates to `/concrete-results` (route missing) |
| `client/src/screens/ConcreteResults.tsx` | 633 | Concrete beam results — navigates to `/concrete` (route missing) |
| `client/src/lib/concrete-design.ts` | 301 | Concrete beam design engine — no methodology issues in scope |

---

### Part A: Wiring Gap — Exact Changes Needed

#### Imports to ADD to `main.tsx`:
```ts
import SlabForm from "./screens/SlabForm.tsx";
import SlabResults from "./screens/SlabResults.tsx";
import ConcreteForm from "./screens/ConcreteForm.tsx";
import ConcreteResults from "./screens/ConcreteResults.tsx";
```

#### Routes to ADD to router config:
```ts
{ path: "/slab", Component: SlabForm },
{ path: "/slab-results", Component: SlabResults },
{ path: "/concrete", Component: ConcreteForm },
{ path: "/concrete-results", Component: ConcreteResults },
```

#### Nav links to ADD to NavBar:
```tsx
<Link to="/slab" className="text-sm text-text-muted hover:text-text">Losas H°</Link>
<Link to="/concrete" className="text-sm text-text-muted hover:text-text">Viga H°</Link>
```

#### Navigation verification:
- `SlabForm.tsx` → `navigate("/slab-results")` ✅
- `SlabResults.tsx` → `navigate("/slab")` ✅
- `ConcreteForm.tsx` → `navigate("/concrete-results")` ✅
- `ConcreteResults.tsx` → `navigate("/concrete")` ✅

All navigations target existing routes (once added). No import issues — all dependency files exist.

---

### Part B: Methodology Discrepancies

#### CRITICAL (3 findings)

| # | Step | Issue | Code Behavior | Spec Requirement |
|---|------|-------|--------------|-----------------|
| 1 | 1 | **Missing 4-edge support check** | `const isCrossed = ratio >= 0.5 && ratio <= 2.0` — checks aspect ratio ONLY | Must also require "apoyo en los 4 bordes" — all 4 edges must be supported (not "free") |
| 2 | 6 | **Unidirectional slabs use Kalmanok** | Falls through to the same Kalmanok table selection logic even when `isCrossed=false`. Only difference is predim coefficients and distribution steel. | Unidirectional slabs must use beam strip analysis (isostatic/hyperstatic: M=qu·L²/8, etc.) |
| 3 | 6 | **Missing compatibilización de apoyos** | No support moment averaging or compatibility check performed when `EdgeCondition="continuo"` | If continuity exists and Ma2/Ma1 ≥ 0.6, average moments at support. If < 0.6, no perfect fixity — recalculate. |

#### MEDIUM (5 findings)

| # | Step | Issue | Code Behavior | Spec Requirement |
|---|------|-------|--------------|-----------------|
| 4 | 2 | **No continuity ratio validation** | Accepts "continuo" as an input without verification | Must validate that (luz menor / luz mayor) ≥ 0.5 in the continuity direction |
| 5 | 1 | **No cantilever detection** | No detection or handling of "voladizo" (1-edge support) | Spec explicitly mentions cantilever as a unidirectional case |
| 6 | 9 | **KaMin formula uncertainty** | Uses `KaMin = 1.4/(0.85·fc)` for fc≤30 and `1/(3.4·fc)` for fc>30 | Spec says "según tablas en función de f'c". Formula for fc>30 should be `1/(3.4·√fc)` not `1/(3.4·fc)` — likely a bug |
| 7 | 10 | **Ka > KaMax behavior wrong** | Uses KaMax with label "armadura doble (simplificado)" but does NOT actually design compression steel | Spec says "recomendar aumentar espesor" — should warn user, not silently use max reinforcement |
| 8 | 11 | **Missing minimum spacing check** | Only computes sMax (max spacing), no sMin (min spacing) validation | Must also check s_min = 80mm per CIRSOC |

#### COSMETIC (2 findings)

| # | Step | Issue | Code Behavior | Spec Requirement |
|---|------|-------|--------------|-----------------|
| 9 | 3 | **h rounding with user input** | `h = Math.ceil(h/10)*10` even when user explicitly provides h | When user provides h, should honor it (or at least not silently round) |
| 10 | 3 | **h formula discrepancy** | `h = dMin + cover + 10` (adds 10mm for bar diameter) | Spec says `h = d_min + r` where r = cover |

---

### Part C: Unidirectional Handling Assessment

The current code has a GAP in unidirectional support:

**Classification**: The ratio check `ratio >= 0.5 && ratio <= 2.0` (where ratio = ly/lx) is a necessary but NOT sufficient condition. A slab with lx=4m, ly=5m (ratio=1.25) is classified as crossed regardless of edge conditions. The spec requires 4-edge support.

**Structural analysis**: When `isCrossed=false`, the code STILL uses Kalmanok 4-edge tables — it doesn't switch to beam analysis. This means:
- A slab spanning 10m with lx=2m, ly=10m (ratio=5) gets Kalmanok clipped to ratio=2.0, giving wrong moments
- The only unidirectional-specific behaviors are predim coefficients (30/35/40) and distribution reinforcement

**Cantilever**: Not handled at all. A slab with 1 edge fixed and 3 "free" edges (voladizo) should use M = qu·L²/2.

---

### Part D: Concrete Beam Wiring (Secondary)

Identical wiring issue: `ConcreteForm.tsx` and `ConcreteResults.tsx` exist but routes `/concrete` and `/concrete-results` are not in `main.tsx`. The ConcreteForm's `handleSubmit` navigates to `/concrete-results` and the results page links back to `/concrete`. No secondary issues beyond route wiring.

---

### Estimated Scope

| Activity | Files | Lines Changed | Complexity |
|----------|-------|--------------|------------|
| Wire slab routes + nav | `main.tsx` | ~20 lines added | Low |
| Wire concrete routes + nav | `main.tsx` | ~8 lines added | Low |
| Fix isCrossed classification | `slab-calc.ts` | ~5 lines | Low |
| Add 4-edge + cantilever detection | `slab-calc.ts` | ~15 lines | Medium |
| Add beam analysis for unidirectional | `slab-calc.ts` | ~40 lines | Medium |
| Add compatibilización de apoyos | `slab-calc.ts` | ~30 lines | High (needs multi-support analysis) |
| Add KaMax warning | `slab-calc.ts` | ~5 lines | Low |
| Fix KaMin formula | `slab-calc.ts` | ~2 lines | Low |
| Add minimum spacing check | `slab-calc.ts` | ~5 lines | Low |
| Fix continuity validation | `slab-calc.ts` | ~10 lines | Low |
| **Total** | **~10 files** | **~140 lines** | **Medium** |

---

### Recommendation

**Approach**: Proceed with the full SDD pipeline for change `losa-ha-wiring`. The wiring fix is trivially small, but the methodology fixes in `slab-calc.ts` need design work and careful spec writing.

The change should be scoped as:
1. **Phase 1** (quick): Wire routes + nav for slabs and concrete beams (~28 lines in main.tsx)
2. **Phase 2** (methodology): Fix the slab calc engine per the discrepancies table
3. **Phase 3** (unidirectional): Add proper beam analysis for unidirectional slabs

Phases 1 and 2+3 should NOT be combined in a single PR — the wiring is trivial and non-controversial, while the methodology changes need review. Recommended as chained PRs:
- PR #1: Wire slab + concrete routes/nav (low risk, standalone)
- PR #2: Fix methodology in slab-calc.ts

---

### Risks

- **Medium**: The unidirectional analysis gap means users who create a slab that should be unidirectional get potentially wrong moments. This is a correctness risk, not a crash risk.
- **Low**: Wiring is purely additive — no risk of breaking existing routes.
- **Low**: No test coverage exists (confirmed in openspec config), so methodology fixes cannot be validated by CI. Manual verification required.
- **Low**: Adding compatibilización de apoyos (moment averaging) is the riskiest methodology change — it introduces a convergence loop that could produce unexpected results.

---

### Ready for Proposal

**Yes** — proceed to `sdd-propose`. The exploration has identified clear scope and a recommended delivery strategy (chained PRs). The user should be informed that:

1. The wiring fix is ~28 lines in main.tsx (5 min work)
2. The methodology fixes in slab-calc.ts include 10 discrepancies, 3 critical and 5 medium
3. Unidirectional slabs need a completely different structural analysis path
4. Recommend separate PRs: wiring first (quick win), then methodology
