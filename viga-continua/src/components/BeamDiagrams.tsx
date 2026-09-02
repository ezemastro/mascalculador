import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import type { BeamEnvelopeResult } from "../lib/beam-envelope";
import type { VigaContinuaState } from "../lib/viga-continua";
import DiagramCurve from "./DiagramCurve";

function peak(
  fn: (x: number) => number,
  pts: number[],
  x0: number,
  x1: number,
) {
  let best = { x: x0, v: -Infinity };
  for (const x of pts) {
    if (x >= x0 && x <= x1 && fn(x) > best.v) best = { x, v: fn(x) };
  }
  for (let k = 0; k <= 300; k++) {
    const x = x0 + (k / 300) * (x1 - x0);
    if (fn(x) > best.v) best = { x, v: fn(x) };
  }
  return best;
}

function supportTriangle(x: number, h: number, w: number): [number, number][] {
  return [
    [x, 0],
    [x - w, -h],
    [x + w, -h],
  ];
}

export default function BeamDiagrams({
  spans,
  supportTypes,
  envelope,
  selected = ["corte", "momento"],
  printMode = false,
}: {
  spans: number[];
  supportTypes: VigaContinuaState["supportTypes"];
  envelope: BeamEnvelopeResult;
  selected?: string[];
  printMode?: boolean;
}) {
  const L = spans.reduce((a, b) => a + b, 0);
  const shearColor = printMode ? "#000000" : "#f87171";
  const momentColor = printMode ? "#000000" : "#b45309";
  const axisColor = printMode ? "#111827" : "#6b7280";
  const positions = [0];
  for (const span of spans)
    positions.push(positions[positions.length - 1] + span);
  const supports = positions.map((position, i) => ({
    position,
    type: supportTypes[i],
  }));
  let maxM = 0;
  let maxV = 0;
  for (let k = 0; k <= 500; k++) {
    const x = (k / 500) * L;
    maxM = Math.max(maxM, envelope.momentPos(x), envelope.momentNeg(x));
    maxV = Math.max(maxV, envelope.shearMax(x));
  }
  const xMin = -L * 0.08;
  const xMax = L * 1.08;
  const maxMoment = Math.max(maxM, 1);
  const maxShear = Math.max(maxV, 1);
  const eps = 0.001;
  const supportV = positions.map((x, i) => ({
    x,
    left:
      i > 0 && supportTypes[i] !== "free" ? envelope.shearNeg(x - eps) : null,
    right:
      i < spans.length && supportTypes[i] !== "free"
        ? envelope.shearPos(x + eps)
        : null,
  }));
  const spanM = spans.map((_span, i) =>
    peak(
      envelope.momentPos,
      envelope.criticalPoints,
      positions[i],
      positions[i + 1],
    ),
  );
  const supportM = positions
    .slice(1, spans.length)
    .map((x) => ({ x, v: envelope.momentNeg(x) }));
  const clamp = (x: number) => Math.min(Math.max(x, L * 0.05), L * 0.95);
  const attach = (x: number) => (x < L * 0.5 ? "e" : "w");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {selected.includes("corte") && (
        <section className="print-card overflow-hidden rounded-xl border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Corte
          </h3>
          <div className="print-diagram p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-maxShear * 1.3, maxShear * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color={axisColor} />
              <DiagramCurve
                fn={envelope.shearPos}
                criticalPoints={envelope.criticalPoints}
                x0={0}
                x1={L}
                color={shearColor}
              />
              <DiagramCurve
                fn={envelope.shearNeg}
                criticalPoints={envelope.criticalPoints}
                x0={0}
                x1={L}
                color={shearColor}
              />
              {supports
                .filter((s) => s.type !== "free")
                .map((s) => (
                  <Polygon
                    key={s.position}
                    points={supportTriangle(
                      s.position,
                      maxShear * 0.09,
                      L * 0.02,
                    )}
                    color={axisColor}
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {supportV.map(
                (s) =>
                  s.right != null && (
                    <Text
                      key={`r-${s.x}`}
                      x={clamp(s.x)}
                      y={s.right + maxShear * 0.07}
                      attach={`n${attach(s.x)}`}
                      size={16}
                      color={shearColor}
                    >
                      V⁺ = {s.right.toFixed(1)}
                    </Text>
                  ),
              )}
              {supportV.map(
                (s) =>
                  s.left != null && (
                    <Text
                      key={`l-${s.x}`}
                      x={clamp(s.x)}
                      y={s.left - maxShear * 0.07}
                      attach={`s${attach(s.x)}`}
                      size={16}
                      color={shearColor}
                    >
                      V⁻ = {s.left.toFixed(1)}
                    </Text>
                  ),
              )}
            </Mafs>
          </div>
        </section>
      )}
      {selected.includes("momento") && (
        <section className="print-card overflow-hidden rounded-xl border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Momento
          </h3>
          <div className="print-diagram p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-maxMoment * 1.3, maxMoment * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color={axisColor} />
              <DiagramCurve
                fn={(x) => -envelope.momentPos(x)}
                criticalPoints={envelope.criticalPoints}
                x0={0}
                x1={L}
                color={momentColor}
              />
              <DiagramCurve
                fn={envelope.momentNeg}
                criticalPoints={envelope.criticalPoints}
                x0={0}
                x1={L}
                color={momentColor}
              />
              {supports
                .filter((s) => s.type !== "free")
                .map((s) => (
                  <Polygon
                    key={s.position}
                    points={supportTriangle(
                      s.position,
                      maxMoment * 0.09,
                      L * 0.02,
                    )}
                    color={axisColor}
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {spanM.map((m, i) => (
                <Text
                  key={`p-${i}`}
                  x={clamp(m.x)}
                  y={-m.v - maxMoment * 0.07}
                  attach={`s${attach(m.x)}`}
                  size={16}
                  color={momentColor}
                >
                  M⁺{spans.length > 1 ? ` tramo ${i + 1}` : ""} ={" "}
                  {m.v.toFixed(1)}
                </Text>
              ))}
              {supportM.map((m, i) => (
                <Text
                  key={`n-${i}`}
                  x={clamp(m.x)}
                  y={m.v + maxMoment * 0.07}
                  attach={`n${attach(m.x)}`}
                  size={16}
                  color={momentColor}
                >
                  M⁻ = {m.v.toFixed(1)}
                </Text>
              ))}
            </Mafs>
          </div>
        </section>
      )}
    </div>
  );
}
