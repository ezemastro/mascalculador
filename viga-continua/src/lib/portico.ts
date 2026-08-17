/**
 * Portico domain types.
 *
 * Defines the strict shape of a 2-D plane-frame input and its solved result.
 * Locked by design.md §5.1, with conventions:
 *
 *   - Eje Y positivo hacia ABAJO (coincide con pixels de pantalla y Mafs).
 *   - `PorticoSupportKind = "hinge" | "fixed"`:
 *       `hinge` constrains u, v; rotation θ free.
 *       `fixed` constrains u, v, θ.
 *   - Apoyos SOLO en nudos (sin bisagras internas ni soportes inclinados).
 *   - Solver internamente escalable (sin cap de barras/nudos); el form
 *     enforce un cap UX de 5/5/5/5 (5 nodos, 5 barras, 5 apoyos, 5 cargas).
 *
 * Reference requirements: R-portico-types, R-portico-supports,
 * R-portico-results, R-portico-y-axis, R-portico-m-plus-convention
 * (spec #709, design.md §5.1).
 */

/**
 * Portico support kind at a node.
 * - `hinge`: constrains translations (u, v); rotation θ free.
 * - `fixed`: constrains translations AND rotation.
 */
export type PorticoSupportKind = "hinge" | "fixed";

/** A node in 2-D space (m). User-supplied id, unique within a PorticoState. */
export interface PorticoNode {
  id: string;
  x: number;
  /** Global Y in meters. POSITIVE DOWNWARD. */
  y: number;
}

/** A bar connecting two existing PorticoNode ids.
 *  `E`, `A` and `I` are **non-design placeholders** — el solver distribuye
 *  linealmente con E factor neutral; A=1e-2 m², I=1e-4 m⁴ se usan como
 *  defaults razonables hasta que el equipo decida exponer inputs (PR+). */
export interface PorticoBar {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** MPa; default 1. */
  E: number;
  /** Cross-section area in m²; default 1e-2. */
  A: number;
  /** Moment of inertia in m⁴; default 1e-4. */
  I: number;
}

/** Tipo de carga de barra. */
export type PorticoLoadKind = "point" | "distributed";

/** A bar load carrying dead (D) and live (L) parts, with an inclination
 *  (degrees, 0 = +x, 90 = +y = DOWN) and a position along the bar from the
 *  `from` node. For `kind = "point"`, `b` is ignored. For
 *  `kind = "distributed"`, the load is uniform between `a` and `b`. */
export interface PorticoBarLoad {
  id: string;
  barId: string;
  kind: PorticoLoadKind;
  /** Carga muerta (kN o kN/m según `kind`). */
  D: number;
  /** Carga viva (kN o kN/m según `kind`). */
  L: number;
  /** Ángulo en grados, 0 = +x, 90 = +y (down). */
  angle: number;
  /** Posición a lo largo de la barra desde `from`, en metros. 0 ≤ a ≤ L_bar. */
  a: number;
  /** Fin del rango (solo `kind = "distributed"`); `b ≤ L_bar`. */
  b?: number;
}

/** A support attached to an existing node id. */
export interface PorticoSupport {
  id: string;
  nodeId: string;
  kind: PorticoSupportKind;
}

/**
 * Top-level portico input state. This is the persistence target and the
 * argument to the solver.
 */
export interface PorticoState {
  nodes: PorticoNode[];
  bars: PorticoBar[];
  loads: PorticoBarLoad[];
  supports: PorticoSupport[];
}

// ---- Result shapes ----

export interface PorticoReaction {
  supportId: string;
  /** Horizontal force in global +x (the support exerts this on the structure). */
  Fx: number;
  /** Vertical force in global +y (positive = down). */
  Fy: number;
  /** Moment about +z (vector pointing out of the page; right-hand rule). */
  Mz: number;
}

export interface PorticoNodeDisplacement {
  nodeId: string;
  u: number;
  v: number;
  theta: number;
}

export interface PorticoBarSample {
  /** Position `s` along the bar from the `from` node, in metres. */
  s: number;
  N: number;
  V: number;
  M: number;
}

export interface PorticoBarForces {
  /** Forces at the `from` end, in the bar's local frame. */
  start: { N: number; V: number; M: number };
  /** Forces at the `to` end, in the bar's local frame. */
  end: { N: number; V: number; M: number };
  /** Intermediate samples (≥ 5; the solver emits exactly 11). */
  samples: PorticoBarSample[];
}

export interface SolvedPortico {
  displacements: PorticoNodeDisplacement[];
  reactions: PorticoReaction[];
  bars: Array<{ barId: string; forces: PorticoBarForces }>;
}

export interface PorticoResults {
  uls: SolvedPortico;
  slsD: SolvedPortico;
  slsL: SolvedPortico;
}
