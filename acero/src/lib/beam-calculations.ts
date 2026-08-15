// Re-export de funciones de analisis elastico y formato desde shared.
// Funciones de analisis (calculateBeam, calculateBeamDual) son genericas.
// Funciones de formato (formatForce, formatMoment, formatLength) son genericas.
// migrateLoads queda aqui porque es especifica del manejo de cargas legacy en acero.
export {
  calculateBeam,
  calculateBeamDual,
  formatForce,
  formatMoment,
  formatLength,
} from "@mascalculador/shared";
import type { Load } from "@mascalculador/shared";

/**
 * Detects legacy loads that only have `magnitude` (no `deadLoad`/`liveLoad`).
 * Patches them to: deadLoad = magnitude, liveLoad = 0 (conservative default).
 * Returns the migrated loads and a flag indicating whether any were patched.
 */
export function migrateLoads(rawLoads: Record<string, unknown>[]): {
  loads: Load[];
  migrated: boolean;
} {
  let migrated = false;
  const loads: Load[] = rawLoads.map((l) => {
    if (
      typeof (l as unknown as Load).deadLoad === "number" &&
      typeof (l as unknown as Load).liveLoad === "number"
    ) {
      return l as unknown as Load;
    }
    migrated = true;
    const mag = typeof l.magnitude === "number" ? l.magnitude : 0;
    return {
      id: (l.id as string) || Math.random().toString(36).slice(2),
      type: (l.type as Load["type"]) || "distributed",
      deadLoad: mag,
      liveLoad: 0,
      magnitude: mag,
      position: typeof l.position === "number" ? l.position : undefined,
      start: typeof l.start === "number" ? l.start : undefined,
      end: typeof l.end === "number" ? l.end : undefined,
    };
  });
  return { loads, migrated };
}
