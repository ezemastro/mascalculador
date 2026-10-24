import type { ReactElement } from "react";
import type { EdgeCondition } from "@mascalculador/shared";

export interface PrintSlabPlanProps {
  lx: number;
  ly: number;
  edges: [EdgeCondition, EdgeCondition, EdgeCondition, EdgeCondition];
}

const PAD = 9;
const VB_W = 72;
const VB_H = 58;
const INNER_W = VB_W - PAD * 2; // 54
const INNER_H = VB_H - PAD * 2; // 40

interface EdgeProps {
  type: EdgeCondition;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Outward normal (unit length). */
  nx: number;
  ny: number;
}

/** Draws one slab edge: a line plus the support symbol for its condition. */
function Edge({ type, ax, ay, bx, by, nx, ny }: EdgeProps): ReactElement {
  const len = Math.hypot(bx - ax, by - ay);
  const ux = len > 0 ? (bx - ax) / len : 0;
  const uy = len > 0 ? (by - ay) / len : 0;
  // Perpendicular to the outward normal, used for triangle base width.
  const perpX = -ny;
  const perpY = nx;

  const line = (
    <line
      x1={ax}
      y1={ay}
      x2={bx}
      y2={by}
      stroke="#000"
      strokeWidth={type === "continuo" ? 2.2 : type === "free" ? 0.9 : 1}
      strokeDasharray={type === "free" ? "3 2" : undefined}
    />
  );

  if (type === "simple") {
    const tris = [0.25, 0.5, 0.75].map((t, i) => {
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const size = 3;
      const half = 1.5;
      const baseX = px + nx * size;
      const baseY = py + ny * size;
      const p1x = baseX + perpX * half;
      const p1y = baseY + perpY * half;
      const p2x = baseX - perpX * half;
      const p2y = baseY - perpY * half;
      return (
        <polygon
          key={i}
          points={`${px},${py} ${p1x},${p1y} ${p2x},${p2y}`}
          fill="#000"
        />
      );
    });
    return (
      <g>
        {line}
        {tris}
      </g>
    );
  }

  if (type === "continuo") {
    const ticks: ReactElement[] = [];
    const step = 5;
    for (let d = 2.5; d < len - 1; d += step) {
      const px = ax + (bx - ax) * (d / len);
      const py = ay + (by - ay) * (d / len);
      // 45° outward tick: move outward and along the edge by the same amount.
      const ex = px + nx * 2.5 - ux * 2.5;
      const ey = py + ny * 2.5 - uy * 2.5;
      ticks.push(
        <line
          key={ticks.length}
          x1={px}
          y1={py}
          x2={ex}
          y2={ey}
          stroke="#000"
          strokeWidth={0.9}
        />,
      );
    }
    return (
      <g>
        {line}
        {ticks}
      </g>
    );
  }

  return line;
}

/** Compact black-and-white slab plan for the print sheet. Pure SVG, no chrome. */
export default function PrintSlabPlan({ lx, ly, edges }: PrintSlabPlanProps) {
  if (!(lx > 0) || !(ly > 0)) return null;

  const s = Math.min(INNER_W / lx, INNER_H / ly);
  const w = lx * s;
  const h = ly * s;
  const x0 = PAD + (INNER_W - w) / 2;
  const y0 = PAD + (INNER_H - h) / 2;
  const x1 = x0 + w;
  const y1 = y0 + h;

  return (
    <svg
      className="slab-plan"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      aria-hidden="true"
      focusable={false}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#fff" />
      {/* Edge order: left, right, top, bottom */}
      <Edge type={edges[0]} ax={x0} ay={y0} bx={x0} by={y1} nx={-1} ny={0} />
      <Edge type={edges[1]} ax={x1} ay={y0} bx={x1} by={y1} nx={1} ny={0} />
      <Edge type={edges[2]} ax={x0} ay={y0} bx={x1} by={y0} nx={0} ny={-1} />
      <Edge type={edges[3]} ax={x0} ay={y1} bx={x1} by={y1} nx={0} ny={1} />
    </svg>
  );
}
