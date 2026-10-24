import type { ReactElement } from "react";
import type { BaseType } from "../lib/bases-calc";

export interface PrintBasePlanProps {
  type: BaseType;
  Lx: number;
  Ly: number;
  cx: number;
  cy: number;
}

const VB_W = 76;
const VB_H = 56;
const PAD = 6;
const INNER_W = VB_W - PAD * 2; // 64
const INNER_H = VB_H - PAD * 2; // 44

/** Compact black-and-white base plan for the print sheet. Pure SVG, no chrome:
 *  the footing outline and the column positioned by base type. */
export default function PrintBasePlan({
  type,
  Lx,
  Ly,
  cx,
  cy,
}: PrintBasePlanProps): ReactElement | null {
  if (!(Lx > 0) || !(Ly > 0) || !(cx > 0) || !(cy > 0)) return null;

  const s = Math.min(INNER_W / Lx, INNER_H / Ly);
  const w = Lx * s;
  const h = Ly * s;
  const fx0 = PAD + (INNER_W - w) / 2;
  const fy0 = PAD + (INNER_H - h) / 2;
  const fy1 = fy0 + h;

  // Column size, clamped to the footing so it never overflows the drawing.
  const cw = Math.min(cx * s, w);
  const ch = Math.min(cy * s, h);

  let cx0: number;
  let cy0: number;
  const effType: BaseType = type === "medianera" ? "medianera-y" : type;
  switch (effType) {
    case "medianera-y":
      cx0 = fx0; // flush to the left edge
      cy0 = fy0 + (h - ch) / 2; // vertically centered
      break;
    case "medianera-x":
      cx0 = fx0 + (w - cw) / 2; // horizontally centered
      cy0 = fy1 - ch; // flush to the bottom edge
      break;
    case "esquina":
      cx0 = fx0; // flush to the top-left corner
      cy0 = fy0;
      break;
    case "centrada":
    default:
      cx0 = fx0 + (w - cw) / 2; // centered in both directions
      cy0 = fy0 + (h - ch) / 2;
      break;
  }

  return (
    <svg
      className="base-plan"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      aria-hidden="true"
      focusable={false}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#fff" />
      <rect
        x={fx0}
        y={fy0}
        width={w}
        height={h}
        fill="none"
        stroke="#000"
        strokeWidth={1.2}
      />
      <rect x={cx0} y={cy0} width={cw} height={ch} fill="#000" />
    </svg>
  );
}
