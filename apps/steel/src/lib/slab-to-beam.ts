import type { SlabResult, EdgeIndex } from "./slab-calc";

/** Returns true if the slab result has unfactored D/L reactions (not a legacy slab). */
export function hasSlabDL(r: SlabResult): boolean {
  return r.RD_izq !== undefined && r.RL_izq !== undefined;
}

/**
 * Converts a slab result's per-edge reaction into unfactored { deadLoad, liveLoad }
 * for use in a beam Load.
 * Returns null for legacy slabs (RD/RL undefined).
 */
export function slabReactionToBeamLoad(
  result: SlabResult,
  edge: EdgeIndex,
): { deadLoad: number; liveLoad: number } | null {
  const map: Record<EdgeIndex, [number | undefined, number | undefined]> = {
    0: [result.RD_izq, result.RL_izq],
    1: [result.RD_der, result.RL_der],
    2: [result.RD_arr, result.RL_arr],
    3: [result.RD_aba, result.RL_aba],
  };
  const [rd, rl] = map[edge];
  if (rd === undefined || rl === undefined) return null;
  return { deadLoad: rd, liveLoad: rl };
}
