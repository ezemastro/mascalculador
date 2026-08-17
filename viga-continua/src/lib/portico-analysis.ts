/**
 * portico-analysis — solver 2-D de pórticos planos por método de rigidez
 * directa (direct stiffness method).
 *
 * ## Convenciones (locked — diseño §6.10/§6.11, spec #709)
 *
 * - Eje Y positivo hacia ABAJO (coincide con pixels de pantalla y Mafs).
 * - Eje X positivo a la derecha.
 * - 6 GDL por barra: `u, v, θ` en cada extremo (num. local) → DOF global
 *   `3*i + 0..2` para el nudo `i`.
 * - M+ = fibra inferior traccionada en el tramo; vector momento apuntando a
 *   +x (regla de la mano derecha). El signo del momento en la convención
 *   adoptada coincide con `M = r × F` para una viga horizontal con carga
 *   apuntando a +y (down). La recuperación detallada se hace en
 *   `recoverInternalForces()` (PR2b); aquí solo se ensambla y resuelve
 *   el desplazamiento.
 *
 * ## Modos de carga
 *
 * - `uls` = `1.2·D + 1.6·L` aplicadas en simultáneo sobre todas las cargas
 *   (sin patronado; locked en proposal §Open Decisions).
 * - `sls-d` = solo cargas muertas D, sin factor.
 * - `sls-l` = solo cargas vivas L, sin factor.
 *
 * ## Cargas inclinadas
 *
 * Cada carga aporta `(D, L, angle)` en kN absolutos. El solver las descompone
 * a global `(fx, fy)` PRIMERO y luego proyecta a local sobre la barra (axial
 * N̄ y transversal ȳ). Esto unifica el comportamiento de cargas de viento,
 * nieve y peso propio sin ramas por ángulo en el código.
 *
 * ## Sin dependencias externas
 *
 * La inversa de K se computa con Gauss-Jordan de pivoteo parcial
 * implementado a mano. Funciona para frames pequeños (≤ 5 barras × 6 GDL)
 * sin costo perceptible.
 */
import type { PorticoState } from "./portico";
import type {
  PorticoBarForces,
  PorticoBarSample,
  PorticoNodeDisplacement,
  PorticoReaction,
  PorticoResults,
  SolvedPortico,
} from "./portico";

export type { PorticoResults };
export type { SolvedPortico };
export type { PorticoNodeDisplacement };
export type { PorticoReaction };
export type { PorticoBarForces };
export type { PorticoBarSample };
export type SolveMode = "uls" | "sls-d" | "sls-l";

// ---- Validación ----

/** Errores de validación previos al solve. `gaussSolve` puede tirar aparte. */
export class PorticoValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Estado de pórtico inválido: ${issues.join("; ")}`);
    this.name = "PorticoValidationError";
    this.issues = issues;
  }
}

/** Verifica integridad referencial y rangos. Lanza `PorticoValidationError` si
 *  hay problemas. Diseñado para correrse ANTES del ensamblaje. */
export function validatePorticoState(state: PorticoState): void {
  const issues: string[] = [];

  // 1. IDs únicos por colección. Se aceptan duplicados textuales entre
  // colecciones (un nudo y una carga pueden llamarse "X" sin chocar) pero
  // cada colección debe tener IDs únicos internamente.
  const seenNode = new Set<string>();
  for (const n of state.nodes) {
    if (seenNode.has(n.id)) issues.push(`nodo con id duplicado "${n.id}"`);
    else seenNode.add(n.id);
  }
  const seenBar = new Set<string>();
  for (const b of state.bars) {
    if (seenBar.has(b.id)) issues.push(`barra con id duplicado "${b.id}"`);
    else seenBar.add(b.id);
  }
  const seenLoad = new Set<string>();
  for (const l of state.loads) {
    if (seenLoad.has(l.id)) issues.push(`carga con id duplicado "${l.id}"`);
    else seenLoad.add(l.id);
  }
  const seenSup = new Set<string>();
  for (const s of state.supports) {
    if (seenSup.has(s.id)) issues.push(`apoyo con id duplicado "${s.id}"`);
    else seenSup.add(s.id);
  }

  // 2. Las barras referencian nudos existentes y tienen largo > 0.
  const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
  for (const b of state.bars) {
    const a = nodeById.get(b.fromNodeId);
    const c = nodeById.get(b.toNodeId);
    if (!a) {
      issues.push(
        `barra ${b.id} referencia nudo inexistente "${b.fromNodeId}"`,
      );
    }
    if (!c) {
      issues.push(`barra ${b.id} referencia nudo inexistente "${b.toNodeId}"`);
    }
    if (a && c) {
      const L = Math.hypot(c.x - a.x, c.y - a.y);
      if (L < 1e-9) issues.push(`barra ${b.id} tiene longitud cero`);
    }
  }
  // 3. Cargas referencian barras existentes y rangos válidos.
  const barIds = new Set(state.bars.map((b) => b.id));
  for (const l of state.loads) {
    if (!barIds.has(l.barId)) {
      issues.push(`carga ${l.id} referencia barra inexistente "${l.barId}"`);
    }
    const bar = state.bars.find((b) => b.id === l.barId);
    if (bar) {
      const a = nodeById.get(bar.fromNodeId);
      const c = nodeById.get(bar.toNodeId);
      if (a && c) {
        const L = Math.hypot(c.x - a.x, c.y - a.y);
        if (l.a < -1e-9 || l.a > L + 1e-9) {
          issues.push(`carga ${l.id}: 'a' fuera de rango [0, L_bar]`);
        }
        if (l.kind === "distributed") {
          const b = l.b ?? l.a;
          if (b < l.a - 1e-9 || b > L + 1e-9) {
            issues.push(`carga ${l.id}: 'b' fuera de rango [a, L_bar]`);
          }
        }
      }
    }
  }
  // 4. Apoyos referencian nudos existentes.
  for (const s of state.supports) {
    if (!nodeById.has(s.nodeId)) {
      issues.push(`apoyo ${s.id} referencia nudo inexistente "${s.nodeId}"`);
    }
  }
  // 5. Mínimo viable.
  if (state.nodes.length < 2) issues.push("se requieren al menos 2 nudos");
  if (state.bars.length < 1) issues.push("se requiere al menos 1 barra");
  if (state.supports.length < 1) issues.push("se requiere al menos 1 apoyo");

  if (issues.length) throw new PorticoValidationError(issues);
}

// ---- Mapa de DOF ----

interface DofMap {
  /** Mapa de nodeId → primer índice DOF del nudo (3 consecutivos). */
  nodeStart: Map<string, number>;
  nDof: number;
}

function buildDofMap(state: PorticoState): DofMap {
  const nodeStart = new Map<string, number>();
  state.nodes.forEach((n, i) => {
    nodeStart.set(n.id, 3 * i);
  });
  return { nodeStart, nDof: 3 * state.nodes.length };
}

/** Devuelve los 6 índices DOF globales para una barra, en orden
 *  `[u1, v1, θ1, u2, v2, θ2]` después de la transformación de cosenos. */
function barLocalDofIndices(
  bar: { fromNodeId: string; toNodeId: string },
  map: DofMap,
): number[] {
  const a = map.nodeStart.get(bar.fromNodeId);
  const b = map.nodeStart.get(bar.toNodeId);
  if (a === undefined || b === undefined)
    throw new Error("DOF map missing node");
  return [a, a + 1, a + 2, b, b + 1, b + 2];
}

// ---- Matriz elemental 6×6 en marco local ----
//
// Formato EAN (Euler-Bernoulli axial + flexión). Layout rows/cols:
//   [u1, v1, θ1, u2, v2, θ2]
//
// k_local con la subdivisión:
//   EA·L² / L³ = EA/L para axial (u1,u1)/(u1,u2)/etc.
//   12·EI/L³ para shear, 6·EI/L² para shear-momento, 4·EI/L para momento
// puro. Detalles en design.md §6.2.

function localElementStiffness(L: number, EA: number, EI: number): number[][] {
  const k: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
  const kA = EA / L;
  const k2 = (12 * EI) / (L * L * L);
  const k3 = (6 * EI) / (L * L);
  const k4 = (4 * EI) / L;
  const k5 = (2 * EI) / L;

  // Axial (filas/cols u).
  k[0][0] = kA;
  k[0][3] = -kA;
  k[3][0] = -kA;
  k[3][3] = kA;

  // Transversal + rotacional.
  k[1][1] = k2;
  k[1][2] = k3;
  k[1][4] = -k2;
  k[1][5] = k3;
  k[2][1] = k3;
  k[2][2] = k4;
  k[2][4] = -k3;
  k[2][5] = k5;
  k[4][1] = -k2;
  k[4][2] = -k3;
  k[4][4] = k2;
  k[4][5] = -k3;
  k[5][1] = k3;
  k[5][2] = k5;
  k[5][4] = -k3;
  k[5][5] = k4;
  return k;
}

// ---- Matriz de transformación cosenoidal ----
//
// Para una barra con vector unitario local `x̄ = (c, s)` (c = cos α,
// s = sin α, α medido desde +x global hacia +y global que es down),
// la transformación T de local → global es 6×6 con dos bloques 3×3 iguales:
//
//   T = [ R  0 ]
//       [ 0  R ]
//   donde R = [[ c, s, 0], [-s, c, 0], [0,0,1]]
//
// K_global = Tᵀ · K_local · T. Implementado abajo de forma explícita.

function transformationMatrix(c: number, s: number): number[][] {
  const T: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
  // Bloque R en filas/cols 0..2.
  T[0][0] = c;
  T[0][1] = s;
  T[1][0] = -s;
  T[1][1] = c;
  T[2][2] = 1;
  // Bloque R en filas/cols 3..5.
  T[3][3] = c;
  T[3][4] = s;
  T[4][3] = -s;
  T[4][4] = c;
  T[5][5] = 1;
  return T;
}

/** Multiplica matrices densas. Helper puro, sin verificar shapes (uso interno). */
function matMul(A: number[][], B: number[][]): number[][] {
  const r = A.length;
  const c = B[0].length;
  const k2 = B.length;
  const out: number[][] = Array.from({ length: r }, () => Array(c).fill(0));
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let s = 0;
      for (let k3 = 0; k3 < k2; k3++) s += A[i][k3] * B[k3][j];
      out[i][j] = s;
    }
  }
  return out;
}

function transpose(A: number[][]): number[][] {
  const r = A.length;
  const c = A[0].length;
  const T: number[][] = Array.from({ length: c }, () => Array(r).fill(0));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
  return T;
}

/** Combina k_local 6×6 con T (coseno) → K_global_bar 6×6 ya indexable
 *  por DOF locales [u1,v1,θ1,u2,v2,θ2] que se mapean a globales vía dofs[]. */
function transformBarStiffness(kLocal: number[][], T: number[][]): number[][] {
  return matMul(matMul(transpose(T), kLocal), T);
}

// ---- Ensamblaje de la matriz global K (nDof × nDof) ----

function zeros(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function assembleK(state: PorticoState, map: DofMap): number[][] {
  const K = zeros(map.nDof);
  for (const bar of state.bars) {
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const b = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !b) continue; // validación ya filtró
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const c = dx / L;
    const s = dy / L; // +y hacia abajo; barras que van hacia abajo tienen s > 0
    // Los E/A/I son placeholders no-diseño. Para pórticos pequeños con
    // cargas kN/m↔m, los cocientes EA/L y EI/L³ fijan la escala.
    const EA = (bar.E ?? 1) * (bar.A ?? 1e-2);
    const EI = (bar.E ?? 1) * (bar.I ?? 1e-4);
    const kLocal = localElementStiffness(L, EA, EI);
    const T = transformationMatrix(c, s);
    const KgBar = transformBarStiffness(kLocal, T);
    const dof = barLocalDofIndices(bar, map);
    for (let r = 0; r < 6; r++) {
      for (let cI = 0; cI < 6; cI++) {
        K[dof[r]][dof[cI]] += KgBar[r][cI];
      }
    }
  }
  return K;
}

// ---- Condiciones de borde (apoyos) ----

function constrainedDofs(state: PorticoState, map: DofMap): boolean[] {
  const c = new Array<boolean>(map.nDof).fill(false);
  for (const s of state.supports) {
    const start = map.nodeStart.get(s.nodeId);
    if (start === undefined) continue;
    if (s.kind === "hinge") {
      // u, v constreñidos.
      c[start] = true;
      c[start + 1] = true;
      // θ libre.
    } else {
      // fixed: u, v, θ.
      c[start] = true;
      c[start + 1] = true;
      c[start + 2] = true;
    }
  }
  return c;
}

function partition(
  nDof: number,
  constrained: boolean[],
): {
  freeDofs: number[];
  constrainedDofs: number[];
} {
  const freeDofs: number[] = [];
  const constrainedDofs: number[] = [];
  for (let i = 0; i < nDof; i++) {
    (constrained[i] ? constrainedDofs : freeDofs).push(i);
  }
  return { freeDofs, constrainedDofs };
}

function subMatrix(M: number[][], rows: number[], cols: number[]): number[][] {
  return rows.map((r) => cols.map((c2) => M[r][c2]));
}

function subVector(v: number[], idxs: number[]): number[] {
  return idxs.map((i) => v[i]);
}

// ---- Cargas: vector F equivalente en global ----

/** Construye el vector F global a partir de las cargas usando un "factor" que
 *  decide qué parte de D/L aplicar:
 *    - factor = (D,L) → 1.2·D + 1.6·L   (ULS)
 *    - factor = (D,L) → D                  (sls-d)
 *    - factor = (D,L) → L                  (sls-l)
 */
function buildF(
  state: PorticoState,
  map: DofMap,
  factor: (D: number, L: number) => number,
): number[] {
  const F = new Array<number>(map.nDof).fill(0);

  for (const load of state.loads) {
    const bar = state.bars.find((b2) => b2.id === load.barId);
    if (!bar) continue;
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const b = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const Lbar = Math.hypot(dx, dy);
    if (Lbar < 1e-9) continue;
    const c = dx / Lbar;
    const sG = dy / Lbar;

    // Cargas distribuidas: integración por Simpson con N=20 subintervalos.
    // Para cada subsegmento ds en posición s, se agrega una carga puntual
    // de magnitud w·ds (mismo ángulo, mismo barId). Trade-off explícito:
    // pequeño error numérico vs código simple.
    if (load.kind === "distributed") {
      const w = factor(load.D, load.L);
      if (w !== 0) {
        const a0 = Math.max(0, load.a);
        const b0 = Math.min(Lbar, load.b ?? load.a);
        if (b0 > a0) {
          const N = 20;
          const step = (b0 - a0) / N;
          // Pesos Simpson: 1, 4, 2, 4, ..., 4, 1.
          for (let i = 0; i < N; i++) {
            const weight = i % 2 === 1 ? 4 : 2;
            const subMag = (w * step * weight) / 3;
            const sPos = a0 + (i + 0.5) * step;
            addGlobalLoad(F, map, bar, sPos, Lbar, c, sG, subMag, load.angle);
          }
        }
      }
      continue;
    }

    // Carga puntual.
    const mag = factor(load.D, load.L);
    if (mag === 0) continue;
    const aPos = Math.max(0, Math.min(load.a, Lbar));
    addGlobalLoad(F, map, bar, aPos, Lbar, c, sG, mag, load.angle);
  }
  return F;
}

/** Suma al vector F global la carga equivalente a una carga puntual de
 *  magnitud `mag` (kN) y ángulo `angleDeg` aplicada en `sPos` desde `from`
 *  a lo largo de la barra `bar`. La transformación a global se hace con
 *  la matriz T = R ⊕ R del elemento (R = coseno/seno del ángulo de la barra). */
function addGlobalLoad(
  F: number[],
  map: DofMap,
  bar: { id: string; fromNodeId: string; toNodeId: string },
  sPos: number,
  Lbar: number,
  c: number,
  sG: number,
  mag: number,
  angleDeg: number,
): void {
  const dof = barLocalDofIndices(bar, map);
  const angleRad = (angleDeg * Math.PI) / 180;
  // Componentes globales (Y-down: sin > 0 → fy positivo).
  const fx = mag * Math.cos(angleRad);
  const fy = mag * Math.sin(angleRad);
  // Proyección a local: x̄ = (c, sG), ȳ = (-sG, c).
  const Nbar = fx * c + fy * sG;
  const Pbar = -fx * sG + fy * c;

  // Componente axial: reparte N̄ entre A y B sin momentos.
  if (Math.abs(Nbar) > 1e-12) {
    F[dof[0]] += c * Nbar;
    F[dof[1]] += sG * Nbar;
    F[dof[3]] += -c * Nbar;
    F[dof[4]] += -sG * Nbar;
  }

  // Componente transversal.
  if (Math.abs(Pbar) > 1e-12) {
    const a = sPos;
    const b = Lbar - sPos;
    if (b < 1e-9 || a < 1e-9) {
      // Carga en el extremo: tratar como carga nodal completa.
      if (a < 1e-9) {
        F[dof[0]] += -sG * Pbar;
        F[dof[1]] += c * Pbar;
      } else {
        F[dof[3]] += -sG * Pbar;
        F[dof[4]] += c * Pbar;
      }
    } else {
      const VA = (Pbar * b * (Lbar * Lbar - b * b)) / (Lbar * Lbar * Lbar);
      const VB = (Pbar * a * (Lbar * Lbar - a * a)) / (Lbar * Lbar * Lbar);
      const MA = (-Pbar * a * (b * b)) / (Lbar * Lbar);
      const MB = (Pbar * (a * a) * b) / (Lbar * Lbar);
      if (Math.abs(VA) > 1e-12) {
        F[dof[0]] += -sG * VA;
        F[dof[1]] += c * VA;
      }
      if (Math.abs(VB) > 1e-12) {
        F[dof[3]] += -sG * VB;
        F[dof[4]] += c * VB;
      }
      if (Math.abs(MA) > 1e-12) {
        F[dof[2]] += MA;
      }
      if (Math.abs(MB) > 1e-12) {
        F[dof[5]] += MB;
      }
    }
  }
}

// ---- Solver Gauss-Jordan con pivoteo parcial ----

/** Resuelve `A · x = b` con Gauss-Jordan de pivoteo parcial. Lanza
 *  `Error("K_ff singular")` si aparece pivot menor a 1e-12. */
function gaussSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Matriz aumentada copia.
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    }
    if (Math.abs(M[p][k]) < 1e-12) {
      throw new Error("K_ff singular — pórtico es un mecanismo");
    }
    if (p !== k) {
      const tmp = M[k];
      M[k] = M[p];
      M[p] = tmp;
    }
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// ---- Entrada principal: solvePortico ----

function runMode(
  state: PorticoState,
  map: DofMap,
  K: number[][],
  constrained: boolean[],
  factor: (D: number, L: number) => number,
): { u: number[] } {
  const F = buildF(state, map, factor);
  const { freeDofs, constrainedDofs: cDofs } = partition(map.nDof, constrained);
  if (freeDofs.length === 0) {
    // Sin DOFs libres: estructura totalmente restringida. Vector de
    // desplazamiento todo en cero.
    return { u: new Array<number>(map.nDof).fill(0) };
  }
  const Kff = subMatrix(K, freeDofs, freeDofs);
  const Ff = subVector(F, freeDofs);
  const uf = gaussSolve(Kff, Ff);
  const u = new Array<number>(map.nDof).fill(0);
  for (let i = 0; i < freeDofs.length; i++) u[freeDofs[i]] = uf[i];
  // Asegurar nulos en DOFs constreñidos (sanidad).
  for (const d of cDofs) u[d] = 0;
  return { u };
}

/** Resuelve el pórtico bajo los tres modos (ULS, SLS-D, SLS-L) y devuelve el
 *  triple. La función es PURA — sin I/O, sin estado global, sin cap interno.
 *  PR2a completa los `displacements`; PR2b agrega `recoverInternalForces`.
 *
 *  El parámetro `mode` es parte del contrato público (PR4 lo pasa siempre).
 *  Hoy se ignora porque `solvePortico` resuelve los tres modos
 *  simultáneamente y devuelve el triple (el toggle elige el slice a
 *  renderizar, sin re-resolver).
 */
export function solvePortico(
  state: PorticoState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept in the API for forward-compatibility with single-mode calls
  _mode: SolveMode,
): PorticoResults {
  validatePorticoState(state);
  const map = buildDofMap(state);
  const K = assembleK(state, map);
  const constrained = constrainedDofs(state, map);

  const factorUls = (D: number, L: number) => 1.2 * D + 1.6 * L;
  const factorD = (D: number) => D;
  const factorL = (_D: number, L: number) => L;

  const uUls = runMode(state, map, K, constrained, factorUls).u;
  const uD = runMode(state, map, K, constrained, factorD).u;
  const uL = runMode(state, map, K, constrained, factorL).u;

  function toDisplacements(u: number[]): PorticoNodeDisplacement[] {
    return state.nodes.map((n) => {
      const start = map.nodeStart.get(n.id) ?? 0;
      return {
        nodeId: n.id,
        u: u[start],
        v: u[start + 1],
        theta: u[start + 2],
      };
    });
  }

  return {
    uls: { displacements: toDisplacements(uUls), reactions: [], bars: [] },
    slsD: { displacements: toDisplacements(uD), reactions: [], bars: [] },
    slsL: { displacements: toDisplacements(uL), reactions: [], bars: [] },
  };
}
