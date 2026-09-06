import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import { MainLayout } from "@mascalculador/shared";
import { formatForce } from "@mascalculador/shared";
import { designConcreteDetailed } from "../lib/concrete-design";
import { saveBeam, updateSave } from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import DiagramCurve from "../components/DiagramCurve";
import { CONCRETE_DENSITY } from "../lib/constants";
import { calculateBeamEnvelope } from "../lib/beam-envelope";
import { computoViga } from "../lib/computo";
import ComputoSection from "../components/ComputoSection";
import type { ConcreteState } from "./ConcreteForm";

function sanitizeDecimal(val: string): string {
  // Replace comma (both regular and numpad) with dot
  return val.replace(/,/g, ".");
}

/** Convierte los pasos del motor (mm) a cm para su visualización.
 *  Solo se protegen los diámetros de barras (designación comercial en mm)
 *  y el ratio mm²/mm (el patrón mm²/m matchea dentro de "mm²/mm").
 *  La geometría lineal también pasa a cm. */
function postSteps(steps: string[]): string[] {
  const PROTECT_PATTERNS: RegExp[] = [
    /Ø\s*[\d.,]+\s*mm/g,
    /diámetro[^\n]*?mm/g,
    /[\d.,]+\s*mm²\/mm/g,
  ];

  return steps.map((line) => {
    const saved: string[] = [];
    let out = line;
    for (const re of PROTECT_PATTERNS) {
      out = out.replace(re, (m) => {
        saved.push(m);
        return `@@P${saved.length - 1}@@`;
      });
    }
    out = out
      .replace(
        /(\d+\.?\d*)\s*mm²\/m/g,
        (_m: string, n: string) => `${(Number(n) / 100).toFixed(2)} cm²/m`,
      )
      .replace(
        /(\d+\.?\d*)\s*mm²(?!\/)/g,
        (_m: string, n: string) => `${(Number(n) / 100).toFixed(2)} cm²`,
      )
      .replace(
        /(\d+\.?\d*)\s*mm(?!²)/g,
        (_m: string, n: string) => `${(Number(n) / 10).toFixed(1)} cm`,
      );
    // Restaurar los tokens protegidos
    for (let i = 0; i < saved.length; i++) {
      out = out.replace(`@@P${i}@@`, () => saved[i]);
    }
    return out;
  });
}

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20, 25];
const BAR_AREA: Record<number, number> = {
  6: 28,
  8: 50,
  10: 79,
  12: 113,
  16: 201,
  20: 314,
  25: 491,
};

// Helpers
function arr<T>(n: number, fill: T): T[] {
  return Array.from({ length: n }, () => fill);
}

/** Extiende/recorta un arreglo a la longitud n (para arrays por tramo). */
function ensure<T>(a: T[], n: number, fill: T): T[] {
  return a.length >= n ? a.slice(0, n) : [...a, ...arr(n - a.length, fill)];
}

/** Copia un arreglo escribiendo la posición i (rellena hasta i+1 con fill). */
function patchArr(
  base: number[],
  i: number,
  fill: number,
  v: number,
): number[] {
  const nxt =
    base.length >= i + 1
      ? [...base]
      : [...base, ...arr(i + 1 - base.length, fill)];
  nxt[i] = v;
  return nxt;
}

/** Migra armaduras de apoyo guardadas a índice absoluto de apoyo.
 *  Los guardados viejos guardaban solo apoyos interiores (j → apoyo j+1);
 *  los nuevos guardan por índice absoluto (longitud = nSupports). */
function migrateSupArray<T>(
  v: T[] | T | undefined,
  nSupports: number,
  fill: T,
): T[] | null {
  if (v == null) return null;
  const src = Array.isArray(v) ? v : [v];
  if (src.length >= nSupports) return src.slice(0, nSupports);
  const out = new Array<T>(nSupports).fill(fill);
  for (let j = 0; j < src.length; j++) out[j + 1] = src[j];
  return out;
}

function peak(
  fn: (x: number) => number,
  pts: number[],
  x0: number,
  x1: number,
  steps = 300,
): { x: number; v: number } {
  let bx = x0;
  let bv = -Infinity;
  for (const x of pts) {
    if (x < x0 || x > x1) continue;
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  for (let k = 0; k <= steps; k++) {
    const x = x0 + (k / steps) * (x1 - x0);
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  return { x: bx, v: bv };
}

function supportTriangle(x: number, h: number, w: number): [number, number][] {
  return [
    [x, 0],
    [x - w, -h],
    [x + w, -h],
  ];
}

export default function ConcreteResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const s = location.state as ConcreteState | null;

  const nSpans = s?.spans.length ?? 1;
  const nSupports = nSpans + 1;

  // ---- Estado de armaduras por tramo (arrays; acepta escalares de guardados viejos) ----
  const [barQty, setBarQty] = useState<number[]>(() => {
    const v = s?.barQty;
    return v != null ? (Array.isArray(v) ? v : arr(nSpans, v)) : arr(nSpans, 3);
  });
  const [barDiam, setBarDiam] = useState<number[]>(() => {
    const v = s?.barDiam;
    return v != null
      ? Array.isArray(v)
        ? v
        : arr(nSpans, v)
      : arr(nSpans, 16);
  });
  const [compBarQty, setCompBarQty] = useState<number[]>(() => {
    const v = s?.compBarQty;
    return v != null ? (Array.isArray(v) ? v : arr(nSpans, v)) : arr(nSpans, 0);
  });
  const [compBarDiam, setCompBarDiam] = useState<number[]>(() => {
    const v = s?.compBarDiam;
    return v != null
      ? Array.isArray(v)
        ? v
        : arr(nSpans, v)
      : arr(nSpans, 12);
  });
  const [stirrupLegs, setStirrupLegs] = useState<number[]>(() => {
    const v = s?.stirrupLegs;
    return v != null ? (Array.isArray(v) ? v : arr(nSpans, v)) : arr(nSpans, 2);
  });
  const [stirrupDiam, setStirrupDiam] = useState<number[]>(() => {
    const v = s?.stirrupDiam;
    return v != null ? (Array.isArray(v) ? v : arr(nSpans, v)) : arr(nSpans, 8);
  });
  const [stirrupSpacing, setStirrupSpacing] = useState<number[]>(() => {
    const v = s?.stirrupSpacing;
    return v != null
      ? Array.isArray(v)
        ? v
        : arr(nSpans, v)
      : arr(nSpans, 200);
  });
  // Armadura de apoyo (momentos negativos) — flexión únicamente. Indexada por
  // índice ABSOLUTO de apoyo (0..nSupports-1) para poder diseñar también los
  // extremos empotrados (voladizos); los guardados viejos (solo interiores)
  // se migran al inicializar.
  const [supBarQty, setSupBarQty] = useState<number[]>(() => {
    const migrated = migrateSupArray(s?.supBarQty, nSupports, 3);
    if (migrated) return migrated;
    return (s?.supportTypes ?? arr(nSupports, "simple")).map((t) =>
      t === "free" ? 0 : 3,
    );
  });
  const [supBarDiam, setSupBarDiam] = useState<number[]>(() => {
    const migrated = migrateSupArray(s?.supBarDiam, nSupports, 16);
    if (migrated) return migrated;
    return (s?.supportTypes ?? arr(nSupports, "simple")).map((t) =>
      t === "free" ? 0 : 16,
    );
  });
  const [supportWidths] = useState<number[]>(() => s?.supportWidths ?? []);
  const [directSupport] = useState(s?.directSupport ?? true);
  const [savedId, setSavedId] = useState<string | null>(
    s?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    s?.loadedSaveName ?? null,
  );

  // ---- Memoización (antes del early return: orden de hooks estable) ----
  // Payload estable para la envolvente
  const envelopeLoads = useMemo(
    () =>
      (s?.concreteLoads ?? []).map((cl) => ({
        type: cl.type,
        D: cl.D,
        L: cl.L,
        position: cl.position,
        start: cl.start,
        end: cl.end,
      })),
    [s?.concreteLoads],
  );

  // Peso propio: (bw·h / 1e6) × γ_hormigón [kN/m], en mm.
  // Const plana: el número es un dep estable por valor para los useMemo.
  const selfWeight = s?.includeSelfWeight
    ? ((s.bw * s.h) / 1e6) * CONCRETE_DENSITY
    : 0;

  // Carga uniforme (para reducción de corte) — incluye peso propio
  const qu = useMemo(() => {
    if (!s) return 0;
    return (
      s.concreteLoads
        .filter((l) => l.type === "distributed")
        .reduce((sum, l) => sum + 1.2 * l.D + 1.6 * l.L, 0) +
      (selfWeight > 0 ? 1.2 * selfWeight : 0)
    );
  }, [s, selfWeight]);

  // Envolvente (cargas alternadas): M/V últimos máximos, reacciones D y L
  const envelope = useMemo(() => {
    if (!s) return null;
    return calculateBeamEnvelope(
      s.spans,
      s.supportTypes,
      envelopeLoads,
      selfWeight,
    );
  }, [s, envelopeLoads, selfWeight]);

  // Diseño por tramo (todo en mm)
  const spanResults = useMemo(() => {
    if (!s || !envelope) return null;
    const supportPositions: number[] = [0];
    for (const sp of s.spans)
      supportPositions.push(supportPositions[supportPositions.length - 1] + sp);
    return s.spans.map((_sp, i) => {
      const Mu = envelope.spanMuPos[i];
      const Vu = envelope.spanVu[i];
      const c = ensure(supportWidths, supportPositions.length, 300)[i]; // mm
      const crReq = designConcreteDetailed({
        bw: s.bw,
        h: s.h,
        d: 0,
        dp: 0,
        cover: s.cover,
        fc: s.fc,
        fy: s.fy,
        Mu,
        Vu,
        qu,
        c,
        directSupport,
        As: 0,
        Av: 0,
        nLegs: 0,
        s: 0,
      });
      return { Mu, Vu, crReq, c };
    });
  }, [s, envelope, qu, supportWidths, directSupport]);

  // Verificación de corte por tramo (en vivo, con armaduras colocadas)
  const shearChecks = useMemo(() => {
    if (!s || !spanResults) return null;
    return spanResults.map((sr, i) => {
      const AsT =
        (ensure(barQty, nSpans, 3)[i] || 0) *
        (BAR_AREA[ensure(barDiam, nSpans, 16)[i]] || 0);
      const AsC =
        (ensure(compBarQty, nSpans, 0)[i] || 0) *
        (BAR_AREA[ensure(compBarDiam, nSpans, 12)[i]] || 0);
      const Av1 = BAR_AREA[ensure(stirrupDiam, nSpans, 8)[i]] || 0;
      const sSpacing = ensure(stirrupSpacing, nSpans, 200)[i] || 200; // mm
      const sLegs = ensure(stirrupLegs, nSpans, 2)[i] || 2;
      const chk = designConcreteDetailed({
        bw: s.bw,
        h: s.h,
        d: 0,
        dp: 0,
        cover: s.cover,
        fc: s.fc,
        fy: s.fy,
        Mu: sr.Mu,
        Vu: sr.Vu,
        qu,
        c: sr.c,
        directSupport,
        As: AsT + AsC,
        Av: Av1,
        nLegs: sLegs,
        s: sSpacing,
      });
      return { AsT, AsC, Av1, sSpacing, sLegs, chk };
    });
  }, [
    s,
    spanResults,
    qu,
    directSupport,
    nSpans,
    barQty,
    barDiam,
    compBarQty,
    compBarDiam,
    stirrupLegs,
    stirrupDiam,
    stirrupSpacing,
  ]);

  // Payload de guardado/impresión: los mismos campos que persiste el botón
  // "Guardar resultados" (referencia única para no divergir).
  const saveData = useMemo<Record<string, unknown>>(
    () => ({
      spans: s?.spans ?? [],
      supportTypes: s?.supportTypes ?? [],
      concreteLoads: s?.concreteLoads ?? [],
      bw: s?.bw ?? 0,
      h: s?.h ?? 0,
      cover: s?.cover ?? 0,
      fc: s?.fc ?? 0,
      fy: s?.fy ?? 0,
      includeSelfWeight: s?.includeSelfWeight,
      directSupport,
      barQty,
      barDiam,
      compBarQty,
      compBarDiam,
      stirrupLegs,
      stirrupDiam,
      stirrupSpacing,
      supportWidths,
      supBarQty,
      supBarDiam,
    }),
    [
      s,
      directSupport,
      barQty,
      barDiam,
      compBarQty,
      compBarDiam,
      stirrupLegs,
      stirrupDiam,
      stirrupSpacing,
      supportWidths,
      supBarQty,
      supBarDiam,
    ],
  );

  if (!s) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/concrete")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!envelope || !spanResults || !shearChecks) return null;

  const {
    spans,
    supportTypes,
    concreteLoads,
    bw,
    h,
    cover,
    fc,
    fy,
    includeSelfWeight,
  } = s;
  const L = spans.reduce((a, b) => a + b, 0);

  const supportPositions: number[] = [0];
  for (const sp of spans)
    supportPositions.push(supportPositions[supportPositions.length - 1] + sp);
  const supports: Support[] = supportPositions.map((pos, i) => ({
    position: pos,
    type: supportTypes[i],
  }));

  const {
    momentPos,
    momentNeg,
    shearPos,
    shearNeg,
    shearMax,
    criticalPoints,
    supportMuNeg,
    reactionsD,
    reactionsL,
  } = envelope;

  // Apoyos que requieren armadura de apoyo (tracción superior): todos los
  // no-libres con M⁻ > 0 — interiores y extremos empotrados (p. ej. el
  // apoyo de un voladizo, o un extremo empotrado simple).
  const designSupportIdx = supportPositions
    .map((_p, i) => i)
    .filter((i) => supportTypes[i] !== "free" && (supportMuNeg[i] ?? 0) > 1e-6);

  const spanDomains = spans.map((_s, i) => ({
    start: supportPositions[i],
    end: supportPositions[i + 1],
    length: spans[i],
  }));

  // Cómputo de materiales con el armado adoptado en pantalla
  const computo = computoViga({
    spansM: spans,
    bwMm: bw,
    hMm: h,
    coverMm: cover,
    barQty,
    barDiam,
    compBarQty,
    compBarDiam,
    supBarQty,
    supBarDiam,
    designSupportIdx,
    stirrupLegs,
    stirrupDiam,
    stirrupSpacingMm: stirrupSpacing,
  });

  // ---- Extremos globales para los diagramas ----
  let globalMaxM = 0,
    globalMaxV = 0;
  for (let k = 0; k <= 500; k++) {
    const x = (k / 500) * L;
    globalMaxM = Math.max(globalMaxM, momentPos(x), momentNeg(x));
    globalMaxV = Math.max(globalMaxV, shearMax(x));
  }
  for (const x of criticalPoints) {
    globalMaxM = Math.max(globalMaxM, momentPos(x), momentNeg(x));
    globalMaxV = Math.max(globalMaxV, shearMax(x));
  }
  const globalMaxMomentAbs = Math.max(globalMaxM, 1);
  const xMin = -L * 0.08,
    xMax = L * 1.08;

  // Posiciones/valores para etiquetas de los diagramas
  const eps = 0.001;
  const spanMpos = spans.map((_s, i) =>
    peak(
      momentPos,
      criticalPoints,
      supportPositions[i],
      supportPositions[i + 1],
    ),
  );
  const supportMneg = designSupportIdx.map((si) => ({
    x: supportPositions[si],
    v: supportMuNeg[si],
  }));
  const supportV = supportPositions.map((p, i) => ({
    x: p,
    vLeft: i > 0 && supportTypes[i] !== "free" ? shearNeg(p - eps) : null,
    vRight: i < nSpans && supportTypes[i] !== "free" ? shearPos(p + eps) : null,
  }));
  const clampX = (x: number) => Math.min(Math.max(x, L * 0.05), L * 0.95);
  const labelH = (x: number) => (x < L * 0.5 ? "e" : "w");

  return (
    <MainLayout>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">
            {savedName ? `Viga: ${savedName}` : "Viga H° A°"}
          </h1>
          <p className="text-sm text-text-muted">
            {(bw / 10).toFixed(0)}×{(h / 10).toFixed(0)} cm &middot; f'c={fc}{" "}
            MPa &middot; L={L} m &middot; {nSpans} tramo{nSpans > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={async () => {
              const data = saveData;
              if (savedId) {
                updateSave(savedId, data);
                return;
              }
              const name = prompt("Nombre para guardar los resultados:");
              if (!name) return;
              const target = await pickObraIfNeeded();
              if (target === null) return;
              try {
                const saved = saveBeam(name, "hormigon", data, target);
                setSavedId(saved.id);
                setSavedName(name);
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al guardar");
              }
            }}
            className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
          >
            Guardar resultados
          </button>
          <button
            onClick={() =>
              navigate("/concrete", {
                state: {
                  ...s,
                  loadedSaveId: savedId,
                  loadedSaveName: savedName,
                  barQty,
                  barDiam,
                  compBarQty,
                  compBarDiam,
                  stirrupLegs,
                  stirrupDiam,
                  stirrupSpacing,
                  supportWidths,
                  supBarQty,
                  supBarDiam,
                  directSupport,
                },
              })
            }
            className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Datos de entrada */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted">Tramos (m)</span>
            <p className="font-semibold">{spans.join(" + ")}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Apoyos</span>
            <p className="font-semibold">
              {supportTypes
                .map((t) =>
                  t === "simple" ? "Art." : t === "fixed" ? "Emp." : "Libre",
                )
                .join(" · ")}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Sección (cm)</span>
            <p className="font-semibold">
              {bw / 10}×{h / 10}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">f'c / fy (MPa)</span>
            <p className="font-semibold">
              {fc} / {fy}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Recubrimiento (cm)</span>
            <p className="font-semibold">{cover / 10}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Peso propio</span>
            <p className="font-semibold">
              {includeSelfWeight ? "Incluido" : "No incluido"}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          {concreteLoads.length === 0 && (
            <p className="text-sm text-text-muted">
              Sin cargas aplicadas — solo peso propio.
            </p>
          )}
          {concreteLoads.map((cl, i) => (
            <p key={i} className="text-sm">
              <span className="text-text-muted">
                {cl.type === "point"
                  ? `Puntual @ ${cl.position}m`
                  : `Distribuida ${cl.start}m → ${cl.end}m`}
                :
              </span>{" "}
              <strong>
                D = {cl.D.toFixed(2)} / L = {cl.L.toFixed(2)} kN
                {cl.type === "distributed" ? "/m" : ""}
              </strong>
            </p>
          ))}
        </div>
      </section>

      {/* Reacciones (D y L por separado) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {supports.map((sup, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl border border-border p-3"
          >
            <span className="text-xs text-text-muted">
              {supportTypes.length === 2
                ? i === 0
                  ? "Apoyo A"
                  : "Apoyo B"
                : `Apoyo ${i + 1}`}
            </span>
            {sup.type === "free" ? (
              <p className="text-sm font-bold text-primary">—</p>
            ) : (
              <div className="text-sm">
                <p className="text-text-muted">
                  D:{" "}
                  <span className="font-semibold text-text">
                    {formatForce(reactionsD[i])}
                  </span>
                </p>
                <p className="text-text-muted">
                  L:{" "}
                  <span className="font-semibold text-text">
                    {formatForce(reactionsL[i])}
                  </span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Una sección por tramo */}
      {spans.map((_spanLen, i) => {
        const sr = spanResults[i];
        const dom = spanDomains[i];
        const sc = shearChecks[i];

        const AsT = sc.AsT;
        const AsC = sc.AsC;
        const Av1 = sc.Av1;
        const sSpacing = sc.sSpacing; // mm
        const sLegs = sc.sLegs;

        const cr = sr.crReq;
        // En armadura doble, AsReq ya incluye AspReq: la tracción total es AsReq
        const AsReqT = cr.AsReq;
        const AsReqC = cr.AspReq;

        const flexTensionOK = AsT >= Math.max(AsReqT, cr.AsMin);
        const flexCompressionOK = AsReqC > 0 ? AsC >= AsReqC : true;
        const flexOK = flexTensionOK && flexCompressionOK;

        // Verificación de corte en vivo (mm directo)
        const shearChk = sc.chk;

        return (
          <section
            key={i}
            className="bg-surface rounded-xl border border-border p-5"
          >
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              Tramo {i + 1} — {dom.length.toFixed(2)} m
            </h2>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="bg-surface-alt rounded-lg p-2">
                <span className="text-xs text-text-muted">
                  M<sub>u</sub>
                </span>
                <p className="text-sm font-bold text-primary">
                  {sr.Mu.toFixed(1)} kN·m
                </p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2">
                <span className="text-xs text-text-muted">
                  V<sub>u</sub>
                </span>
                <p className="text-sm font-bold text-primary">
                  {sr.Vu.toFixed(1)} kN
                </p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2">
                <span className="text-xs text-text-muted">
                  A<sub>s</sub> req
                </span>
                <p className="text-sm font-bold text-warning">
                  {(cr.AsReq / 100).toFixed(2)} cm²
                </p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2">
                <span className="text-xs text-text-muted">
                  A<sub>s</sub> mín
                </span>
                <p className="text-sm font-bold">
                  {(cr.AsMin / 100).toFixed(2)} cm²
                </p>
              </div>
            </div>

            {/* Requerimiento */}
            <p className="text-xs text-text-muted mb-2">
              Necesaria: <strong>{(AsReqT / 100).toFixed(2)} cm²</strong> (mín:{" "}
              {(cr.AsMin / 100).toFixed(2)} cm²)
              {AsReqC > 0 && (
                <span>
                  {" "}
                  + A<sub>s</sub>' = {(AsReqC / 100).toFixed(2)} cm²
                  (compresión)
                </span>
              )}
            </p>

            {/* Tracción */}
            <div className="flex flex-wrap gap-3 items-end mb-1">
              <span className="text-xs text-text-muted font-semibold w-16">
                Tracción
              </span>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Cantidad</span>
                <input
                  type="text"
                  value={ensure(barQty, nSpans, 3)[i] || ""}
                  onChange={(e) => {
                    const raw = sanitizeDecimal(e.target.value);
                    const num = parseFloat(raw);
                    setBarQty(patchArr(barQty, i, 3, isNaN(num) ? 0 : num));
                  }}
                  className="w-20"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Diámetro</span>
                <select
                  value={ensure(barDiam, nSpans, 16)[i]}
                  onChange={(e) =>
                    setBarDiam(patchArr(barDiam, i, 16, Number(e.target.value)))
                  }
                >
                  {BAR_DIAMETERS.map((d) => (
                    <option key={d} value={d}>
                      Ø{d} ({(BAR_AREA[d] / 100).toFixed(2)} cm²)
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-sm pb-2">
                = <strong>{(AsT / 100).toFixed(2)} cm²</strong>
              </span>
              <span
                className={`text-xs font-bold ${flexTensionOK ? "text-success" : "text-danger"}`}
              >
                {flexTensionOK ? "✓" : "✗"}
              </span>
            </div>

            {/* Compresión (doble armadura) */}
            {AsReqC > 0 && (
              <div className="flex flex-wrap gap-3 items-end mb-2">
                <span className="text-xs text-text-muted font-semibold w-16">
                  Compresión
                </span>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Cantidad</span>
                  <input
                    type="text"
                    value={ensure(compBarQty, nSpans, 0)[i] || ""}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setCompBarQty(
                        patchArr(compBarQty, i, 0, isNaN(num) ? 0 : num),
                      );
                    }}
                    className="w-20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Diámetro</span>
                  <select
                    value={ensure(compBarDiam, nSpans, 12)[i]}
                    onChange={(e) =>
                      setCompBarDiam(
                        patchArr(compBarDiam, i, 12, Number(e.target.value)),
                      )
                    }
                  >
                    {BAR_DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        Ø{d} ({(BAR_AREA[d] / 100).toFixed(2)} cm²)
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-sm pb-2">
                  = <strong>{(AsC / 100).toFixed(2)} cm²</strong>
                </span>
                <span
                  className={`text-xs font-bold ${flexCompressionOK ? "text-success" : "text-danger"}`}
                >
                  {flexCompressionOK ? "✓" : "✗"}
                </span>
              </div>
            )}

            <div
              className={`p-2 rounded-lg text-sm font-bold mb-3 ${flexOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
            >
              {flexOK ? "✓ Verifica flexión" : "✗ No verifica flexión"} —{" "}
              {AsReqC > 0
                ? `tracción: ${(AsT / 100).toFixed(2)} vs ${(Math.max(AsReqT, cr.AsMin) / 100).toFixed(2)} cm², compresión: ${(AsC / 100).toFixed(2)} vs ${(AsReqC / 100).toFixed(2)} cm²`
                : `${(AsT / 100).toFixed(2)} vs ${(Math.max(cr.AsReq, cr.AsMin) / 100).toFixed(2)} cm²`}
            </div>

            {/* Estribos */}
            <div>
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Estribos
              </span>
              <p className="text-xs text-text-muted mt-1 mb-2">
                V<sub>u</sub> = {sr.Vu.toFixed(1)} kN &middot; V<sub>c</sub> ={" "}
                {cr.Vc.toFixed(1)} kN &middot; V<sub>s</sub> req ={" "}
                {cr.VsReq.toFixed(1)} kN &middot; A<sub>v</sub>/s mín ={" "}
                {(cr.AvSMin / 100).toFixed(2)} cm²/m &middot; s<sub>máx</sub> ={" "}
                {(cr.sMax / 10).toFixed(1)} cm
              </p>
              <div className="flex flex-wrap gap-3 items-end mb-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Ramas</span>
                  <input
                    type="text"
                    value={sLegs || ""}
                    onChange={(e) => {
                      const raw = sanitizeDecimal(e.target.value);
                      const num = parseFloat(raw);
                      setStirrupLegs(
                        patchArr(stirrupLegs, i, 2, isNaN(num) ? 0 : num),
                      );
                    }}
                    className="w-16"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Diámetro</span>
                  <select
                    value={ensure(stirrupDiam, nSpans, 8)[i]}
                    onChange={(e) =>
                      setStirrupDiam(
                        patchArr(stirrupDiam, i, 8, Number(e.target.value)),
                      )
                    }
                  >
                    {BAR_DIAMETERS.filter((d) => d <= 12).map((d) => (
                      <option key={d} value={d}>
                        Ø{d} ({(BAR_AREA[d] / 100).toFixed(2)} cm²)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Separación (cm)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={sSpacing ? sSpacing / 10 : ""}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (isNaN(num)) {
                        setStirrupSpacing(patchArr(stirrupSpacing, i, 200, 0));
                        return;
                      }
                      // Entrada en cm → estado/guardado en mm (unidad del motor)
                      setStirrupSpacing(
                        patchArr(
                          stirrupSpacing,
                          i,
                          200,
                          Math.min(50, Math.max(1, Math.round(num))) * 10,
                        ),
                      );
                    }}
                    className="w-24"
                  />
                </label>
                <span className="text-sm pb-2">
                  A<sub>v</sub>/s ={" "}
                  <strong>
                    {(((sLegs * Av1) / (sSpacing || 1)) * 10).toFixed(2)} cm²/m
                  </strong>
                </span>
              </div>
              <div
                className={`p-2 rounded-lg text-sm font-bold ${shearChk.shearOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                {shearChk.shearOK
                  ? "✓ Verifica corte"
                  : `✗ No verifica corte — ${shearChk.shearFailReason ?? "verificar datos"}`}{" "}
                &middot; V<sub>s</sub> colocado = {shearChk.VsProv.toFixed(1)}{" "}
                kN
              </div>
            </div>

            {/* Cuentas */}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
                Ver cuentas
              </summary>
              <pre className="mt-2 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
                {postSteps(shearChk.steps).join("\n")}
              </pre>
            </details>
          </section>
        );
      })}

      {/* Apoyos con momento negativo (armadura de flexión por tracción superior):
          interiores + extremos empotrados (voladizos). */}
      {designSupportIdx.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Armadura de apoyo (momento negativo)
          </h2>
          {designSupportIdx.map((supportIdx) => {
            const Mneg = supportMuNeg[supportIdx] ?? 0;
            const c = ensure(supportWidths, nSupports, 300)[supportIdx];

            // Diseño a flexión por momento negativo (tracción superior)
            const supDesign = designConcreteDetailed({
              bw,
              h,
              d: 0,
              dp: 0,
              cover,
              fc,
              fy,
              Mu: Mneg,
              Vu: 0,
              qu,
              c,
              directSupport,
              As: 0,
              Av: 0,
              nLegs: 0,
              s: 0,
            });

            // En armadura doble, AsReq ya incluye AspReq: la tracción total es AsReq
            const supAsReqT = supDesign.AsReq;
            const supAsReqC = supDesign.AspReq;

            const qty = ensure(supBarQty, nSupports, 3)[supportIdx];
            const diam = ensure(supBarDiam, nSupports, 16)[supportIdx];
            const supAsProv = (qty || 0) * (BAR_AREA[diam] || 0);
            const supCompAs = 0;

            const supTensionOK =
              supAsProv >= Math.max(supAsReqT, supDesign.AsMin);
            const supCompOK = supAsReqC > 0 ? supCompAs >= supAsReqC : true;
            const supOK = supTensionOK && supCompOK;

            return (
              <section
                key={supportIdx}
                className="bg-surface rounded-xl border border-border p-5"
              >
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                  Apoyo {supportIdx + 1} — M<sub>u,apoyo</sub> ={" "}
                  {Mneg.toFixed(1)} kN·m
                </h3>
                <p className="text-xs text-text-muted mb-2">
                  Necesaria: <strong>{(supAsReqT / 100).toFixed(2)} cm²</strong>{" "}
                  (mín: {(supDesign.AsMin / 100).toFixed(2)} cm²)
                  {supAsReqC > 0 && (
                    <span>
                      {" "}
                      + A<sub>s</sub>' = {(supAsReqC / 100).toFixed(2)} cm²
                      (compresión)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3 items-end mb-2">
                  <span className="text-xs text-text-muted font-semibold w-16">
                    Superior
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">Cantidad</span>
                    <input
                      type="text"
                      value={qty || ""}
                      onChange={(e) => {
                        const raw = sanitizeDecimal(e.target.value);
                        const num = parseFloat(raw);
                        setSupBarQty(
                          patchArr(
                            supBarQty,
                            supportIdx,
                            3,
                            isNaN(num) ? 0 : num,
                          ),
                        );
                      }}
                      className="w-20"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">Diámetro</span>
                    <select
                      value={diam}
                      onChange={(e) =>
                        setSupBarDiam(
                          patchArr(
                            supBarDiam,
                            supportIdx,
                            16,
                            Number(e.target.value),
                          ),
                        )
                      }
                    >
                      {BAR_DIAMETERS.map((d) => (
                        <option key={d} value={d}>
                          Ø{d} ({(BAR_AREA[d] / 100).toFixed(2)} cm²)
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-sm pb-2">
                    = <strong>{(supAsProv / 100).toFixed(2)} cm²</strong>
                  </span>
                  <span
                    className={`text-xs font-bold ${supTensionOK ? "text-success" : "text-danger"}`}
                  >
                    {supTensionOK ? "✓" : "✗"}
                  </span>
                </div>
                <div
                  className={`p-2 rounded-lg text-sm font-bold ${supOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                >
                  {supOK ? "✓ Verifica flexión" : "✗ No verifica flexión"} —{" "}
                  {(supAsProv / 100).toFixed(2)} vs{" "}
                  {(Math.max(supAsReqT, supDesign.AsMin) / 100).toFixed(2)} cm²
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
                    Ver cuentas
                  </summary>
                  <pre className="mt-2 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
                    {postSteps(supDesign.steps).join("\n")}
                  </pre>
                </details>
              </section>
            );
          })}
        </div>
      )}

      {/* Diagramas globales (envolvente) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Cortante (envolvente)
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-globalMaxV * 1.3, globalMaxV * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              <DiagramCurve
                fn={(t) => shearPos(t)}
                criticalPoints={criticalPoints}
                x0={0}
                x1={L}
                color="#f87171"
              />
              <DiagramCurve
                fn={(t) => shearNeg(t)}
                criticalPoints={criticalPoints}
                x0={0}
                x1={L}
                color="#f87171"
              />
              {supports
                .filter((sp) => sp.type !== "free")
                .map((sp, i) => (
                  <Polygon
                    key={`vsup-${i}`}
                    points={supportTriangle(
                      sp.position,
                      globalMaxV * 0.09,
                      L * 0.02,
                    )}
                    color="#6b7280"
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {supportV.map(
                (sv, i) =>
                  sv.vRight != null && (
                    <Text
                      key={`vr-${i}`}
                      x={clampX(sv.x)}
                      y={sv.vRight + globalMaxV * 0.07}
                      attach={`n${labelH(sv.x)}`}
                      size={16}
                      color="#f87171"
                    >
                      V⁺ = {sv.vRight.toFixed(1)}
                    </Text>
                  ),
              )}
              {supportV.map(
                (sv, i) =>
                  sv.vLeft != null && (
                    <Text
                      key={`vl-${i}`}
                      x={clampX(sv.x)}
                      y={sv.vLeft - globalMaxV * 0.07}
                      attach={`s${labelH(sv.x)}`}
                      size={16}
                      color="#f87171"
                    >
                      V⁻ = {sv.vLeft.toFixed(1)}
                    </Text>
                  ),
              )}
            </Mafs>
          </div>
        </section>
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Momento (envolvente)
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-globalMaxMomentAbs * 1.3, globalMaxMomentAbs * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              <DiagramCurve
                fn={(t) => -momentPos(t)}
                criticalPoints={criticalPoints}
                x0={0}
                x1={L}
                color="#fbbf24"
              />
              <DiagramCurve
                fn={(t) => momentNeg(t)}
                criticalPoints={criticalPoints}
                x0={0}
                x1={L}
                color="#fbbf24"
              />
              {supports
                .filter((sp) => sp.type !== "free")
                .map((sp, i) => (
                  <Polygon
                    key={`msup-${i}`}
                    points={supportTriangle(
                      sp.position,
                      globalMaxMomentAbs * 0.09,
                      L * 0.02,
                    )}
                    color="#6b7280"
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {spanMpos.map((m, i) => (
                <Text
                  key={`mp-${i}`}
                  x={clampX(m.x)}
                  y={-m.v - globalMaxMomentAbs * 0.07}
                  attach={`s${labelH(m.x)}`}
                  size={16}
                  color="#fbbf24"
                >
                  {nSpans > 1 ? `M⁺ tramo ${i + 1}` : "M⁺"} = {m.v.toFixed(1)}
                </Text>
              ))}
              {supportMneg.map((m, i) => (
                <Text
                  key={`mn-${i}`}
                  x={clampX(m.x)}
                  y={m.v + globalMaxMomentAbs * 0.07}
                  attach={`n${labelH(m.x)}`}
                  size={16}
                  color="#fbbf24"
                >
                  M⁻ = {m.v.toFixed(1)}
                </Text>
              ))}
            </Mafs>
          </div>
        </section>
      </div>

      <ComputoSection
        computo={computo}
        note="Barras de apoyo superior: extienden la mitad de cada tramo adyacente."
      />
    </MainLayout>
  );
}
