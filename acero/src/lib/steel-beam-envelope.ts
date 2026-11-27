// Envolvente de estado último y flecha de servicio para la viga de acero.
//
// - Envolvente: U = máx(1.4·D ; 1.2·D + 1.6·L) con la sobrecarga de cada
//   tramo activada o no en forma independiente (alternancia de cargas,
//   CIRSOC 301-05 / 201-05 Art. 8.9). Por superposición lineal: un caso D y
//   un caso L por tramo; para cada x se suman sólo los casos L que aumentan
//   (máximo) o disminuyen (mínimo) el esfuerzo. Equivale a recorrer los 2^n
//   patrones.
// - Flecha: integración de la curvatura M/(E·I) del diagrama de momentos de
//   servicio (D + L), tramo por tramo, con w = 0 en los apoyos. Como el
//   diagrama de momentos ya es el real (incluye la continuidad y los
//   empotramientos), basta imponer w = 0 en los dos apoyos de cada tramo;
//   los voladizos arrancan con la pendiente del tramo vecino (o 0 si el
//   apoyo es un empotramiento).
import { calculateBeam } from "./beam-calculations";
import type { BeamConfig, BeamResults, Load } from "@mascalculador/shared";

export interface MomentPoint {
  value: number; // kN·m (con signo)
  position: number; // m
}

export interface SteelEnvelope {
  /** Máximo momento positivo (≥ 0) y su posición. */
  MuPos: MomentPoint;
  /** Máximo momento negativo (≤ 0) y su posición. */
  MuNeg: MomentPoint;
  /** Máximo |corte| último (kN). */
  Vu: number;
  /** Reacción última máxima por apoyo (kN, hacia arriba positiva). */
  reactionsMax: number[];
  momentMax: (x: number) => number;
  momentMin: (x: number) => number;
  /** Casos usados (para el diagrama de servicio). */
  d: BeamResults;
  /** Suma de todos los casos L (sobrecarga en todos los tramos). */
  lAll: BeamResults;
}

function supportPositions(spans: number[]): number[] {
  const pos = [0];
  for (const s of spans) pos.push(pos[pos.length - 1] + s);
  return pos;
}

/** Divide la sobrecarga por tramos: devuelve, para cada tramo, las cargas L
 *  (magnitude = liveLoad) que caen en él. */
function liveLoadsBySpan(spans: number[], loads: Load[]): Load[][] {
  const pos = supportPositions(spans);
  const L = pos[pos.length - 1];
  const out: Load[][] = spans.map(() => []);
  for (const ld of loads) {
    const live = ld.liveLoad ?? 0;
    if (live === 0) continue;
    if (ld.type === "point") {
      const p = ld.position ?? 0;
      let k = spans.length - 1;
      for (let i = 0; i < spans.length; i++) {
        if (p >= pos[i] - 1e-9 && p <= pos[i + 1] + 1e-9) {
          k = i;
          break;
        }
      }
      out[k].push({ ...ld, magnitude: live, deadLoad: 0, liveLoad: live });
    } else {
      const s0 = Math.max(ld.start ?? 0, 0);
      const e0 = Math.min(ld.end ?? L, L);
      for (let i = 0; i < spans.length; i++) {
        const s = Math.max(s0, pos[i]);
        const e = Math.min(e0, pos[i + 1]);
        if (s < e)
          out[i].push({
            ...ld,
            id: `${ld.id}-t${i}`,
            start: s,
            end: e,
            magnitude: live,
            deadLoad: 0,
            liveLoad: live,
          });
      }
    }
  }
  return out;
}

function range(d: number, ls: number[]): { max: number; min: number } {
  let pos = 0;
  let neg = 0;
  for (const l of ls) {
    if (l > 0) pos += l;
    else neg += l;
  }
  return {
    max: Math.max(1.4 * d, 1.2 * d + 1.6 * pos),
    min: Math.min(1.4 * d, 1.2 * d + 1.6 * neg),
  };
}

export function computeSteelEnvelope(
  config: BeamConfig,
  loads: Load[],
): SteelEnvelope {
  const dLoads = loads.map((l) => ({
    ...l,
    magnitude: l.deadLoad ?? 0,
    liveLoad: 0,
  }));
  const allL = loads.map((l) => ({
    ...l,
    magnitude: l.liveLoad ?? 0,
    deadLoad: 0,
  }));
  const d = calculateBeam(config, dLoads);
  const lAll = calculateBeam(config, allL);
  const lCases = liveLoadsBySpan(config.spans, loads)
    .filter((ls) => ls.length > 0)
    .map((ls) => calculateBeam(config, ls));

  const momentMax = (x: number) =>
    range(
      d.bendingMoment(x),
      lCases.map((c) => c.bendingMoment(x)),
    ).max;
  const momentMin = (x: number) =>
    range(
      d.bendingMoment(x),
      lCases.map((c) => c.bendingMoment(x)),
    ).min;
  const shearAbs = (x: number) => {
    const r = range(
      d.shearForce(x),
      lCases.map((c) => c.shearForce(x)),
    );
    return Math.max(Math.abs(r.max), Math.abs(r.min));
  };

  // Puntos de búsqueda: críticos de todos los casos + grilla fina (el
  // máximo de la envolvente puede caer entre los críticos de cada caso).
  const pos = supportPositions(config.spans);
  const total = pos[pos.length - 1];
  const xs = new Set<number>();
  for (const c of [d, lAll, ...lCases])
    for (const x of c.criticalPoints) xs.add(x);
  const N = 400;
  for (let i = 0; i <= N; i++) xs.add((i / N) * total);
  const eps = 1e-6;
  for (const p of pos) {
    xs.add(Math.max(0, p - eps));
    xs.add(Math.min(total, p + eps));
  }

  let MuPos: MomentPoint = { value: 0, position: 0 };
  let MuNeg: MomentPoint = { value: 0, position: 0 };
  let Vu = 0;
  for (const x of xs) {
    const mx = momentMax(x);
    const mn = momentMin(x);
    if (mx > MuPos.value) MuPos = { value: mx, position: x };
    if (mn < MuNeg.value) MuNeg = { value: mn, position: x };
    // Corte a ambos lados de cada punto (saltos por cargas puntuales).
    Vu = Math.max(
      Vu,
      shearAbs(Math.max(0, x - eps)),
      shearAbs(Math.min(total, x + eps)),
    );
  }

  const reactionsMax = d.reactions.map(
    (rd, i) =>
      range(
        rd,
        lCases.map((c) => c.reactions[i]),
      ).max,
  );

  return { MuPos, MuNeg, Vu, reactionsMax, momentMax, momentMin, d, lAll };
}

export interface DeflectionRegion {
  /** "tramo" entre dos apoyos o "voladizo". */
  kind: "tramo" | "voladizo";
  start: number; // m
  end: number; // m
  /** Luz de comparación (m): la luz del tramo, o 2·L del voladizo. */
  refLength: number;
  /** Flecha máxima de servicio (mm, valor absoluto). */
  delta: number;
  /** Posición de la flecha máxima (m). */
  position: number;
}

/**
 * Flecha de servicio por integración numérica de M/(E·I).
 * `moment(x)` en kN·m, `EI` en kN·m². Devuelve la flecha por región
 * (tramos entre apoyos y voladizos), en mm.
 */
export function computeDeflections(
  config: BeamConfig,
  moment: (x: number) => number,
  EI: number,
): DeflectionRegion[] {
  const pos = supportPositions(config.spans);
  const total = pos[pos.length - 1];
  const supIdx = config.supportTypes
    .map((t, i) => (t !== "free" ? i : -1))
    .filter((i) => i >= 0);
  if (supIdx.length === 0) return [];
  const N = 600;

  // Integra w'' = −M/EI en [a,b] con w(a) = 0 y pendiente inicial θa.
  // Devuelve muestras de w y la pendiente final.
  function integrate(a: number, b: number, thetaA: number) {
    const h = (b - a) / N;
    const w: number[] = [0];
    let theta = thetaA;
    let wi = 0;
    let kPrev = -moment(a) / EI;
    for (let i = 1; i <= N; i++) {
      const x = a + i * h;
      const k = -moment(x) / EI;
      const thetaNext = theta + ((kPrev + k) / 2) * h;
      wi += ((theta + thetaNext) / 2) * h;
      theta = thetaNext;
      kPrev = k;
      w.push(wi);
    }
    return { w, thetaEnd: theta, h };
  }

  const regions: DeflectionRegion[] = [];
  // Pendientes en cada apoyo (para arrancar los voladizos).
  const slopeAt = new Map<number, number>();

  for (let k = 0; k < supIdx.length - 1; k++) {
    const a = pos[supIdx[k]];
    const b = pos[supIdx[k + 1]];
    // Con θa = 0 se obtiene w0; la solución real es w0 − (w0(b)/(b−a))·(x−a).
    const { w, thetaEnd, h } = integrate(a, b, 0);
    const corr = w[N] / (b - a);
    let dMax = 0;
    let xMax = a;
    for (let i = 0; i <= N; i++) {
      const wi = w[i] - corr * i * h;
      if (Math.abs(wi) > Math.abs(dMax)) {
        dMax = wi;
        xMax = a + i * h;
      }
    }
    slopeAt.set(supIdx[k], -corr);
    slopeAt.set(supIdx[k + 1], thetaEnd - corr);
    regions.push({
      kind: "tramo",
      start: a,
      end: b,
      refLength: b - a,
      delta: Math.abs(dMax) * 1000,
      position: xMax,
    });
  }

  const slopeFor = (i: number) =>
    config.supportTypes[i] === "fixed" ? 0 : (slopeAt.get(i) ?? 0);

  // Voladizo izquierdo: desde el primer apoyo hacia x = 0.
  const first = supIdx[0];
  if (pos[first] > 1e-9) {
    const a = pos[first];
    // Se integra con la variable invertida (u = a − x): w''(u) = −M/EI y
    // dw/du = −θ(a).
    const lenL = a;
    const mirror = (u: number) => moment(a - u);
    const h = lenL / N;
    let theta = -slopeFor(first);
    let wi = 0;
    let kPrev = -mirror(0) / EI;
    let dMax = 0;
    for (let i = 1; i <= N; i++) {
      const k = -mirror(i * h) / EI;
      const thetaNext = theta + ((kPrev + k) / 2) * h;
      wi += ((theta + thetaNext) / 2) * h;
      theta = thetaNext;
      kPrev = k;
      if (Math.abs(wi) > Math.abs(dMax)) dMax = wi;
    }
    regions.unshift({
      kind: "voladizo",
      start: 0,
      end: a,
      refLength: 2 * lenL,
      delta: Math.abs(dMax) * 1000,
      position: 0,
    });
  }

  // Voladizo derecho: desde el último apoyo hasta el final.
  const last = supIdx[supIdx.length - 1];
  if (total - pos[last] > 1e-9) {
    const a = pos[last];
    const { w } = integrate(a, total, slopeFor(last));
    let dMax = 0;
    for (const wi of w) if (Math.abs(wi) > Math.abs(dMax)) dMax = wi;
    regions.push({
      kind: "voladizo",
      start: a,
      end: total,
      refLength: 2 * (total - a),
      delta: Math.abs(dMax) * 1000,
      position: total,
    });
  }

  return regions;
}
