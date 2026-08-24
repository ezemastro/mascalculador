import { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { PrintButton } from "@mascalculador/shared";
import { designBase } from "../lib/bases-calc";
import type { BaseInput } from "../lib/bases-calc";
import { saveBeam, updateSave } from "../lib/storage";

// ---------------------------------------------------------------------------
// Location state contract (set by BasesForm on submit)
// ---------------------------------------------------------------------------

interface LocationState {
  input: BaseInput;
  /** Id del guardado cargado, si viene de uno existente */
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Format a number for display: 1 decimal for forces/lengths, up to 4 for small values */
function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BasesResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSteps, setShowSteps] = useState(false);

  const locState = location.state as LocationState | null;
  const input = locState?.input;

  // Identidad del guardado (arranca del router state, se actualiza al guardar)
  const [savedId, setSavedId] = useState<string | null>(
    locState?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    locState?.loadedSaveName ?? null,
  );

  // ─── Compute result (must be before any early return — rules of hooks) ───
  const { result, calcError } = useMemo(() => {
    if (!input) return { result: null, calcError: null };
    try {
      return { result: designBase(input), calcError: null };
    } catch (e: unknown) {
      return {
        result: null,
        calcError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [input]);

  // ─── No data guard ───
  if (!input) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">
            No hay resultados para mostrar. Complete el formulario de
            dimensionado primero.
          </p>
          <Link
            to="/bases"
            className="bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Ir al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  // ─── Error guard ───
  if (calcError || !result) {
    return (
      <MainLayout>
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-danger">
            Error en el cálculo
          </h2>
          <p className="text-text-muted text-sm">{calcError}</p>
          <Link
            to="/bases"
            className="inline-block bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Volver al formulario
          </Link>
        </div>
      </MainLayout>
    );
  }

  const isCentrada = input.type === "centrada";
  const isMedianera = input.type === "medianera";
  const isViga = isMedianera && input.subType === "viga-de-fundacion";
  const isTensor = isMedianera && input.subType === "tensor";

  // ─── Save handler ───
  function handleSave() {
    const data = { input, result } as Record<string, unknown>;
    // Si venimos de una base guardada, actualizamos la misma (mismo id/nombre)
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar estos resultados:");
    if (!name) return;
    try {
      const saved = saveBeam(name, "bases", data);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <MainLayout>
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-3">
              Base {isCentrada ? "Centrada" : "Medianera"} {result.B}×{result.L}
              ×{result.h} cm
              {savedName ? (
                <span className="text-sm font-normal text-text-muted bg-surface-alt border border-border px-2.5 py-0.5 rounded-full">
                  {savedName}
                </span>
              ) : (
                <span className="text-sm font-normal text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
                  Sin guardar
                </span>
              )}
            </h1>
            <p className="text-sm text-text-muted">
              {isCentrada
                ? `f'c = ${input.fc} MPa · fy = ${input.fy} MPa`
                : isViga
                  ? `Viga de fundación · Lcol = ${input.Lcol} cm`
                  : `Tensor · H = ${input.H} cm`}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <PrintButton />
          <button
            type="button"
            onClick={handleSave}
            className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Guardar resultados
          </button>
          <button
            type="button"
            onClick={() =>
              navigate("/bases", {
                state: {
                  ...input,
                  loadedSaveId: savedId,
                  loadedSaveName: savedName,
                },
              })
            }
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* ─── Datos de entrada ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <DataCard
            label="Cargas P<sub>D</sub> / P<sub>L</sub>"
            value={`${fmt(input.PD, 1)} / ${fmt(input.PL, 1)}`}
            sub="kN"
          />
          <DataCard
            label="Tensión admisible suelo (q<sub>a</sub>)"
            value={`${fmt(input.qa, 4)}`}
            sub="kN/cm²"
          />
          <DataCard
            label="Profundidad (D<sub>f</sub>)"
            value={`${fmt(input.Df, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Columna cx × cy"
            value={`${fmt(input.cx, 1)} × ${fmt(input.cy, 1)}`}
            sub="cm"
          />
          <DataCard
            label="f'<sub>c</sub> / f<sub>y</sub>"
            value={`${input.fc} / ${input.fy}`}
            sub="MPa"
          />
          <DataCard
            label="Recubrimiento"
            value={`${fmt(input.cover ?? 5, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Diámetro barra"
            value={`${input.rebD ?? 12}`}
            sub="mm"
          />
          {isMedianera && (
            <DataCard
              label={
                isViga ? "Luz col. (L<sub>col</sub>)" : "Altura tensor (H)"
              }
              value={
                isViga
                  ? `${fmt(input.Lcol ?? 0, 1)}`
                  : `${fmt(input.H ?? 0, 1)}`
              }
              sub="cm"
            />
          )}
        </div>
      </section>

      {/* ─── Resumen ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Resumen
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <DataCard
            label="Base (B &times; L)"
            value={`${result.B} × ${result.L}`}
            sub="cm"
          />
          <DataCard label="Altura (h)" value={`${fmt(result.h, 1)}`} sub="cm" />
          <DataCard
            label="Altura útil (d)"
            value={`${fmt(result.d, 1)}`}
            sub="cm"
          />
          <DataCard
            label="P<sub>u</sub>"
            value={`${fmt(result.Pu, 1)}`}
            sub="kN"
          />
          <DataCard
            label="q<sub>u</sub>"
            value={`${fmt(result.qu, 6)}`}
            sub="kN/cm²"
          />
          <DataCard
            label="Voladizo k<sub>x</sub>"
            value={`${fmt(result.kx, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Voladizo k<sub>y</sub>"
            value={`${fmt(result.ky, 1)}`}
            sub="cm"
          />
          <DataCard
            label="Área req. / provista"
            value={`${fmt(result.Areq, 0)} / ${fmt(result.Ap, 0)}`}
            sub="cm²"
          />
          {isMedianera && (
            <>
              <DataCard
                label="Excentricidad (e)"
                value={`${fmt(result.e, 1)}`}
                sub="cm"
              />
              <DataCard
                label="M<sub>u</sub> volcador"
                value={`${fmt(result.Mu, 1)}`}
                sub="kN·cm"
              />
              {isTensor && (
                <DataCard
                  label="Tracción T<sub>u</sub>"
                  value={`${fmt(result.Tu, 1)}`}
                  sub="kN"
                />
              )}
              {isViga && (
                <DataCard
                  label="Reacción R<sub>u</sub>"
                  value={`${fmt(result.Ru, 1)}`}
                  sub="kN"
                />
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── Verificaciones ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Verificaciones
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {isCentrada && (
            <>
              <DataCard
                label="Punzonado V<sub>u</sub>"
                value={`${fmt(result.Vu_punch, 1)} kN`}
                sub={
                  <span>
                    φV<sub>c</sub> = {fmt(result.phiVc_punch, 1)} kN{" "}
                    <Badge ok={result.punchOK} />
                  </span>
                }
              />
              <DataCard
                label="Corte X V<sub>ux</sub>"
                value={`${fmt(result.Vux, 1)} kN`}
                sub={
                  <span>
                    φV<sub>c</sub> = {fmt(result.phiVc_beam, 1)} kN{" "}
                    <Badge ok={result.Vux <= result.phiVc_beam} />
                  </span>
                }
              />
              <DataCard
                label="Corte Y V<sub>uy</sub>"
                value={`${fmt(result.Vuy, 1)} kN`}
                sub={
                  <span>
                    φV<sub>c</sub> = {fmt(result.phiVc_beam, 1)} kN{" "}
                    <Badge ok={result.Vuy <= result.phiVc_beam} />
                  </span>
                }
              />
              <DataCard
                label="Separación"
                value={`sx=${fmt(result.sep_x, 1)} sy=${fmt(result.sep_y, 1)}`}
                sub={
                  <span>
                    cm <Badge ok={result.sepCheckOK} />
                  </span>
                }
              />
              <DataCard
                label="Talón"
                value={`${fmt(result.heel, 1)} cm`}
                sub={
                  <span>
                    ≥ 25 cm <Badge ok={result.heelOK} />
                  </span>
                }
              />
            </>
          )}
          {isTensor && (
            <DataCard
              label="Rozamiento"
              value={`T<sub>u</sub> = ${fmt(result.Tu, 1)} kN`}
              sub={
                <span>
                  PD·μ = {fmt(input.PD * (input.mu ?? 0.4), 1)} kN{" "}
                  <Badge ok={result.FrictionOK} />
                </span>
              }
            />
          )}
        </div>
      </section>

      {/* ─── Armadura ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Armadura
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {isCentrada && (
            <>
              <DataCard
                label="A<sub>sx</sub>"
                value={`${fmt(result.Asx, 2)}`}
                sub="cm²"
              />
              <DataCard
                label="A<sub>sy</sub>"
                value={`${fmt(result.Asy, 2)}`}
                sub="cm²"
              />
              <DataCard
                label="A<sub>s mín</sub>"
                value={`${fmt(result.AsMin, 2)}`}
                sub="cm²"
              />
              <DataCard
                label="ka<sub>x</sub> / ka<sub>y</sub>"
                value={`${fmt(result.kax, 4)} / ${fmt(result.kay, 4)}`}
                sub={`ka<sub>mín</sub> = ${fmt(result.kamin, 4)}`}
              />
              <DataCard label="Ø<sub>b</sub>" value={`${result.db}`} sub="mm" />
              <DataCard
                label="Barras X / Y"
                value={`${result.nb_x} / ${result.nb_y}`}
                sub={`sep ${fmt(result.sep_x, 1)} / ${fmt(result.sep_y, 1)} cm`}
              />
            </>
          )}
          {isViga && (
            <>
              <DataCard
                label="A<sub>s sup</sub>"
                value={`${fmt(result.As_sup, 2)}`}
                sub="cm²"
              />
              <DataCard
                label="A<sub>s inf</sub>"
                value={`${fmt(result.As_inf, 2)}`}
                sub="cm²"
              />
            </>
          )}
          {isTensor && (
            <DataCard
              label="A<sub>s tensor</sub>"
              value={`${fmt(result.As_tensor, 2)}`}
              sub="cm²"
            />
          )}
        </div>
      </section>

      {/* ─── Medianera extras ─── */}
      {isMedianera && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Medianera — {isViga ? "Viga de fundación" : "Tensor"}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DataCard
              label="Excentricidad (e)"
              value={`${fmt(result.e, 1)}`}
              sub="cm"
            />
            <DataCard
              label="M<sub>u</sub>"
              value={`${fmt(result.Mu, 1)}`}
              sub="kN·cm"
            />
            {isViga && (
              <>
                <DataCard
                  label="R<sub>u</sub>"
                  value={`${fmt(result.Ru, 1)}`}
                  sub="kN"
                />
                <DataCard
                  label="Sección viga"
                  value={`${Math.max(input.cy, 20)} × ${fmt(result.h, 1)}`}
                  sub="cm (b × h)"
                />
                <DataCard
                  label="Altura útil viga (d)"
                  value={`${fmt(result.d, 1)}`}
                  sub="cm"
                />
              </>
            )}
            {isTensor && (
              <>
                <DataCard
                  label="Altura tensor (H)"
                  value={`${input.H}`}
                  sub="cm"
                />
                <DataCard
                  label="T<sub>u</sub>"
                  value={`${fmt(result.Tu, 1)}`}
                  sub="kN"
                />
                <DataCard
                  label="Sección tensor"
                  value={`${Math.round(result.h_tensor)} × ${Math.round(result.h_tensor)}`}
                  sub="cm (adoptada)"
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* ─── Ver cuentas ─── */}
      <section className="no-print bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Ver cuentas
          </h2>
          <button
            type="button"
            onClick={() => setShowSteps(!showSteps)}
            className="text-xs bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
          >
            {showSteps ? "Ocultar cuentas ▲" : "Mostrar cuentas ▼"}
          </button>
        </div>
        {showSteps && (
          <pre className="p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[32rem] overflow-y-auto">
            {result.steps.join("\n")}
          </pre>
        )}
      </section>

      {/* ─── Warnings ─── */}
      {result.warnings.length > 0 && (
        <section className="bg-warning/5 border border-warning/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-warning uppercase tracking-wider mb-3">
            Advertencias
          </h2>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
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

      {/* ─── Errors ─── */}
      {result.errors.length > 0 && (
        <section className="bg-danger/5 border border-danger/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-danger uppercase tracking-wider mb-3">
            Errores
          </h2>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
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
