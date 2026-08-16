# Design: Viga Continua — Modo Pórtico + Mejoras Compartidas

## 1. Technical Approach

`viga-continua/` (port 5175) gains a second mode (`Pórtico`) sharing the same entry/result routes with the existing `Viga Continua` mode. A `ModeSelector` segmented control at the top of the form persists `?mode=portico` to the URL via `useSearchParams`, and the results screen branches on `location.state.mode` to render either `VigaContinuaResults` (reusing `calculateBeamEnvelope`) or `PorticoResults` (new 2-D direct-stiffness solver). Both modes share the new `Nueva` button and `Envolvente / Servicio` toggle. The solver is a pure module — no I/O, no globals, no internal cap — and is verified by 3 hand-computed fixtures.

**References:** R-portico-types/-solver/-results/-supers/-persistence/-limits/-diagram (new), R-beam-nueva/-env-toggle (modified), R-routing-mode-selector/-portico-routes/-path-correction (modified).

## 2. Architecture Decisions

| # | Decision | Option | Tradeoff | Choice |
|---|---|---|---|---|
| D1 | Solve K·u=F | (a) Inline dense Gauss-Jordan (b) `mathjs` dep (c) `numeric.js` dep | (a) zero deps, ≤120 LOC, fine for ≤5 bars/15 DOFs (b) +15 deps, larger bundle (c) similar | **(a) Inline** — locked from proposal §Open Decisions |
| D2 | Pivoting | (a) Partial (row max) (b) Full (row+col) (c) None | (a) numerically stable for SPD-ish frame matrices (b) ≈2× cost for ≤15 DOFs (c) crashing on bad conditioning | **(a) Partial pivoting** |
| D3 | URL mode persistence | (a) `?mode=portico` (b) `location.state` only (c) cookie | (a) deep-linkable, shareable, browser-history friendly (b) breaks refresh (c) extra API | **(a) URL query** |
| D4 | Results routing | (a) Single route + `location.state` (b) Two routes `/viga-continua-results` and `/portico-results` | (a) one wrapper that branches on `state.mode` (b) cleaner URLs but two registrations | **(a) Single route** — matches proposal §Approach |
| D5 | Mode toggle location | (a) Top of form (b) In NavBar (c) Sidebar | (a) closest to the produced artifact (b) always visible (c) takes horizontal space | **(a) Top of form** — matches explore §mode_selector_location |
| D6 | Diagram from / sample count | (a) 11 (b) 21 (c) adaptive | (a) smooth enough for 5-bar frames, no visible kinks (b) 2× cost, no gain in MVP (c) complexity for no engine win | **(a) 11 intermediate samples per bar** (matches M+ curve resolution in `VigaContinuaResults`) |
| D7 | Separate `MafsFrame` | (a) Extract now (b) Defer | (a) DRY but adds PR1 scope (b) duplicate Mafs primitives in two screens | **(b) Defer** — risks §Bundle size note says "decide in PR4" |
| D8 | Stiffness terms | (a) Include axial (b) Bernoulli only (bending) | (a) standard 6×6 EAN frame element (b) only DV = 3 → simpler but excludes thermal/bar loads | **(a) Include axial** — needed for inclined-load decomposition and reaction consistency |
| D9 | `portico.ts` location | (a) `src/lib/` (b) `shared/src/` | (a) co-located with solver (b) sharable with future `hormigon/` mirror | **(a) `src/lib/`** — out of scope §"mirror" |
| D10 | Domain naming | `PorticoSupportKind = "hinge" \| "fixed"` | Distinct from beam `SupportType = "simple" \| "fixed" \| "free"` (semantics differ) | **Locked** — spec #709 |

## 3. Data Flow

```
URL /viga-continua?mode=portico
        │
        ▼
┌────────────────────────────────┐
│ viga-continua-main.tsx         │
│  createBrowserRouter           │
│  /            ─→ MainEntry     │
│  /viga-continua ─→ MainEntry   │
│  /viga-continua-results        │
│              ─→ ResultsWrapper │
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ MainEntry (NEW PR1)            │
│  useSearchParams → mode        │
│  mode="portico" → <PorticoForm/>│
│  default        → <VigaContinuaForm/>│
└────────────────────────────────┘
        │
        ▼ submit { mode, ...state }
┌────────────────────────────────┐
│ ResultsWrapper (NEW PR1)       │
│  const m = location.state?.mode│
│  m==="portico" → <PorticoResults/>│
│  else          → <VigaContinuaResults/>│
└────────────────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│ PorticoResults (NEW PR4)       │
│  const r = useMemo(() =>       │
│    solvePortico(state, "uls"), │  ←── portico-analysis.ts
│    [state])                    │
│  toggle "Envolvente / Servicio"│
│    → render slice r.uls /      │
│      r.slsD / r.slsL  (no re-solve)│
└────────────────────────────────┘
```

## 4. File Changes

| File | Action | Description |
|---|---|---|
| `viga-continua/src/lib/portico.ts` | **Create** | `PorticoNode`, `PorticoBar`, `PorticoBarLoad`, `PorticoSupport`, `PorticoState`, `PorticoSupportKind`, `SolvedPortico`, `PorticoResults`. Validation function `validatePorticoState(s)`. |
| `viga-continua/src/lib/portico-analysis.ts` | **Create** | Pure module: `solvePortico(state, mode: "uls" \| "sls-d" \| "sls-l"): PorticoResults`. Internal helpers: `assembleK`, `applyBCs`, `gaussSolve`, `recoverInternalForces`. |
| `viga-continua/src/components/ModeSelector.tsx` | **Create** | Segmented control (`Viga Continua` \| `Pórtico`). Controlled prop + onChange. Tailwind tokens only. |
| `viga-continua/src/components/MainEntry.tsx` | **Create** | PR1 wrapper: reads `?mode=`, mounts `<VigaContinuaForm/>` or `<PorticoForm/>`. |
| `viga-continua/src/components/ResultsWrapper.tsx` | **Create** | PR1 wrapper: reads `location.state.mode`, mounts beam or pórtico results. |
| `viga-continua/src/screens/PorticoForm.tsx` | **Create** (PR3) | Editor: nodes, bars, supports, loads. 5/5/5 cap with disabled `+`. Defaults precargados. `Nueva` button. |
| `viga-continua/src/screens/PorticoResults.tsx` | **Create** (PR4) | Mafs canvas + reactions table + Envolvente/Servicio toggle + M+ legend. |
| `viga-continua/src/screens/VigaContinuaForm.tsx` | **Modify** | Mount `<ModeSelector/>` above `<header>`. Mount `<Nueva/>` button. |
| `viga-continua/src/screens/VigaContinuaResults.tsx` | **Modify** | Mount `<EnvToggle/>` (Envolvente default). Refactor: compute ULS + SLS once, switch render by toggle. |
| `viga-continua/src/viga-continua-main.tsx` | **Modify** | `/` and `/viga-continua` → `<MainEntry/>`; `/viga-continua-results` → `<ResultsWrapper/>`. |
| `viga-continua/shared/src/storage.ts` | **Modify** | `SaveType += "portico"`. Add `saveLastPorticoFormState` / `loadLastPorticoFormState` / `savePorticoInput` / `updatePorticoInput` / `loadPorticoInput` / `deletePorticoInput` / `getSavedPorticoInputs`. New key `LAST_PORTICO_FORM_KEY = "last_portico_form"`. |
| `viga-continua/shared/src/SavedBeams.tsx` | **Modify** | `type` union adds `"portico"`. Render branch: label `"Pórtico"`, summary `nodes=N bars=M`. |
| `viga-continua/scripts/portico-smoke.ts` | **Create** | Standalone `tsx` script with 3 fixtures (ménsula, simétrico, carga inclinada). Asserts match to 0.1%. |
| `openspec/changes/active/viga-continua-modo-portico/design.md` | **Create** | This file. |

## 5. Interfaces / Contracts

### 5.1 `portico.ts`

```ts
export type PorticoSupportKind = "hinge" | "fixed";

export interface PorticoNode {
  id: string;        // user-provided, unique
  x: number;         // global X (m)
  y: number;         // global Y, positive DOWNWARD (m)
}

export interface PorticoBar {
  id: string;        // unique
  from: string;      // node id
  to: string;        // node id
  E: number;         // MPa → use 1 (rigidities cancel for linear-elastic force distribution)
  A: number;         // cross-section area (m²) — placeholder 1e-2; non-design
  I: number;         // moment of inertia (m⁴) — placeholder 1e-4; non-design
}

export type PorticoLoadKind = "point" | "distributed";

export interface PorticoBarLoad {
  id: string;
  barId: string;     // references PorticoBar.id
  kind: PorticoLoadKind;
  /** D + L parts, in kN or kN/m, with `angle` degrees, +x=0, +y=90 (Y positive DOWN). */
  D: number;
  L: number;
  angle: number;            // degrees; 0 = +x, 90 = +y (down)
  a: number;                // start position along bar m, 0 ≤ a < L_bar
  b?: number;               // end position (only for distributed), b ≤ L_bar
}

export interface PorticoSupport {
  id: string;
  nodeId: string;           // references PorticoNode.id
  kind: PorticoSupportKind;
}

export interface PorticoState {
  nodes: PorticoNode[];
  bars: PorticoBar[];
  loads: PorticoBarLoad[];
  supports: PorticoSupport[];
}

export interface PorticoBarForces {
  start: { N: number; V: number; M: number };   // local-frame, "from" end
  end:   { N: number; V: number; M: number };   // local-frame, "to" end
  samples: Array<{ s: number; N: number; V: number; M: number }>; // s ∈ [0, L]
}

export interface PorticoReaction {
  supportId: string;
  Fx: number; Fy: number; Mz: number;          // global frame; M+ = +z
}

export interface PorticoNodeDisplacement {
  nodeId: string;
  u: number; v: number; theta: number;         // global; theta = +z (right-hand rule)
}

export interface SolvedPortico {
  displacements: PorticoNodeDisplacement[];
  reactions: PorticoReaction[];
  bars: Array<{ barId: string; forces: PorticoBarForces }>;
}

export interface PorticoResults {
  uls:  SolvedPortico;   // U = 1.2·D + 1.6·L on all loads
  slsD: SolvedPortico;   // D loads only, unfactored
  slsL: SolvedPortico;   // L loads only, unfactored
}
```

**Validation invariants** (run before solve; throw `PorticoValidationError` on failure):

- `nodes` ids unique; `bars` ids unique; `loads` ids unique; `supports` ids unique.
- Every `bar.from` / `bar.to` references an existing `node.id`.
- Every `load.barId` references an existing `bar.id`.
- Every `support.nodeId` references an existing `node.id`.
- `bar.length > 0` (Euclidean distance > 1e-9).
- For `point` loads: `0 ≤ a ≤ L_bar`.
- For `distributed` loads: `0 ≤ a < b ≤ L_bar`.
- `nodes.length ≥ 2`; `bars.length ≥ 1`; `supports.length ≥ 1`.
- DOF count: `n = 3 * nodes.length`; free DOFs after BCs `≥ 1`.

### 5.2 `portico-analysis.ts`

```ts
export type SolveMode = "uls" | "sls-d" | "sls-l";

export function solvePortico(state: PorticoState, mode: SolveMode): PorticoResults;
```

One call to `solvePortico` returns the full triple `{ uls, slsD, slsL }` (the toggle selects which slice to render — no re-solve). Internally: factor load collection per mode, build per-mode `F`, share the same `K` matrix and DOF indexing (the structure is identical for D/L/ULS), solve `K_ff · u_f = F_f` once per mode, recover reactions + bar forces per mode.

## 6. Solver Design (most detailed)

### 6.1 DOF numbering

Each node `i` (0-indexed) reserves 3 consecutive DOFs:

| Node i | DOF index | Meaning |
|---|---|---|
| `0..n-1` | `3i + 0` | `u_i` (X-direction, positive +x) |
| `0..n-1` | `3i + 1` | `v_i` (Y-direction, positive +y = DOWNWARD) |
| `0..n-1` | `3i + 2` | `θ_i` (rotation about +z, right-hand rule) |

Total `nDof = 3 * nodes.length`. Convention locked at scope top-of-file **JSDoc**.

### 6.2 Local element stiffness (6×6)

For a 2-D frame element of length `L`, axial `EA`, bending `EI`, in local coordinates (x̄ along bar axis, ȳ perpendicular, +x̄ pointing from `from` to `to`):

```
k_local = (1/L³) *
┌                                                                  ┐
│ EA·L²    0          0        -EA·L²    0           0            │
│ 0        12·EI      6·EI·L    0       -12·EI      6·EI·L        │
│ 0        6·EI·L     4·EI·L²   0       -6·EI·L     2·EI·L²       │
│-EA·L²    0          0         EA·L²    0           0            │
│ 0       -12·EI     -6·EI·L    0        12·EI     -6·EI·L        │
│ 0        6·EI·L     2·EI·L²   0       -6·EI·L     4·EI·L²       │
└                                                                  ┘
```

Layout: rows/cols ordered `[u1, v1, θ1, u2, v2, θ2]`. At end-1, local V = +ȳ positive (perpendicular to bar); at end-2, V is opposite sign by convention so global equilibrium is consistent.

### 6.3 Transformation matrix (6×6)

For a bar from `P1(x1,y1)` to `P2(x2,y2)`, `dx = x2-x1`, `dy = y2-y1`, `L = sqrt(dx²+dy²)`, `c = dx/L`, `s = dy/L`. (Y-positive-down, so `dy > 0` for bars going down.)

```
T = [ c  s  0  0  0  0
     -s  c  0  0  0  0
      0  0  1  0  0  0
      0  0  0  c  s  0
      0  0  0 -s  c  0
      0  0  0  0  0  1 ]
```

`K_local_global = Tᵀ · k_local · T`. (For frame analysis the result is symmetric; verified by `K_g[i][j] - K_g[j][i] < 1e-9`.)

### 6.4 Assembly

Global `K` (`nDof × nDof`), symmetric, zero-initialized. For each bar index `b`:

```
let nodeA = nodes[bar.from]; let nodeB = nodes[bar.to];
let i0 = 3*nodeA, i6 = 3*nodeB;       // starting DOFs
let dof = [i0, i0+1, i0+2, i6, i6+1, i6+2];
for (let r = 0; r < 6; r++)
  for (let c = 0; c < 6; c++)
    K[dof[r]][dof[c]] += Kg[r][c];
```

### 6.5 Boundary conditions

Compute `constrained[d] = true` for each support:

- `hinge` → `u, v` constrained → `constrained[3i], constrained[3i+1] = true`; `theta` free.
- `fixed` → u, v, θ constrained → all three.

Build `freeDofs[]` = indices where `constrained[d] === false`. Extract `K_ff`, `F_f` = `K[freeDofs][freeDofs]`, `F[freeDofs]`. Solve `K_ff · u_f = F_f` → set `u[freeDofs] = u_f`, `u[constrainedDofs] = 0`.

### 6.6 Loads

For each load, build the equivalent nodal force vector in global coordinates:

- **Point** at position `a` from `from` end:
  - `angle` degrees → `fx = mag·cos(α)`, `fy = mag·sin(α)` (global, Y-positive-down).
  - Magnitude `mag` = `1.2·D + 1.6·L` (ULS) or `D` (sls-d) or `L` (sls-l).
  - **Procedure (locked)**: load is decomposed to global `(fx, fy)` first; then `fx` is projected onto the bar's local x̄ (axial) and `fy` onto the local ȳ (transverse). For a transverse component `P̄` (positive in local +ȳ) at distance `a` from end A, `b = L - a`:
    - `VF_A = P̄·b·(L² - b²) / L³` (shear at A, local +ȳ)
    - `VF_B = P̄·a·(L² - a²) / L³` (shear at B, local +ȳ)
    - `MF_A = -P̄·a·b² / L²` (fixed-end moment at A, signed per M+ convention)
    - `MF_B = +P̄·a²·b / L²` (fixed-end moment at B)
  - **Axial contribution** (along bar axis): for axial component `N̄` (positive in local +x̄): `NF_A = N̄·b/L`, `NF_B = N̄·a/L` (no moments).
  - After computing in local frame, transform: `F_global = Tᵀ · F_local` and add to `F[i0..i6]`.

- **Distributed** over `[a, b]`:
  - `fy` per unit length (projected to perpendicular local direction).
  - Fixed-end forces for UDL `w` over portion `[a, b]` of length `L`:
    - `VF_A = w·(c²/2 - 2c³/3 + c⁴/4)·(1/L)`... Use the standard formula or integrate from `a` to `b` over the closed-form.
  - **Implementation choice**: integrate via Simpson's rule with `N=20` subintervals over the loaded span; for each subsegment `ds` at parameter `s`, add a point load of magnitude `w·ds` at `s`. (Trades tiny numerical error for code simplicity.) Sanity-cap at `1e-9·L` accuracy.

### 6.7 Solve (Gauss-Jordan with partial pivoting)

```ts
function gaussSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);   // augmented
  for (let k = 0; k < n; k++) {
    // partial pivot: find row with max |M[i][k]| for i in [k, n)
    let p = k;
    for (let i = k + 1; i < n; i++)
      if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) < 1e-12) throw new Error("K_ff is singular");
    if (p !== k) [M[k], M[p]] = [M[p], M[k]];
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}
```

### 6.8 Reactions

`R = K·u − F` for all constrained DOFs. Assign to `PorticoReaction`:
- `Fx = -R[3i]` (so a positive Fx in the output means the support pushes the structure in +x, matching the user-facing convention).
- `Fy = -R[3i+1]`.
- `Mz = -R[3i+2]`. Sign matches M+ (vector +z = right-hand rule, out of page; Y-positive-down + x-right).

### 6.9 Internal forces per bar

For each bar:

1. Get `u_local = T · u_global_dof` where `u_global_dof = [u[3iA],v[3iA],θ[3iA], u[3iB],v[3iB],θ[3iB]]`.
2. `f_local = k_local · u_local + f_fixed_end` (including loads).
3. **End A**: `N_A = f_local[0]`, `V_A = f_local[1]`, `M_A = f_local[2]`.
4. **End B**: `N_B = -f_local[3]`, `V_B = -f_local[4]`, `M_B = -f_local[5]`. (Sign flipped because end-B forces are taken acting on the support, not the bar.)
5. **Intermediate samples**: at each `s ∈ {L/12, 2L/12, ..., 11L/12}` (11 samples), compute internal forces by **slicing** the bar at `s` and solving the equilibrium of the stub from `from` to `s`. Mathematically equivalent: `u_local(s) = sum of N1..N3 Hermite shape functions × u_local`, then `f_local(s) = k_local · u_local(s)` evaluated at the slice.

### 6.10 M+ convention (locked)

**M+ = fiber traccionada abajo en el tramo + vector momento apuntando a +x.** Two diagrams:

```
HORIZONTAL BEAM (left → right, Y positive down):
  _____↓ load
       ↓
       .─────────.
       │   M+    │  ← compression on top, tension on bottom
       .─────────.
       ↑ M+ vector points right (and out of the page)

VERTICAL COLUMN (top → bottom):
       │
       │  → horizontal load (e.g. wind)
       │
       │  M+ tension on right fiber, vector points +x (right)
       ▽ hinge
```

Sign rule for a vector cross product: `M = r × F` (right-hand rule). For a horizontal beam with DOWNWARD load `+fy` at distance `a` from left end, `M(a) = -fy·a·(L-a)/L` (negative). The user sees `M+ = 30 kN·m` at the support of a cantilever with TIP load of 10 kN at length 3 m (because the fixed-end moment is reported as the magnitude and the M+ convention is "tension on bottom", which the cantilever bending satisfies).

This is documented in **JSDoc** at the top of `portico-analysis.ts` AND re-printed verbatim in `PorticoResults` legend (top-right, visible without scrolling).

### 6.11 Y-positive-down (locked)

Documented in **JSDoc** at the solver entry point and at the Mafs render call. Input hints in `PorticoForm` carry the legend "Y positivo hacia abajo". On the Mafs canvas, `y` coordinate maps directly to Mafs `y` (Y-down on screen = world-Y).

## 7. Storage Extension

`shared/src/storage.ts`:
- `SaveType` gains `"portico"`.
- New const `LAST_PORTICO_FORM_KEY = "last_portico_form"`.
- New functions (mirror viga-continua pattern):
  - `saveLastPorticoFormState(state)` → `localStorage.setItem(key("concrete", "last_portico_form"), JSON.stringify(state))`.
  - `loadLastPorticoFormState()` → parse and return.
  - `savePorticoInput(name, state)` → `saveBeam("concrete", name, "portico", { input: state })`.
  - `updatePorticoInput(id, state)` → `updateSave(...)`.
  - `loadPorticoInput(id)` → fetch by id.
  - `deletePorticoInput(id)` → `deleteSave(...)`.
  - `getSavedPorticoInputs()` → `getSavedBeams("concrete", "portico")`.

`PorticoState` is the persistence target. `SavedPorticoData = { input: PorticoState }` (no result snapshot — result is deterministic from state).

`shared/src/SavedBeams.tsx`:
- `type` union adds `"portico"`.
- Render branch: when `type === "portico"`, label = `"Pórtico"`, summary = `"Nodos: {n}, Barras: {m}"`.

## 8. UI Flows

### 8.1 `ModeSelector` (NEW, PR1)

Props: `{ value: "viga-continua" | "portico", onChange: (m) => void }`. Two pill buttons in a `flex container` with `rounded-lg bg-surface-alt p-1`. Active pill: `bg-primary text-white`. Inactive: `text-text-muted hover:text-text`. Default prop `value = "viga-continua"`. No inline colors — only Tailwind theme tokens (`primary`, `text`, `surface-alt`).

Parent (`VigaContinuaForm`) reads `useSearchParams()`; on `onChange`, calls `setSearchParams({ mode: next })` (omit key when default).

### 8.2 `VigaContinuaForm` (MODIFIED, PR1)

- Mount `<ModeSelector value={mode} onChange={...} />` above the existing `<header>`.
- Mount `<NuevaButton onConfirm={resetToDefaults} />` next to the existing `💾 Guardar` button.
- `mode === "portico"` → render `<PorticoForm/>` placeholder (PR1) or full form (PR3).
- `mode === "viga-continua"` (default) → render the existing `<VigaContinuaFormInner/>` (extracted to its own component to keep the file manageable).

### 8.3 `VigaContinuaResults` (MODIFIED, PR1+PR4)

- Mount `<EnvToggle value={envMode} onChange={...} />` in the header (default = `"envolvente"`).
- Refactor: `useMemo` computes both `envelopeUls` (existing `calculateBeamEnvelope(...)`) and `envelopeSls` (compute twice; once with D-only loads, once with L-only loads).
- Toggle renders `{envMode === "envolvente" ? envelopeUls : envelopeSls}` — no re-solve on click.

### 8.4 `PorticoForm` (NEW, PR3)

Layout (top-to-bottom):

```
┌──────────────────────────────────────────┐
│ <header> Pórtico — nombre + ayuda       │
├──────────────────────────────────────────┤
│ <ModoToggle>     Envolvente / Servicio   │  ← out of form, only results
├──────────────────────────────────────────┤
│ Nodos (cap 5) [+ nodo]                   │
│  id, x, y                                │
├──────────────────────────────────────────┤
│ Barras (cap 5) [+ barra]                 │
│  id, from, to, E, A, I (defaults)        │
├──────────────────────────────────────────┤
│ Apoyos (cap 5) [+ apoyo]                 │
│  id, nodo, kind                          │
├──────────────────────────────────────────┤
│ Cargas (cap 5) [+ carga]                 │
│  id, barra, kind, D, L, angle, a, b      │
├──────────────────────────────────────────┤
│ <SavedBeams app="concrete" type="portico"/>│
├──────────────────────────────────────────┤
│  [Nueva] [Calcular]                      │
└──────────────────────────────────────────┘
```

`+` buttons disabled when cap reached. State hydrated from `loadLastPorticoFormState()` on mount. `useEffect` autosaves on every change. `Calcular` validate → `navigate("/viga-continua-results", { state: { mode: "portico", state: porticoState } })`. `Nueva` triggers `window.confirm("¿Limpiar y volver al ejemplo precargado?")`. Defaults (loaded on first mount + Nueva): 3 nodes (`A(0,0)`, `B(2,3)`, `C(4,0)`), 2 bars (`A→B`, `B→C`), 2 supports (A=hinge, C=fixed), 1 load (B, point, D=10, L=5, angle=0, a=0).

### 8.5 `PorticoResults` (NEW, PR4)

- Header: back button + name + `<EnvToggle/>` (default Envolvente).
- `<MafsView>` (700×400 px): nodes (small circles), bars (lines), support glyphs (triangle = hinge, hatched square = fixed), load arrows, deformed shape (exaggerated ×50), and per-bar M+ diagram (polyline offset from bar axis, drawn on the tensioned side).
- Reactions table: per support `(Fx, Fy, Mz)` with sign.
- Inline legend (top-right, always visible without scrolling): `M+ = fibra inferior traccionada, vector → +x · Y positivo hacia abajo`.
- Toggle selects which slice of `r` (PR2) to render.

## 9. Verification Plan

| Layer | What | How |
|---|---|---|
| Smoke (mandatory) | 3 fixtures | `tsx viga-continua/scripts/portico-smoke.ts` from `viga-continua/`. Numbers checked to 0.1%. |
| Types | TS strict | `npm run typecheck:all` at repo root. |
| Lint | ESLint flat config | `npm run lint:all` at repo root. |
| Build | Vite | `npm run build:all` at repo root. |
| UX | Manual / acceptance | User reviews the M+ diagram of the precarged example in PR4. |

**Smoke fixtures** (must match to 0.1%):

1. **Ménsula**: 1 bar `A(0,0)→B(0,3)`, fixed at A, no support at B. Load at B: `D=10, L=0, angle=90` (vertical down). Expect: `Ry_A = -10` (i.e., 10 kN upward → report `Fy = 10`), `Mz_A = P·L = 30` (magnitude).
2. **Pórtico simétrico**: 3 nodes `A(0,0)`, `B(2,3)`, `C(4,0)`. Bars `A→B`, `B→C`. Support A = hinge, C = fixed. Load at B: `D=20, L=0, angle=90`. Expect: `Fy_A = 10`, `Fy_C = 10`, `Fx_A = 0`.
3. **Carga inclinada**: same frame, support A = hinge, C = fixed. Load at B: `D=30, L=0, angle=30`. Expect: `fy_total = 30·sin(30°) = 15`, `ΣFy_reactions = 15`, `ΣFx_reactions = -30·cos(30°) ≈ -25.98`.

Runbook for sdd-verify: `cd viga-continua && npx tsx scripts/portico-smoke.ts && cd .. && npm run lint:all && npm run typecheck:all && npm run build:all`.

## 10. Conventions & Risks

**Conventions (all enforced in code AND UI):**

- Y-positive-down: solver entry JSDoc + `PorticoForm` input hints + `PorticoResults` legend.
- M+ convention: solver JSDoc + `PorticoResults` legend (top-right, always visible).
- Loads decompose `(intensity, angle)` → `(fx, fy)` global BEFORE integration (no per-bar-angle decomposition in the field UI).
- Validation **rejects** zero-length bars, missing support/load references, and (at solve time) singular `K_ff` (mechanism).

**Risks:**

| Risk | Mitigation |
|---|---|
| Mechanism (singular K_ff) | `gaussSolve` throws if `|pivot| < 1e-12`; `PorticoResults` catches and renders a structured error banner. |
| Zero-length bar | `validatePorticoState` rejects with `PorticoValidationError`. |
| Sign confusion on M+ | Legend mandatory + smoke fixtures — design MUST match. |
| Reflexión / live-load patterning | Out of scope; load 1.2·D + 1.6·L on whole frame for ULS. |
| Mafs bundle size | Defer extraction of `<MafsFrame/>`; if PR4 hits the 400-line budget, reduce legends. |
| WIP commit before PR1 | README/PR1 description includes the cleanup commit as the first commit. |

## 11. Migration / Rollout

No data migration. localStorage entries with `type === "portico"` are filtered by `getSavedBeams("concrete", "portico")`; if missing, treated as empty. Rollout = stacked-to-main 4-PR chain (see proposal §Chained PR Plan). Each PR has its own rollback — see proposal §Rollback Plan.

## 12. Out of Scope

- Mirror to `apps/hormigon/`.
- Inclined supports / skew BCs.
- Internal hinges along a bar.
- RC dimensioning (As, f'c, fy).
- Raising the 5/5/5 UX cap.
- Rewriting `beam-envelope.ts`.
- Live-load patterning on pórtico (locked: 1.2·D + 1.6·L on whole frame).
- Adding a unit test runner.

## 13. Open Questions

**None.** All decisions locked in proposal #708, decisions #707, and the 3 specs (portico-analysis #709, viga-continua-analysis #710, viga-continua-routing #711).

## 14. Spec References

- `R-portico-types` → §5.1.
- `R-portico-solver` (3 fixtures) → §6, §9 smoke fixtures.
- `R-portico-results` → §5.1 `PorticoResults`, §6.8–6.9 recovery.
- `R-portico-m-plus-convention` → §6.10, §8.5.
- `R-portico-y-axis` → §6.11, §8.4–8.5.
- `R-portico-supports` → §5.1 validation + §6.5.
- `R-portico-default-geometry` → §8.4.
- `R-portico-persistence` → §7.
- `R-portico-limits` → §5.1, §8.4.
- `R-portico-diagram` → §8.5.
- `R-portico-env-toggle-shared` → §8.3, §8.5.
- `R-portico-nueva-shared` → §8.2, §8.4.
- `R-beam-nueva` / `R-beam-env-toggle` → §8.2, §8.3.
- `R-routing-mode-selector` / `R-routing-portico-routes` / `R-routing-path-correction` → §3, §4 (file changes for `viga-continua-main.tsx`).
