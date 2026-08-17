/**
 * PorticoDiagram — render parametrizable del pórtico en Mafs.
 *
 * Props:
 *   - porticoState: estado del pórtico (nodos, barras, cargas, apoyos).
 *   - solved?: resultado del solver. Requerido para los modos
 *     "deformada" | "normales" | "momentos" | "corte". En "geometría" se
 *     puede omitir.
 *   - mode: "geometria" | "deformada" | "normales" | "momentos" | "corte".
 *   - viewBoxOverride?: [xMin, xMax, yMin, yMax] para zoom. Si se omite,
 *     se calcula fit-to-bbox + 18% padding.
 *
 * Convenciones (locked en design.md §3):
 *   - Y positivo hacia abajo en el modelo; Mafs recibe `-Y` porque su eje
 *     visual Y es positivo hacia arriba.
 *   - M+ = fibra inferior traccionada (perpendicular a +x̄_local según el
 *     signo de M).
 *   - Normales: tracción (+) en azul, compresión (-) en rojo.
 *   - Corte: signo derecho (positivo hacia +x̄_local).
 *
 * Layout:
 *   - 100% width del container; height controlado por el padre vía CSS.
 *   - preserveAspectRatio=false para que el aspect dependa del viewBox.
 *   - Nodos siempre visibles como círculos pequeños + label con ID y
 *     coordenadas (en geometría son grandes; en otros son sutiles).
 */

import { Fragment, useMemo } from "react";
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import type { PorticoState, SolvedPortico } from "../lib/portico";

// ---- Visual constants ----

export const COLOR_BAR = "#f8fafc";
export const COLOR_DEFORM = "#3b82f6";
export const COLOR_SUPPORT = "#10b981";
export const COLOR_LOAD = "#f87171";
export const COLOR_M = "#fbbf24";
export const COLOR_N_TENSION = "#3b82f6";
export const COLOR_N_COMPRESSION = "#ef4444";
export const COLOR_V = "#a855f7";
export const COLOR_NODE = "#fbbf24";
export const COLOR_NODE_LABEL = "#f8fafc";

// ---- Types ----

export type DiagramMode =
  | "geometria"
  | "deformada"
  | "normales"
  | "momentos"
  | "corte";

export interface PorticoDiagramProps {
  porticoState: PorticoState;
  solved?: SolvedPortico;
  mode: DiagramMode;
  /** Override del viewBox; si se omite, fit-to-bbox + 18% padding. */
  viewBoxOverride?: [number, number, number, number];
  /** Altura en px; default 400. */
  height?: number;
}

// ---- Geometry helpers ----

const SUPPORT_HALF_W = 0.22;
const FIXED_SUPPORT_W = 0.28;
const FIXED_SUPPORT_H = 0.32;

function hingeTriangle(cx: number, cy: number): [number, number][] {
  const h = SUPPORT_HALF_W * 1.6;
  return [
    // El vértice superior coincide exactamente con el nudo.
    [cx, cy],
    [cx - SUPPORT_HALF_W, cy - h],
    [cx + SUPPORT_HALF_W, cy - h],
  ];
}

function fixedSupportBlock(cx: number, cy: number): [number, number][] {
  // En Mafs la pantalla tiene Y positiva hacia arriba; debajo del nudo es
  // cy - h. El bloque queda anclado exactamente al nudo.
  return [
    [cx - FIXED_SUPPORT_W, cy],
    [cx + FIXED_SUPPORT_W, cy],
    [cx + FIXED_SUPPORT_W, cy - FIXED_SUPPORT_H],
    [cx - FIXED_SUPPORT_W, cy - FIXED_SUPPORT_H],
  ];
}

// ---- ViewBox ----

function computeFitViewBox(
  state: PorticoState,
): [number, number, number, number] {
  const xs = state.nodes.map((n) => n.x);
  const ys = state.nodes.map((n) => -n.y);
  const xMin = xs.length ? Math.min(...xs) : -1;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const yMin = ys.length ? Math.min(...ys) : -1;
  const yMax = ys.length ? Math.max(...ys) : 1;
  const padX = Math.max(2, (xMax - xMin) * 0.18);
  const padY = Math.max(2, (yMax - yMin) * 0.18);
  return [
    Math.floor(xMin - padX),
    Math.ceil(xMax + padX),
    Math.floor(yMin - padY),
    Math.ceil(yMax + padY),
  ];
}

// ---- Force polyline builders ----

interface BarSamplePoint {
  s: number;
  x: number;
  y: number;
  value: number;
}

function buildOffsetPolyline(
  state: PorticoState,
  bars: SolvedPortico["bars"],
  sampleKey: "M" | "N" | "V",
  scale: number,
): Array<{ barId: string; samples: BarSamplePoint[] }> {
  return bars
    .map((b) => {
      const bar = state.bars.find((bb) => bb.id === b.barId);
      if (!bar) return null;
      const a = state.nodes.find((n) => n.id === bar.fromNodeId);
      const c = state.nodes.find((n) => n.id === bar.toNodeId);
      if (!a || !c) return null;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L < 1e-9) return null;
      // Normal local en el modelo Y-down. No calcular cosenos aquí: para
      // una barra horizontal dx/L=1 y la normal debe ser (0,1), no (0,0).
      const offX = -dy / L;
      const offY = dx / L;
      const samples: BarSamplePoint[] = b.forces.samples.map((s) => {
        const forceVal = s[sampleKey];
        // Cada punto conserva su propio signo. Usar el signo medio de la
        // barra ocultaba los cambios de signo del momento en el nudo A.
        const sign = forceVal >= 0 ? 1 : -1;
        return {
          s: s.s,
          x: a.x + (s.s / L) * dx + offX * sign * Math.abs(forceVal) * scale,
          y: a.y + (s.s / L) * dy + offY * sign * Math.abs(forceVal) * scale,
          value: forceVal,
        };
      });
      return { barId: b.barId, samples };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function forceScale(
  bars: SolvedPortico["bars"],
  key: "N" | "M" | "V",
  targetOffset: number,
): number {
  const max = bars.reduce(
    (outer, bar) =>
      Math.max(
        outer,
        ...bar.forces.samples.map((sample) => Math.abs(sample[key])),
      ),
    0,
  );
  return max > 1e-9 ? targetOffset / max : 0;
}

// ---- N-bar polylines (color depends on tension sign) ----

interface NBarSegment {
  barId: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  baseX0: number;
  baseY0: number;
  baseX1: number;
  baseY1: number;
  value0: number;
  value1: number;
  tension: boolean;
}

function buildNPolylines(
  state: PorticoState,
  bars: SolvedPortico["bars"],
  scale: number,
): NBarSegment[] {
  const out: NBarSegment[] = [];
  for (const b of bars) {
    const bar = state.bars.find((bb) => bb.id === b.barId);
    if (!bar) continue;
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const c = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !c) continue;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const offX = -dy / L;
    const offY = dx / L;
    for (let i = 0; i < b.forces.samples.length - 1; i++) {
      const p0 = b.forces.samples[i];
      const p1 = b.forces.samples[i + 1];
      const n0 = p0.N;
      const n1 = p1.N;
      const s0 = a.x + (p0.s / L) * dx + offX * n0 * scale;
      const y0 = a.y + (p0.s / L) * dy + offY * n0 * scale;
      const s1 = a.x + (p1.s / L) * dx + offX * n1 * scale;
      const y1 = a.y + (p1.s / L) * dy + offY * n1 * scale;
      out.push({
        barId: b.barId,
        x0: s0,
        y0,
        x1: s1,
        y1,
        baseX0: a.x + (p0.s / L) * dx,
        baseY0: a.y + (p0.s / L) * dy,
        baseX1: a.x + (p1.s / L) * dx,
        baseY1: a.y + (p1.s / L) * dy,
        value0: n0,
        value1: n1,
        tension: (n0 + n1) / 2 >= 0,
      });
    }
  }
  return out;
}

// ---- V-bar polylines (sign by instantaneous V) ----

interface VBarSegment {
  barId: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  baseX0: number;
  baseY0: number;
  baseX1: number;
  baseY1: number;
  value0: number;
  value1: number;
  sign: number;
}

function buildVPolylines(
  state: PorticoState,
  bars: SolvedPortico["bars"],
  scale: number,
): VBarSegment[] {
  const out: VBarSegment[] = [];
  for (const b of bars) {
    const bar = state.bars.find((bb) => bb.id === b.barId);
    if (!bar) continue;
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const c = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !c) continue;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const offX = -dy / L;
    const offY = dx / L;
    for (let i = 0; i < b.forces.samples.length - 1; i++) {
      const p0 = b.forces.samples[i];
      const p1 = b.forces.samples[i + 1];
      const v0 = p0.V;
      const v1 = p1.V;
      const sign0 = v0 >= 0 ? 1 : -1;
      const sign1 = v1 >= 0 ? 1 : -1;
      const s0 = a.x + (p0.s / L) * dx + offX * sign0 * Math.abs(v0) * scale;
      const y0 = a.y + (p0.s / L) * dy + offY * sign0 * Math.abs(v0) * scale;
      const s1 = a.x + (p1.s / L) * dx + offX * sign1 * Math.abs(v1) * scale;
      const y1 = a.y + (p1.s / L) * dy + offY * sign1 * Math.abs(v1) * scale;
      out.push({
        barId: b.barId,
        x0: s0,
        y0,
        x1: s1,
        y1,
        baseX0: a.x + (p0.s / L) * dx,
        baseY0: a.y + (p0.s / L) * dy,
        baseX1: a.x + (p1.s / L) * dx,
        baseY1: a.y + (p1.s / L) * dy,
        value0: v0,
        value1: v1,
        sign: (sign0 + sign1) / 2,
      });
    }
  }
  return out;
}

// ---- Force-vector arrows (for normals / shear, perpendicular to bar) ----

interface NArrow {
  barId: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  tension: boolean;
}

function buildNArrows(
  state: PorticoState,
  bars: SolvedPortico["bars"],
  viewBox: [number, number, number, number],
): NArrow[] {
  const out: NArrow[] = [];
  // Longitud proporcional al ancho del viewBox para que se vea siempre.
  const [, xHi, , yHiV] = viewBox;
  const ref = Math.max(1, Math.max(xHi, yHiV));
  const len = ref * 0.04;
  for (const b of bars) {
    const samples = b.forces.samples;
    if (samples.length === 0) continue;
    const meanN =
      samples.reduce((acc, p) => acc + p.N, 0) / Math.max(1, samples.length);
    if (Math.abs(meanN) < 1e-6) continue;
    const bar = state.bars.find((bb) => bb.id === b.barId);
    if (!bar) continue;
    const a = state.nodes.find((n) => n.id === bar.fromNodeId);
    const c = state.nodes.find((n) => n.id === bar.toNodeId);
    if (!a || !c) continue;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    // Mid-point of bar
    const mx = (a.x + c.x) / 2;
    const my = (a.y + c.y) / 2;
    // Axial direction: unit vector along bar
    const ux = dx / L;
    const uy = dy / L;
    const sign = meanN >= 0 ? 1 : -1;
    const tipX = mx + ux * sign * len;
    const tipY = my + uy * sign * len;
    out.push({
      barId: b.barId,
      x: tipX,
      y: -tipY,
      dx: ux * sign * len,
      dy: -uy * sign * len,
      tension: meanN >= 0,
    });
  }
  return out;
}

// ---- Node coords display ----

interface NodeGlyphProps {
  x: number;
  y: number;
  id: string;
  nx: number;
  ny: number;
  showCoords: boolean;
}

function NodeGlyph({ x, y, id, nx, ny, showCoords }: NodeGlyphProps) {
  // Punto Mafs separado del label: el punto es amarillo y el texto claro
  // queda desplazado para conservar legibilidad sobre el fondo oscuro.
  const label = showCoords ? `${id} (${nx.toFixed(2)}, ${ny.toFixed(2)})` : id;
  return (
    <>
      <Text x={x} y={y} size={18} color={COLOR_NODE} attach="ne">
        ●
      </Text>
      <Text
        x={x + 0.16}
        y={y - 0.16}
        size={13}
        color={COLOR_NODE_LABEL}
        attach="sw"
      >
        {label}
      </Text>
    </>
  );
}

function PerpendicularTick({
  baseX,
  baseY,
  tipX,
  tipY,
  color,
  weight = 1.5,
}: {
  baseX: number;
  baseY: number;
  tipX: number;
  tipY: number;
  color: string;
  weight?: number;
}) {
  return (
    <Plot.Parametric
      xy={(t) => [baseX + t * (tipX - baseX), -(baseY + t * (tipY - baseY))]}
      domain={[0, 1]}
      color={color}
      weight={weight}
    />
  );
}

function DiagramValueLabel({
  x,
  y,
  value,
  color,
}: {
  x: number;
  y: number;
  value: number;
  color: string;
}) {
  return (
    <Text x={x} y={-y} size={11} color={color} attach="ne">
      {value.toFixed(2)}
    </Text>
  );
}

function segmentExtremes(
  segments: Array<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    value0: number;
    value1: number;
  }>,
) {
  const points = segments.flatMap((segment) => [
    { x: segment.x0, y: segment.y0, value: segment.value0 },
    { x: segment.x1, y: segment.y1, value: segment.value1 },
  ]);
  if (points.length === 0) return null;
  const min = points.reduce((a, b) => (b.value < a.value ? b : a));
  const max = points.reduce((a, b) => (b.value > a.value ? b : a));
  const abs = points.reduce((a, b) =>
    Math.abs(b.value) > Math.abs(a.value) ? b : a,
  );
  return { min, max, abs };
}

// ---- Main component ----

export default function PorticoDiagram({
  porticoState,
  solved,
  mode,
  viewBoxOverride,
  height = 400,
}: PorticoDiagramProps) {
  // viewBox fit-to-bbox (memoized to avoid recompute per render)
  const fitViewBox = useMemo(
    () => computeFitViewBox(porticoState),
    [porticoState],
  );
  const viewBox = viewBoxOverride ?? fitViewBox;
  const [xLo, xHi, yLo, yHi] = viewBox;
  const widthSpan = xHi - xLo;
  const heightSpan = yHi - yLo;
  const diagramSpan = Math.max(1, Math.min(widthSpan, heightSpan));
  const maxDisplacement = solved
    ? solved.displacements.reduce(
        (max, d) => Math.max(max, Math.hypot(d.u, d.v)),
        0,
      )
    : 0;
  // Exageración visual automática: limita la deformada a ~20% del gráfico.
  const deformScale =
    maxDisplacement > 1e-12 ? (diagramSpan * 0.2) / maxDisplacement : 1;

  // Memoize heavy derivatives
  const mScale = solved ? forceScale(solved.bars, "M", diagramSpan * 0.2) : 0;
  const nScale = solved ? forceScale(solved.bars, "N", diagramSpan * 0.16) : 0;
  const vScale = solved ? forceScale(solved.bars, "V", diagramSpan * 0.16) : 0;

  const mPolylines = useMemo(
    () =>
      solved ? buildOffsetPolyline(porticoState, solved.bars, "M", mScale) : [],
    [porticoState, solved, mScale],
  );
  const nPolylines = useMemo(
    () => (solved ? buildNPolylines(porticoState, solved.bars, nScale) : []),
    [porticoState, solved, nScale],
  );
  const vPolylines = useMemo(
    () => (solved ? buildVPolylines(porticoState, solved.bars, vScale) : []),
    [porticoState, solved, vScale],
  );
  const nArrows = useMemo(
    () => (solved ? buildNArrows(porticoState, solved.bars, viewBox) : []),
    [porticoState, solved, viewBox],
  );

  const dispByNodeId = useMemo(
    () =>
      solved
        ? new Map(solved.displacements.map((d) => [d.nodeId, d]))
        : new Map(),
    [solved],
  );

  const showCoords = mode === "geometria";

  return (
    <Mafs
      viewBox={{ x: [xLo, xHi], y: [yLo, yHi] }}
      height={height}
      // Mantener escala física igual en X/Y. Puede quedar espacio libre en
      // uno de los ejes, pero una barra de 1 m siempre mide lo mismo en ambos.
      preserveAspectRatio="contain"
    >
      <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={{ lines: 4 }} />

      {/* Ejes X y Y baseline */}
      <Plot.OfX y={() => 0} domain={[xLo, xHi]} color="#94a3b8" />
      <Plot.OfY x={() => 0} domain={[yLo, yHi]} color="#94a3b8" />

      {/* Barras indeformadas (siempre) */}
      {porticoState.bars.map((b) => {
        const a = porticoState.nodes.find((n) => n.id === b.fromNodeId);
        const c = porticoState.nodes.find((n) => n.id === b.toNodeId);
        if (!a || !c) return null;
        return (
          <Plot.Parametric
            key={`bar-${b.id}`}
            xy={(t) => [a.x + t * (c.x - a.x), -(a.y + t * (c.y - a.y))]}
            domain={[0, 1]}
            color={COLOR_BAR}
            weight={4}
          />
        );
      })}

      {/* Deformada en su propia vista; geometría queda indeformada. */}
      {mode === "deformada" &&
        solved &&
        porticoState.bars.map((b) => {
          const a = porticoState.nodes.find((n) => n.id === b.fromNodeId);
          const c = porticoState.nodes.find((n) => n.id === b.toNodeId);
          const disA = a ? dispByNodeId.get(a.id) : undefined;
          const disC = c ? dispByNodeId.get(c.id) : undefined;
          if (!a || !c || !disA || !disC) return null;
          return (
            <Polygon
              key={`deform-${b.id}`}
              points={[
                [a.x + disA.u * deformScale, -(a.y + disA.v * deformScale)],
                [c.x + disC.u * deformScale, -(c.y + disC.v * deformScale)],
              ]}
              color={COLOR_DEFORM}
              fillOpacity={0}
              strokeOpacity={0.7}
            />
          );
        })}

      {/* Diagramas según modo */}
      {mode === "momentos" &&
        mPolylines.flatMap((pl) => {
          if (pl.samples.length < 2) return [];
          const segs: Array<{
            x0: number;
            x1: number;
            y0: number;
            y1: number;
          }> = [];
          for (let i = 0; i < pl.samples.length - 1; i++) {
            const p0 = pl.samples[i];
            const p1 = pl.samples[i + 1];
            segs.push({ x0: p0.x, x1: p1.x, y0: p0.y, y1: p1.y });
          }
          const bar = porticoState.bars.find((item) => item.id === pl.barId);
          const a = bar
            ? porticoState.nodes.find((node) => node.id === bar.fromNodeId)
            : undefined;
          const c = bar
            ? porticoState.nodes.find((node) => node.id === bar.toNodeId)
            : undefined;
          if (!a || !c) return [];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const length = Math.hypot(dx, dy);
          return [
            ...segs.map((s, idx) => (
              <Plot.Parametric
                key={`m-${pl.barId}-${idx}`}
                xy={(t) => [
                  s.x0 + t * (s.x1 - s.x0),
                  -(s.y0 + t * (s.y1 - s.y0)),
                ]}
                domain={[0, 1]}
                color={COLOR_M}
                weight={2.5}
              />
            )),
            ...pl.samples.map((sample, idx) => (
              <PerpendicularTick
                key={`m-tick-${pl.barId}-${idx}`}
                baseX={a.x + (sample.s / length) * dx}
                baseY={a.y + (sample.s / length) * dy}
                tipX={sample.x}
                tipY={sample.y}
                color={COLOR_M}
                weight={idx === 0 || idx === pl.samples.length - 1 ? 2.5 : 1.25}
              />
            )),
            ...(() => {
              const min = pl.samples.reduce((a, b) =>
                b.value < a.value ? b : a,
              );
              const max = pl.samples.reduce((a, b) =>
                b.value > a.value ? b : a,
              );
              const abs = pl.samples.reduce((a, b) =>
                Math.abs(b.value) > Math.abs(a.value) ? b : a,
              );
              return [
                <DiagramValueLabel
                  key={`m-min-${pl.barId}`}
                  x={min.x}
                  y={min.y}
                  value={min.value}
                  color={COLOR_M}
                />,
                <DiagramValueLabel
                  key={`m-max-${pl.barId}`}
                  x={max.x}
                  y={max.y}
                  value={max.value}
                  color={COLOR_M}
                />,
                <DiagramValueLabel
                  key={`m-abs-${pl.barId}`}
                  x={abs.x}
                  y={abs.y}
                  value={Math.abs(abs.value)}
                  color={COLOR_M}
                />,
              ];
            })(),
          ];
        })}

      {mode === "normales" && (
        <>
          {nPolylines.map((seg, idx) => (
            <Fragment key={`n-${seg.barId}-${idx}`}>
              <Plot.Parametric
                xy={(t) => [
                  seg.x0 + t * (seg.x1 - seg.x0),
                  -(seg.y0 + t * (seg.y1 - seg.y0)),
                ]}
                domain={[0, 1]}
                color={seg.tension ? COLOR_N_TENSION : COLOR_N_COMPRESSION}
                weight={2.5}
              />
              <PerpendicularTick
                baseX={seg.baseX0}
                baseY={seg.baseY0}
                tipX={seg.x0}
                tipY={seg.y0}
                color={seg.tension ? COLOR_N_TENSION : COLOR_N_COMPRESSION}
              />
              <PerpendicularTick
                baseX={seg.baseX1}
                baseY={seg.baseY1}
                tipX={seg.x1}
                tipY={seg.y1}
                color={seg.tension ? COLOR_N_TENSION : COLOR_N_COMPRESSION}
              />
            </Fragment>
          ))}
          {Array.from(new Set(nPolylines.map((seg) => seg.barId))).flatMap(
            (barId) => {
              const extremes = segmentExtremes(
                nPolylines.filter((seg) => seg.barId === barId),
              );
              if (!extremes) return [];
              return [
                <DiagramValueLabel
                  key={`n-min-${barId}`}
                  x={extremes.min.x}
                  y={extremes.min.y}
                  value={extremes.min.value}
                  color={COLOR_N_TENSION}
                />,
                <DiagramValueLabel
                  key={`n-max-${barId}`}
                  x={extremes.max.x}
                  y={extremes.max.y}
                  value={extremes.max.value}
                  color={COLOR_N_TENSION}
                />,
                <DiagramValueLabel
                  key={`n-abs-${barId}`}
                  x={extremes.abs.x}
                  y={extremes.abs.y}
                  value={Math.abs(extremes.abs.value)}
                  color={COLOR_N_TENSION}
                />,
              ];
            },
          )}
          {/* Flechas axiales para visualizar tracción/compresión */}
          {nArrows.map((a, idx) => {
            const tipX = a.x;
            const tipY = a.y;
            const tailX = tipX - a.dx;
            const tailY = tipY - a.dy;
            const wing = Math.hypot(a.dx, a.dy) * 0.25;
            const wx1 =
              tailX + (-a.dy / Math.max(1e-9, Math.hypot(a.dx, a.dy))) * wing;
            const wy1 =
              tailY + (a.dx / Math.max(1e-9, Math.hypot(a.dx, a.dy))) * wing;
            const wx2 =
              tailX - (-a.dy / Math.max(1e-9, Math.hypot(a.dx, a.dy))) * wing;
            const wy2 =
              tailY - (a.dx / Math.max(1e-9, Math.hypot(a.dx, a.dy))) * wing;
            return (
              <Polygon
                key={`narr-${a.barId}-${idx}`}
                points={[
                  [tipX, tipY],
                  [tailX, tailY],
                  [wx1, wy1],
                  [wx2, wy2],
                ]}
                color={a.tension ? COLOR_N_TENSION : COLOR_N_COMPRESSION}
                fillOpacity={1}
              />
            );
          })}
        </>
      )}

      {mode === "corte" &&
        vPolylines.map((seg, idx) => (
          <Fragment key={`v-${seg.barId}-${idx}`}>
            <Plot.Parametric
              xy={(t) => [
                seg.x0 + t * (seg.x1 - seg.x0),
                -(seg.y0 + t * (seg.y1 - seg.y0)),
              ]}
              domain={[0, 1]}
              color={COLOR_V}
              weight={2.5}
            />
            <PerpendicularTick
              baseX={seg.baseX0}
              baseY={seg.baseY0}
              tipX={seg.x0}
              tipY={seg.y0}
              color={COLOR_V}
            />
            <PerpendicularTick
              baseX={seg.baseX1}
              baseY={seg.baseY1}
              tipX={seg.x1}
              tipY={seg.y1}
              color={COLOR_V}
            />
          </Fragment>
        ))}
      {mode === "corte" &&
        Array.from(new Set(vPolylines.map((seg) => seg.barId))).flatMap(
          (barId) => {
            const extremes = segmentExtremes(
              vPolylines.filter((seg) => seg.barId === barId),
            );
            if (!extremes) return [];
            return [
              <DiagramValueLabel
                key={`v-min-${barId}`}
                x={extremes.min.x}
                y={extremes.min.y}
                value={extremes.min.value}
                color={COLOR_V}
              />,
              <DiagramValueLabel
                key={`v-max-${barId}`}
                x={extremes.max.x}
                y={extremes.max.y}
                value={extremes.max.value}
                color={COLOR_V}
              />,
              <DiagramValueLabel
                key={`v-abs-${barId}`}
                x={extremes.abs.x}
                y={extremes.abs.y}
                value={Math.abs(extremes.abs.value)}
                color={COLOR_V}
              />,
            ];
          },
        )}

      {/* Glyphs de apoyo */}
      {porticoState.supports.map((sup) => {
        const n = porticoState.nodes.find((nn) => nn.id === sup.nodeId);
        if (!n) return null;
        const cy = -n.y;
        if (sup.kind === "fixed") {
          return (
            <Fragment key={`sup-${sup.id}`}>
              <Polygon
                points={fixedSupportBlock(n.x, cy)}
                color={COLOR_SUPPORT}
                fillOpacity={0.9}
                strokeOpacity={1}
              />
              {[0, 1, 2].map((i) => {
                const x0 = n.x - FIXED_SUPPORT_W + i * FIXED_SUPPORT_W * 0.8;
                return (
                  <Plot.Parametric
                    key={`sup-hatch-${sup.id}-${i}`}
                    xy={(t) => [
                      x0 + t * FIXED_SUPPORT_W * 0.55,
                      cy - FIXED_SUPPORT_H + t * FIXED_SUPPORT_H * 0.45,
                    ]}
                    domain={[0, 1]}
                    color="#f8fafc"
                    weight={2}
                  />
                );
              })}
            </Fragment>
          );
        }
        return (
          <Polygon
            key={`sup-${sup.id}`}
            points={hingeTriangle(n.x, cy)}
            color={COLOR_SUPPORT}
            fillOpacity={0.9}
            strokeOpacity={1}
          />
        );
      })}

      {/* Flechas de carga (solo en geometría) */}
      {mode === "geometria" &&
        porticoState.loads.flatMap((l) => {
          const bar = porticoState.bars.find((b) => b.id === l.barId);
          const a = porticoState.nodes.find((n) => n.id === bar?.fromNodeId);
          const bN = porticoState.nodes.find((n) => n.id === bar?.toNodeId);
          if (!a || !bN || !bar) return null;
          const dx = bN.x - a.x;
          const dy = bN.y - a.y;
          const L = Math.hypot(dx, dy);
          if (L < 1e-9) return null;
          const start = Math.max(0, Math.min(l.a, L));
          const end =
            l.kind === "distributed"
              ? Math.max(start, Math.min(l.b ?? L, L))
              : start;
          if (l.kind === "distributed") {
            // El ángulo de la carga manda la dirección de las flechas. Con
            // Y positiva hacia abajo: 90° apunta hacia abajo. La banda se
            // coloca en sentido contrario al vector, de modo que cada flecha
            // nace en la banda y termina sobre la barra.
            const ux = dx / L;
            const uy = -dy / L;
            const angleRad = (l.angle * Math.PI) / 180;
            const forceX = Math.cos(angleRad);
            const forceY = -Math.sin(angleRad);
            const bandHeight = Math.max(0.35, widthSpan * 0.09);
            const p0: [number, number] = [
              a.x + (start / L) * dx,
              -(a.y + (start / L) * dy),
            ];
            const p1: [number, number] = [
              a.x + (end / L) * dx,
              -(a.y + (end / L) * dy),
            ];
            const q0: [number, number] = [
              p0[0] - forceX * bandHeight,
              p0[1] - forceY * bandHeight,
            ];
            const q1: [number, number] = [
              p1[0] - forceX * bandHeight,
              p1[1] - forceY * bandHeight,
            ];
            const arrowCount = 5;
            return [
              <Polygon
                key={`load-band-${l.id}`}
                points={[p0, p1, q1, q0]}
                color={COLOR_LOAD}
                fillOpacity={0.18}
                strokeOpacity={1}
                weight={2}
              />,
              ...Array.from({ length: arrowCount }, (_, i) => {
                const ratio = i / (arrowCount - 1);
                const bx = p0[0] + ratio * (p1[0] - p0[0]);
                const by = p0[1] + ratio * (p1[1] - p0[1]);
                const tx = bx - forceX * bandHeight * 0.78;
                const ty = by - forceY * bandHeight * 0.78;
                const head = bandHeight * 0.16;
                return (
                  <Fragment key={`load-arrow-${l.id}-${i}`}>
                    <Plot.Parametric
                      xy={(t) => [bx + t * (tx - bx), by + t * (ty - by)]}
                      domain={[0, 1]}
                      color={COLOR_LOAD}
                      weight={2}
                    />
                    <Polygon
                      points={[
                        [bx, by],
                        [
                          bx - forceX * head + ux * head,
                          by - forceY * head + uy * head,
                        ],
                        [
                          bx - forceX * head - ux * head,
                          by - forceY * head - uy * head,
                        ],
                      ]}
                      color={COLOR_LOAD}
                      fillOpacity={1}
                    />
                  </Fragment>
                );
              }),
              <Text
                key={`load-label-${l.id}`}
                x={(q0[0] + q1[0]) / 2}
                y={(q0[1] + q1[1]) / 2}
                size={14}
                color={COLOR_LOAD}
                attach="n"
              >
                {`${Math.round(l.D)}D+${Math.round(l.L)}L`}
              </Text>,
            ];
          }

          const angleRad = (l.angle * Math.PI) / 180;
          const fx = Math.cos(angleRad);
          const fy = -Math.sin(angleRad);
          const len = Math.max(0.75, widthSpan * 0.14);
          const x = a.x + (start / L) * dx;
          const y = -(a.y + (start / L) * dy);
          const tailX = x - fx * len;
          const tailY = y - fy * len;
          const head = Math.max(0.1, len * 0.12);
          const headWidth = head * 0.7;
          return [
            <Fragment key={`load-${l.id}`}>
              <Plot.Parametric
                xy={(t) => [tailX + t * (x - tailX), tailY + t * (y - tailY)]}
                domain={[0, 1]}
                color={COLOR_LOAD}
                weight={2}
              />
              <Polygon
                points={[
                  [x, y],
                  [
                    x - fx * head + -fy * headWidth,
                    y - fy * head + fx * headWidth,
                  ],
                  [
                    x - fx * head - -fy * headWidth,
                    y - fy * head - fx * headWidth,
                  ],
                ]}
                color={COLOR_LOAD}
                fillOpacity={1}
              />
              <Text
                x={tailX - fx * len * 0.2}
                y={tailY - fy * len * 0.2}
                size={14}
                color={COLOR_LOAD}
                attach="e"
              >
                {`${Math.round(l.D)}D+${Math.round(l.L)}L`}
              </Text>
            </Fragment>,
          ];
        })}

      {/* Nodos con ID (siempre); coords solo en geometría */}
      {porticoState.nodes.map((n) => (
        <NodeGlyph
          key={`node-${n.id}`}
          x={n.x}
          y={-n.y}
          id={n.id}
          nx={n.x}
          ny={n.y}
          showCoords={showCoords}
        />
      ))}
    </Mafs>
  );
}
