import type { EdgeCondition } from "../lib/slab-calc";

interface Props {
  lx: number;
  ly: number;
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
}

export default function SlabPlan({ lx, ly, edges }: Props) {
  const W = 300,
    H = 250,
    pad = 50;
  const sx = (lx >= ly ? W - 2 * pad : (W - 2 * pad) * (lx / ly)) / lx;
  const sy = (ly >= lx ? H - 2 * pad : (H - 2 * pad) * (ly / lx)) / ly;
  const s = Math.min(sx, sy);
  const w = lx * s;
  const h = ly * s;
  const x0 = pad + (W - 2 * pad - w) / 2;
  const y0 = pad + (H - 2 * pad - h) / 2;
  const hatchLen = 20;

  function hatchLines(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len,
      uy = dy / len;
    const perpX = -uy,
      perpY = ux;
    const lines: React.ReactNode[] = [];
    for (let d = 0; d < len; d += 16) {
      const hx1 = x1 + ux * d + perpX * 0;
      const hy1 = y1 + uy * d + perpY * 0;
      const hx2 = x1 + ux * d + perpX * hatchLen;
      const hy2 = y1 + uy * d + perpY * hatchLen;
      lines.push(
        <line
          key={d}
          x1={hx1}
          y1={hy1}
          x2={hx2}
          y2={hy2}
          stroke="#7c8aff"
          strokeWidth={2}
        />,
      );
    }
    return lines;
  }

  function edgeSymbol(
    edge: EdgeCondition,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    if (edge === "simple") {
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#9090b0"
          strokeWidth={3}
        />
      );
    }
    if (edge === "empotrado" || edge === "continuo") {
      return (
        <g>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#7c8aff"
            strokeWidth={3}
          />
          {hatchLines(x1, y1, x2, y2)}
        </g>
      );
    }
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#4ade80"
        strokeWidth={3}
        strokeDasharray="6,3"
      />
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex flex-col items-center">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
        Planta
      </span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Slab fill */}
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          fill="#1a1a2e"
          stroke="none"
          rx={2}
        />
        {/* Edges */}
        {edgeSymbol(edges[0], x0, y0, x0, y0 + h)}
        {edgeSymbol(edges[1], x0 + w, y0, x0 + w, y0 + h)}
        {edgeSymbol(edges[2], x0, y0, x0 + w, y0)}
        {edgeSymbol(edges[3], x0, y0 + h, x0 + w, y0 + h)}
        {/* Dimensions */}
        <text
          x={x0 + w / 2}
          y={y0 - 10}
          textAnchor="middle"
          fill="#9090b0"
          fontSize={11}
        >
          l
          <tspan fontSize={9} baselineShift="sub">
            x
          </tspan>{" "}
          = {lx} m
        </text>
        <text
          x={x0 + w + 15}
          y={y0 + h / 2 + 4}
          textAnchor="middle"
          fill="#9090b0"
          fontSize={11}
          transform={`rotate(90, ${x0 + w + 15}, ${y0 + h / 2})`}
        >
          l
          <tspan fontSize={9} baselineShift="sub">
            y
          </tspan>{" "}
          = {ly} m
        </text>
      </svg>
      <div className="flex gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#9090b0]" /> Apoyado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#7c8aff]" /> Continuo
        </span>
      </div>
    </div>
  );
}
