// Pantalla de resultados del muro de contención. El dimensionamiento se calcula
// en designMuro (muro-calc.ts) a partir del input que llega por router state.
// Acá solo se muestran las verificaciones, la armadura propuesta y el cómputo.
import { useMemo, useState } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { useLocation, useNavigate, Link } from "react-router";
import { MainLayout, PrintButton } from "@mascalculador/shared";
import { designMuro } from "../lib/muro-calc";
import type {
  MuroInput,
  MuroResult,
  MuroBarSelection,
  MuroAdopcion,
  MuroAdopcionGrupo,
} from "../lib/muro-calc";
import { saveBeam, updateSave } from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import { computoMuro } from "../lib/computo";
import ComputoSection from "../components/ComputoSection";

interface LocationState {
  input: MuroInput;
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
        ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {ok ? "✓ OK" : "✗ FALLA"}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="section-title mb-4">{children}</h2>;
}

function DataCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      <span
        className="text-xs text-text-muted"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <p className="text-lg font-bold text-primary mt-0.5">{value}</p>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  );
}

function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

/** Ø comerciales de barras (tabique/zapata) y de estribos. */
const DIAMS_BAR = [8, 10, 12, 16, 20, 25, 32];
const DIAMS_ESTRIBO = [6, 8, 10, 12];

/** Escribe/borra la adopción manual de un grupo en el input del motor. */
function applyAdopcion(
  setInput: React.Dispatch<React.SetStateAction<MuroInput | null>>,
  grupo: keyof MuroAdopcion,
  val?: MuroAdopcionGrupo,
) {
  setInput((p) => {
    if (!p) return p;
    const a = { ...(p.adopcion ?? {}) };
    if (val) a[grupo] = val;
    else delete a[grupo];
    return { ...p, adopcion: a };
  });
}

/** Editor de un grupo de flexión: desplegables Ø/sep, As provisto y Badge. */
function BarEditor({
  title,
  grupo,
  result,
  asReq,
  input,
  setInput,
}: {
  title: string;
  grupo: keyof MuroAdopcion;
  result: MuroBarSelection;
  asReq?: number;
  input: MuroInput;
  setInput: React.Dispatch<React.SetStateAction<MuroInput | null>>;
}) {
  const adopt = input.adopcion?.[grupo];
  const diam = adopt?.diam ?? result.diam;
  const sep = adopt?.sep ?? result.sep;
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">{title}</span>
        <Badge ok={result.ok ?? true} />
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-text-muted">
            Ø (mm)
          </span>
          <select
            className="w-24"
            value={diam}
            onChange={(e) =>
              applyAdopcion(setInput, grupo, {
                diam: Number(e.target.value),
                sep,
                ...(adopt?.count !== undefined ? { count: adopt.count } : {}),
                ...(adopt?.legs !== undefined ? { legs: adopt.legs } : {}),
              })
            }
          >
            {DIAMS_BAR.map((d) => (
              <option key={d} value={d}>
                Ø{d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-text-muted">
            Separación (cm)
          </span>
          <input
            type="number"
            className="w-24"
            min="1"
            step="1"
            value={sep === 0 ? "" : sep}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              applyAdopcion(setInput, grupo, {
                diam,
                sep: Number.isFinite(v) && v > 0 ? v : 0,
                ...(adopt?.count !== undefined ? { count: adopt.count } : {}),
                ...(adopt?.legs !== undefined ? { legs: adopt.legs } : {}),
              });
            }}
          />
        </label>
        <span className="text-xs text-text-muted">
          As prov{" "}
          <b className="tabular-nums text-text">{fmt(result.asProv, 2)}</b>{" "}
          cm²/m
          {asReq !== undefined && <span> (req {fmt(asReq, 2)})</span>}
        </span>
        <button
          type="button"
          onClick={() => applyAdopcion(setInput, grupo, undefined)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
        >
          ↺ Propuesta automática
        </button>
      </div>
    </div>
  );
}

/** Editor de estribos: Ø/sep/ramas, Av/s provisto vs requerido y Badge. */
function StirrupEditor({
  title,
  input,
  setInput,
  result,
  avsReq,
  avsMin,
}: {
  title: string;
  input: MuroInput;
  setInput: React.Dispatch<React.SetStateAction<MuroInput | null>>;
  result: MuroBarSelection;
  avsReq: number; // cm²/cm
  avsMin: number; // cm²/cm
}) {
  const adopt = input.adopcion?.estribo;
  const diam = adopt?.diam ?? result.diam;
  const sep = adopt?.sep ?? result.sep;
  const legs = adopt?.legs ?? result.legs ?? 2;
  const avsProv = result.asProv; // cm²/m
  const avsReqM2 = Math.max(avsReq, avsMin) * 100; // cm²/m
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">{title}</span>
        <Badge ok={result.ok ?? true} />
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-text-muted">
            Ø (mm)
          </span>
          <select
            className="w-24"
            value={diam}
            onChange={(e) =>
              applyAdopcion(setInput, "estribo", {
                diam: Number(e.target.value),
                sep,
                legs,
              })
            }
          >
            {DIAMS_ESTRIBO.map((d) => (
              <option key={d} value={d}>
                Ø{d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-text-muted">
            Separación (cm)
          </span>
          <input
            type="number"
            className="w-24"
            min="1"
            step="1"
            value={sep === 0 ? "" : sep}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              applyAdopcion(setInput, "estribo", {
                diam,
                sep: Number.isFinite(v) && v > 0 ? v : 0,
                legs,
              });
            }}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-text-muted">Ramas</span>
          <select
            className="w-20"
            value={legs}
            onChange={(e) =>
              applyAdopcion(setInput, "estribo", {
                diam,
                sep,
                legs: Number(e.target.value),
              })
            }
          >
            {[1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-text-muted">
          Av/s prov <b className="tabular-nums text-text">{fmt(avsProv, 2)}</b>{" "}
          cm²/m{" "}
          {avsReq > 0 ? (
            <span>(req {fmt(avsReqM2, 2)})</span>
          ) : (
            <span className="italic">(solo montaje)</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => applyAdopcion(setInput, "estribo", undefined)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
        >
          ↺ Propuesta automática
        </button>
      </div>
    </div>
  );
}

/** Esquema en corte del muro + zapata (para interpretar estados y presiones).
 *  Suelo retenido a la izquierda. Zapata centrada: tabique en el eje (talón
 *  bajo el relleno + puntera). Zapata excéntrica / medianera: tabique en el
 *  borde (eje medianero) y toda la zapata hacia la excavación. Con losa se
 *  dibuja la losa superior; abajo, el diagrama de presiones del suelo. */
/** Flechas de las cargas del vecino sobre el suelo retenido: Q (franja/línea
 *  paralela al muro, kN/m) y P (columna, kN), a distancia x del paramento y
 *  a profundidad D (si D > 0 se dibuja la zapata del vecino). */
function VecinoLoads({
  wallX,
  wallTop,
  scale,
  D,
  arrowL,
  Q,
  P,
  stagger,
}: {
  wallX: number;
  wallTop: number;
  scale: number;
  D: number;
  arrowL: number;
  Q: { v: number; x: number } | null;
  P: { v: number; x: number } | null;
  stagger: boolean;
}) {
  const color = "var(--color-danger, #ef4444)";
  const yLoad = wallTop + D * scale;
  const one = (
    key: string,
    load: { v: number; x: number },
    label: string,
    lift: number,
    thick: boolean,
  ) => {
    const x = wallX - load.x * scale;
    const yTop = yLoad - arrowL - lift;
    return (
      <g key={key}>
        {D > 0 && (
          <rect
            x={x - 9}
            y={yLoad}
            width={18}
            height={4}
            fill={color}
            opacity="0.5"
          />
        )}
        <line
          x1={x}
          y1={yTop}
          x2={x}
          y2={yLoad - 5}
          stroke={color}
          strokeWidth={thick ? 2.5 : 1.5}
        />
        <polygon
          points={`${x - 4},${yLoad - 6} ${x + 4},${yLoad - 6} ${x},${yLoad}`}
          fill={color}
        />
        <text x={x} y={yTop - 14} fontSize="9" textAnchor="middle" fill={color}>
          {label}
        </text>
        <text x={x} y={yTop - 4} fontSize="8" textAnchor="middle" fill={color}>
          x {fmt(load.x, 2)} m
        </text>
      </g>
    );
  };
  return (
    <>
      {D > 0 && (
        <line
          x1={wallX - Math.max(Q?.x ?? 0, P?.x ?? 0) * scale - 12}
          y1={yLoad}
          x2={wallX}
          y2={yLoad}
          stroke={color}
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />
      )}
      {Q && one("q", Q, `Q ${fmt(Q.v, 0)} kN/m`, 0, false)}
      {P && one("p", P, `P ${fmt(P.v, 0)} kN`, stagger ? 22 : 0, true)}
    </>
  );
}

function MuroSketch({ r, input }: { r: MuroResult; input: MuroInput }) {
  const H = r.H;
  const em = r.e_muro;
  const B = input.B_zap;
  const Hz = input.H_zap;
  const medianera = input.tipo_zapata === "excentrica";
  const conLosa = input.con_losa !== false;
  // Escala única (1 m ≈ 60 px) para que las proporciones sean reales.
  const scale = 60;
  const wM = Math.max(10, em * scale);
  const wB = Math.max(wM + 20, B * scale);
  const hH = Math.max(40, H * scale);
  const hZ = Math.max(14, Hz * scale);
  const losaW = 56; // tramo de losa dibujado
  const hLosa = Math.max(6, input.e_losa * scale);
  const padX = 12;

  // Cargas del vecino (del lado del suelo, a x del paramento del tabique y a
  // profundidad D bajo el coronamiento).
  const Qv = input.Q_vec ?? 0;
  const Pv = input.P_vec ?? 0;
  const xQ = Math.max(0, input.x_Q_vec ?? 0);
  const xP = Math.max(0, input.x_P_vec ?? 0);
  const Dv = Math.min(Math.max(0, input.D_vec ?? 0), H);
  const hasQ = Qv > 0;
  const hasP = Pv > 0;
  const hasVec = hasQ || hasP;
  // Si las dos flechas quedan cerca, el rótulo de P va un renglón más arriba.
  const stagger = hasQ && hasP && Math.abs(xQ - xP) * scale < 70;
  const arrowL = 20;
  const topExtra = hasVec
    ? Math.max(0, arrowL + 25 + (stagger ? 22 : 0) - Dv * scale)
    : 0;
  const padY = 22 + topExtra;
  // Franja de suelo a la izquierda: alcanza para ubicar las cargas a escala.
  const xVecMax = Math.max(hasQ ? xQ : 0, hasP ? xP : 0);
  const wallOff = medianera ? 0 : Math.max(wM + 20, B * scale) / 2 - wM / 2;
  const soilW = Math.max(46, xVecMax * scale + 30 - wallOff);
  const presH = 34; // altura máxima del diagrama de presiones
  const x0 = padX + soilW; // borde izquierdo de la zapata
  const wallX = medianera ? x0 : x0 + wB / 2 - wM / 2;
  const wallR = wallX + wM;
  const svgW = Math.max(x0 + wB, wallR + (conLosa ? losaW : 96)) + padX + 4;
  const baseY = padY + hH; // cara superior de la zapata
  const botY = baseY + hZ; // apoyo de la zapata
  const svgH = botY + presH + 30;
  const wallTop = padY;

  // Diagrama de presiones (servicio). Con losa: uniforme. Sin losa: trapecio
  // o triángulo según e (e > 0 → máximo del lado de la puntera, derecha).
  const vuelca = r.sigma_max <= 0 && !conLosa;
  const sMax = Math.max(r.sigma_max, 1e-9);
  const hOf = (s: number) => (presH * Math.max(0, s)) / sMax;
  let presPts = "";
  if (!vuelca) {
    const cont = Math.min(B, r.B_contacto || B) * scale;
    const right = r.e0 >= 0;
    const sL = right ? r.sigma_min : r.sigma_max;
    const sR = right ? r.sigma_max : r.sigma_min;
    if (cont >= wB - 0.5) {
      presPts = `${x0},${botY} ${x0 + wB},${botY} ${x0 + wB},${botY + hOf(sR)} ${x0},${botY + hOf(sL)}`;
    } else if (right) {
      const xs = x0 + wB - cont;
      presPts = `${xs},${botY} ${x0 + wB},${botY} ${x0 + wB},${botY + presH}`;
    } else {
      const xe = x0 + cont;
      presPts = `${x0},${botY} ${xe},${botY} ${x0},${botY + presH}`;
    }
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto block max-w-[340px]"
      role="img"
      aria-label="Esquema en corte del muro y la zapata"
    >
      {/* Suelo retenido (izquierda del tabique, hasta la cara superior de la zapata) */}
      <rect
        x={padX}
        y={wallTop}
        width={wallX - padX}
        height={hH}
        fill="var(--color-surface-alt, #1e293b)"
        opacity="0.35"
      />
      {/* Suelo al costado de la zapata */}
      <rect
        x={padX}
        y={baseY}
        width={x0 - padX}
        height={hZ}
        fill="var(--color-surface-alt, #1e293b)"
        opacity="0.35"
      />
      {/* Empuje activo (triángulo sobre la cara del suelo) */}
      <polygon
        points={`${wallX - 3},${wallTop + 4} ${wallX - 3},${baseY - 2} ${Math.max(padX + 2, wallX - 3 - 40)},${baseY - 2}`}
        fill="var(--color-danger, #ef4444)"
        opacity="0.22"
      />
      {/* Zapata */}
      <rect
        x={x0}
        y={baseY}
        width={wB}
        height={hZ}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Tabique */}
      <rect
        x={wallX}
        y={wallTop}
        width={wM}
        height={hH}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Losa superior */}
      {conLosa && (
        <rect
          x={wallR}
          y={wallTop}
          width={losaW}
          height={hLosa}
          fill="currentColor"
          opacity="0.35"
        />
      )}
      {!conLosa && (
        <text x={wallR + 4} y={wallTop + 10} fontSize="9" fill="currentColor">
          sin losa (voladizo)
        </text>
      )}
      {/* Eje medianero */}
      {medianera && (
        <>
          <line
            x1={x0}
            y1={wallTop - 14}
            x2={x0}
            y2={botY + presH + 6}
            stroke="var(--color-warning, #f59e0b)"
            strokeWidth="1"
            strokeDasharray="5 3"
          />
          <text x={x0 + 3} y={wallTop - 5} fontSize="9" fill="currentColor">
            eje medianero
          </text>
        </>
      )}
      {/* Nivel freático */}
      {input.h_napa > 0 && input.H_zap + input.h_napa < input.H && (
        <line
          x1={padX}
          y1={baseY - input.h_napa * scale}
          x2={wallX}
          y2={baseY - input.h_napa * scale}
          stroke="var(--color-primary, #2563eb)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      )}
      {/* Apuntalamiento (estado provisorio, solo con losa) */}
      {conLosa && r.z_strut > 0 && (
        <line
          x1={wallR}
          y1={padY + r.z_strut * scale}
          x2={wallR + 22}
          y2={padY + r.z_strut * scale}
          stroke="var(--color-warning, #f59e0b)"
          strokeWidth="3"
        />
      )}
      {/* Presiones del suelo */}
      {presPts && (
        <polygon
          points={presPts}
          fill="var(--color-primary, #2563eb)"
          opacity="0.25"
          stroke="var(--color-primary, #2563eb)"
          strokeWidth="1"
        />
      )}
      {vuelca && (
        <text
          x={x0 + wB / 2}
          y={botY + 16}
          fontSize="10"
          textAnchor="middle"
          fill="var(--color-danger, #ef4444)"
        >
          vuelca (e ≥ B/2)
        </text>
      )}
      {/* Cargas del vecino */}
      {hasVec && (
        <VecinoLoads
          wallX={wallX}
          wallTop={wallTop}
          scale={scale}
          D={Dv}
          arrowL={arrowL}
          Q={hasQ ? { v: Qv, x: xQ } : null}
          P={hasP ? { v: Pv, x: xP } : null}
          stagger={stagger}
        />
      )}
      {/* Cotas */}
      <text x={x0} y={svgH - 6} fontSize="10" fill="currentColor">
        B_zap {fmt(B, 2)} m{!vuelca && ` · σmax ${fmt(r.sigma_max, 0)} kPa`}
      </text>
      <text
        x={wallR + 4}
        y={wallTop + hH * 0.78}
        fontSize="10"
        fill="currentColor"
      >
        e {fmt(em, 2)} m
      </text>
    </svg>
  );
}

export default function MuroResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const locState = location.state as LocationState | null;
  const [input, setInput] = useState<MuroInput | null>(locState?.input ?? null);

  const [savedId, setSavedId] = useState<string | null>(
    locState?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    locState?.loadedSaveName ?? null,
  );

  const { result, calcError } = useMemo(() => {
    if (!input) return { result: null, calcError: null };
    try {
      return { result: designMuro(input), calcError: null };
    } catch (e: unknown) {
      return {
        result: null,
        calcError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [input]);

  if (!input) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">
            No hay resultados para mostrar. Complete el formulario de
            dimensionado primero.
          </p>
          <Link
            to="/muro"
            className="bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Ir al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (calcError || !result) {
    return (
      <MainLayout>
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-danger">
            Error en el cálculo
          </h2>
          <p className="text-text-muted text-sm">{calcError}</p>
          <Link
            to="/muro"
            className="inline-block bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Volver al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  const r = result;
  const estadoLabel =
    r.which === "voladizo"
      ? "Voladizo (sin losa)"
      : r.which === "definitivo"
        ? "Definitivo (biapoyado)"
        : "Provisorio (apuntalado)";
  const conLosa = input.con_losa !== false;
  const medianera = input.tipo_zapata === "excentrica";

  function handleSave() {
    const data = { input, result } as Record<string, unknown>;
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar estos resultados:");
    if (!name) return;
    void (async () => {
      const target = await pickObraIfNeeded();
      if (target === null) return;
      try {
        const saved = saveBeam(name, "muro", data, target);
        setSavedId(saved.id);
        setSavedName(name);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
    })();
  }

  const computo = computoMuro({
    H: r.H,
    e_muro: r.e_muro,
    B_zap: input.B_zap,
    H_zap: input.H_zap,
    rec_zap: input.rec_zap,
    vertInt: r.vertInt,
    vertExt: r.vertExt,
    horizInt: r.horizInt,
    horizExt: r.horizExt,
    trans: r.trans,
    longInf: r.longInf,
    longSup: r.longSup,
    estribo: r.estribo,
  });

  return (
    <MainLayout>
      <ScreenHeader
        title={
          <>
            Muro — H {fmt(r.H, 2)} m × e {fmt(r.e_muro, 2)} m
          </>
        }
        subtitle={
          <>
            <span>
              f'c = {input.fc} MPa · fy = {input.fy} MPa · σ<sub>adm</sub> ={" "}
              {fmt(input.sigma_adm_suelo, 3)} {input.sigma_adm_unit}
            </span>
          </>
        }
        badge={
          savedName
            ? { label: savedName, tone: "saved" }
            : { label: "Sin guardar", tone: "unsaved" }
        }
        actions={
          <>
            <PrintButton />
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px dark:text-[#241a10]"
            >
              Guardar resultados
            </button>
            <button
              type="button"
              onClick={() =>
                navigate("/muro", {
                  state: {
                    ...(input as unknown as Record<string, unknown>),
                    loadedSaveId: savedId,
                    loadedSaveName: savedName,
                  },
                })
              }
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-alt hover:text-text active:translate-y-px"
            >
              ← Volver
            </button>
          </>
        }
      />

      {/* Esquema */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Esquema en corte</SectionHeading>
        <div className="text-text-muted">
          <MuroSketch r={r} input={input} />
        </div>
      </section>

      {/* Resumen */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Resumen</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DataCard
            label="Estado gobernante"
            value={estadoLabel}
            sub={`z = ${fmt(r.z_M_gov, 2)} m`}
          />
          <DataCard
            label="M<sub>u</sub> gobernante"
            value={`${fmt(r.M_u_gov, 1)}`}
            sub="kN·m/m"
          />
          <DataCard
            label="V<sub>u</sub> gobernante"
            value={`${fmt(r.Vu, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label="P<sub>u</sub> (axial)"
            value={`${fmt(r.Pu, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label={
              conLosa ? "K<sub>0</sub> (en reposo)" : "K<sub>a</sub> (Rankine)"
            }
            value={fmt(r.K, 3)}
            sub={conLosa ? `Ka = ${fmt(r.Ka, 3)} (provisorio)` : undefined}
          />
          <DataCard
            label="z<sub>0</sub> (tracción)"
            value={`${fmt(r.z0, 2)}`}
            sub="m"
          />
          <DataCard
            label="σ<sub>max</sub> suelo"
            value={`${fmt(r.sigma_max, 0)}`}
            sub="kPa"
          />
          <DataCard
            label="Rigidez zapata"
            value={r.rigidOK ? "✓" : "✗"}
            sub={r.rigidOK ? "vuelo ≤ 2·H_zap" : "vuelo > 2·H_zap"}
          />
        </div>
      </section>

      {/* Empuje activo */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>
          {conLosa ? "Empuje en reposo (con losa)" : "Empuje activo de Rankine"}
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DataCard
            label="p<sub>q</sub> (sobrecarga)"
            value={`${fmt(r.p_q, 1)}`}
            sub="kN/m²"
          />
          <DataCard
            label="p<sub>suelo</sub> base"
            value={`${fmt(r.p_s_base, 1)}`}
            sub="kN/m²"
          />
          {input.h_napa > 0 && (
            <DataCard
              label="p<sub>sumerg.</sub> base"
              value={`${fmt(r.p_sub_base, 1)}`}
              sub="kN/m²"
            />
          )}
          {input.h_napa > 0 && (
            <DataCard
              label="p<sub>hídrica</sub> base"
              value={`${fmt(r.p_w_base, 1)}`}
              sub="kN/m²"
            />
          )}
          <DataCard
            label="p<sub>net</sub> base"
            value={`${fmt(r.p_net_base, 1)}`}
            sub="kN/m²"
          />
          {r.W_vec > 0 && (
            <DataCard
              label="Empuje cargas vecino"
              value={`${fmt(r.W_vec, 1)}`}
              sub="kN/m (resultante)"
            />
          )}
          {r.U_sub > 0 && (
            <DataCard
              label="Subpresión U"
              value={`${fmt(r.U_sub, 1)}`}
              sub="kN/m bajo la zapata"
            />
          )}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Ka = tan²(45°−φ/2), K0 = 1 − sen φ. Con losa el muro no se desplaza y
          el estado definitivo usa K0 (empuje en reposo); el provisorio
          apuntalado y el voladizo sin losa usan Ka. z<sub>0</sub> = max(0,
          2·c/(FS<sub>c</sub>·γ·√K) − q/γ). p<sub>net</sub> = 0 por encima de z
          <sub>0</sub> (grieta de tracción). Con napa, suma la presión efectiva
          del suelo sumergido y la hidrostática desde z<sub>wt</sub>; bajo la
          zapata actúa la subpresión u = γw·(h<sub>napa</sub> + H<sub>zap</sub>
          ), que se descuenta de la carga sobre el suelo y del deslizamiento y
          suma al vuelco. Las cargas del vecino se suman como presión lateral
          por Boussinesq modificado (NAVFAC DM-7.2).
        </p>
      </section>

      {/* Modelo estructural */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Modelo estructural</SectionHeading>
        {!conLosa ? (
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-sm font-semibold text-text">
              Sin losa — tabique en voladizo empotrado en la zapata
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
              <span>Empuje W = {fmt(r.W_def, 1)} kN/m</span>
              <span>
                M<sub>base</sub> = {fmt(r.M_volad, 1)} kN·m/m (cara suelo)
              </span>
              <span>
                V<sub>base</sub> = {fmt(r.W_def, 1)} kN/m
              </span>
              <span>
                M<sub>u</sub> = {fmt(r.M_u_suelo, 1)} kN·m/m
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-sm font-semibold text-text">
                Definitivo — biapoyado
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
                <span>Empuje W = {fmt(r.W_def, 1)} kN/m</span>
                <span>R cabeza = {fmt(r.R_sup, 1)} kN/m</span>
                <span>R base = {fmt(r.R_inf, 1)} kN/m</span>
                <span>
                  M<sub>max</sub> = {fmt(Math.abs(r.M_max_def), 1)} kN·m/m
                </span>
                <span>
                  z M<sub>max</sub> = {fmt(r.z_M_max_def, 2)} m
                </span>
                <span>
                  V<sub>max</sub> = {fmt(r.V_max_def, 1)} kN/m
                </span>
              </div>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-sm font-semibold text-text">
                Provisorio — apuntalado
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
                <span>
                  z<sub>puntal</sub> = {fmt(r.z_strut, 2)} m
                </span>
                <span>
                  M<sub>cant</sub> = {fmt(Math.abs(r.M_cant), 1)} kN·m/m
                </span>
                <span>
                  R<sub>puntal</sub> = {fmt(r.R_strut, 1)} kN/m
                </span>
                <span>
                  R<sub>base</sub> = {fmt(r.R_base_lower, 1)} kN/m
                </span>
                <span>
                  M<sub>max</sub> = {fmt(Math.abs(r.M_max_prov), 1)} kN·m/m
                </span>
                <span>
                  V<sub>max</sub> = {fmt(r.V_max_prov, 1)} kN/m
                </span>
              </div>
            </div>
          </div>
        )}
        {conLosa && medianera && r.M_u_nudo > 0 && (
          <p className="text-xs text-text-muted mt-3">
            Medianera con losa: el momento de la puntera M<sub>u,nudo</sub> ={" "}
            {fmt(r.M_u_nudo, 1)} kN·m/m pasa al pie del tabique (cara del suelo)
            y la cupla losa/base T = {fmt(r.T_losa, 1)} kN/m (servicio) centra
            la presión sobre el suelo.
          </p>
        )}
      </section>

      {/* Verificaciones */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Verificaciones (D/C)</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {r.verifications.map((v) => (
            <DataCard
              key={v.label}
              label={v.label}
              value={v.value}
              sub={
                <span>
                  D/C = {fmt(v.ratio, 3)} <Badge ok={v.ok} />
                </span>
              }
            />
          ))}
        </div>
      </section>

      {/* Armadura del tabique */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Armadura del tabique</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BarEditor
            title="Vertical cara del suelo"
            grupo="vertInt"
            result={r.vertInt}
            asReq={r.As_req}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Vertical cara libre (excavación)"
            grupo="vertExt"
            result={r.vertExt}
            asReq={r.As_ext}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Horizontal cara del suelo"
            grupo="horizInt"
            result={r.horizInt}
            asReq={0.0018 * 100 * (input.e_muro * 100)}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Horizontal cara libre (excavación)"
            grupo="horizExt"
            result={r.horizExt}
            asReq={0.0018 * 100 * (input.e_muro * 100)}
            input={input}
            setInput={setInput}
          />
        </div>
        <p className="text-xs text-text-muted mt-3">
          Tabique: d = {fmt(r.e_muro * 100, 1)} − {fmt(input.rec_muro / 10, 1)}{" "}
          ={fmt(r.d_cm, 1)} cm. Cada cara vertical se arma con su propio momento
          (cara suelo M<sub>u</sub> = {fmt(r.M_u_suelo, 1)}, cara libre M
          <sub>u</sub> = {fmt(r.M_u_libre, 1)} kN·m/m), con As
          <sub>mín</sub> como piso. Horizontales por cara: mínimo de retracción
          0.18% (ρ = 0.0018·b·e) por cara, s ≤ 45 cm.
        </p>
      </section>

      {/* Corte del tabique */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Corte del tabique</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DataCard
            label="V<sub>u</sub>"
            value={`${fmt(r.Vu, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label="φV<sub>c</sub>"
            value={`${fmt(r.phiVc, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label="D/C corte"
            value={fmt(r.shearRatio, 3)}
            sub={<Badge ok={r.shearOK} />}
          />
          <DataCard
            label="M<sub>u</sub> gobernante"
            value={`${fmt(r.M_u_gov, 1)}`}
            sub="kN·m/m"
          />
        </div>
      </section>

      {/* Zapata */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Zapata corrida</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DataCard
            label="Tipo"
            value={medianera ? "Medianera" : "Centrada"}
            sub={conLosa ? "con losa superior" : "sin losa (voladizo)"}
          />
          <DataCard
            label="B × H<sub>zap</sub>"
            value={`${fmt(input.B_zap, 2)}×${fmt(input.H_zap, 2)}`}
            sub="m"
          />
          <DataCard label="Vuelo v" value={`${fmt(r.vuelo, 2)}`} sub="m" />
          <DataCard
            label="σ<sub>adm</sub>"
            value={`${fmt(r.sigma_adm_kPa, 0)}`}
            sub="kPa"
          />
          <DataCard
            label={conLosa ? "σ uniforme" : "σ<sub>max</sub> suelo"}
            value={
              !conLosa && r.sigma_max <= 0 ? "vuelca" : `${fmt(r.sigma_max, 0)}`
            }
            sub={
              <span>
                {conLosa
                  ? `≤ ${fmt(r.sigma_adm_kPa, 0)} kPa`
                  : `≤ ${fmt(1.25 * r.sigma_adm_kPa, 0)} kPa`}{" "}
                <Badge ok={r.sigmaOK} />
              </span>
            }
          />
          {!conLosa && (
            <DataCard
              label="e / B<sub>apoyado</sub>"
              value={`${fmt(Math.abs(r.e0), 2)} / ${fmt(r.B_contacto, 2)}`}
              sub={
                Math.abs(r.e0) > input.B_zap / 6
                  ? "m · e > B/6 (triángulo)"
                  : "m · e ≤ B/6"
              }
            />
          )}
          {!conLosa && (
            <DataCard
              label="FS vuelco / deslizamiento"
              value={`${fmt(r.FS_vuelco, 2)} / ${fmt(r.FS_desl, 2)}`}
              sub={
                <span>
                  ≥ 1.5 <Badge ok={r.FS_vuelco >= 1.5 && r.FS_desl >= 1.5} />
                </span>
              }
            />
          )}
          {conLosa && r.T_losa > 0.005 && (
            <DataCard
              label="T losa/base"
              value={`${fmt(r.T_losa, 1)}`}
              sub="kN/m (cupla que centra la presión)"
            />
          )}
          <DataCard
            label="N servicio"
            value={`${fmt(r.P_serv, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label="q<sub>u</sub>"
            value={`${fmt(r.q_u, 1)}`}
            sub="kPa"
          />
          <DataCard
            label="M<sub>u,zap</sub>"
            value={`${fmt(r.M_u_zap, 1)}`}
            sub="kN·m/m"
          />
          <DataCard
            label="d<sub>zap</sub>"
            value={`${fmt(r.d_zap_cm, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Compresión axial"
            value={fmt(r.axialRatio, 3)}
            sub={<Badge ok={r.axialOK} />}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <BarEditor
            title="Transversal zapata (flexión del vuelo)"
            grupo="trans"
            result={r.trans}
            asReq={r.As_trans_req}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Longitudinal inferior (reparto)"
            grupo="longInf"
            result={r.longInf}
            asReq={r.As_long}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Longitudinal superior (montaje/reparto)"
            grupo="longSup"
            result={r.longSup}
            asReq={0.0018 * 100 * (input.H_zap * 100)}
            input={input}
            setInput={setInput}
          />
          <StirrupEditor
            title="Estribos de la zapata"
            input={input}
            setInput={setInput}
            result={r.estribo}
            avsReq={r.avsReq}
            avsMin={r.avsMin}
          />
        </div>
        <p className="text-xs text-text-muted mt-3">
          Zapata: d = {fmt(input.H_zap * 100, 1)} − {fmt(input.rec_zap / 10, 1)}{" "}
          ={fmt(r.d_zap_cm, 1)} cm. M<sub>u,zap</sub> = q<sub>u</sub>·v²/2.
          Longitudinal inferior = máx(0.2·As<sub>trans</sub>, 0.18%·100·H
          <sub>zap</sub>); la superior es armadura de montaje/reparto (mínimo
          0.18%). Estribos: corte en la cara del muro Vu = q<sub>u</sub>·vuelo,
          φVc = 0.75·b·d·√f'c/60; Av/s = (Vu−φVc)/(φ·fy·d), s<sub>max</sub> =
          mín(0.5·d, 60) cm.
        </p>
      </section>

      {/* Cómputo */}
      <ComputoSection
        computo={computo}
        note="Por metro lineal. Hormigón = tabique + zapata. Acero según la propuesta del diseño (verticales y horizontales del tabique; transversales y longitudinales de la zapata)."
      />

      {/* Ver cuentas */}
      <section className="no-print bg-surface rounded-xl border border-border p-5">
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text">
            Ver cuentas
          </summary>
          <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[32rem] overflow-y-auto">
            {r.steps.join("\n")}
          </pre>
        </details>
      </section>

      {/* Advertencias */}
      {r.warnings.length > 0 && (
        <section className="bg-warning/5 border border-warning/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-warning uppercase tracking-wider mb-3">
            Advertencias
          </h2>
          <ul className="space-y-1">
            {r.warnings.map((w, i) => (
              <li
                key={i}
                className="text-sm text-text-muted flex items-start gap-2"
              >
                <span className="text-warning font-bold shrink-0">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Errores */}
      {r.errors.length > 0 && (
        <section className="bg-danger/5 border border-danger/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3">
            Errores
          </h2>
          <ul className="space-y-1">
            {r.errors.map((e, i) => (
              <li
                key={i}
                className="text-sm text-text-muted flex items-start gap-2"
              >
                <span className="text-danger font-bold shrink-0">✗</span>
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}
    </MainLayout>
  );
}
