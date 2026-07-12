# Design: Steel Beam Dead/Live Load Split

## Technical Approach

Extend `Load` with `deadLoad`/`liveLoad` fields, wrap the existing `calculateBeam()` in a two-pass driver that runs D-only and L-only elastic analyses, then combines via LRFD U = 1.2·D + 1.6·L for ultimate reactions, shear, and moment. Diagrams render ultimate-only (spec option B). Service moment for deflection becomes `M_D + M_L`, replacing the `Mu/1.4` heuristic entirely.

## Architecture Decisions

### Decision: Two-pass elastic analysis vs. in-solver decomposition

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Two-pass: call `calculateBeam()` twice | Simplest; leaves solver untouched; sub-ms × 2 negligible | **Chosen** |
| In-solver: track D/L contributions inside one run | Invasive to 3-moment matrix assembly; high regression risk | Rejected |

**Rationale**: `calculateBeam()` assembles a linear system `A·M = B` where `B` mixes all loads. Splitting the solver internals would require separate `loadTerm()` arrays — risky and hard to verify. Two-pass produces identical results without touching the solver.

### Decision: Service moment computation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `serviceM = M_D + M_L` (unfactored) | Correct per LRFD; requires both passes | **Chosen** |
| Keep `Mu/1.4` fallback | Wrong for any D/L ratio ≠ 1:1; legacy L=0 case: Mu/1.4 = 0.857·M_D ≠ M_D | Rejected |

**Rationale**: The old heuristic assumed a 1:1 D/L ratio. With the split, we have actual M_D and M_L — use them. No fallback needed; the computation is exact.

### Decision: Load migration strategy

Detect legacy loads at `FormPage` load time: if `magnitude` exists but `deadLoad`/`liveLoad` are missing → set `deadLoad = magnitude, liveLoad = 0`. Show a migration banner. This is conservative (all loads become dead, live = 0) and lets the user adjust L values afterward.

## Data Flow

```
User inputs (D,L per load)
    │
    ▼
FormPage ──► calculateBeamDual(config, loads)
                  │
                  ├─► calculateBeam(config, D-loads[]) ──► BeamResults_d
                  ├─► calculateBeam(config, L-loads[]) ──► BeamResults_l
                  │
                  └─► combine: V_U=1.2·V_D+1.6·V_L, M_U=1.2·M_D+1.6·M_L
                              maxShearU, maxMomentU
                              ▼
                       BeamResultsDual
                              │
    ResultsPage ◄─────────────┘
         │
         ├─► Reaction cards: Ra_D, Ra_L, Rb_D, Rb_L
         ├─► Diagrams: V_U(x), M_U(x) only (no per-load plots)
         ├─► checkBeam(profile, params, serviceM = M_D_max + M_L_max)
         └─► Load diagram: renders deadLoad + liveLoad per load

Storage round-trip: loads[] with deadLoad/liveLoad + magnitude (redundant)
    → localStorage → SavedBeams.onLoad → migration shim if needed
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/types.d.ts` | Modify | Add `deadLoad: number`, `liveLoad: number` to `Load`; `magnitude` becomes optional. Add `BeamResultsDual` interface |
| `client/src/lib/beam-calculations.ts` | Modify | Add `calculateBeamDual()`: maps D/L to temporary `magnitude`-only `Load[]`, calls `calculateBeam()` twice, returns combined results. Existing `calculateBeam()` unchanged |
| `client/src/screens/FormPage.tsx` | Modify | Replace single magnitude input with D/L side-by-side (kg/m or kN/m); add `migrateLoads()` detection on SavedBeam load; update validation to `loads.some(l => l.deadLoad > 0 \|\| l.liveLoad > 0)` |
| `client/src/screens/ResultsPage.tsx` | Modify | Use `calculateBeamDual`; reaction cards show D/L per support; design check uses `M_U`, `V_U`, and `serviceM = M_D_max + M_L_max`; diagrams render ultimate functions only |
| `client/src/lib/steel-design.ts` | None | Unchanged — receives `serviceM` externally |
| `client/src/lib/storage.ts` | None | No schema changes; migration at load boundary |

## Interfaces

```typescript
// types.d.ts — Load extension
interface Load {
  id: string;
  type: "point" | "distributed";
  deadLoad: number;       // NEW — required
  liveLoad: number;       // NEW — required
  magnitude?: number;     // NOW OPTIONAL — kept for legacy compat
  position?: number;
  start?: number;
  end?: number;
}

// types.d.ts — New dual-result type
interface BeamResultsDual {
  d: BeamResults;                // dead-only
  l: BeamResults;                // live-only
  shearForceU: (x: number) => number;
  bendingMomentU: (x: number) => number;
  maxMomentU: { value: number; position: number };
  maxShearU: number;
  criticalPointsU: number[];
}
```

```typescript
// beam-calculations.ts — new entry point
export function calculateBeamDual(config: BeamConfig, loads: Load[]): BeamResultsDual
// Internally creates D-only and L-only Load[] copies (deadLoad/liveLoad → magnitude),
// calls calculateBeam() twice, then combines ultimate functions via LRFD.
```

## Persistence Migration

`loads` in localStorage may contain legacy `{magnitude: 8}` records. On `SavedBeams.onLoad` in `FormPage`:

1. Map each raw load through `migrateLoads()`.
2. Detect: `typeof l.deadLoad !== 'number'` → legacy.
3. Patch: `{ ...l, deadLoad: l.magnitude ?? 0, liveLoad: 0 }`.
4. Show a migration notice banner.
5. On next save, the load includes both `deadLoad`/`liveLoad` and `magnitude` (redundant for rollback).

## Test Strategy

No test runner. Verification via manual hand-calc fixtures:

| Fixture | Check |
|---------|-------|
| Simple span 6 m, D=5 kN/m, L=3 kN/m | w_U = 10.8, M_U_max = 10.8×6²/8 = 48.6 kN·m |
| Simple span 4 m, D=100 kg/m, L=200 kg/m | Ra_D=Rb_D=200 kg, Ra_L=Rb_L=400 kg |
| Legacy load: magnitude=8, no D/L | Loads as D=8, L=0; migration banner appears |
| Steel design with IPN 200 | `serviceM` uses M_D + M_L; `tsc -b` passes |
| Old saved beam reload | Loads migrate with notice; no data loss |

TypeScript strict mode (`tsc -b`) is the quality gate.

## Open Questions

- [ ] Should the migration notice be a modal or an inline banner? (Defer to apply phase — inline banner is simpler.)
- [ ] Should `magnitude` be stripped on save for new loads, or always preserved? (Per proposal: preserved for rollback.)
