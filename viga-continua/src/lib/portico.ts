/**
 * Portico domain types.
 *
 * Defines the strict shape of a 2-D plane-frame input. PR1 establishes the
 * minimal scaffolding (types only). PR2 enriches with `E/A/I`, point-vs-
 * distributed distinction, separate `D`/`L`, and the full
 * `PorticoBarLoad { D, L, angle, a, b? }` per design.md §5.1 / §6. The
 * validation helper `validatePorticoState` (rejects duplicate IDs, bad
 * references, zero-length bars, unsupported load ranges, missing supports,
 * and singular mechanism mechanisms) ships in PR2.
 *
 * Conventions:
 *   - Y axis positive DOWN (matches screen pixel coordinates).
 *   - Supports ONLY at existing nodes (`hinge` constrains u,v; `fixed`
 *     constrains u,v,θ). No inclined supports. No internal hinges. Out of
 *     scope for PR1.
 *
 * Reference requirements: R-portico-types, R-portico-supports
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

/** A bar connecting two existing PorticoNode ids. */
export interface PorticoBar {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

/**
 * A bar load, modelled at PR1 as a single inclined point load described by an
 * intensity (magnitude), an angle (degrees from +x towards +y), and a position
 * measured from the bar's origin (the `from` node) in metres along the bar.
 * PR2 enriches to multi-load point/distributed D/L loads per design.md §5.1.
 */
export interface PorticoBarLoad {
  barId: string;
  /** Load magnitude (kN for point). Sign + direction is encoded in `angleDeg`. */
  intensity: number;
  /** Angle in degrees, 0 = +x, 90 = +y (down). */
  angleDeg: number;
  /** Distance in metres from the `from` node along the bar. 0 ≤ distanceFromOrigin ≤ bar length. */
  distanceFromOrigin: number;
}

/** A support attached to an existing node id. */
export interface PorticoSupport {
  nodeId: string;
  kind: PorticoSupportKind;
}

/**
 * Top-level portico input state. This is the persistence target and the
 * argument to the solver (once it ships in PR2). PR1 keeps the shape minimal:
 * no E/A/I on bars, no distributed-load breakdown, no row-level `id` on
 * collections (collections carry positional identity in the placeholder UI;
 * PR3 will introduce UUID row ids as the editor lands).
 */
export interface PorticoState {
  nodes: PorticoNode[];
  bars: PorticoBar[];
  loads: PorticoBarLoad[];
  supports: PorticoSupport[];
}
