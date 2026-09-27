import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import ScreenHeader from "../components/ScreenHeader";
import { pickObraIfNeeded } from "../components/ObraPicker";
import { saveBeam, updateSave } from "../lib/storage";
import { calculateCartel } from "../lib/cartel-calc";
import type { AngleVerification, GlobalColumnCheck } from "../lib/cartel-calc";
import type { CartelState } from "./CartelForm";

/** Sección de resultado con título. */
function Section({
  title,
  extra,
  children,
}: {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface rounded-xl border border-border p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Tarjeta compacta label + valor. */
function Card({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-surface-alt rounded-lg p-3">
      {label && <span className="text-xs text-text-muted">{label}</span>}
      {children}
    </div>
  );
}

/** Verificación de una barra (cota de compresión / tracción): KL/r, Fcr, φPn, N, ratio. */
function MemberCheck({
  title,
  check,
}: {
  title: ReactNode;
  check: AngleVerification;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
        {title} — {check.name}
      </span>
      <div className="mt-2 space-y-1 text-sm">
        <p>KL/r = {check.KLr.toFixed(0)}</p>
        <p>
          F<sub>cr</sub> = {check.Fcr.toFixed(0)} MPa
        </p>
        <p>
          φ·P<sub>n</sub> = {check.phiPn.toFixed(1)} kN
        </p>
        <p>N = {check.force.toFixed(1)} kN</p>
        <p className={`font-bold ${check.ok ? "text-success" : "text-danger"}`}>
          Ratio = {check.ratio.toFixed(2)}{" "}
          {check.ok ? "✓ Verifica" : "✗ No verifica"}
        </p>
      </div>
    </div>
  );
}

/** Verificación global del conjunto (CIRSOC 301 Grupo 4). */
function GlobalCheckDetail({
  check,
  showLocal,
}: {
  check: GlobalColumnCheck;
  showLocal?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        <div>
          <span className="text-xs text-text-muted">λ₀</span>
          <p className="font-bold">{check.lambda0.toFixed(1)}</p>
        </div>
        {showLocal && (
          <>
            <div>
              <span className="text-xs text-text-muted">λ₁</span>
              <p className="font-bold">{check.lambda1.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">λₘ</span>
              <p className="font-bold">{check.lambdaM.toFixed(1)}</p>
            </div>
          </>
        )}
        <div>
          <span className="text-xs text-text-muted">
            λ<sub>c</sub>
          </span>
          <p className="font-bold">{check.lambdaC.toFixed(3)}</p>
        </div>
        <div>
          <span className="text-xs text-text-muted">
            F<sub>cr</sub> (MPa)
          </span>
          <p className="font-bold">{check.Fcr_MPa.toFixed(0)}</p>
        </div>
        <div>
          <span className="text-xs text-text-muted">
            &phi;·P<sub>n</sub>
          </span>
          <p className="font-bold">{check.phiPn_kN.toFixed(1)} kN</p>
        </div>
        <div>
          <span className="text-xs text-text-muted">
            P<sub>u</sub>
          </span>
          <p className="font-bold">{check.Pu_kN.toFixed(1)} kN</p>
        </div>
      </div>
      <p
        className={`mt-3 font-bold ${check.passes ? "text-success" : "text-danger"}`}
      >
        Ratio = {check.ratio.toFixed(2)}{" "}
        {check.passes ? "✓ Verifica" : "✗ No verifica"}
      </p>
    </div>
  );
}

export default function CartelResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CartelState | null;

  const [savedId, setSavedId] = useState<string | null>(
    state?.loadedSaveId ?? null,
  );
  const [savedName, setSavedName] = useState<string | null>(
    state?.loadedSaveName ?? null,
  );

  if (!state) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/cartel")}
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  const result = calculateCartel(state);

  const saveData: Record<string, unknown> = {
    anchoCartel: state.anchoCartel,
    altoCartel: state.altoCartel,
    despegue: state.despegue,
    sepColumnas: state.sepColumnas,
    sepCorreas: state.sepCorreas,
    tipoColumna: state.tipoColumna,
    tienePuntal: state.tienePuntal,
    hPuntal: state.hPuntal,
    dPuntal: state.dPuntal,
    velocidadViento: state.velocidadViento,
    categoria: state.categoria,
    exposicion: state.exposicion,
    hCol: state.hCol,
    aCol: state.aCol,
    perfilCordon: state.perfilCordon,
    perfilDiagonal: state.perfilDiagonal,
    perfilMontante: state.perfilMontante,
    Fy: state.Fy,
    perfilIPN: state.perfilIPN,
    separacionCol: state.separacionCol,
    cantColumnas: state.cantColumnas,
    vueloLateral: state.vueloLateral,
    KGlobal: state.KGlobal,
    tipoPuntal: state.tipoPuntal,
  };

  async function handleSaveFromResults() {
    if (savedId) {
      updateSave(savedId, saveData);
      return;
    }

    const name = prompt("Nombre para guardar este cartel:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "cartel", saveData, target);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  const isLattice = state.tipoColumna !== 1;
  const tipoTitle =
    state.tipoColumna === 1
      ? "Simple IPN"
      : state.tipoColumna === 4
        ? "Celosía completa"
        : "Celosía";

  return (
    <MainLayout>
      <ScreenHeader
        title={`Cartel ${result.nColumnas} col. × ${result.nCorreas} correas`}
        subtitle={`${state.anchoCartel} × ${state.altoCartel} m · d = ${state.despegue} m · V = ${state.velocidadViento} m/s`}
        badge={
          savedName
            ? { label: savedName, tone: "saved" }
            : { label: "Resultado", tone: "neutral" }
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                navigate("/cartel", {
                  state: {
                    ...state,
                    loadedSaveId: savedId ?? undefined,
                    loadedSaveName: savedName ?? undefined,
                  },
                })
              }
              className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
            >
              ← Volver
            </button>
            <button
              onClick={handleSaveFromResults}
              className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
            >
              {savedId ? "💾 Guardar corrección" : "💾 Guardar"}
            </button>
            <button
              onClick={() => navigate("/cartel-print", { state })}
              className="text-sm bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
            >
              🖨 Imprimir
            </button>
          </div>
        }
      />

      {/* 1 · Viento — CIRSOC 102 */}
      <Section title="Viento — CIRSOC 102">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card
            label={
              <>
                q<sub>z</sub> (N/m²)
              </>
            }
          >
            <p className="text-sm font-bold">{result.wind.qz.toFixed(0)}</p>
            <span className="text-[10px] text-text-muted">
              presión dinámica
            </span>
          </Card>
          <Card label={<>p (N/m²)</>}>
            <p className="text-sm font-bold">{result.wind.p.toFixed(0)}</p>
            <span className="text-[10px] text-text-muted">
              presión de diseño
            </span>
          </Card>
          <Card
            label={
              <>
                K<sub>z</sub>
              </>
            }
          >
            <p className="text-sm font-bold">{result.wind.Kz.toFixed(3)}</p>
            <span className="text-[10px] text-text-muted">
              z = {result.wind.z.toFixed(1)} m
            </span>
          </Card>
          <Card label={<>I</>}>
            <p className="text-sm font-bold">{result.wind.I.toFixed(2)}</p>
            <span className="text-[10px] text-text-muted">importancia</span>
          </Card>
          <Card
            label={
              <>
                A<sub>cartel</sub> (m²)
              </>
            }
          >
            <p className="text-sm font-bold">
              {result.wind.areaCartel.toFixed(1)}
            </p>
            <span className="text-[10px] text-text-muted">área expuesta</span>
          </Card>
          <Card
            label={
              <>
                F<sub>viento</sub> (kN)
              </>
            }
          >
            <p className="text-sm font-bold text-primary">
              {result.wind.Fviento.toFixed(1)}
            </p>
            <span className="text-[10px] text-text-muted">fuerza total</span>
          </Card>
        </div>
      </Section>

      {/* 2 · Geometría */}
      <Section title="Geometría">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <Card label="Cartel (m)">
            <p className="text-sm font-bold">
              {state.anchoCartel} × {state.altoCartel}
            </p>
          </Card>
          <Card label="Despegue (m)">
            <p className="text-sm font-bold">{state.despegue}</p>
          </Card>
          <Card label="Columnas">
            <p className="text-sm font-bold">{result.nColumnas}</p>
          </Card>
          <Card label="Sep. columnas (m)">
            <p className="text-sm font-bold">
              {state.sepColumnas ? state.sepColumnas.toFixed(2) : "—"}
            </p>
          </Card>
          <Card label="Correas">
            <p className="text-sm font-bold">{result.nCorreas} líneas</p>
          </Card>
          <Card label="Altura columna (m)">
            <p className="text-sm font-bold">
              {result.alturaColumna.toFixed(2)}
            </p>
          </Card>
          <Card label="Paneles">
            <p className="text-sm font-bold">
              {result.nPaneles} de {state.aCol}m
            </p>
          </Card>
        </div>
      </Section>

      {/* 3 · Reacciones */}
      <Section title="Reacciones">
        {result.brace ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card label="Puntal — axil">
              <p className="text-sm font-bold text-primary">
                {result.brace.axilPuntal.toFixed(1)} kN
              </p>
              <span className="text-xs text-text-muted">
                α = {result.brace.alphaPuntal.toFixed(1)}° &middot; L ={" "}
                {result.brace.lPuntal.toFixed(2)} m
              </span>
            </Card>
            <Card
              label={
                <>
                  R<sub>av</sub> / R<sub>ah</sub> — base A
                </>
              }
            >
              <p className="text-sm font-bold">
                V: {result.brace.Rav.toFixed(1)} kN ↓
              </p>
              <span className="text-xs text-text-muted">
                H: {result.brace.Rah.toFixed(1)} kN ←
              </span>
            </Card>
            <Card
              label={
                <>
                  R<sub>bv</sub> / R<sub>bh</sub> — base B
                </>
              }
            >
              <p className="text-sm font-bold">
                V: {result.brace.Rbv.toFixed(1)} kN ↑
              </p>
              <span className="text-xs text-text-muted">
                H: {result.brace.Rbh.toFixed(1)} kN ←
              </span>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Modelo en voladizo (sin puntal).
          </p>
        )}
      </Section>

      {/* 4 · Columna — solicitación y barras */}
      <Section
        title={<>Columna — {tipoTitle}</>}
        extra={
          <p
            className={`text-sm font-bold ${result.passes ? "text-success" : "text-danger"}`}
          >
            Ratio máx = {result.ratioColumna.toFixed(2)}{" "}
            {result.passes ? "✓" : "✗"}
          </p>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <Card
            label={
              <>
                F<sub>col</sub> (kN)
              </>
            }
          >
            <p className="text-sm font-bold">{result.forces.Fcol.toFixed(1)}</p>
            <span className="text-[10px] text-text-muted">
              viento por columna
            </span>
          </Card>
          <Card
            label={
              <>
                M<sub>máx</sub> (kN·m)
              </>
            }
          >
            <p className="text-sm font-bold">{result.forces.Mmax.toFixed(1)}</p>
            <span className="text-[10px] text-text-muted">
              momento de cálculo
            </span>
          </Card>
          {isLattice && (
            <>
              <Card
                label={
                  <>
                    h<sub>col</sub> — profundidad (m)
                  </>
                }
              >
                <p className="text-sm font-bold">{state.hCol}</p>
              </Card>
              <Card
                label={
                  <>
                    a<sub>col</sub> — panel (m)
                  </>
                }
              >
                <p className="text-sm font-bold">{state.aCol}</p>
              </Card>
            </>
          )}
        </div>

        {state.tipoColumna === 1 && result.flexoResult && (
          <div className="bg-surface-alt rounded-xl border border-border p-4">
            <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
              Flexocompresión — {state.perfilIPN}
            </span>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <span className="text-xs text-text-muted">
                  KL/r<sub>x</sub>
                </span>
                <p className="font-bold">
                  {result.flexoResult.KLrx.toFixed(1)}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">
                  KL/r<sub>y</sub>
                </span>
                <p className="font-bold">
                  {result.flexoResult.KLry.toFixed(1)}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">Estado límite</span>
                <p className="font-bold">{result.flexoResult.limitState}</p>
              </div>
              <div>
                <span className="text-xs text-text-muted">
                  &phi;·P<sub>n</sub>
                </span>
                <p className="font-bold">
                  {result.flexoResult.phiPn.toFixed(1)} kN
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted">
                  &phi;·M<sub>n,x</sub> / &phi;·M<sub>n,y</sub>
                </span>
                <p className="font-bold">
                  {result.flexoResult.phiMnx.toFixed(1)} /{" "}
                  {result.flexoResult.phiMny.toFixed(1)} kN·m
                </p>
              </div>
            </div>
            <p
              className={`mt-3 font-bold ${result.flexoResult.passes ? "text-success" : "text-danger"}`}
            >
              Ratio interacción = {result.flexoResult.ratio.toFixed(3)}{" "}
              {result.flexoResult.passes ? "✓ Verifica" : "✗ No verifica"}
            </p>
          </div>
        )}

        {isLattice && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.chkCordon && (
              <MemberCheck title="Cordón" check={result.chkCordon} />
            )}
            {result.chkDiag && (
              <MemberCheck title="Diagonal" check={result.chkDiag} />
            )}
            {result.chkMont && (
              <MemberCheck title="Montante" check={result.chkMont} />
            )}
          </div>
        )}
      </Section>

      {/* 5 · Columna — Verificación global */}
      {isLattice && result.globalCheck && (
        <Section title="Columna — Verificación global (CIRSOC 301 Grupo 4)">
          <GlobalCheckDetail check={result.globalCheck} showLocal />
        </Section>
      )}

      {/* 6 · Puntal */}
      {result.braceCheck && (
        <Section
          title={`Puntal — verificación (Tipo ${result.braceCheck.tipo})`}
          extra={
            <p
              className={`text-sm font-bold ${result.braceCheck.passesBrace ? "text-success" : "text-danger"}`}
            >
              Ratio puntal = {result.braceCheck.ratioBrace.toFixed(2)}{" "}
              {result.braceCheck.passesBrace ? "✓" : "✗"}
            </p>
          }
        >
          {result.braceCheck.globalCheck && (
            <div className="mb-4 rounded-xl bg-surface-alt border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Puntal — Verificación global
              </span>
              <div className="mt-2">
                <GlobalCheckDetail check={result.braceCheck.globalCheck} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.braceCheck.chkAngle && (
              <MemberCheck
                title="Puntal — Cruz (Pu/2 por ángulo)"
                check={result.braceCheck.chkAngle}
              />
            )}
            {result.braceCheck.chkDiagonal && (
              <MemberCheck
                title="Puntal — Diagonal"
                check={result.braceCheck.chkDiagonal}
              />
            )}
            {result.braceCheck.chkMontant && (
              <MemberCheck
                title="Puntal — Montante"
                check={result.braceCheck.chkMontant}
              />
            )}
          </div>

          {result.braceCheck.lateralBracing_cm !== undefined && (
            <div className="mt-4 bg-surface-alt rounded-lg p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Arriostramiento lateral
              </span>
              <p className="text-lg font-bold text-primary mt-1">
                Requerido cada {result.braceCheck.lateralBracing_cm.toFixed(0)}{" "}
                cm
              </p>
              <span className="text-xs text-text-muted">
                &lambda;<sub>lim</sub> = &pi;·&radic;(E/F<sub>y</sub>)
              </span>
            </div>
          )}
        </Section>
      )}

      {/* 7 · Acero por columna */}
      {isLattice && (
        <Section title="Acero por columna">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card label="L cordones">
              <p className="text-sm font-bold">
                {result.longCordones.toFixed(1)} m
              </p>
              {state.tipoColumna === 4 && (
                <span className="text-xs text-text-muted">× 4 cordones</span>
              )}
            </Card>
            <Card label="L montantes">
              <p className="text-sm font-bold">
                {result.longMontantes.toFixed(1)} m
              </p>
            </Card>
            <Card label="L diagonales">
              <p className="text-sm font-bold">
                {result.longDiagonales.toFixed(1)} m
              </p>
            </Card>
            <Card label="Total / columna">
              <p className="text-sm font-bold">
                {result.longTotal.toFixed(1)} m
              </p>
            </Card>
            <Card label="Total obra">
              <p className="text-sm font-bold">
                {(result.longTotal * result.nColumnas).toFixed(1)} m
              </p>
              <span className="text-xs text-text-muted">
                × {result.nColumnas} columnas
              </span>
            </Card>
          </div>
        </Section>
      )}

      {/* 8 · Cuentas completas */}
      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">
          Ver cuentas completas
        </summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {result.steps}
        </pre>
      </details>
    </MainLayout>
  );
}
