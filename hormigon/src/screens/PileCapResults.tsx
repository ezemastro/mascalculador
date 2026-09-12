// Resultados del módulo "Cabezal sobre pilotes": verificaciones de bielas y
// tirantes con tarjetas ✓/✗, dibujo del cabezal y cuentas paso a paso.
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { designPileCap, type PileCapInput } from "../lib/pilecap-calc";
import { saveBeam, updateSave } from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import ScreenHeader from "../components/ScreenHeader";
import PileCapDiagram from "../components/PileCapDiagram";

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

function CheckCard({
  title,
  ok,
  rows,
  tone,
}: {
  title: string;
  ok: boolean;
  rows: Array<[string, React.ReactNode]>;
  tone?: "aviso";
}) {
  const color =
    tone === "aviso" ? "text-warning" : ok ? "text-success" : "text-danger";
  const chip = tone === "aviso" ? "⚠ revisar" : ok ? "✓ cumple" : "✗ NO cumple";
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <span className={`text-xs font-bold ${color}`}>{chip}</span>
      </div>
      <dl className="space-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-text-muted">{k}</dt>
            <dd className="text-right font-medium tabular-nums text-text">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${accent ? "text-primary" : "text-text"}`}
      >
        {value}
      </p>
      {sub ? <p className="text-[11px] text-text-muted">{sub}</p> : null}
    </div>
  );
}

export default function PileCapResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as {
    input?: PileCapInput;
    loadedSaveId?: string;
    loadedSaveName?: string;
  } | null;

  const input = locationState?.input;
  const [savedId, setSavedId] = useState<string | null>(
    locationState?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    locationState?.loadedSaveName ?? null,
  );

  const { result, calcError } = useMemo(() => {
    if (!input) return { result: null, calcError: null };
    try {
      return { result: designPileCap(input), calcError: null };
    } catch (e: unknown) {
      return {
        result: null,
        calcError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [input]);

  if (!input || !result) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">
            {calcError ??
              "No hay resultados para mostrar. Completá el formulario primero."}
          </p>
          <Link
            to="/cabezal-pilotes"
            className="rounded-lg bg-primary px-4 py-1.5 text-white hover:bg-primary-hover"
          >
            Ir al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  const tipoLabel =
    result.input.tipo === "rect2"
      ? "Rectangular — 2 pilotes"
      : result.input.tipo === "linea3"
        ? "Rectangular — 3 pilotes en línea"
        : "Triangular — 3 pilotes";

  async function handleSave() {
    const data = { input, result } as unknown as Record<string, unknown>;
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar estos resultados:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "pilecap", data, target);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <MainLayout>
      <ScreenHeader
        title={
          <>
            Cabezal {tipoLabel} — h {result.input.h ?? "—"} cm
          </>
        }
        subtitle={
          <span>
            f'c = {result.input.fc} MPa · fy = {result.input.fy} MPa ·{" "}
            {result.n} pilotes Ø{result.input.Dp} cm · s = {result.input.s} cm
          </span>
        }
        badge={
          savedName
            ? { label: savedName, tone: "saved" }
            : { label: "Sin guardar", tone: "unsaved" }
        }
        actions={
          <>
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
                navigate("/cabezal-pilotes", {
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

      <div className="flex flex-col gap-6">
        {/* ── Resumen ─────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Resumen</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Estado"
              value={result.allOK ? "✓ Cumple" : "✗ Revisar"}
              accent
              sub="todas las verificaciones"
            />
            <Stat
              label={`Pu (columna)`}
              value={`${f1(result.Pu)} kN`}
              sub={`+ 1.2·W = ${f1(result.W)} kN → ${f1(result.PuTot)} kN`}
            />
            <Stat
              label={`Reacción por pilote`}
              value={`${f1(result.Rp)} kN`}
              sub={`servicio ${f1(result.Rserv)} kN`}
            />
            <Stat
              label="Capacidad real del grupo"
              value={`${f1(result.capGrupo)} kN`}
              sub={`${result.n} × Qpilote vs ${f1(result.Pserv)} kN servicio`}
            />
          </div>
        </section>

        {/* ── Modelo y dibujo ────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Modelo de bielas y tirantes</h2>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-surface-alt p-4">
              <PileCapDiagram
                tipo={result.input.tipo}
                cx={result.input.cx}
                cy={result.input.cy}
                Dp={result.input.Dp}
                s={result.input.s}
                L1={result.L1}
                L2={result.L2}
                h={result.input.h ?? 0}
                d={result.d}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Altura útil d"
                value={`${f2(result.d)} cm`}
                sub={`h − recubrimiento − 2.5`}
              />
              <Stat
                label="Proyección horizontal a"
                value={`${f2(result.a)} cm`}
                sub={
                  result.input.tipo === "rect2"
                    ? "s/2 (columna centrada)"
                    : result.input.tipo === "linea3"
                      ? "s (pilotes exteriores)"
                      : "s/√3 (radio del triángulo)"
                }
              />
              <Stat
                label="Ángulo de biela θ"
                value={`${f1(result.thetaDeg)}°`}
                sub="mínimo recomendado 25°"
              />
              <Stat
                label="Tracción del tirante T"
                value={`${f1(result.T)} kN`}
                sub={`por tirante · ${result.armadura} (As prov ${f2(result.AsProv)} cm²)`}
              />
            </div>
          </div>
        </section>

        {/* ── Verificaciones ─────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Verificaciones</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <CheckCard
              title="Capacidad de los pilotes"
              ok={result.capOK}
              rows={[
                ["R servicio / pilote", `${f1(result.Rserv)} kN`],
                ["Qpilote", `${f1(result.input.Qp)} kN`],
                ["Grupo n·Qpilote", `${f1(result.capGrupo)} kN`],
                ["Demanda de servicio", `${f1(result.Pserv)} kN`],
              ]}
            />
            <CheckCard
              title="Ángulo de la biela"
              ok={result.thetaOK}
              rows={[
                ["θ = atan(d/a)", `${f1(result.thetaDeg)}°`],
                ["Mínimo", "25°"],
              ]}
            />
            <CheckCard
              title="Compresión en bielas"
              ok={result.bielaOK}
              rows={[
                ["C por biela", `${f1(result.C)} kN`],
                ["Sección ws × b", `${f1(result.wS)} × ${f1(result.bDisp)} cm`],
                ["σ", `${f2(result.sigmaC)} MPa`],
                ["Límite φ·0.85·βs·f'c", `${f2(result.sigmaCLim)} MPa`],
              ]}
            />
            <CheckCard
              title="Nudos columna / pilote"
              ok={result.nodoColOK && result.nodoPilOK}
              rows={[
                [
                  "σ columna (CCC)",
                  `${f2(result.sigmaCol)} ≤ ${f2(result.sigmaColLim)} MPa`,
                ],
                [
                  "σ pilote (CCT)",
                  `${f2(result.sigmaPil)} ≤ ${f2(result.sigmaPilLim)} MPa`,
                ],
              ]}
            />
            <CheckCard
              title="Tirantes"
              ok={result.tieOK}
              rows={[
                ["T", `${f1(result.T)} kN`],
                ["As requerido", `${f2(result.AsNec)} cm²`],
                [
                  "Armadura",
                  `${result.armadura} (As ${f2(result.AsProv)} cm²)`,
                ],
              ]}
            />
            <CheckCard
              title="Anclaje de tirantes"
              ok={result.anclajeOK || result.anclajeGanchoOK}
              rows={[
                ["ld recto (Ø" + result.barD + ")", `${f1(result.ld)} cm`],
                ["ldc gancho 90°", `${f1(result.ldc)} cm`],
                ["Disponible", `${f1(result.anclaje)} cm`],
                [
                  "Solución",
                  result.anclajeOK
                    ? "recto"
                    : result.anclajeGanchoOK
                      ? "gancho estándar"
                      : "no alcanza",
                ],
              ]}
            />
            <CheckCard
              title="Punzonado de la columna"
              ok={result.punCol.OK}
              rows={[
                ["Vu", `${f1(result.punCol.Vu)} kN`],
                ["b0", `${f1(result.punCol.b0 ?? 0)} cm`],
                ["φVc", `${f1(result.punCol.phiVc)} kN`],
              ]}
            />
            <CheckCard
              title="Punzonado de cada pilote"
              ok={result.punPil.OK}
              rows={[
                ["Vu = Rp", `${f1(result.punPil.Vu)} kN`],
                ["b0 = π(Dp+d)", `${f1(result.punPil.b0 ?? 0)} cm`],
                ["φVc", `${f1(result.punPil.phiVc)} kN`],
              ]}
            />
            {result.corte && (
              <CheckCard
                title="Corte del voladizo"
                ok={result.corte.OK}
                rows={[
                  [
                    "Vu",
                    result.corte.Vu > 0
                      ? `${f1(result.corte.Vu)} kN`
                      : "no aplica",
                  ],
                  [
                    "φVc",
                    result.corte.Vu > 0 ? `${f1(result.corte.phiVc)} kN` : "—",
                  ],
                ]}
              />
            )}
            <CheckCard
              title="Geometría y detalles"
              ok={result.vueloOK && result.sepGrupoOK}
              tone={result.vueloOK && result.sepGrupoOK ? undefined : "aviso"}
              rows={[
                ["Vuelo dir. pilotes", `${f1(result.vueloLong)} cm`],
                ["Vuelo transversal", `${f1(result.vueloPerp)} cm`],
                [
                  "s vs 2.5·Dpilote",
                  `${f1(result.input.s)} vs ${f1(2.5 * result.input.Dp)} cm`,
                ],
              ]}
            />
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <h3 className="mb-1 text-sm font-semibold text-warning">
                Avisos de detallado
              </h3>
              <ul className="list-inside list-disc space-y-1 text-xs text-text">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── Cuentas ────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Ver cuentas</h2>
          <pre className="max-h-[36rem] overflow-auto rounded-lg bg-surface-alt p-3 font-mono text-xs whitespace-pre-wrap text-text-muted">
            {result.steps.join("\n")}
          </pre>
        </section>

        {/* ── Obs. de detallado ──────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="section-title mb-4">Obs. de detallado</h2>
          <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-text-muted">
            <li>
              Los tirantes se distribuyen en un ancho acorde con el apoyo del
              pilote; las barras deben anclarse más allá del eje del pilote
              (rectas o con gancho estándar 90° según la verificación).
            </li>
            <li>
              Completar la malla inferior en ambas direcciones (armadura de
              reparto) con separación ≤ 2h, y una malla superior de retracción
              (~Ø10 c/20) en cabezales de altura mayor a 90 cm.
            </li>
            <li>
              El cabezal debe quedar en contacto pleno con la cabeza del pilote:
              sanjeado previo y hormigón de samma o encofrado perdido.
            </li>
            <li>
              Verificar en obra la verticalidad y la cota de cabeza de cada
              pilote antes de fundir el cabezal.
            </li>
          </ul>
        </section>
      </div>
    </MainLayout>
  );
}
