// Esquemas acotados del cartel (vista lateral y vista frontal) para el
// formulario. SVG puro, se redibuja con los valores vivos del estado para que
// se vea qué significa cada parámetro (h_col, a_col, despegue, puntal, etc.).
// Colores fijos: mismos que usan los íconos de tipo de columna del form.

const C_CHORD = "#fbbf24"; // cordones
const C_DIAG = "#f87171"; // diagonales
const C_MONT = "#4ade80"; // montantes
const C_BRACE = "#7c8aff"; // puntal
const C_DIM = "#9090b0"; // cotas y terreno
const C_SIGN_FILL = "#2a2a3c";
const C_SIGN_STROKE = "#9090b0";

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Texto de cota con subíndice: "h" + "col" + " = 0.60". */
function DimText({
  x,
  y,
  base,
  sub,
  value,
  rotate = 0,
  size = 9,
  anchor = "middle",
}: {
  x: number;
  y: number;
  base: string;
  sub?: string;
  value?: string;
  rotate?: number;
  size?: number;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={C_DIM}
      textAnchor={anchor}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {base}
      {sub && (
        <tspan fontSize={size - 2.5} dy={2}>
          {sub}
        </tspan>
      )}
      {value !== undefined && <tspan dy={sub ? -2 : 0}> = {value}</tspan>}
    </text>
  );
}

/** Cota vertical con ticks en los extremos (x en px, y en px, y1 abajo). */
function VDim({
  x,
  yBottom,
  yTop,
  base,
  sub,
  value,
}: {
  x: number;
  yBottom: number;
  yTop: number;
  base: string;
  sub?: string;
  value?: string;
}) {
  const tick = 3.5;
  const ym = (yBottom + yTop) / 2;
  return (
    <g>
      <line
        x1={x}
        y1={yBottom}
        x2={x}
        y2={yTop}
        stroke={C_DIM}
        strokeWidth="0.7"
      />
      <line
        x1={x - tick}
        y1={yBottom}
        x2={x + tick}
        y2={yBottom}
        stroke={C_DIM}
        strokeWidth="0.7"
      />
      <line
        x1={x - tick}
        y1={yTop}
        x2={x + tick}
        y2={yTop}
        stroke={C_DIM}
        strokeWidth="0.7"
      />
      <DimText
        x={x - 3}
        y={ym}
        base={base}
        sub={sub}
        value={value}
        rotate={-90}
      />
    </g>
  );
}

/** Cota horizontal con ticks en los extremos. */
function HDim({
  y,
  x1,
  x2,
  base,
  sub,
  value,
}: {
  y: number;
  x1: number;
  x2: number;
  base: string;
  sub?: string;
  value?: string;
}) {
  const tick = 3.5;
  const xm = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={C_DIM} strokeWidth="0.7" />
      <line
        x1={x1}
        y1={y - tick}
        x2={x1}
        y2={y + tick}
        stroke={C_DIM}
        strokeWidth="0.7"
      />
      <line
        x1={x2}
        y1={y - tick}
        x2={x2}
        y2={y + tick}
        stroke={C_DIM}
        strokeWidth="0.7"
      />
      <DimText x={xm} y={y - 3} base={base} sub={sub} value={value} />
    </g>
  );
}

/** Línea de extensión desde un punto de la pieza hasta la línea de cota. */
function Ext({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={C_DIM}
      strokeWidth="0.5"
      strokeDasharray="2 2"
    />
  );
}

/** Línea de suelo con rayado. */
function Ground({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const hatches = [];
  for (let x = x1; x <= x2; x += 9) {
    hatches.push(
      <line
        key={x}
        x1={x}
        y1={y}
        x2={x - 5}
        y2={y + 6}
        stroke={C_DIM}
        strokeWidth="0.6"
      />,
    );
  }
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={C_DIM} strokeWidth="1.2" />
      {hatches}
    </g>
  );
}

export function CartelLateralScheme({
  altoCartel,
  despegue,
  hCol,
  aCol,
  tipoColumna,
  tienePuntal,
  hPuntal,
  dPuntal,
}: {
  altoCartel: number;
  despegue: number;
  hCol: number;
  aCol: number;
  tipoColumna: number;
  tienePuntal: boolean;
  hPuntal: number;
  dPuntal: number;
}) {
  const hc = Math.max(hCol, 0.2);
  const H = Math.max(despegue, 0) + Math.max(altoCartel, 0.3);
  const dp = tienePuntal ? Math.max(dPuntal, 0.2) : 0;

  const isLattice = tipoColumna !== 1;
  const nPaneles = aCol > 0 ? Math.ceil(H / aCol) : 1;
  const panelH = H / nPaneles;
  const signW = Math.min(hc * 0.5, 0.45);

  // Mundo (m): x=0 en el eje de columna, z=0 en el suelo.
  const xMin = -(hc / 2) - 1.35;
  const xMax = Math.max(hc / 2, dp) + 0.85;
  const VW = 330;
  const VH = 300;
  const padT = 18;
  const padB = dp > 0 ? 30 : 14;
  const s = Math.min((VW - 24) / (xMax - xMin), (VH - padT - padB) / H);
  const X0 = 12 + -xMin * s; // px del eje de columna
  const Y0 = VH - padB; // px del suelo
  const px = (m: number) => X0 + m * s;
  const py = (z: number) => Y0 - z * s;

  const xL = px(-hc / 2);
  const xR = px(hc / 2);
  const rail1 = px(-hc / 2 - 0.45); // cota despegue
  const rail2 = px(-hc / 2 - 1.05); // cota h_puntal
  const dimA = xR + 0.3 * s; // cota a_col
  const dimAlto = xR + 0.85 * s; // cota alto cartel

  // Panel del cartel (franja vista de canto)
  const signTop = py(despegue + Math.max(altoCartel, 0));
  const signBot = py(despegue);

  const diagonals = [];
  const montantes = [];
  if (isLattice) {
    for (let i = 0; i <= nPaneles; i++) {
      const z = i * panelH;
      montantes.push(
        <line
          key={`m${i}`}
          x1={xL}
          y1={py(z)}
          x2={xR}
          y2={py(z)}
          stroke={C_MONT}
          strokeWidth="1"
        />,
      );
    }
    for (let i = 0; i < nPaneles; i++) {
      const z1 = i * panelH;
      const z2 = z1 + panelH;
      const left = i % 2 === 0;
      diagonals.push(
        <line
          key={`d${i}`}
          x1={left ? xL : xR}
          y1={py(z1)}
          x2={left ? xR : xL}
          y2={py(z2)}
          stroke={C_DIAG}
          strokeWidth="1"
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={VW}
      height={VH}
      className="max-w-full h-auto"
      role="img"
      aria-label="Vista lateral del cartel con cotas"
    >
      <Ground x1={px(xMin + 0.1)} x2={px(xMax - 0.1)} y={Y0} />

      {/* Columna */}
      {isLattice ? (
        <g>
          <line
            x1={xL}
            y1={Y0}
            x2={xL}
            y2={py(H)}
            stroke={C_CHORD}
            strokeWidth="2.6"
          />
          <line
            x1={xR}
            y1={Y0}
            x2={xR}
            y2={py(H)}
            stroke={C_CHORD}
            strokeWidth="2.6"
          />
          {tipoColumna === 4 && (
            <line
              x1={X0}
              y1={Y0}
              x2={X0}
              y2={py(H)}
              stroke={C_CHORD}
              strokeWidth="1.6"
              strokeDasharray="4 3"
            />
          )}
          {montantes}
          {diagonals}
        </g>
      ) : (
        <rect
          x={X0 - 3}
          y={py(H)}
          width={6}
          height={H * s}
          fill="none"
          stroke={C_CHORD}
          strokeWidth="2"
        />
      )}

      {/* Panel del cartel (canto) */}
      <rect
        x={X0 - (signW / 2) * s}
        y={signTop}
        width={signW * s}
        height={signBot - signTop}
        fill={C_SIGN_FILL}
        stroke={C_SIGN_STROKE}
        strokeWidth="1"
      />

      {/* Puntal */}
      {tienePuntal && (
        <g>
          <line
            x1={X0}
            y1={py(Math.min(hPuntal, H))}
            x2={px(dp)}
            y2={Y0}
            stroke={C_BRACE}
            strokeWidth="2.2"
          />
          <circle
            cx={X0}
            cy={py(Math.min(hPuntal, H))}
            r="2.4"
            fill={C_BRACE}
          />
          <polygon
            points={`${px(dp)},${Y0 - 1} ${px(dp) - 5},${Y0 + 7} ${px(dp) + 5},${Y0 + 7}`}
            fill="none"
            stroke={C_BRACE}
            strokeWidth="1.4"
          />
        </g>
      )}

      {/* Cotas */}
      {/* despegue */}
      <Ext x1={xL} y1={Y0} x2={rail1} y2={Y0} />
      <Ext x1={X0 - (signW / 2) * s} y1={signBot} x2={rail1} y2={signBot} />
      <VDim
        x={rail1}
        yBottom={Y0}
        yTop={signBot}
        base="d"
        sub="espegue"
        value={fmt(despegue)}
      />
      {/* alto cartel */}
      <Ext x1={X0 + (signW / 2) * s} y1={signTop} x2={dimAlto} y2={signTop} />
      <VDim
        x={dimAlto}
        yBottom={signBot}
        yTop={signTop}
        base="h"
        sub="c"
        value={fmt(altoCartel)}
      />
      {/* h_col y a_col (reticulado) */}
      {isLattice && (
        <g>
          <HDim
            y={py(H) - 0.28 * s}
            x1={xL}
            x2={xR}
            base="h"
            sub="col"
            value={fmt(hCol)}
          />
          <Ext x1={xR} y1={py(panelH)} x2={dimA} y2={py(panelH)} />
          <Ext x1={xR} y1={py(2 * panelH)} x2={dimA} y2={py(2 * panelH)} />
          <VDim
            x={dimA}
            yBottom={py(panelH)}
            yTop={py(2 * panelH)}
            base="a"
            sub="col"
            value={fmt(aCol)}
          />
        </g>
      )}
      {/* puntal */}
      {tienePuntal && (
        <g>
          <Ext
            x1={X0}
            y1={py(Math.min(hPuntal, H))}
            x2={rail2}
            y2={py(Math.min(hPuntal, H))}
          />
          <VDim
            x={rail2}
            yBottom={Y0}
            yTop={py(Math.min(hPuntal, H))}
            base="h"
            sub="puntal"
            value={fmt(hPuntal)}
          />
          <HDim
            y={Y0 + 0.32 * s}
            x1={X0}
            x2={px(dp)}
            base="d"
            sub="puntal"
            value={fmt(dPuntal)}
          />
        </g>
      )}
    </svg>
  );
}

export function CartelFrontalScheme({
  anchoCartel,
  altoCartel,
  despegue,
  cantColumnas,
  vueloLateral,
  sepColumnas,
  sepCorreas,
}: {
  anchoCartel: number;
  altoCartel: number;
  despegue: number;
  cantColumnas: number;
  vueloLateral: number;
  sepColumnas: number;
  sepCorreas: number;
}) {
  const A = Math.max(anchoCartel, 0.5);
  const hAlto = Math.max(altoCartel, 0.3);
  const des = Math.max(despegue, 0);
  const H = des + hAlto;
  const n = Math.max(Math.round(cantColumnas), 1);
  const sep = n > 1 ? sepColumnas : 0;
  const vuelo = n > 1 ? Math.max(vueloLateral, 0) : 0;

  // Columnas: x_i = vuelo + i·sep (n=1 → centrada)
  const colX = (i: number) => (n === 1 ? A / 2 : vuelo + i * sep);

  const VW = 330;
  const VH = 300;
  const padL = 14,
    padT = 30,
    padB = sep > 0 ? 34 : 14;
  const s = Math.min((VW - padL - 14) / A, (VH - padT - padB) / H);
  const X0 = padL;
  const Y0 = VH - padB;
  const px = (m: number) => X0 + m * s;
  const py = (z: number) => Y0 - z * s;

  const panelTop = py(H);
  const panelBot = py(des);

  // Correas: líneas horizontales dentro del panel
  const correas = [];
  const nCorreas = sepCorreas > 0 ? Math.floor(hAlto / sepCorreas) : 0;
  for (let k = 1; k <= nCorreas; k++) {
    const z = des + k * sepCorreas;
    if (z < H - 1e-6) {
      correas.push(
        <line
          key={`c${k}`}
          x1={px(0)}
          y1={py(z)}
          x2={px(A)}
          y2={py(z)}
          stroke={C_MONT}
          strokeWidth="0.9"
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={VW}
      height={VH}
      className="max-w-full h-auto"
      role="img"
      aria-label="Vista frontal del cartel con cotas"
    >
      <Ground x1={px(-0.2)} x2={px(A + 0.2)} y={Y0} />

      {/* Columnas: visibles bajo el panel, punteadas detrás */}
      {Array.from({ length: n }, (_, i) => {
        const x = px(colX(i));
        return (
          <g key={i}>
            <line
              x1={x}
              y1={Y0}
              x2={x}
              y2={panelBot}
              stroke={C_CHORD}
              strokeWidth="2.4"
            />
            <line
              x1={x}
              y1={panelBot}
              x2={x}
              y2={panelTop}
              stroke={C_CHORD}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </g>
        );
      })}

      {/* Panel */}
      <rect
        x={px(0)}
        y={panelTop}
        width={A * s}
        height={panelBot - panelTop}
        fill={C_SIGN_FILL}
        stroke={C_SIGN_STROKE}
        strokeWidth="1.1"
      />
      {correas}

      {/* Cotas */}
      {/* ancho total (arriba) */}
      <HDim
        y={panelTop - 0.34 * s}
        x1={px(0)}
        x2={px(A)}
        base="ancho"
        value={fmt(anchoCartel)}
      />
      {/* vuelo lateral (segundo riel superior) */}
      {n > 1 && (
        <g>
          <HDim
            y={panelTop - 0.85 * s}
            x1={px(0)}
            x2={px(colX(0))}
            base="vuelo"
            value={fmt(vueloLateral)}
          />
          {/* sep. columnas (debajo del suelo) */}
          <HDim
            y={Y0 + 0.32 * s}
            x1={px(colX(0))}
            x2={px(colX(1))}
            base="sep. col."
            value={fmt(sepColumnas)}
          />
        </g>
      )}
      {/* alto cartel + despegue (derecha) */}
      <VDim
        x={px(A) + 0.34 * s}
        yBottom={panelBot}
        yTop={panelTop}
        base="h"
        sub="c"
        value={fmt(altoCartel)}
      />
      <Ext x1={px(A)} y1={panelBot} x2={px(A) + 0.85 * s} y2={panelBot} />
      <VDim
        x={px(A) + 0.85 * s}
        yBottom={Y0}
        yTop={panelBot}
        base="d"
        sub="espegue"
        value={fmt(despegue)}
      />
      {/* sep. correas (entre dos correas, adentro a la derecha) */}
      {nCorreas >= 1 && sepCorreas > 0 && (
        <g>
          <Ext
            x1={px(A)}
            y1={py(des + sepCorreas)}
            x2={px(A) + 0.3 * s}
            y2={py(des + sepCorreas)}
          />
          <VDim
            x={px(A) + 0.3 * s}
            yBottom={py(des)}
            yTop={py(des + sepCorreas)}
            base="sep. corr."
            value={fmt(sepCorreas)}
          />
        </g>
      )}
      <DimText
        x={px(A) + 0.34 * s}
        y={panelTop - 6}
        base={`${n} col.`}
        anchor="start"
      />
    </svg>
  );
}
