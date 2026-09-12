// Dibujo del cabezal sobre pilotes: planta y elevación con el modelo de
// bielas (línea punteada de marca) y tirantes (línea llena de marca), según
// el tipo: rect2 (2 pilotes), linea3 (3 en línea) y triangulo (3 en triángulo).
const INK = "var(--color-text)";
const DIM = "var(--color-text-muted)";
const BRAND = "var(--color-brand)";

function Caption({ text }: { text: string }) {
  return (
    <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted">
      {text}
    </p>
  );
}

function Pile({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="none" stroke={INK} strokeWidth="1.4" />
      <circle
        cx={x}
        cy={y}
        r={Math.max(1.2, r * 0.28)}
        fill={INK}
        fillOpacity="0.55"
      />
    </>
  );
}

function DimH({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
}) {
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM} strokeWidth="1" />
      <line
        x1={x1}
        y1={y - 4}
        x2={x1}
        y2={y + 4}
        stroke={DIM}
        strokeWidth="1"
      />
      <line
        x1={x2}
        y1={y - 4}
        x2={x2}
        y2={y + 4}
        stroke={DIM}
        strokeWidth="1"
      />
      <text
        x={(x1 + x2) / 2}
        y={y - 5}
        fontSize="9"
        fill={DIM}
        textAnchor="middle"
      >
        {label}
      </text>
    </>
  );
}

function DimV({
  y1,
  y2,
  x,
  label,
}: {
  y1: number;
  y2: number;
  x: number;
  label: string;
}) {
  return (
    <>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM} strokeWidth="1" />
      <line
        x1={x - 4}
        y1={y1}
        x2={x + 4}
        y2={y1}
        stroke={DIM}
        strokeWidth="1"
      />
      <line
        x1={x - 4}
        y1={y2}
        x2={x + 4}
        y2={y2}
        stroke={DIM}
        strokeWidth="1"
      />
      <text
        x={x - 6}
        y={(y1 + y2) / 2}
        fontSize="9"
        fill={DIM}
        textAnchor="middle"
        transform={`rotate(-90 ${x - 6} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </>
  );
}

/** Planta de los cabezales rectangulares (2 pilotes o 3 en línea). */
function PlantaRect({
  L1,
  L2,
  cx,
  cy,
  Dp,
  s,
  n,
}: {
  L1: number;
  L2: number;
  cx: number;
  cy: number;
  Dp: number;
  s: number;
  n: number;
}) {
  const k = Math.min(250 / L1, 95 / L2);
  const capW = L1 * k;
  const capH = L2 * k;
  const x0 = (320 - capW) / 2;
  const y0 = 28 + (95 - capH) / 2;
  const xc = 160;
  const yc = y0 + capH / 2;
  const offs = n === 2 ? [-s / 2, s / 2] : [-s, 0, s];
  const pileXs = offs.map((o) => xc + o * k);
  const rPile = Math.max(2.5, (Dp * k) / 2);
  return (
    <svg
      viewBox="0 0 320 190"
      className="w-full"
      role="img"
      aria-label="Planta del cabezal"
    >
      <rect
        x={x0}
        y={y0}
        width={capW}
        height={capH}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
      />
      {pileXs.map((px) => (
        <Pile key={px} x={px} y={yc} r={rPile} />
      ))}
      <rect
        x={xc - (cx * k) / 2}
        y={yc - (cy * k) / 2}
        width={cx * k}
        height={cy * k}
        fill={BRAND}
        fillOpacity="0.8"
      />
      <line
        x1={pileXs[0]}
        y1={yc}
        x2={pileXs[pileXs.length - 1]}
        y2={yc}
        stroke={BRAND}
        strokeWidth="2.2"
        strokeDasharray="6 3"
      />
      <DimH
        x1={x0}
        x2={x0 + capW}
        y={y0 + capH + 14}
        label={`Lx ${Math.round(L1)}`}
      />
      <DimV y1={y0} y2={y0 + capH} x={x0 - 10} label={`Ly ${Math.round(L2)}`} />
      {n === 2 ? (
        <DimH
          x1={pileXs[0]}
          x2={pileXs[1]}
          y={yc + rPile + 12}
          label={`s ${Math.round(s)}`}
        />
      ) : (
        <>
          <DimH
            x1={pileXs[0]}
            x2={pileXs[1]}
            y={yc + rPile + 12}
            label={`s ${Math.round(s)}`}
          />
          <DimH x1={pileXs[1]} x2={pileXs[2]} y={yc + rPile + 12} label="" />
        </>
      )}
      <text
        x={pileXs[0] + rPile + 4}
        y={yc - rPile + 2}
        fontSize="9"
        fill={DIM}
      >
        Ø{Math.round(Dp)}
      </text>
    </svg>
  );
}

/** Planta del cabezal triangular (3 pilotes en los vértices de un triángulo
 *  equilátero concéntrico de lado s). */
function PlantaTriangulo({
  lado,
  cx,
  cy,
  Dp,
  s,
}: {
  lado: number;
  cx: number;
  cy: number;
  Dp: number;
  s: number;
}) {
  const k = Math.min(230 / lado, 125 / lado);
  const Ht = (lado * Math.sqrt(3) * k) / 2;
  const x0 = 160;
  const yTop = 24;
  const V = [
    [x0, yTop],
    [x0 - (lado * k) / 2, yTop + Ht],
    [x0 + (lado * k) / 2, yTop + Ht],
  ];
  const G: [number, number] = [x0, yTop + (Ht * 2) / 3];
  const f = s / lado;
  const P = V.map(([vx, vy]) => [
    G[0] + (vx - G[0]) * f,
    G[1] + (vy - G[1]) * f,
  ]);
  const rPile = Math.max(3, (Dp * k) / 2);
  return (
    <svg
      viewBox="0 0 320 200"
      className="w-full"
      role="img"
      aria-label="Planta del cabezal triangular"
    >
      <polygon
        points={V.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
      />
      {P.map(([px, py]) => (
        <Pile key={px} x={px} y={py} r={rPile} />
      ))}
      <polygon
        points={P.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={BRAND}
        strokeWidth="2.2"
        strokeDasharray="6 3"
      />
      <rect
        x={G[0] - (cx * k) / 2}
        y={G[1] - (cy * k) / 2}
        width={cx * k}
        height={cy * k}
        fill={BRAND}
        fillOpacity="0.8"
      />
      <DimH
        x1={V[1][0]}
        x2={V[2][0]}
        y={V[1][1] + 16}
        label={`Lado ${Math.round(lado)}`}
      />
      <DimH
        x1={P[1][0]}
        x2={P[2][0]}
        y={P[1][1] + rPile + 4}
        label={`s ${Math.round(s)}`}
      />
      <text x={P[0][0] + rPile + 4} y={P[0][1] + 3} fontSize="9" fill={DIM}>
        Ø{Math.round(Dp)}
      </text>
    </svg>
  );
}

/** Elevación: sección por el eje de pilotes con bielas y tirante. */
function Elevacion({
  L1,
  cx,
  Dp,
  s,
  h,
  d,
  n,
}: {
  L1: number;
  cx: number;
  Dp: number;
  s: number;
  h: number;
  d: number;
  n: number;
}) {
  const k = Math.min(240 / L1, 145 / (2.5 * h));
  const capW = L1 * k;
  const capH = h * k;
  const x0 = (320 - capW) / 2;
  const xc = 160;
  const capTop = 18 + 0.55 * h * k;
  const capBot = capTop + capH;
  const colH = 0.55 * h * k;
  const pileTop = capBot;
  const pileH = 0.85 * h * k;
  const rPile = Math.max(2.5, (Dp * k) / 2);
  const offs = n === 2 ? [-s / 2, s / 2] : [-s, 0, s];
  const pileXs = offs.map((o) => xc + o * k);
  const yTie = capTop + Math.min(d, h * 0.95) * k;
  return (
    <svg
      viewBox="0 0 320 190"
      className="w-full"
      role="img"
      aria-label="Elevación del cabezal"
    >
      <rect
        x={xc - (cx * k) / 2}
        y={capTop - colH}
        width={cx * k}
        height={colH}
        fill={BRAND}
        fillOpacity="0.8"
      />
      <text
        x={xc}
        y={capTop - colH / 2 + 3}
        fontSize="9"
        fill="var(--color-surface)"
        textAnchor="middle"
      >
        Columna
      </text>
      <rect
        x={x0}
        y={capTop}
        width={capW}
        height={capH}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
      />
      {pileXs.map((px) => (
        <rect
          key={px}
          x={px - rPile}
          y={pileTop}
          width={rPile * 2}
          height={pileH}
          fill="none"
          stroke={INK}
          strokeWidth="1.2"
          strokeDasharray="4 2"
        />
      ))}
      {pileXs.map((px) => (
        <line
          key={`biela-${px}`}
          x1={xc}
          y1={capTop}
          x2={px}
          y2={yTie}
          stroke={BRAND}
          strokeWidth="1.4"
          strokeDasharray="5 3"
        />
      ))}
      <line
        x1={pileXs[0]}
        y1={yTie}
        x2={pileXs[pileXs.length - 1]}
        y2={yTie}
        stroke={BRAND}
        strokeWidth="2.2"
      />
      <DimV
        y1={capTop}
        y2={capBot}
        x={x0 + capW + 12}
        label={`h ${Math.round(h)}`}
      />
      <DimV
        y1={capTop}
        y2={yTie}
        x={x0 + capW + 34}
        label={`d ${Math.round(d)}`}
      />
      {pileXs.length > 1 && (
        <DimH
          x1={pileXs[0]}
          x2={pileXs[1]}
          y={pileTop + pileH + 12}
          label={`s ${Math.round(s)}`}
        />
      )}
      <text
        x={x0 - 8}
        y={capTop + capH / 2}
        fontSize="9"
        fill={DIM}
        textAnchor="end"
      >
        Cabezal
      </text>
    </svg>
  );
}

export default function PileCapDiagram({
  tipo,
  cx,
  cy,
  Dp,
  s,
  L1,
  L2,
  h,
  d,
}: {
  tipo: "rect2" | "linea3" | "triangulo";
  cx: number;
  cy: number;
  Dp: number;
  s: number;
  L1: number;
  L2: number;
  h: number;
  d: number;
}) {
  if (!(L1 > 0 && h > 0 && Dp > 0 && s > 0 && cx > 0 && cy > 0)) {
    return (
      <p className="py-8 text-center text-xs text-text-muted">
        Completá las dimensiones para ver el dibujo.
      </p>
    );
  }
  const n = tipo === "rect2" ? 2 : 3;
  return (
    <div className="flex flex-col gap-3">
      <div>
        {tipo === "triangulo" ? (
          <PlantaTriangulo lado={L1} cx={cx} cy={cy} Dp={Dp} s={s} />
        ) : (
          <PlantaRect L1={L1} L2={L2} cx={cx} cy={cy} Dp={Dp} s={s} n={n} />
        )}
        <Caption text="Planta" />
      </div>
      <div>
        <Elevacion L1={L1} cx={cx} Dp={Dp} s={s} h={h} d={d} n={n} />
        <Caption text="Elevación — bielas (punteado) y tirante (lleno)" />
      </div>
    </div>
  );
}
