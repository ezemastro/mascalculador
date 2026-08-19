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
 *   +x (regla de la mano derecha). La recuperación detallada se hace en
 *   `recoverBarForces()` (PR2b).
 *
 * ## Modos de carga
 *
 * - `uls` = `1.2·D + 1.6·L` aplicadas en simultáneo sobre todas las cargas.
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
 * implementado a mano.
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

  // IDs únicos por colección.
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
  for (const s of state.supports) {
    if (!nodeById.has(s.nodeId)) {
      issues.push(`apoyo ${s.id} referencia nudo inexistente "${s.nodeId}"`);
    }
  }
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
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const c = dx / L;
    const s = dy / L;
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
      c[start] = true;
      c[start + 1] = true;
    } else {
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

    const mag = factor(load.D, load.L);
    if (mag === 0) continue;
    const c = dx / Lbar;
    const sG = dy / Lbar;

    if (load.kind === "distributed") {
      const a0 = Math.max(0, load.a);
      const b0 = Math.min(Lbar, load.b ?? load.a);
      if (b0 > a0) {
        const N = 20;
        const step = (b0 - a0) / N;
        // Regla de puntos medios compuesta. Para una carga uniforme, esta
        // integración conserva exactamente la resultante y su primer
        // momento; no mezclar pesos Simpson con puntos medios.
        for (let i = 0; i < N; i++) {
          const subMag = mag * step;
          const sPos = a0 + (i + 0.5) * step;
          addGlobalLoad(F, map, bar, sPos, Lbar, c, sG, subMag, load.angle);
        }
      }
      continue;
    }

    const aPos = Math.max(0, Math.min(load.a, Lbar));
    addGlobalLoad(F, map, bar, aPos, Lbar, c, sG, mag, load.angle);
  }
  return F;
}

/** Suma al vector F global la carga equivalente a una carga puntual de
 *  magnitud `mag` (kN) y ángulo `angleDeg` aplicada en `sPos` desde `from`
 *  a lo largo de la barra `bar`. Usa el vector de carga consistente:
 *  - Axial: N_A = N̄·b/L, N_B = −N̄·a/L (proporcional al brazo).
 *  - Transversal: funciones de forma Hermite N_v1, N_v2, N_θ1, N_θ2 —
 *    la formulación correcta del método de rigidez (equivalente a las
 *    fórmulas de viga empotrada-empotrada en posiciones intermedias, y
 *    correcta en posiciones de extremo donde V_A / V_B no se anulan mal). */
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
  const fx = mag * Math.cos(angleRad);
  const fy = mag * Math.sin(angleRad);
  // Proyección a local.
  const Nbar = fx * c + fy * sG;
  const Pbar = -fx * sG + fy * c;

  const aCl = Math.max(0, Math.min(sPos, Lbar));
  const bCl = Lbar - aCl;
  const NAxial = Nbar * (bCl / Lbar);
  const NBxial = -Nbar * (aCl / Lbar);

  // Funciones de forma Hermite en ξ = aCl/L.
  const xi = aCl / Lbar;
  const Nv1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
  const Nv2 = 3 * xi * xi - 2 * xi * xi * xi;
  const Nth1 = Lbar * (xi - 2 * xi * xi + xi * xi * xi);
  const Nth2 = Lbar * (-xi * xi + xi * xi * xi);

  const VA = Pbar * Nv1;
  const VB = Pbar * Nv2;
  const MA = Pbar * Nth1;
  const MB = Pbar * Nth2;

  // Acumular al F global proyectando local → global con la matriz T = R ⊕ R:
  // F_global = T · F_local con T = [[c, s], [-s, c]] (design.md §6.3).
  //   F_gx = c · F_x̄ + s · F_ȳ
  //   F_gy = −s · F_x̄ + c · F_ȳ
  // Nudo A (DOFs u_A=dof[0], v_A=dof[1], θ_A=dof[2]):
  F[dof[0]] += c * NAxial + sG * VA;
  F[dof[1]] += -sG * NAxial + c * VA;
  F[dof[2]] += MA;
  // Nudo B (DOFs u_B=dof[3], v_B=dof[4], θ_B=dof[5]):
  F[dof[3]] += c * NBxial + sG * VB;
  F[dof[4]] += -sG * NBxial + c * VB;
  F[dof[5]] += MB;
}

/** Devuelve un mapa bar.id → 6-vector LOCAL [N_A, V_A, M_A, N_B, V_B, M_B]
 *  con las fuerzas equivalentes a las cargas EN MARCO LOCAL. Es la mitad
 *  que falta en `f_internal = k·u − f_load` para la recuperación de fuerzas
 *  internas (PR2b). Usa el mismo `factor` que se aplicó al resolver `u`. */
function buildLocalLoadVectors(
  state: PorticoState,
  _map: DofMap,
  factor: (D: number, L: number) => number,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const bar of state.bars) out.set(bar.id, [0, 0, 0, 0, 0, 0]);

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

    if (load.kind === "distributed") {
      const w = factor(load.D, load.L);
      if (w !== 0) {
        const a0 = Math.max(0, load.a);
        const b0 = Math.min(Lbar, load.b ?? load.a);
        if (b0 > a0) {
          const N = 20;
          const step = (b0 - a0) / N;
          // Puntos medios: exacto para resultante y primer momento de una
          // carga uniforme; evita el Simpson incorrecto sobre midpoints.
          for (let i = 0; i < N; i++) {
            const subMag = w * step;
            const sPos = a0 + (i + 0.5) * step;
            accumulateLocalLoad(
              out.get(bar.id)!,
              subMag,
              load.angle,
              sPos,
              Lbar,
              c,
              sG,
            );
          }
        }
      }
      continue;
    }

    const mag = factor(load.D, load.L);
    if (mag === 0) continue;
    const aPos = Math.max(0, Math.min(load.a, Lbar));
    accumulateLocalLoad(out.get(bar.id)!, mag, load.angle, aPos, Lbar, c, sG);
  }
  return out;
}

/** Acumula al 6-vector LOCAL de una barra la contribución de una carga
 *  puntual de magnitud `mag` (kN) y ángulo `angleDeg` en posición `sPos`.
 *  Mismo vector de carga consistente que `addGlobalLoad`, pero en local
 *  (sin proyectar al global). */
function accumulateLocalLoad(
  f6: number[],
  mag: number,
  angleDeg: number,
  sPos: number,
  Lbar: number,
  c: number,
  sG: number,
): void {
  const angleRad = (angleDeg * Math.PI) / 180;
  const fx = mag * Math.cos(angleRad);
  const fy = mag * Math.sin(angleRad);
  const Nbar = fx * c + fy * sG;
  const Pbar = -fx * sG + fy * c;

  const aCl = Math.max(0, Math.min(sPos, Lbar));
  const bCl = Lbar - aCl;
  const NAxial = Nbar * (bCl / Lbar);
  const NBxial = -Nbar * (aCl / Lbar);

  const xi = aCl / Lbar;
  const Nv1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
  const Nv2 = 3 * xi * xi - 2 * xi * xi * xi;
  const Nth1 = Lbar * (xi - 2 * xi * xi + xi * xi * xi);
  const Nth2 = Lbar * (-xi * xi + xi * xi * xi);

  f6[0] += NAxial;
  f6[1] += Pbar * Nv1;
  f6[2] += Pbar * Nth1;
  f6[3] += NBxial;
  f6[4] += Pbar * Nv2;
  f6[5] += Pbar * Nth2;
}

// ---- Solver Gauss-Jordan con pivoteo parcial ----

function gaussSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
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

// ---- Recuperación: reacciones y fuerzas internas ----

/** Reactions: `R = K·u − F` at constrained DOFs, already expressed as the
 *  support reaction acting on the structure under the project's sign convention. */
function recoverReactions(
  state: PorticoState,
  map: DofMap,
  K: number[][],
  u: number[],
  F: number[],
  constrained: boolean[],
): PorticoReaction[] {
  const Ku: number[] = new Array(map.nDof).fill(0);
  for (let i = 0; i < map.nDof; i++) {
    let s = 0;
    for (let j = 0; j < map.nDof; j++) s += K[i][j] * u[j];
    Ku[i] = s;
  }
  const out: PorticoReaction[] = [];
  for (const sup of state.supports) {
    const start = map.nodeStart.get(sup.nodeId);
    if (start === undefined) continue;
    const all =
      constrained[start] && constrained[start + 1] && constrained[start + 2];
    out.push({
      supportId: sup.id,
      Fx: Ku[start] - F[start],
      Fy: Ku[start + 1] - F[start + 1],
      Mz: all ? Ku[start + 2] - F[start + 2] : 0,
    });
  }
  return out;
}

/** Recupera fuerzas internas por barra (extremos + 11 muestras intermedias
 *  con Hermite). Convención: M+ = fiber traccionada abajo en vigas
 *  horizontales con carga vertical hacia abajo → `M = -EI · d²v/dx²`. */
function recoverBarForces(
  state: PorticoState,
  map: DofMap,
  u: number[],
  localLoad: Map<string, number[]>,
  factor: (D: number, L: number) => number,
): Array<{ barId: string; forces: PorticoBarForces }> {
  const out: Array<{ barId: string; forces: PorticoBarForces }> = [];
  for (const bar of state.bars) {
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const b = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const c = dx / L;
    const s = dy / L;
    const EA = (bar.E ?? 1) * (bar.A ?? 1e-2);
    const EI = (bar.E ?? 1) * (bar.I ?? 1e-4);
    const kLocal = localElementStiffness(L, EA, EI);
    const T = transformationMatrix(c, s);

    const startA = map.nodeStart.get(bar.fromNodeId);
    const startB = map.nodeStart.get(bar.toNodeId);
    if (startA === undefined || startB === undefined) continue;
    const uG = [
      u[startA],
      u[startA + 1],
      u[startA + 2],
      u[startB],
      u[startB + 1],
      u[startB + 2],
    ];
    // u_local = T · u_global.
    const uLocal: number[] = new Array(6).fill(0);
    for (let r = 0; r < 6; r++) {
      let s2 = 0;
      for (let cI = 0; cI < 6; cI++) s2 += T[r][cI] * uG[cI];
      uLocal[r] = s2;
    }
    // f_internal_local_end = k·u − f_load_local (convención McGuire).
    const fLoad = localLoad.get(bar.id) ?? [0, 0, 0, 0, 0, 0];
    const fKE: number[] = new Array(6).fill(0);
    for (let r = 0; r < 6; r++) {
      let s2 = 0;
      for (let cI = 0; cI < 6; cI++) s2 += kLocal[r][cI] * uLocal[cI];
      fKE[r] = s2;
    }
    const fInternal = fKE.map((v, i) => v - fLoad[i]);

    // Extremo B: signo invertido (Newton: la fuerza en el otro extremo se
    // reporta opuesta a la que la barra ejerce sobre el nudo).
    const startForce = {
      N: fInternal[0],
      V: fInternal[1],
      M: fInternal[2],
    };
    const endForce = {
      N: -fInternal[3],
      V: -fInternal[4],
      M: -fInternal[5],
    };

    // 11 muestras interiores + extremos, más posiciones a ambos lados de
    // cada carga puntual. La recuperación de M/V se hace
    // desde los esfuerzos de extremo y las cargas locales; usar solamente
    // la curvatura Hermite de desplazamientos omitía el término parabólico
    // de una carga distribuida.
    const samplePositions = new Set<number>();
    for (let i = 0; i <= 12; i++) samplePositions.add((i / 12) * L);
    const loadEpsilon = Math.max(1e-8, L * 1e-6);
    for (const load of state.loads) {
      if (load.barId !== bar.id || load.kind !== "point") continue;
      const point = Math.max(0, Math.min(load.a, L));
      samplePositions.add(Math.max(0, point - loadEpsilon));
      samplePositions.add(Math.min(L, point + loadEpsilon));
    }

    const samples: PorticoBarSample[] = [];
    for (const sPos of [...samplePositions].sort(
      (left, right) => left - right,
    )) {
      let V = startForce.V;
      let N = startForce.N;
      let M = startForce.M - startForce.V * sPos;

      for (const load of state.loads) {
        if (load.barId !== bar.id) continue;
        const angleRad = (load.angle * Math.PI) / 180;
        const magnitude = factor(load.D, load.L);
        const globalFx = magnitude * Math.cos(angleRad);
        const globalFy = magnitude * Math.sin(angleRad);
        const localN = globalFx * c + globalFy * s;
        const localV = -globalFx * s + globalFy * c;

        if (load.kind === "distributed") {
          const loadStart = Math.max(0, Math.min(load.a, L));
          const loadEnd = Math.max(loadStart, Math.min(load.b ?? L, L));
          const loadedLength = Math.max(0, Math.min(sPos, loadEnd) - loadStart);
          if (loadedLength > 0) {
            N += localN * loadedLength;
            V += localV * loadedLength;
            M -= (localV * loadedLength * loadedLength) / 2;
          }
        } else {
          const point = Math.max(0, Math.min(load.a, L));
          if (sPos >= point) {
            N += localN;
            V += localV;
            M -= localV * (sPos - point);
          }
        }
      }

      samples.push({ s: sPos, N, V, M });
    }

    out.push({
      barId: bar.id,
      forces: { start: startForce, end: endForce, samples },
    });
  }
  return out;
}

// ---- Entrada principal: solvePortico ----

function runMode(
  state: PorticoState,
  map: DofMap,
  K: number[][],
  constrained: boolean[],
  factor: (D: number, L: number) => number,
): { u: number[]; F: number[] } {
  const F = buildF(state, map, factor);
  const { freeDofs, constrainedDofs: cDofs } = partition(map.nDof, constrained);
  if (freeDofs.length === 0) {
    return { u: new Array<number>(map.nDof).fill(0), F };
  }
  const Kff = subMatrix(K, freeDofs, freeDofs);
  const Ff = subVector(F, freeDofs);
  const uf = gaussSolve(Kff, Ff);
  const u = new Array<number>(map.nDof).fill(0);
  for (let i = 0; i < freeDofs.length; i++) u[freeDofs[i]] = uf[i];
  for (const d of cDofs) u[d] = 0;
  return { u, F };
}

/** Resuelve el pórtico bajo los tres modos (ULS, SLS-D, SLS-L) y devuelve el
 *  triple con displacements, reactions y bar forces poblados.
 *
 *  El parámetro `mode` es parte del contrato público (PR4 lo pasa siempre).
 *  Hoy se ignora porque `solvePortico` resuelve los tres modos
 *  simultáneamente y devuelve el triple (el toggle elige el slice a
 *  renderizar, sin re-resolver). */
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

  const ulsRun = runMode(state, map, K, constrained, factorUls);
  const dRun = runMode(state, map, K, constrained, factorD);
  const lRun = runMode(state, map, K, constrained, factorL);

  function toSolved(
    u: number[],
    F: number[],
    factor: (D: number, L: number) => number,
  ): SolvedPortico {
    const reactions = recoverReactions(state, map, K, u, F, constrained);
    const localLoad = buildLocalLoadVectors(state, map, factor);
    return {
      displacements: state.nodes.map((n) => {
        const start = map.nodeStart.get(n.id) ?? 0;
        return {
          nodeId: n.id,
          u: u[start],
          v: u[start + 1],
          theta: u[start + 2],
        };
      }),
      reactions,
      bars: recoverBarForces(state, map, u, localLoad, factor),
    };
  }

  return {
    uls: toSolved(ulsRun.u, ulsRun.F, factorUls),
    slsD: toSolved(dRun.u, dRun.F, factorD),
    slsL: toSolved(lRun.u, lRun.F, factorL),
  };
}
