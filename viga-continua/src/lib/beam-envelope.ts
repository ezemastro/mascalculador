import { calculateBeam } from "@mascalculador/shared";
import type {
  BeamConfig,
  BeamResults,
  Load,
  SupportType,
} from "@mascalculador/shared";

export interface EnvelopeLoad {
  type: "point" | "distributed";
  D: number;
  L: number;
  position?: number;
  start?: number;
  end?: number;
}

export interface BeamEnvelopeResult {
  /** Maximum positive moment for the selected calculation mode, kN·m. */
  momentPos: (x: number) => number;
  /** Maximum negative moment magnitude for the selected mode, kN·m. */
  momentNeg: (x: number) => number;
  /** Maximum positive shear for the selected calculation mode, kN. */
  shearPos: (x: number) => number;
  /** Minimum shear for the selected calculation mode, kN. */
  shearNeg: (x: number) => number;
  /** Maximum absolute shear for the selected calculation mode, kN. */
  shearMax: (x: number) => number;
  criticalPoints: number[];
  /** Maximum positive moment by span. */
  spanMuPos: number[];
  /** Maximum absolute shear by span. */
  spanVu: number[];
  /** Maximum negative moment magnitude by support. */
  supportMuNeg: number[];
  /** Unfactored dead-load reactions (kN). */
  reactionsD: number[];
  /** Unfactored live-load reactions (kN). */
  reactionsL: number[];
}

interface Seg {
  spanIdx: number;
  type: "point" | "distributed";
  D: number;
  L: number;
  position?: number;
  start?: number;
  end?: number;
}

/**
 * Calculates either the factored live-load envelope or one unfactored service case.
 *
 * El momento/corte máximo se obtiene combinando:
 *  - Carga muerta (1.2·D) en TODOS los tramos.
 *  - Carga viva (1.6·L) únicamente en los tramos "activados" de cada patrón.
 *
 * The envelope enumerates all patterns (2^n). Service mode assembles one D + L
 * case without factors or live-load patterning. Reactions remain split into
 * unfactored D and L components for the reactions cards.
 */
export function calculateBeamEnvelope(
  spans: number[],
  supportTypes: SupportType[],
  loads: EnvelopeLoad[],
  selfWeight: number, // kN/m, unfactored dead load
  mode: "envelope" | "service" = "envelope",
): BeamEnvelopeResult {
  const n = spans.length;
  const supportPositions: number[] = [0];
  for (const s of spans)
    supportPositions.push(supportPositions[supportPositions.length - 1] + s);
  const L = supportPositions[n];

  // ---- Split loads into per-span segments ----
  const segments: Seg[] = [];

  for (const ld of loads) {
    if (ld.type === "point") {
      const p = ld.position ?? 0;
      let spanIdx = 0;
      for (let i = 0; i < n; i++) {
        if (
          p >= supportPositions[i] - 1e-9 &&
          p <= supportPositions[i + 1] + 1e-9
        ) {
          spanIdx = i;
          break;
        }
      }
      segments.push({ spanIdx, type: "point", D: ld.D, L: ld.L, position: p });
    } else {
      const s0 = Math.max(ld.start ?? 0, 0);
      const e0 = Math.min(ld.end ?? L, L);
      for (let i = 0; i < n; i++) {
        const a = supportPositions[i];
        const b = supportPositions[i + 1];
        const s = Math.max(s0, a);
        const e = Math.min(e0, b);
        if (s < e)
          segments.push({
            spanIdx: i,
            type: "distributed",
            D: ld.D,
            L: ld.L,
            start: s,
            end: e,
          });
      }
    }
  }

  // Self-weight (dead) over whole beam, split per span
  for (let i = 0; i < n; i++) {
    segments.push({
      spanIdx: i,
      type: "distributed",
      D: selfWeight,
      L: 0,
      start: supportPositions[i],
      end: supportPositions[i + 1],
    });
  }

  const config: BeamConfig = { spans, supportTypes };

  // Service uses one unfactored D + L case. ULS keeps the existing live-load
  // pattern enumeration and 1.2·D + 1.6·L factors.
  const patterns: BeamResults[] = [];
  if (mode === "service") {
    const serviceLoads: Load[] = segments.flatMap((seg, idx) => {
      const magnitude = seg.D + seg.L;
      return magnitude === 0
        ? []
        : [
            {
              id: `s${idx}`,
              type: seg.type,
              magnitude,
              position: seg.position,
              start: seg.start,
              end: seg.end,
            },
          ];
    });
    patterns.push(calculateBeam(config, serviceLoads));
  } else {
    const numPatterns = 1 << n;
    for (let mask = 0; mask < numPatterns; mask++) {
      const cfgLoads: Load[] = [];
      let idx = 0;
      for (const seg of segments) {
        const liveActive = (mask >> seg.spanIdx) & 1;
        const magnitude = 1.2 * seg.D + (liveActive ? 1.6 * seg.L : 0);
        if (magnitude === 0) continue;
        cfgLoads.push({
          id: `p${mask}-${idx++}`,
          type: seg.type,
          magnitude,
          position: seg.position,
          start: seg.start,
          end: seg.end,
        });
      }
      patterns.push(calculateBeam(config, cfgLoads));
    }
  }

  // ---- Envelope query functions ----
  const momentPos = (x: number): number =>
    patterns.reduce(
      (mx, p) => Math.max(mx, Math.max(0, p.bendingMoment(x))),
      0,
    );

  const momentNeg = (x: number): number =>
    patterns.reduce(
      (mx, p) => Math.max(mx, Math.max(0, -p.bendingMoment(x))),
      0,
    );

  const shearMax = (x: number): number =>
    patterns.reduce((mx, p) => Math.max(mx, Math.abs(p.shearForce(x))), 0);

  const shearPos = (x: number): number =>
    patterns.reduce((mx, p) => Math.max(mx, p.shearForce(x)), 0);

  const shearNeg = (x: number): number =>
    patterns.reduce((mn, p) => Math.min(mn, p.shearForce(x)), 0);

  // ---- Union of critical points ----
  const cpSet = new Set<number>();
  for (const p of patterns) for (const cp of p.criticalPoints) cpSet.add(cp);
  for (const sp of supportPositions) cpSet.add(sp);
  const criticalPoints = [...cpSet].sort((a, b) => a - b);

  // ---- Per-span / per-support extremes ----
  const spanMuPos = spans.map((_s, i) =>
    maxOf(
      momentPos,
      supportPositions[i],
      supportPositions[i + 1],
      criticalPoints,
    ),
  );
  const spanVu = spans.map((_s, i) =>
    maxOf(
      shearMax,
      supportPositions[i],
      supportPositions[i + 1],
      criticalPoints,
    ),
  );
  const supportMuNeg = supportPositions.map((pos) => momentNeg(pos));

  // ---- Reactions D and L (unfactored) ----
  const dLoads: Load[] = [];
  const lLoads: Load[] = [];
  let idx = 0;
  for (const seg of segments) {
    if (seg.D !== 0) {
      dLoads.push({
        id: `d${idx++}`,
        type: seg.type,
        magnitude: seg.D,
        position: seg.position,
        start: seg.start,
        end: seg.end,
      });
    }
    if (seg.L !== 0) {
      lLoads.push({
        id: `l${idx++}`,
        type: seg.type,
        magnitude: seg.L,
        position: seg.position,
        start: seg.start,
        end: seg.end,
      });
    }
  }
  const reactionsD = calculateBeam(config, dLoads).reactions;
  const reactionsL = calculateBeam(config, lLoads).reactions;

  return {
    momentPos,
    momentNeg,
    shearPos,
    shearNeg,
    shearMax,
    criticalPoints,
    spanMuPos,
    spanVu,
    supportMuNeg,
    reactionsD,
    reactionsL,
  };
}

function maxOf(
  fn: (x: number) => number,
  x0: number,
  x1: number,
  criticalPoints: number[],
  steps = 200,
): number {
  let m = 0;
  for (let k = 0; k <= steps; k++) {
    const x = x0 + (k / steps) * (x1 - x0);
    m = Math.max(m, fn(x));
  }
  for (const x of criticalPoints) {
    if (x >= x0 && x <= x1) m = Math.max(m, fn(x));
  }
  return m;
}
