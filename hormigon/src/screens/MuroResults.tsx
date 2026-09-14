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

/** Separaciones múltiplo de 5 entre 5 y smax (inclusive). */
function sepOptions(smax: number): number[] {
  const n = Math.max(1, Math.floor(smax / 5));
  return Array.from({ length: n }, (_, i) => (i + 1) * 5);
}

/** Editor de un grupo de flexión: desplegables Ø/sep, As provisto y Badge. */
function BarEditor({
  title,
  grupo,
  result,
  asReq,
  smax,
  input,
  setInput,
}: {
  title: string;
  grupo: keyof MuroAdopcion;
  result: MuroBarSelection;
  asReq?: number;
  smax: number;
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
          <select
            className="w-24"
            value={sep}
            onChange={(e) =>
              applyAdopcion(setInput, grupo, {
                diam,
                sep: Number(e.target.value),
                ...(adopt?.count !== undefined ? { count: adopt.count } : {}),
                ...(adopt?.legs !== undefined ? { legs: adopt.legs } : {}),
              })
            }
          >
            {sepOptions(smax).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
  sMax,
}: {
  title: string;
  input: MuroInput;
  setInput: React.Dispatch<React.SetStateAction<MuroInput | null>>;
  result: MuroBarSelection;
  avsReq: number; // cm²/cm
  avsMin: number; // cm²/cm
  sMax: number; // cm
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
          <select
            className="w-24"
            value={sep}
            onChange={(e) =>
              applyAdopcion(setInput, "estribo", {
                diam,
                sep: Number(e.target.value),
                legs,
              })
            }
          >
            {sepOptions(sMax).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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

/** Esquema en corte del muro + zapata (para interpretar estados y presiones). */
function MuroSketch({ r, input }: { r: MuroResult; input: MuroInput }) {
  const H = r.H;
  const em = r.e_muro;
  const B = input.B_zap;
  const Hz = input.H_zap;
  // Escala simple a px: 1 m ≈ 60 px (altura dibujable), con márgenes.
  const scale = 60;
  const wM = Math.max(14, em * scale);
  const wB = Math.max(70, B * scale);
  const hH = Math.max(40, H * scale);
  const hZ = Math.max(20, Hz * scale);
  const padX = 20;
  const padY = 20;
  const svgW = padX * 2 + wB;
  const svgH = padY * 2 + hH + hZ;
  const cx0 = padX + wB / 2 - wM / 2; // x del tabique (centrado)
  const baseY = padY + hH; // arranque de la zapata
  const wallTop = padY;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto block max-w-[260px]"
      role="img"
      aria-label="Esquema en corte del muro y la zapata"
    >
      {/* Suelo retenido (izquierda), sombreado */}
      <rect
        x={padX}
        y={wallTop}
        width={cx0 - padX}
        height={hH + hZ}
        fill="var(--color-surface-alt, #1e293b)"
        opacity="0.35"
      />
      {/* Zapata */}
      <rect
        x={padX}
        y={baseY}
        width={wB}
        height={hZ}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Tabique */}
      <rect
        x={cx0}
        y={wallTop}
        width={wM}
        height={hH}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Empuje activo (triángulo, izquierda) */}
      <polygon
        points={`${padX + 6},${wallTop + 4} ${padX + 6},${baseY - 2} ${cx0 - 4},${baseY - 2}`}
        fill="var(--color-danger, #ef4444)"
        opacity="0.18"
      />
      {/* Nivel freático */}
      {input.h_napa > 0 && input.H_zap + input.h_napa < input.H && (
        <line
          x1={padX}
          y1={baseY - input.h_napa * scale}
          x2={cx0}
          y2={baseY - input.h_napa * scale}
          stroke="var(--color-primary, #2563eb)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      )}
      {/* Apuntalamiento (estado provisorio) */}
      {r.z_strut > 0 && (
        <line
          x1={cx0 + wM / 2}
          y1={padY + r.z_strut * scale}
          x2={cx0 + wM / 2 + 22}
          y2={padY + r.z_strut * scale}
          stroke="var(--color-warning, #f59e0b)"
          strokeWidth="3"
        />
      )}
      {/* Cotas */}
      <text x={padX} y={baseY + hZ + 14} fontSize="10" fill="currentColor">
        B_zap {fmt(B, 2)} m
      </text>
      <text
        x={cx0 + wM + 4}
        y={wallTop + hH / 2}
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
    r.which === "definitivo"
      ? "Definitivo (biapoyado)"
      : "Provisorio (apuntalado)";

  // Separaciones máximas por grupo (para los desplegables de edición).
  const smaxVert = Math.min(3 * input.e_muro * 100, 30);
  const smaxHoriz = 45;
  const smaxTrans = Math.min(3 * input.H_zap * 100, 45);
  const smaxLong = 45;

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
            value={`${fmt(1.6 * r.V_max_def, 1)}`}
            sub="kN/m"
          />
          <DataCard
            label="P<sub>u</sub> (axial)"
            value={`${fmt(r.Pu, 1)}`}
            sub="kN/m"
          />
          <DataCard label="K<sub>a</sub> (Rankine)" value={fmt(r.Ka, 3)} />
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
        <SectionHeading>Empuje activo de Rankine</SectionHeading>
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
        </div>
        <p className="text-xs text-text-muted mt-3">
          Ka = tan²(45°−φ/2); z<sub>0</sub> = max(0, 2·c/(FS<sub>c</sub>·γ·√Ka)
          − q/γ). p<sub>net</sub> = 0 por encima de z<sub>0</sub> (grieta de
          tracción). Con napa, suma la presión efectiva del suelo sumergido y la
          hidrostática desde z<sub>wt</sub>.
        </p>
      </section>

      {/* Modelo estructural */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <SectionHeading>Modelo estructural</SectionHeading>
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
            title="Vertical interior"
            grupo="vertInt"
            result={r.vertInt}
            asReq={r.As_req}
            smax={smaxVert}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Vertical exterior (cara libre)"
            grupo="vertExt"
            result={r.vertExt}
            asReq={r.As_ext}
            smax={smaxVert}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Horizontal interior (cara suelo)"
            grupo="horizInt"
            result={r.horizInt}
            asReq={0.0018 * 100 * (input.e_muro * 100)}
            smax={smaxHoriz}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Horizontal exterior (cara libre)"
            grupo="horizExt"
            result={r.horizExt}
            asReq={0.0018 * 100 * (input.e_muro * 100)}
            smax={smaxHoriz}
            input={input}
            setInput={setInput}
          />
        </div>
        <p className="text-xs text-text-muted mt-3">
          Tabique: d = {fmt(r.e_muro * 100, 1)} − {fmt(input.rec_muro / 10, 1)}{" "}
          ={fmt(r.d_cm, 1)} cm. Vertical exterior = máx(As<sub>mín</sub>, 0.5·As
          <sub>int</sub>). Horizontales por cara: mínimo de retracción 0.18% (ρ
          = 0.0018·b·e) por cara, s ≤ 45 cm.
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
            value={input.tipo_zapata === "centrada" ? "Centrada" : "Excéntrica"}
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
            label={
              input.tipo_zapata === "centrada"
                ? "σ<sub>centrada</sub>"
                : "σ<sub>max</sub> exc."
            }
            value={`${fmt(r.sigma_max, 0)}`}
            sub={
              <span>
                {input.tipo_zapata === "centrada"
                  ? `${fmt(r.sigma_adm_kPa, 0)} kPa`
                  : `≤ ${fmt(1.25 * r.sigma_adm_kPa, 0)} kPa`}{" "}
                <Badge ok={r.sigmaOK} />
              </span>
            }
          />
          <DataCard
            label="P<sub>serv</sub>"
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
            smax={smaxTrans}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Longitudinal inferior (reparto)"
            grupo="longInf"
            result={r.longInf}
            asReq={r.As_long}
            smax={smaxLong}
            input={input}
            setInput={setInput}
          />
          <BarEditor
            title="Longitudinal superior (montaje/reparto)"
            grupo="longSup"
            result={r.longSup}
            asReq={0.0018 * 100 * (input.H_zap * 100)}
            smax={smaxLong}
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
            sMax={r.sMax}
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
