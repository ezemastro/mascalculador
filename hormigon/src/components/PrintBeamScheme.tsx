import type { ReactElement } from "react";
import type { SupportType } from "@mascalculador/shared";

export interface PrintBeamSchemeProps {
  left: SupportType;
  right: SupportType;
}

// Span line geometry (viewBox 0 0 96 34).
const LINE_Y = 22;
const X_LEFT = 14;
const X_RIGHT = 82;

/** Draws the support symbol at `x` end, away from the span (start = left). */
function Support({
  type,
  x,
  start,
}: {
  type: SupportType;
  x: number;
  start: boolean;
}): ReactElement | null {
  if (type === "free") return null;

  if (type === "simple") {
    const half = 3.5;
    const baseY = LINE_Y + 7;
    return (
      <polygon
        points={`${x},${LINE_Y} ${x - half},${baseY} ${x + half},${baseY}`}
        fill="#000"
      />
    );
  }

  // fixed: vertical embedment wall + 45° hatch ticks on the outside.
  const dir = start ? -1 : 1; // outside direction (left for start, right for end)
  const ticks = [16, 19, 22].map((y, i) => (
    <line
      key={i}
      x1={x}
      y1={y}
      x2={x + dir * 3}
      y2={y - 3}
      stroke="#000"
      strokeWidth={0.9}
    />
  ));
  return (
    <g>
      <line x1={x} y1={13} x2={x} y2={31} stroke="#000" strokeWidth={1.6} />
      {ticks}
    </g>
  );
}

/** Compact black-and-white beam static-scheme for the print sheet. Pure SVG. */
export default function PrintBeamScheme({ left, right }: PrintBeamSchemeProps) {
  return (
    <svg
      className="beam-scheme"
      viewBox="0 0 96 34"
      aria-hidden="true"
      focusable={false}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={96} height={34} fill="#fff" />
      <line
        x1={X_LEFT}
        y1={LINE_Y}
        x2={X_RIGHT}
        y2={LINE_Y}
        stroke="#000"
        strokeWidth={1.6}
      />
      <Support type={left} x={X_LEFT} start={true} />
      <Support type={right} x={X_RIGHT} start={false} />
    </svg>
  );
}
