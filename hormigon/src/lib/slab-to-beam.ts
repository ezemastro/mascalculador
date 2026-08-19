import type { SlabResult } from "./slab-calc";
import type { Load } from "@mascalculador/shared";

export type SlabEdge = "izq" | "der" | "arr" | "aba";

/** Returns true if the slab result has unfactored D/L reactions for all four edges (not a legacy slab). */
export function hasSlabDL(r: SlabResult): boolean {
  return (
    r.RD_izq !== undefined &&
    r.RL_izq !== undefined &&
    r.RD_der !== undefined &&
    r.RL_der !== undefined &&
    r.RD_arr !== undefined &&
    r.RL_arr !== undefined &&
    r.RD_aba !== undefined &&
    r.RL_aba !== undefined
  );
}

/**
 * Converts a slab result's per-edge reaction into a distributed `Load` for use in a beam.
 * Returns `null` for legacy slabs (RD/RL undefined), when both D and L clamp to 0, or when
 * either value is not finite. The `id` is generated internally (same pattern as storage.ts).
 */
export function slabReactionToBeamLoad(
  result: SlabResult,
  edge: SlabEdge,
  start: number,
  end: number,
): Load | null {
  const map: Record<SlabEdge, { d: keyof SlabResult; l: keyof SlabResult }> = {
    izq: { d: "RD_izq", l: "RL_izq" },
    der: { d: "RD_der", l: "RL_der" },
    arr: { d: "RD_arr", l: "RL_arr" },
    aba: { d: "RD_aba", l: "RL_aba" },
  };
  const { d, l } = map[edge];
  const deadLoad = Math.max(0, Number(result[d]) || 0);
  const liveLoad = Math.max(0, Number(result[l]) || 0);
  if (deadLoad === 0 && liveLoad === 0) return null;
  if (!Number.isFinite(deadLoad) || !Number.isFinite(liveLoad)) return null;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: "distributed",
    deadLoad,
    liveLoad,
    start,
    end,
  };
}
