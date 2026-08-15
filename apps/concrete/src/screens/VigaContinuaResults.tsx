import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import { MainLayout } from "@mascalculador/shared";
import { formatForce } from "@mascalculador/shared";
import { calculateBeamEnvelope } from "../lib/beam-envelope";
import type { VigaContinuaState } from "../lib/viga-continua";

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

export default function VigaContinuaResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const s = location.state as VigaContinuaState | null;

  // Envolvente de esfuerzos últimos (cargas alternadas). Peso propio = 0.
  const envelope = useMemo(
    () =>
      s ? calculateBeamEnvelope(s.spans, s.supportTypes, s.loads, 0) : null,
    [s],
  );

  if (!s || !envelope)
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/viga-continua")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );

  const { spans, supportTypes } = s;
  const nSpans = spans.length;
  const L = spans.reduce((a, b) => a + b, 0);

  const supportPositions: number[] = [0];
  for (const sp of spans)
    supportPositions.push(supportPositions[supportPositions.length - 1] + sp);

  const {
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
  } = envelope;

  // Mu− solo en apoyos interiores (índices 1..nSpans−1).
  const interiorSupportMuNeg = supportMuNeg.slice(1, nSpans);

  // ----- Globales de diagramas -----
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

  const eps = 0.001;
  const spanMpos = spans.map((_s, i) =>
    peak(
      momentPos,
      criticalPoints,
      supportPositions[i],
      supportPositions[i + 1],
    ),
  );
  const supportMneg = supportPositions.slice(1, nSpans).map((p) => ({
    x: p,
    v: momentNeg(p),
  }));
  const supportV = supportPositions.map((p, i) => ({
    x: p,
    vLeft: i > 0 && supportTypes[i] !== "free" ? shearNeg(p - eps) : null,
    vRight: i < nSpans && supportTypes[i] !== "free" ? shearPos(p + eps) : null,
  }));
  const clampX = (x: number) => Math.min(Math.max(x, L * 0.05), L * 0.95);
  const labelH = (x: number) => (x < L * 0.5 ? "e" : "w");

  const supports = supportPositions.map((position, i) => ({
    position,
    type: supportTypes[i],
  }));

  const supportLabel = (i: number) =>
    supportTypes.length === 2
      ? i === 0
        ? "Apoyo A"
        : "Apoyo B"
      : `Apoyo ${i + 1}`;

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Viga Continua</h1>
          <p className="text-sm text-text-muted">
            L={L.toFixed(2)} m &middot; {nSpans} tramo{nSpans > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/viga-continua")}
          className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
        >
          ← Volver
        </button>
      </header>

      {/* Reacciones (sin factorar) */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
          Reacciones
        </h2>
        <p className="text-xs text-text-muted mb-3">
          Valores sin factorar: D y L por separado.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {supportPositions.map((_pos, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border p-3"
            >
              <span className="text-xs text-text-muted">{supportLabel(i)}</span>
              {supportTypes[i] === "free" ? (
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
      </section>

      {/* Esfuerzos factorados por tramo y apoyo interior */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
          Esfuerzos factorados
        </h2>
        <p className="text-xs text-text-muted mb-3">U = 1.2·D + 1.6·L</p>
        <div className="flex flex-col gap-2">
          {spans.map((len, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-4 p-3 bg-surface-alt rounded-lg"
            >
              <span className="text-xs text-text-muted w-40">
                Tramo {i + 1} — {len.toFixed(2)} m
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  V<sub>u</sub> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {spanVu[i].toFixed(1)} kN
                </span>
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  M<sub>u</sub>
                  <sup>+</sup> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {spanMuPos[i].toFixed(1)} kN·m
                </span>
              </span>
            </div>
          ))}
          {interiorSupportMuNeg.map((mu, j) => (
            <div
              key={`neg-${j}`}
              className="flex flex-wrap items-center gap-4 p-3 bg-surface-alt rounded-lg"
            >
              <span className="text-xs text-text-muted w-40">
                {supportLabel(j + 1)}
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  M<sub>u</sub>
                  <sup>−</sup> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {mu.toFixed(1)} kN·m
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Diagramas (envolvente factorada) */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Diagramas
        </h2>
        <p className="text-xs text-text-muted">
          Envolventes factoradas (U = 1.2·D + 1.6·L).
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Corte (envolvente)
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
              <Plot.OfX
                y={(t) => shearPos(t)}
                domain={[0, L]}
                color="#f87171"
              />
              <Plot.OfX
                y={(t) => shearNeg(t)}
                domain={[0, L]}
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
              <Plot.OfX
                y={(t) => -momentPos(t)}
                domain={[0, L]}
                color="#fbbf24"
              />
              <Plot.OfX
                y={(t) => momentNeg(t)}
                domain={[0, L]}
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
    </MainLayout>
  );
}
