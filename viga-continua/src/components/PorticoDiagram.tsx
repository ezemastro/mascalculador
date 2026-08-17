/**
 * PorticoDiagram — render parametrizable del pórtico en Mafs.
 *
 * Props:
 *   - porticoState: estado del pórtico (nodos, barras, cargas, apoyos).
 *   - solved?: resultado del solver. Requerido para los modos
 *     "normales" | "momentos" | "corte". En "geometría" se puede omitir
 *     (no se muestra deformada ni diagramas).
 *   - mode: "geometria" | "normales" | "momentos" | "corte".
 *   - viewBoxOverride?: [xMin, xMax, yMin, yMax] para zoom. Si se omite,
 *     se calcula fit-to-bbox + 18% padding.
 *
 * Convenciones (locked en design.md §3):
 *   - Y positivo hacia abajo (Mafs / world).
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

import { useMemo } from "react";
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import type { PorticoState, SolvedPortico } from "../lib/portico";

// ---- Visual constants ----

const DEFORM_SCALE = 50;
const M_SCALE = 50;
const N_SCALE = 0.5;
const V_SCALE = 0.5;

export const COLOR_BAR = "#6b7280";
export const COLOR_DEFORM = "#3b82f6";
export const COLOR_SUPPORT = "#10b981";
export const COLOR_LOAD = "#f87171";
export const COLOR_M = "#fbbf24";
export const COLOR_N_TENSION = "#3b82f6";
export const COLOR_N_COMPRESSION = "#ef4444";
export const COLOR_V = "#a855f7";
export const COLOR_NODE = "#111827";
export const COLOR_NODE_LABEL = "#111827";

// ---- Types ----

export type DiagramMode = "geometria" | "normales" | "momentos" | "corte";

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

const SUPPORT_HALF_W = 0.18;

function hingeTriangle(cx: number, cy: number): [number, number][] {
  return [
    [cx, cy],
    [cx - SUPPORT_HALF_W, cy + SUPPORT_HALF_W * 1.5],
    [cx + SUPPORT_HALF_W, cy + SUPPORT_HALF_W * 1.5],
  ];
}

function fixedHatchBox(cx: number, cy: number): [number, number][] {
  const h = SUPPORT_HALF_W * 0.9;
  return [
    [cx - SUPPORT_HALF_W, cy],
    [cx + SUPPORT_HALF_W, cy],
    [cx + SUPPORT_HALF_W, cy + h * 2],
    [cx - SUPPORT_HALF_W, cy + h * 2],
  ];
}

const sinL = (x: number) => x;
const cosL = (x: number) =>
  Math.sqrt(Math.max(0, 1 - x * x)) * (x >= 0 ? 1 : -1);

// ---- ViewBox ----

function computeFitViewBox(
  state: PorticoState,
): [number, number, number, number] {
  const xs = state.nodes.map((n) => n.x);
  const ys = state.nodes.map((n) => n.y);
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
  x: number;
  y: number;
}

function buildOffsetPolyline(
  state: PorticoState,
  bars: SolvedPortico["bars"],
  sampleKey: "M" | "N" | "V",
  scale: number,
  flipSignForTensionBelow: boolean,
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
      // Perpendicular local en Y-DOWN screen: (-sin α, cos α).
      const offX = -sinL(dy / L);
      const offY = cosL(dx / L);
      const samples: BarSamplePoint[] = b.forces.samples.map((s) => {
        const forceVal = s[sampleKey];
        // Para M usamos tensión abajo (mean sign); para N/V usamos el signo
        // instantáneo para que la línea quede del lado correcto.
        const sign = flipSignForTensionBelow
          ? b.forces.samples.reduce((acc, p) => acc + p[sampleKey], 0) /
              Math.max(1, b.forces.samples.length) >=
            0
            ? 1
            : -1
          : forceVal >= 0
            ? 1
            : -1;
        return {
          x: a.x + (s.s / L) * dx + offX * sign * Math.abs(forceVal) * scale,
          y: a.y + (s.s / L) * dy + offY * sign * Math.abs(forceVal) * scale,
        };
      });
      return { barId: b.barId, samples };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

// ---- N-bar polylines (color depends on tension sign) ----

interface NBarSegment {
  barId: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  tension: boolean;
}

function buildNPolylines(
  state: PorticoState,
  bars: SolvedPortico["bars"],
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
    const offX = -sinL(dy / L);
    const offY = cosL(dx / L);
    for (let i = 0; i < b.forces.samples.length - 1; i++) {
      const p0 = b.forces.samples[i];
      const p1 = b.forces.samples[i + 1];
      const n0 = p0.N;
      const n1 = p1.N;
      const s0 = a.x + (p0.s / L) * dx + offX * n0 * N_SCALE;
      const y0 = a.y + (p0.s / L) * dy + offY * n0 * N_SCALE;
      const s1 = a.x + (p1.s / L) * dx + offX * n1 * N_SCALE;
      const y1 = a.y + (p1.s / L) * dy + offY * n1 * N_SCALE;
      out.push({
        barId: b.barId,
        x0: s0,
        y0,
        x1: s1,
        y1,
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
  sign: number;
}

function buildVPolylines(
  state: PorticoState,
  bars: SolvedPortico["bars"],
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
    const offX = -sinL(dy / L);
    const offY = cosL(dx / L);
    for (let i = 0; i < b.forces.samples.length - 1; i++) {
      const p0 = b.forces.samples[i];
      const p1 = b.forces.samples[i + 1];
      const v0 = p0.V;
      const v1 = p1.V;
      const sign0 = v0 >= 0 ? 1 : -1;
      const sign1 = v1 >= 0 ? 1 : -1;
      const s0 = a.x + (p0.s / L) * dx + offX * sign0 * Math.abs(v0) * V_SCALE;
      const y0 = a.y + (p0.s / L) * dy + offY * sign0 * Math.abs(v0) * V_SCALE;
      const s1 = a.x + (p1.s / L) * dx + offX * sign1 * Math.abs(v1) * V_SCALE;
      const y1 = a.y + (p1.s / L) * dy + offY * sign1 * Math.abs(v1) * V_SCALE;
      out.push({
        barId: b.barId,
        x0: s0,
        y0,
        x1: s1,
        y1,
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
      y: tipY,
      dx: ux * sign * len,
      dy: uy * sign * len,
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
  nodeSize: number;
}

function NodeGlyph({ x, y, id, nx, ny, showCoords, nodeSize }: NodeGlyphProps) {
  // Pequeño círculo + label
  const r = nodeSize / 2;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={COLOR_NODE} />
      <Text
        x={x + r + 0.05}
        y={y - r - 0.05}
        size={12}
        color={COLOR_NODE_LABEL}
        attach="sw"
      >
        {id}
        {showCoords ? ` (${nx.toFixed(2)}, ${ny.toFixed(2)})` : ""}
      </Text>
    </g>
  );
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

  // Memoize heavy derivatives
  const mPolylines = useMemo(
    () =>
      solved
        ? buildOffsetPolyline(porticoState, solved.bars, "M", M_SCALE, true)
        : [],
    [porticoState, solved],
  );
  const nPolylines = useMemo(
    () => (solved ? buildNPolylines(porticoState, solved.bars) : []),
    [porticoState, solved],
  );
  const vPolylines = useMemo(
    () => (solved ? buildVPolylines(porticoState, solved.bars) : []),
    [porticoState, solved],
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

  // Tamaños relativos al viewBox para que escalen con el zoom.
  const nodeSize = Math.max(0.08, Math.min(widthSpan, heightSpan) * 0.02);
  const showCoords = mode === "geometria";

  return (
    <Mafs
      viewBox={{ x: [xLo, xHi], y: [yLo, yHi] }}
      height={height}
      preserveAspectRatio={false}
    >
      <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={{ lines: 4 }} />

      {/* Ejes X y Y baseline */}
      <Plot.OfX y={() => 0} domain={[xLo, xHi]} color="#374151" />
      <Plot.OfY x={() => 0} domain={[yLo, yHi]} color="#374151" />

      {/* Barras indeformadas (siempre) */}
      {porticoState.bars.map((b) => {
        const a = porticoState.nodes.find((n) => n.id === b.fromNodeId);
        const c = porticoState.nodes.find((n) => n.id === b.toNodeId);
        if (!a || !c) return null;
        return (
          <Plot.OfX
            key={`bar-${b.id}`}
            y={(t) => {
              if (t < Math.min(a.x, c.x) || t > Math.max(a.x, c.x)) return a.y;
              const u = (t - a.x) / (c.x - a.x || 1);
              return a.y + u * (c.y - a.y);
            }}
            domain={[Math.min(a.x, c.x), Math.max(a.x, c.x)]}
            color={COLOR_BAR}
            weight={2}
          />
        );
      })}

      {/* Geometría deformada (solo en modo "geometria") */}
      {mode === "geometria" &&
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
                [a.x + disA.u * DEFORM_SCALE, a.y + disA.v * DEFORM_SCALE],
                [c.x + disC.u * DEFORM_SCALE, c.y + disC.v * DEFORM_SCALE],
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
          return segs.map((s, idx) => (
            <Plot.OfX
              key={`m-${pl.barId}-${idx}`}
              y={(t) => {
                if (t < s.x0 || t > s.x1) return s.y0;
                const u = (t - s.x0) / (s.x1 - s.x0 || 1);
                return s.y0 + u * (s.y1 - s.y0);
              }}
              domain={[Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)]}
              color={COLOR_M}
              weight={2.5}
            />
          ));
        })}

      {mode === "normales" && (
        <>
          {nPolylines.map((seg, idx) => (
            <Plot.OfX
              key={`n-${seg.barId}-${idx}`}
              y={(t) => {
                if (t < seg.x0 || t > seg.x1) return seg.y0;
                const u = (t - seg.x0) / (seg.x1 - seg.x0 || 1);
                return seg.y0 + u * (seg.y1 - seg.y0);
              }}
              domain={[Math.min(seg.x0, seg.x1), Math.max(seg.x0, seg.x1)]}
              color={seg.tension ? COLOR_N_TENSION : COLOR_N_COMPRESSION}
              weight={2.5}
            />
          ))}
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
          <Plot.OfX
            key={`v-${seg.barId}-${idx}`}
            y={(t) => {
              if (t < seg.x0 || t > seg.x1) return seg.y0;
              const u = (t - seg.x0) / (seg.x1 - seg.x0 || 1);
              return seg.y0 + u * (seg.y1 - seg.y0);
            }}
            domain={[Math.min(seg.x0, seg.x1), Math.max(seg.x0, seg.x1)]}
            color={COLOR_V}
            weight={2.5}
          />
        ))}

      {/* Glyphs de apoyo */}
      {porticoState.supports.map((sup) => {
        const n = porticoState.nodes.find((nn) => nn.id === sup.nodeId);
        if (!n) return null;
        const isHinge = sup.kind === "hinge";
        return (
          <Polygon
            key={`sup-${sup.id}`}
            points={isHinge ? hingeTriangle(n.x, n.y) : fixedHatchBox(n.x, n.y)}
            color={COLOR_SUPPORT}
            fillOpacity={isHinge ? 1 : 0.25}
            strokeOpacity={1}
          />
        );
      })}

      {/* Flechas de carga (solo en geometría) */}
      {mode === "geometria" &&
        porticoState.loads.map((l) => {
          const bar = porticoState.bars.find((b) => b.id === l.barId);
          const a = porticoState.nodes.find((n) => n.id === bar?.fromNodeId);
          const bN = porticoState.nodes.find((n) => n.id === bar?.toNodeId);
          if (!a || !bN || !bar) return null;
          const dx = bN.x - a.x;
          const dy = bN.y - a.y;
          const L = Math.hypot(dx, dy);
          if (L < 1e-9) return null;
          const aPos = Math.max(0, Math.min(l.a, L));
          const x = a.x + (aPos / L) * dx;
          const y = a.y + (aPos / L) * dy;
          const angleRad = (l.angle * Math.PI) / 180;
          const fx = Math.cos(angleRad);
          const fy = Math.sin(angleRad);
          const len = Math.max(0.4, widthSpan * 0.07);
          const tailX = x - fx * len;
          const tailY = y - fy * len;
          const wing = len * 0.25;
          const wingX1 = tailX + -fy * wing;
          const wingY1 = tailY + fx * wing;
          const wingX2 = tailX - -fy * wing;
          const wingY2 = tailY - fx * wing;
          return (
            <g key={`load-${l.id}`}>
              <Polygon
                points={[
                  [x, y],
                  [tailX, tailY],
                  [wingX1, wingY1],
                  [wingX2, wingY2],
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
            </g>
          );
        })}

      {/* Nodos con ID (siempre); coords solo en geometría */}
      {porticoState.nodes.map((n) => (
        <NodeGlyph
          key={`node-${n.id}`}
          x={n.x}
          y={n.y}
          id={n.id}
          nx={n.x}
          ny={n.y}
          showCoords={showCoords}
          nodeSize={nodeSize}
        />
      ))}
    </Mafs>
  );
}
