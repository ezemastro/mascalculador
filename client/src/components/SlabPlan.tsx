import type { EdgeCondition } from "../lib/slab-calc";

interface Props {
  lx: number;
  ly: number;
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
  slabType: "crossed" | "oneway-x" | "oneway-y" | "cantilever-left" | "cantilever-right" | "cantilever-top" | "cantilever-bottom";
}

export default function SlabPlan({ lx, ly, edges, slabType }: Props) {
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

  function hatchLines(x1: number, y1: number, x2: number, y2: number, outward: boolean) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len,
      uy = dy / len;
    const perpX = -uy,
      perpY = ux;
    const dir = outward ? 1 : -1;
    const lines: React.ReactNode[] = [];
    for (let d = 0; d < len; d += 16) {
      const hx1 = x1 + ux * d;
      const hy1 = y1 + uy * d;
      const hx2 = x1 + ux * d + perpX * hatchLen * dir;
      const hy2 = y1 + uy * d + perpY * hatchLen * dir;
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
    outward: boolean,
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
          {hatchLines(x1, y1, x2, y2, outward)}
        </g>
      );
    }
    // free edge
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

  // Normal direction for each edge to push hatch outward
  // Edge 0 left → outward = left (-x), edge 1 right → outward = right (+x)
  // Edge 2 top  → outward = up (-y),   edge 3 bottom → outward = down (+y)
  // The hatchLines perp vector for vertical edges: u=(0,1) → perp=(-1,0) → outward for left edge
  // For right edge, u=(0,1) → perp=(-1,0) which points left (inward), so flip it
  // For top edge, u=(1,0) → perp=(0,1) which points down (inward), so flip it
  // For bottom edge, u=(1,0) → perp=(0,1) which points down (outward), ok

  // Build edge paths: x1,y1 → x2,y2 and outward flag
  const edgeData: { x1: number; y1: number; x2: number; y2: number; outward: boolean }[] = [
    { x1: x0, y1: y0, x2: x0, y2: y0 + h, outward: true },   // left → outward is left
    { x1: x0 + w, y1: y0, x2: x0 + w, y2: y0 + h, outward: false }, // right → outward is right (flip)
    { x1: x0, y1: y0, x2: x0 + w, y2: y0, outward: false },   // top → outward is up (flip)
    { x1: x0, y1: y0 + h, x2: x0 + w, y2: y0 + h, outward: true },  // bottom → outward is down
  ];

  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex flex-col items-center">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
        Planta
      </span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Slab outline — no fill */}
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          fill="none"
          stroke="#4a4a6a"
          strokeWidth={1.5}
          rx={2}
        />
        {/* Edges */}
        {edges.map((edge, i) => (
          <g key={i}>
            {edgeSymbol(edge, edgeData[i].x1, edgeData[i].y1, edgeData[i].x2, edgeData[i].y2, edgeData[i].outward)}
          </g>
        ))}
        {/* Slab type symbol */}
        {(() => {
          const cx = x0 + w / 2;
          const cy = y0 + h / 2;
          const r = Math.min(w, h) * 0.15;
          if (slabType === "crossed") {
            // Circle with cross — both lines extend past the circle
            return (
              <g opacity={0.4}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth={2} />
                <line x1={cx - r * 1.6} y1={cy} x2={cx + r * 1.6} y2={cy} stroke="#fbbf24" strokeWidth={2} />
                <line x1={cx} y1={cy - r * 1.6} x2={cx} y2={cy + r * 1.6} stroke="#fbbf24" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "oneway-x") {
            // Circle with horizontal line (armor in X direction)
            return (
              <g opacity={0.4}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth={2} />
                <line x1={cx - r * 1.8} y1={cy} x2={cx + r * 1.8} y2={cy} stroke="#fbbf24" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "oneway-y") {
            // Circle with vertical line (armor in Y direction)
            return (
              <g opacity={0.4}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth={2} />
                <line x1={cx} y1={cy - r * 1.8} x2={cx} y2={cy + r * 1.8} stroke="#fbbf24" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "cantilever-right") {
            // Support on left, semicircle points right
            const d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r}`;
            return (
              <g opacity={0.4}>
                <path d={d} fill="none" stroke="#f87171" strokeWidth={2} />
                <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#f87171" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "cantilever-left") {
            // Support on right, semicircle points left
            const d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`;
            return (
              <g opacity={0.4}>
                <path d={d} fill="none" stroke="#f87171" strokeWidth={2} />
                <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#f87171" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "cantilever-bottom") {
            // Support on top, semicircle points down
            const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
            return (
              <g opacity={0.4}>
                <path d={d} fill="none" stroke="#f87171" strokeWidth={2} />
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#f87171" strokeWidth={2} />
              </g>
            );
          }
          if (slabType === "cantilever-top") {
            // Support on bottom, semicircle points up
            const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
            return (
              <g opacity={0.4}>
                <path d={d} fill="none" stroke="#f87171" strokeWidth={2} />
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#f87171" strokeWidth={2} />
              </g>
            );
          }
          return null;
        })()}
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
          <span className="inline-block w-4 h-0.5 bg-[#9090b0]" /> Articulado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#7c8aff]" /> Continuo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-[#4ade80]" style={{ borderTop: "2px dashed #4ade80", height: 0 }} /> Libre
        </span>
      </div>
    </div>
  );
}
