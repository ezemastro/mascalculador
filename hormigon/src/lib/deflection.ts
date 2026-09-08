// Flechas en vigas de H° — CIRSOC 201-25 (≡ ACI 318-19), Cap. 24.
// Sección fisurada (Branson/Bischoff), promedio de inercias por tramo,
// integración numérica de EIe·v'' = M(x) servicio y flecha diferida.
//
// Unidades internas: kN, m, kN·m (motor) + mm (sección). Pasos (cuentas)
// se emiten en cm / cm² / cm⁴ / kN·m / mm para la pantalla.

import { calculateBeam } from "@mascalculador/shared";
import type { BeamConfig, Load, SupportType } from "@mascalculador/shared";

export interface DeflLoad {
  type: "point" | "distributed";
  D: number;
  L: number;
  position?: number;
  start?: number;
  end?: number;
}

export interface DeflectionParams {
  spans: number[]; // m
  supportTypes: SupportType[];
  loads: DeflLoad[];
  selfWeight: number; // kN/m (muerta)
  bw: number; // mm
  h: number; // mm
  cover: number; // mm
  fc: number; // MPa
  fy: number; // MPa
  Es?: number; // MPa (default 200000)
  asBottomSpan: number[]; // mm² por tramo (tracción M⁺)
  asTopSpan: number[]; // mm² por tramo (compresión / perchas)
  asTopSup: number[]; // mm² por apoyo (tracción M⁻)
  supportWidthsMm: number[]; // mm por apoyo (0 = desconocido)
  sustainedPct: number; // % de L sostenida (0..100)
  timeFactor: number; // ξ (0.4 | 0.8 | 1.2 | 2.0)
  useBischoff: boolean;
}

export interface SectionIe {
  label: string;
  Ma: number; // kN·m (abs)
  xAt: number; // m (posición de Ma; -1 para apoyos)
  cracked: boolean;
  As: number; // mm²
  As1: number; // mm²
  c: number; // mm
  Icr: number; // mm⁴
  Ie: number; // mm⁴
}

export interface SpanCombo {
  name: string;
  secPlus: SectionIe;
  secL: SectionIe;
  secR: SectionIe | null; // null en voladizo (extremo libre)
  IeAvg: number; // mm⁴
  EI: number; // kN·m²
  delta: number; // mm (máx |v| en el tramo, hacia abajo +)
  xDelta: number; // m
}

export interface SpanDeflection {
  index: number;
  lengthM: number;
  clearM: number;
  checkLenM: number; // 2·luz libre en voladizo
  isCantilever: boolean;
  comboDL: SpanCombo;
  comboD: SpanCombo;
  comboSus: SpanCombo;
  deltaLL: number; // mm
  deltaCpSh: number; // mm
  deltaTotal: number; // mm
  rhoP: number;
  xiUsed: number;
  limLL: number; // mm
  limTotal: number; // mm
  okLL: boolean;
  okTotal: boolean;
}

export interface DeflectionResult {
  Ec: number; // MPa
  n: number;
  Ig: number; // mm⁴
  fr: number; // MPa
  Mcr: number; // kN·m
  d: number; // mm
  d1: number; // mm
  maxResidual: number; // mm (compatibilidad en apoyos interiores)
  spans: SpanDeflection[];
  steps: string[];
}

const NS = 48; // nodos por tramo (par, para Simpson)

function fmt(x: number, dec = 2): string {
  const r = Math.round(x * 10 ** dec) / 10 ** dec;
  return r.toFixed(dec);
}

/** Máximo de fn en [x0,x1] con puntos críticos + barrido fino. */
function peakIn(
  fn: (x: number) => number,
  x0: number,
  x1: number,
  cps: number[],
): { x: number; v: number } {
  let bx = x0;
  let bv = -Infinity;
  for (const x of cps) {
    if (x < x0 - 1e-9 || x > x1 + 1e-9) continue;
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  for (let k = 0; k <= 300; k++) {
    const x = x0 + (k / 300) * (x1 - x0);
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  return { x: bx, v: bv };
}

interface ComboRun {
  name: string;
  m: (x: number) => number;
  cps: number[];
}

/** Simpson acumulativo sobre nodos uniformes (n par): devuelve ∫ en cada nodo. */
function cumIntegral(vals: number[], h: number): number[] {
  const n = vals.length; // n = NS+1
  const out = new Array<number>(n).fill(0);
  for (let p = 0; p < n - 2; p += 2) {
    out[p + 2] = out[p] + (h / 3) * (vals[p] + 4 * vals[p + 1] + vals[p + 2]);
    // nodo impar: corrección de Simpson de 3 puntos
    out[p + 1] =
      out[p] + (h / 12) * (5 * vals[p] + 8 * vals[p + 1] - vals[p + 2]);
  }
  return out;
}

/**
 * Integra v'' = M(x)/EI(x) (v positivo hacia abajo) en toda la viga.
 * Corrección lineal para v = 0 en los apoyos extremos reales (xA, xB).
 * Devuelve nodos y v; compats = |v| residual en apoyos interiores.
 */
function integrateCurvature(
  spans: number[],
  EI: number[],
  m: (x: number) => number,
  xA: number,
  xB: number,
): {
  xs: number[];
  v: number[];
  spanStart: number[]; // índice del primer nodo de cada tramo
  interiorResidual: number;
} {
  const nSpans = spans.length;
  const pos: number[] = [0];
  for (const s of spans) pos.push(pos[pos.length - 1] + s);

  const xs: number[] = [];
  const wRaw: number[] = [];
  const spanStart: number[] = [];

  let theta = 0; // pendiente en x = 0
  let w = 0; // flecha relativa en x = 0

  for (let j = 0; j < nSpans; j++) {
    const a = pos[j];
    const b = pos[j + 1];
    const hs = (b - a) / NS;
    spanStart.push(xs.length);

    const k: number[] = [];
    for (let q = 0; q <= NS; q++) {
      const x = a + q * hs;
      k.push(m(x) / EI[j]); // 1/m
    }
    const K = cumIntegral(k, hs); // ∫ k ds en cada nodo
    const W = cumIntegral(K, hs); // ∫∫ k ds² en cada nodo
    for (let q = 0; q <= NS; q++) {
      const x = a + q * hs;
      xs.push(x);
      wRaw.push(w + theta * (x - a) + W[q]);
    }
    w += theta * (b - a) + W[NS];
    theta += K[NS];
  }

  // Corrección lineal: v = wRaw + C1·(x−xA) + C2, v(xA) = v(xB) = 0
  const wA = wRaw[indexAt(xs, xA)];
  const wB = wRaw[indexAt(xs, xB)];
  const C1 = xB > xA ? -(wB - wA) / (xB - xA) : 0;
  const C2 = -wA;
  const v = wRaw.map((wr, i) => wr + C1 * (xs[i] - xA) + C2);

  // Residual de compatibilidad en apoyos interiores (siempre reales)
  let interiorResidual = 0;
  for (let j = 1; j < nSpans; j++) {
    const i = indexAt(xs, pos[j]);
    interiorResidual = Math.max(interiorResidual, Math.abs(v[i]));
  }
  return { xs, v, spanStart, interiorResidual };
}

function indexAt(xs: number[], x: number): number {
  // busca el nodo más cercano a x
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - x);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

export function computeDeflections(p: DeflectionParams): DeflectionResult {
  const Es = p.Es ?? 200000;
  const Ec = 4700 * Math.sqrt(p.fc); // MPa
  const n = Es / Ec;

  const b = p.bw; // mm
  const hh = p.h; // mm
  const rec = p.cover; // mm
  const d = hh - rec; // mm
  const d1 = rec + 10; // mm
  const Ig = (b * hh ** 3) / 12; // mm⁴
  const yt = hh / 2; // mm
  const fr = 0.62 * Math.sqrt(p.fc); // MPa
  const Mcr = (fr * Ig) / yt / 1e6; // kN·m

  const st: string[] = [];

  // ---------- corridas de servicio ----------
  const Ltot = p.spans.reduce((a, x) => a + x, 0);
  const sus = Math.min(Math.max(p.sustainedPct, 0), 100) / 100;

  function mkLoads(fD: number, fL: number): Load[] {
    const out: Load[] = [];
    let i = 0;
    for (const l of p.loads) {
      const D = l.D * fD;
      const Lv = l.L * fL;
      if (l.type === "point") {
        if (Math.abs(D) > 1e-9)
          out.push({
            id: `fd${i++}`,
            type: "point",
            magnitude: D,
            position: l.position,
          });
        if (Math.abs(Lv) > 1e-9)
          out.push({
            id: `fl${i++}`,
            type: "point",
            magnitude: Lv,
            position: l.position,
          });
      } else {
        if (Math.abs(D) > 1e-9)
          out.push({
            id: `fd${i++}`,
            type: "distributed",
            magnitude: D,
            start: l.start,
            end: l.end,
          });
        if (Math.abs(Lv) > 1e-9)
          out.push({
            id: `fl${i++}`,
            type: "distributed",
            magnitude: Lv,
            start: l.start,
            end: l.end,
          });
      }
    }
    if (p.selfWeight > 1e-9 && fD > 1e-9) {
      out.push({
        id: `sw${i++}`,
        type: "distributed",
        magnitude: p.selfWeight * fD,
        start: 0,
        end: Ltot,
      });
    }
    return out;
  }

  const cfg: BeamConfig = { spans: p.spans, supportTypes: p.supportTypes };
  const rD = calculateBeam(cfg, mkLoads(1, 0));
  const rSus = sus >= 0.999 ? rD : calculateBeam(cfg, mkLoads(1, sus));
  const rDL = calculateBeam(cfg, mkLoads(1, 1));

  st.push("=== DATOS (CIRSOC 201-25 — flechas, Cap. 24) ===");
  st.push(`f'c = ${p.fc} MPa   fy = ${p.fy} MPa   Es = ${fmt(Es, 0)} MPa`);
  st.push(`Ec = 4700·√f'c = 4700·√${p.fc} = ${fmt(Ec, 0)} MPa`);
  st.push(`n = Es/Ec = ${fmt(Es, 0)}/${fmt(Ec, 0)} = ${fmt(n, 2)}`);
  st.push(
    `Sección: b = ${fmt(b / 10, 1)} cm · h = ${fmt(hh / 10, 1)} cm · rec = ${fmt(rec / 10, 1)} cm`,
  );
  st.push(
    `d = h − rec = ${fmt(d / 10, 1)} cm   d' = rec + 1 = ${fmt(d1 / 10, 1)} cm`,
  );
  st.push(
    `Ig = b·h³/12 = ${fmt(b / 10, 1)}·${fmt(hh / 10, 1)}³/12 = ${fmt(Ig / 1e4, 0)} cm⁴`,
  );
  st.push(`yt = h/2 = ${fmt(yt / 10, 1)} cm`);
  st.push(`fr = 0.62·√f'c = 0.62·√${p.fc} = ${fmt(fr, 2)} MPa`);
  st.push(
    `Mcr = fr·Ig/yt = ${fmt(fr, 2)}·${fmt(Ig / 1e4, 0)}/${fmt(yt / 10, 1)} = ${fmt(Mcr, 2)} kN·m`,
  );
  st.push(
    `Carga sostenida: ${fmt(p.sustainedPct, 0)} % de L · ξ = ${fmt(p.timeFactor, 1)} · Ie: ${p.useBischoff ? "Bischoff" : "Branson"}`,
  );
  st.push("");

  // posiciones de apoyos
  const pos: number[] = [0];
  for (const s of p.spans) pos.push(pos[pos.length - 1] + s);

  const isFree = (i: number) => p.supportTypes[i] === "free";

  // apoyos extremos reales para la corrección de integración
  const realIdx = p.supportTypes
    .map((t, i) => ({ t, i }))
    .filter((o) => o.t !== "free");
  const firstReal = realIdx[0]?.i ?? 0;
  const lastReal = realIdx[realIdx.length - 1]?.i ?? p.supportTypes.length - 1;
  const xA = pos[firstReal];
  const xB = pos[lastReal];

  // ---------- rigidez fisurada por sección ----------
  function sectionOf(
    label: string,
    As: number,
    As1: number,
    Ma: number,
    xAt: number,
  ): SectionIe {
    let c = 0;
    let Icr = 0;
    const cracked = Ma > Mcr && As > 0;
    if (cracked) {
      const q = (n * As) / b;
      c = q * (-1 + Math.sqrt(1 + (2 * d) / q)); // mm
      Icr = (b * c ** 3) / 3 + n * As * (d - c) ** 2;
      if (As1 > 0 && c > d1) Icr += n * As1 * (c - d1) ** 2;
    }
    let Ie: number;
    if (!cracked) {
      Ie = Ig;
    } else if (p.useBischoff) {
      Ie = Icr / (1 - (Mcr / Ma) ** 3 * (1 - Icr / Ig));
    } else {
      // Branson completo: Ie = Icr + (Ig − Icr)·(Mcr/Ma)³
      Ie = Icr + (Ig - Icr) * (Mcr / Ma) ** 3;
    }
    Ie = Math.min(Ie, Ig);
    return { label, Ma, xAt, cracked, As, As1, c, Icr, Ie };
  }

  // detalle de Icr de una sección (se muestra una vez)
  function sectionDetail(sec: SectionIe): string[] {
    const lines: string[] = [];
    lines.push(
      `${sec.label}: As = ${fmt(sec.As / 100, 2)} cm², As' = ${fmt(sec.As1 / 100, 2)} cm²`,
    );
    if (sec.As <= 0) {
      lines.push(
        `  sin armadura de tracción → se supone Ie = Ig (verificar armado)`,
      );
      return lines;
    }
    const q = (n * sec.As) / b;
    lines.push(
      `  n·As/b = ${fmt(n, 2)}·${fmt(sec.As / 100, 2)}/${fmt(b / 10, 1)} = ${fmt(q / 10, 2)} cm`,
    );
    lines.push(
      `  c = (n·As/b)·(−1+√(1+2·d/(n·As))) = ${fmt(sec.c / 10, 2)} cm`,
    );
    let icrLine = `  Icr = b·c³/3 + n·As·(d−c)² = ${fmt(b / 10, 1)}·${fmt(sec.c / 10, 2)}³/3 + ${fmt(n, 2)}·${fmt(sec.As / 100, 2)}·(${fmt(d / 10, 1)}−${fmt(sec.c / 10, 2)})²`;
    if (sec.As1 > 0 && sec.c > d1) {
      icrLine += ` + ${fmt(n, 2)}·${fmt(sec.As1 / 100, 2)}·(${fmt(sec.c / 10, 2)}−${fmt(d1 / 10, 1)})²`;
    }
    lines.push(`${icrLine} = ${fmt(sec.Icr / 1e4, 0)} cm⁴`);
    return lines;
  }

  // Ma de una combinación por sección
  function maFor(
    run: ComboRun,
    i: number,
  ): {
    plus: { x: number; v: number };
    negL: number;
    negR: number;
  } {
    const plus = peakIn(run.m, pos[i], pos[i + 1], run.cps);
    const negL = Math.max(0, -run.m(pos[i]));
    const negR = isFree(i + 1) ? 0 : Math.max(0, -run.m(pos[i + 1]));
    return { plus, negL, negR };
  }

  const combos: ComboRun[] = [
    { name: "D+L", m: rDL.bendingMoment, cps: rDL.criticalPoints },
    { name: "D", m: rD.bendingMoment, cps: rD.criticalPoints },
    {
      name: sus >= 0.999 ? "D+L (sostenida)" : "D+sus",
      m: rSus.bendingMoment,
      cps: rSus.criticalPoints,
    },
  ];

  // ---------- análisis por tramo ----------
  const outSpans: SpanDeflection[] = [];
  let maxResidual = 0;

  // Detectar voladizo: extremo del tramo con apoyo libre
  function isCantileverRight(i: number) {
    return isFree(i + 1);
  }
  function isCantileverLeft(i: number) {
    return isFree(i);
  }

  const spanCombos: SpanCombo[][] = []; // [tramo][combo]

  for (let i = 0; i < p.spans.length; i++) {
    const cantL = isCantileverLeft(i);
    const cantR = isCantileverRight(i);
    const perCombo: SpanCombo[] = [];

    for (const combo of combos) {
      const { plus, negL, negR } = maFor(combo, i);

      // As por sección
      const AsPlus = p.asBottomSpan[i] ?? 0;
      const As1Plus = p.asTopSpan[i] ?? 0;
      const AsSupL = p.asTopSup[i] ?? 0;
      const As1SupL = p.asBottomSpan[i] ?? 0; // barras inferiores continúan en el apoyo
      const AsSupR = isFree(i + 1) ? 0 : (p.asTopSup[i + 1] ?? 0);
      const As1SupR = p.asBottomSpan[i] ?? 0;

      const secPlus = sectionOf(
        `Tramo ${i + 1} — sección M⁺`,
        AsPlus,
        As1Plus,
        plus.v,
        plus.x,
      );
      const rootLabel = cantR
        ? `Tramo ${i + 1} (voladizo) — raíz (Ap. ${i + 1})`
        : `Tramo ${i + 1} — apoyo izq (Ap. ${i + 1})`;
      const secL = sectionOf(rootLabel, AsSupL, As1SupL, negL, pos[i]);
      const secR = cantR
        ? null
        : sectionOf(
            `Tramo ${i + 1} — apoyo der (Ap. ${i + 2})`,
            AsSupR,
            As1SupR,
            negR,
            pos[i + 1],
          );

      // Ie promedio
      let IeAvg: number;
      if (cantR) {
        IeAvg = secL.Ie;
      } else if (cantL) {
        IeAvg = secR ? secR.Ie : secL.Ie;
      } else {
        IeAvg =
          0.7 * secPlus.Ie + 0.15 * (secL.Ie + (secR ? secR.Ie : secL.Ie));
      }

      const EI = Ec * 1000 * IeAvg * 1e-12; // kN·m²
      perCombo.push({
        name: combo.name,
        secPlus,
        secL,
        secR,
        IeAvg,
        EI,
        delta: 0,
        xDelta: 0,
      });
    }
    spanCombos.push(perCombo);
  }

  // detalle Icr por sección (una vez, del combo D+L)
  st.push("=== RIGIDEZ FISURADA POR SECCIÓN (Icr no depende de Ma) ===");
  for (let i = 0; i < p.spans.length; i++) {
    const cb = spanCombos[i][0];
    for (const sec of [cb.secPlus, cb.secL, ...(cb.secR ? [cb.secR] : [])]) {
      st.push(...sectionDetail(sec));
    }
  }
  st.push("");

  // ---------- integración por combinación ----------
  const deltas: number[][] = []; // [tramo][combo] → {delta, x}
  const xsDelta: number[][] = [];
  for (let c = 0; c < combos.length; c++) {
    const EIspans = p.spans.map((_s, j) => spanCombos[j][c].EI);
    const run = combos[c];
    const { xs, v, spanStart, interiorResidual } = integrateCurvature(
      p.spans,
      EIspans,
      run.m,
      xA,
      xB,
    );
    maxResidual = Math.max(maxResidual, interiorResidual);
    const dSpan: number[] = [];
    const xSpan: number[] = [];
    for (let j = 0; j < p.spans.length; j++) {
      const i0 = spanStart[j];
      const i1 = j + 1 < p.spans.length ? spanStart[j + 1] : xs.length - 1;
      let dm = 0;
      let dx = xs[i0];
      for (let i = i0; i <= i1; i++) {
        if (Math.abs(v[i]) > Math.abs(dm)) {
          dm = v[i];
          dx = xs[i];
        }
      }
      dSpan.push(dm * 1000); // m → mm
      xSpan.push(dx);
    }
    deltas.push(dSpan);
    xsDelta.push(xSpan);
  }

  // ---------- pasos por tramo ----------
  for (let i = 0; i < p.spans.length; i++) {
    const cantR = isCantileverRight(i);
    const cantL = isCantileverLeft(i);
    const wL = (p.supportWidthsMm[i] ?? 0) / 1000;
    const wR = (p.supportWidthsMm[i + 1] ?? 0) / 1000;
    const clear = Math.max(0.05, p.spans[i] - (wL + wR) / 2);
    const checkLen =
      cantR || cantL ? 2 * Math.max(0.05, p.spans[i] - wL / 2 - wR / 2) : clear;

    st.push(
      `=== TRAMO ${i + 1}: L = ${fmt(p.spans[i])} m (luz libre ${fmt(clear)} m${cantR || cantL ? ", voladizo → chequeo con 2·L" : ""}) ===`,
    );

    for (let c = 0; c < combos.length; c++) {
      const cb = spanCombos[i][c];
      st.push(`[Combo ${cb.name}]`);
      const secP = cb.secPlus;
      st.push(
        `  Ma⁺ = ${fmt(secP.Ma)} kN·m (x = ${fmt(secP.xAt)} m) → ${secP.cracked ? "fisura" : "sin fisura"} → Ie⁺ = ${fmt(secP.Ie / 1e4, 0)} cm⁴`,
      );
      if (secP.cracked && secP.As > 0) {
        if (p.useBischoff) {
          st.push(
            `    Mcr/Ma = ${fmt(Mcr, 2)}/${fmt(secP.Ma, 2)} = ${fmt(Mcr / secP.Ma, 3)} → Ie⁺ = Icr/(1−(Mcr/Ma)³·(1−Icr/Ig)) = ${fmt(secP.Ie / 1e4, 0)} cm⁴`,
          );
        } else {
          st.push(
            `    Mcr/Ma = ${fmt(Mcr, 2)}/${fmt(secP.Ma, 2)} = ${fmt(Mcr / secP.Ma, 3)} → Ie⁺ = Icr + (Ig−Icr)·(Mcr/Ma)³ = ${fmt(secP.Icr / 1e4, 0)} + (${fmt(Ig / 1e4, 0)}−${fmt(secP.Icr / 1e4, 0)})·${fmt((Mcr / secP.Ma) ** 3, 4)} = ${fmt(secP.Ie / 1e4, 0)} cm⁴`,
          );
        }
      }
      st.push(
        `  Ma⁻izq = ${fmt(cb.secL.Ma)} kN·m → Ie⁻izq = ${fmt(cb.secL.Ie / 1e4, 0)} cm⁴`,
      );
      if (cb.secR) {
        st.push(
          `  Ma⁻der = ${fmt(cb.secR.Ma)} kN·m → Ie⁻der = ${fmt(cb.secR.Ie / 1e4, 0)} cm⁴`,
        );
      }
      if (cantR) {
        st.push(`  Ie (raíz del voladizo) = ${fmt(cb.IeAvg / 1e4, 0)} cm⁴`);
      } else if (cantL) {
        st.push(`  Ie (raíz del voladizo) = ${fmt(cb.IeAvg / 1e4, 0)} cm⁴`);
      } else {
        st.push(
          `  Ie prom = 0.70·Ie⁺ + 0.15·(Ie⁻izq + Ie⁻der) = ${fmt(cb.IeAvg / 1e4, 0)} cm⁴`,
        );
      }
      st.push(
        `  EIe = Ec·Ie = ${fmt(Ec, 0)}·10³ kN/m² · ${fmt(cb.IeAvg * 1e-12, 6)} m⁴ = ${fmt(cb.EI, 0)} kN·m²`,
      );
      st.push(
        `  δi(${cb.name}) = ${fmt(Math.abs(deltas[c][i]), 2)} mm (máx en x = ${fmt(xsDelta[c][i])} m)`,
      );
      st.push("");
    }

    const dDL = Math.abs(deltas[0][i]);
    const dD = Math.abs(deltas[1][i]);
    const dSus = Math.abs(deltas[2][i]);
    const deltaLL = dDL - dD;
    const rhoP =
      cantR || cantL ? (p.asBottomSpan[i] ?? 0) : (p.asTopSpan[i] ?? 0);
    const rho = rhoP / (b * d);
    const xiUsed = rho > 0 ? p.timeFactor / (1 + 50 * rho) : p.timeFactor;
    const deltaCpSh = xiUsed * dSus;
    const deltaTotal = (1 + xiUsed) * dSus + deltaLL;
    const limLL = (checkLen * 1000) / 360;
    const limTotal = (checkLen * 1000) / 240;

    st.push(`--- Chequeo tramo ${i + 1} ---`);
    st.push(
      `ΔLL = δi(D+L) − δi(D) = ${fmt(dDL)} − ${fmt(dD)} = ${fmt(deltaLL)} mm ≤ L/360 = ${fmt(checkLen, 2)}/360 = ${fmt(limLL, 2)} mm → ${deltaLL <= limLL ? "✓ OK" : "✗ NO VERIFICA"}`,
    );
    st.push(
      `ρ' = ${fmt(rhoP / 100, 2)} cm²/(${fmt(b / 10, 1)}·${fmt(d / 10, 1)}) = ${fmt(rho, 4)}${rho > 0 ? ` → ξ/(1+50ρ') = ${fmt(p.timeFactor, 1)}/${fmt(1 + 50 * rho, 2)} = ${fmt(xiUsed, 2)}` : ` → ξ = ${fmt(xiUsed, 2)}`}`,
    );
    st.push(
      `Δcp+sh = ξ·δi(D+sus) = ${fmt(xiUsed, 2)}·${fmt(dSus)} = ${fmt(deltaCpSh)} mm`,
    );
    st.push(
      `Δtotal = (1+ξ)·δi(D+sus) + ΔLL = ${fmt(1 + xiUsed, 2)}·${fmt(dSus)} + ${fmt(deltaLL)} = ${fmt(deltaTotal)} mm ≤ L/240 = ${fmt(limTotal, 2)} mm → ${deltaTotal <= limTotal ? "✓ OK" : "✗ NO VERIFICA"}`,
    );
    st.push("");

    const dl = spanCombos[i][0];
    const dd = spanCombos[i][1];
    const ds = spanCombos[i][2];
    outSpans.push({
      index: i,
      lengthM: p.spans[i],
      clearM: clear,
      checkLenM: checkLen,
      isCantilever: cantR || cantL,
      comboDL: { ...dl, delta: dDL, xDelta: xsDelta[0][i] },
      comboD: { ...dd, delta: dD, xDelta: xsDelta[1][i] },
      comboSus: { ...ds, delta: dSus, xDelta: xsDelta[2][i] },
      deltaLL,
      deltaCpSh,
      deltaTotal,
      rhoP,
      xiUsed,
      limLL,
      limTotal,
      okLL: deltaLL <= limLL,
      okTotal: deltaTotal <= limTotal,
    });
  }

  st.push(
    `Compatibilidad Simpson (v residual en apoyos interiores): máx ${fmt(maxResidual, 3)} mm`,
  );

  return { Ec, n, Ig, fr, Mcr, d, d1, maxResidual, spans: outSpans, steps: st };
}
