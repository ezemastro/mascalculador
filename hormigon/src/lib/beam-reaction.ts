import { listSaves } from "./storage";
import { calculateBeamDual } from "@mascalculador/shared";
import { CONCRETE_DENSITY } from "./constants";

export interface BeamReactionResult {
  dReactions: number[];
  lReactions: number[];
  uReactions: number[];
  supportCount: number;
  beamName: string;
}

export function getBeamReactions(saveId: string): BeamReactionResult | null {
  const saves = listSaves();
  const save = saves.find((s) => s.id === saveId);
  if (!save) return null;

  const data = save.data as Record<string, unknown>;
  if (!data.spans || !data.supportTypes) return null;

  const spans = data.spans as number[];
  const supportTypes = data.supportTypes as SupportType[];
  const config: BeamConfig = { spans, supportTypes };

  let loads: Load[] = [];

  if (save.type === "acero") {
    const rawLoads = data.loads as Load[] | undefined;
    if (!rawLoads) return null;
    loads = rawLoads.filter(
      (l) => (l.deadLoad ?? 0) + (l.liveLoad ?? 0) > 0,
    );
  } else if (save.type === "hormigon") {
    const concreteLoads = data.concreteLoads as
      | Array<{
          id: string;
          type: string;
          D: number;
          L: number;
          position?: number;
          start?: number;
          end?: number;
        }>
      | undefined;
    if (!concreteLoads) return null;

    loads = concreteLoads
      .filter((cl) => cl.D + cl.L > 0)
      .map((cl) => ({
        id: cl.id,
        type:
          cl.type === "slab"
            ? ("distributed" as const)
            : (cl.type as "point" | "distributed"),
        deadLoad: cl.D,
        liveLoad: cl.L,
        position: cl.position,
        start: cl.start,
        end: cl.end,
      }));

    // Include self-weight if applicable
    if (data.includeSelfWeight) {
      const bw = data.bw as number;
      const h = data.h as number;
      const totalLength = spans.reduce((a, b) => a + b, 0);
      if (bw && h && totalLength > 0) {
        const selfWeightD = ((bw * h) / 1e6) * CONCRETE_DENSITY;
        loads.push({
          id: "__sw__",
          type: "distributed",
          deadLoad: selfWeightD,
          liveLoad: 0,
          start: 0,
          end: totalLength,
        });
      }
    }
  }

  if (loads.length === 0) return null;

  try {
    const dual = calculateBeamDual(config, loads);
    const uReactions = dual.d.reactions.map(
      (rd, i) => 1.2 * rd + 1.6 * dual.l.reactions[i],
    );
    return {
      dReactions: dual.d.reactions,
      lReactions: dual.l.reactions,
      uReactions,
      supportCount: dual.d.reactions.length,
      beamName: save.name,
    };
  } catch {
    return null;
  }
}

/** Información de una columna guardada, para selección como carga superior */
export interface SavedColumnInfo {
  id: string;
  name: string;
  type: "acero-columna" | "rc-columna";
  PD: number;
  PL: number;
  Pu: number;
}

export function listSavedColumns(): SavedColumnInfo[] {
  const saves = listSaves();
  const columns: SavedColumnInfo[] = [];

  for (const save of saves) {
    const d = save.data as Record<string, unknown>;
    if (save.type === "columna") {
      columns.push({
        id: save.id,
        name: save.name,
        type: "acero-columna",
        PD: (d.Pu as number) || 0,
        PL: 0,
        Pu: (d.Pu as number) || 0,
      });
    } else if (save.type === "rc-columna") {
      columns.push({
        id: save.id,
        name: save.name,
        type: "rc-columna",
        PD: (d.PD as number) || 0,
        PL: (d.PL as number) || 0,
        Pu: 0,
      });
    }
  }

  // Compute Pu for RC columns
  for (const col of columns) {
    if (col.type === "rc-columna" && col.Pu === 0) {
      col.Pu = Math.max(1.4 * col.PD, 1.2 * col.PD + 1.6 * col.PL);
    }
  }

  return columns;
}

/** Información de una viga guardada, para selección de reacciones */
export interface SavedBeamInfo {
  id: string;
  name: string;
  type: "acero-viga" | "hormigon-viga";
  supportCount: number;
}

export function listSavedBeams(): SavedBeamInfo[] {
  const saves = listSaves();
  const beams: SavedBeamInfo[] = [];

  for (const save of saves) {
    if (save.type === "acero" || save.type === "hormigon") {
      const d = save.data as Record<string, unknown>;
      const supportTypes = d.supportTypes as string[] | undefined;
      if (supportTypes) {
        beams.push({
          id: save.id,
          name: save.name,
          type:
            save.type === "acero"
              ? ("acero-viga" as const)
              : ("hormigon-viga" as const),
          supportCount: supportTypes.length,
        });
      }
    }
  }

  return beams;
}
