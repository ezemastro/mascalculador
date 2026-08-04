import { useLocation, useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import { calculateCartel } from "../lib/cartel-calc";
import type { CartelState } from "./CartelForm";

export default function CartelResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CartelState | null;

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

  return (
    <MainLayout>
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
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text">
              Cartel {result.nColumnas} col. × {result.nCorreas} correas
            </h1>
            <p className="text-sm text-text-muted">
              {state.anchoCartel} × {state.altoCartel} m &middot; d = {state.despegue} m &middot; V = {state.velocidadViento} m/s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/cartel", { state })}
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
          <button
            onClick={() => navigate("/cartel-print", { state })}
            className="text-sm bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            🖨 Imprimir
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            F<sub>viento</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.wind.Fviento.toFixed(1)} kN
          </p>
          <span className="text-xs text-text-muted">
            q<sub>z</sub> = {result.wind.qz.toFixed(0)} N/m² &middot; p = {result.wind.p.toFixed(0)} N/m²
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            F<sub>col</sub> / M<sub>máx</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.forces.Fcol.toFixed(1)} kN
          </p>
          <span className="text-xs text-text-muted">
            M<sub>máx</sub> = {result.forces.Mmax.toFixed(1)} kN·m
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Columnas
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.nColumnas}
          </p>
          <span className="text-xs text-text-muted">
            Correas: {result.nCorreas} líneas
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Altura columna
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.alturaColumna.toFixed(2)} m
          </p>
          <span className="text-xs text-text-muted">
            {result.nPaneles} paneles de {state.aCol}m
          </span>
        </div>
      </div>

      {/* Forces row — adapted per type */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {state.tipoColumna !== 1 && (
          <>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                N<sub>cordón</sub>
              </span>
              <p className="text-sm font-bold">{result.forces.Nchord.toFixed(1)} kN</p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                N<sub>diag</sub>
              </span>
              <p className="text-sm font-bold">{result.forces.Ndiag.toFixed(1)} kN</p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                N<sub>mont</sub>
              </span>
              <p className="text-sm font-bold">{result.forces.Nmont.toFixed(1)} kN</p>
            </div>
          </>
        )}
        {state.tipoColumna === 1 && (
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>máx</sub>
            </span>
            <p className="text-sm font-bold">{result.forces.Mmax.toFixed(1)} kN·m</p>
            <span className="text-xs text-text-muted">
              momento de cálculo
            </span>
          </div>
        )}
        {result.brace && (
          <>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                Puntal — axil
              </span>
              <p className="text-sm font-bold">{result.brace.axilPuntal.toFixed(1)} kN</p>
              <span className="text-xs text-text-muted">
                α = {result.brace.alphaPuntal.toFixed(1)}° &middot; L = {result.brace.lPuntal.toFixed(2)} m
              </span>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                R<sub>av</sub> / R<sub>ah</sub> (base A)
              </span>
              <p className="text-sm font-bold">
                V: {result.brace.Rav.toFixed(1)} kN ↓
              </p>
              <span className="text-xs text-text-muted">
                H: {result.brace.Rah.toFixed(1)} kN ←
              </span>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">
                R<sub>bv</sub> / R<sub>bh</sub> (base B)
              </span>
              <p className="text-sm font-bold">
                V: {result.brace.Rbv.toFixed(1)} kN ↑
              </p>
              <span className="text-xs text-text-muted">
                H: {result.brace.Rbh.toFixed(1)} kN ←
              </span>
            </div>
          </>
        )}
        {!result.brace && (
          <div className="bg-surface-alt rounded-lg p-3 col-span-2">
            <span className="text-xs text-text-muted">Modelo</span>
            <p className="text-sm font-bold">Voladizo (sin puntal)</p>
          </div>
        )}
      </div>

      {/* Verification banner */}
      <div
        className={`p-4 rounded-xl border-2 text-center ${result.passes ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
      >
        <span className="text-xs uppercase tracking-wider font-semibold">
          {state.tipoColumna === 1
            ? "Verificación flexocompresión (CIRSOC 301) — φc = 0.85, φb = 0.90"
            : "Verificación de barras — CIRSOC 301 (φc = 0.85)"}
        </span>
        <p
          className={`text-3xl font-bold ${result.passes ? "text-success" : "text-danger"}`}
        >
          Ratio máx = {result.ratioColumna.toFixed(2)} {result.passes ? "✓ Verifica" : "✗ No verifica"}
        </p>
      </div>

      {/* Brace verification banner — independent from column */}
      {result.braceCheck && (
        <div
          className={`p-4 rounded-xl border-2 text-center ${result.braceCheck.passesBrace ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
        >
          <span className="text-xs uppercase tracking-wider font-semibold">
            Verificación del puntal — Tipo {result.braceCheck.tipo} (CIRSOC 301, φ<sub>c</sub> = 0.85)
          </span>
          <p
            className={`text-3xl font-bold ${result.braceCheck.passesBrace ? "text-success" : "text-danger"}`}
          >
            Ratio puntal = {result.braceCheck.ratioBrace.toFixed(2)}{" "}
            {result.braceCheck.passesBrace ? "✓ Verifica" : "✗ No verifica"}
          </p>
        </div>
      )}

      {/* Brace check details */}
      {result.braceCheck && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.braceCheck.tipo === 1 && result.braceCheck.chkAngle && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Puntal — L 2″×3/16″ (Pu/2 por ángulo)
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.braceCheck.chkAngle.KLr.toFixed(0)}</p>
                <p>F<sub>cr</sub> = {result.braceCheck.chkAngle.Fcr.toFixed(0)} MPa</p>
                <p>&phi;·P<sub>n</sub> = {result.braceCheck.chkAngle.phiPn.toFixed(1)} kN</p>
                <p>N = {result.braceCheck.chkAngle.force.toFixed(1)} kN (por ángulo)</p>
                <p className={`font-bold ${result.braceCheck.chkAngle.ok ? "text-success" : "text-danger"}`}>
                  Ratio = {result.braceCheck.chkAngle.ratio.toFixed(2)}{" "}
                  {result.braceCheck.chkAngle.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}

          {result.braceCheck.globalCheck && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Puntal — Verificación global (Grupo 4)
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>&lambda;<sub>0</sub> = {result.braceCheck.globalCheck.lambda0.toFixed(1)}</p>
                <p>&lambda;<sub>c</sub> = {result.braceCheck.globalCheck.lambdaC.toFixed(3)}</p>
                <p>F<sub>cr</sub> = {result.braceCheck.globalCheck.Fcr_MPa.toFixed(0)} MPa</p>
                <p>&phi;·P<sub>n</sub> = {result.braceCheck.globalCheck.phiPn_kN.toFixed(1)} kN</p>
                <p>P<sub>u</sub> = {result.braceCheck.globalCheck.Pu_kN.toFixed(1)} kN</p>
                <p className={`font-bold ${result.braceCheck.globalCheck.passes ? "text-success" : "text-danger"}`}>
                  Ratio = {result.braceCheck.globalCheck.ratio.toFixed(2)}{" "}
                  {result.braceCheck.globalCheck.passes ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}

          {result.braceCheck.chkDiagonal && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Puntal — Diagonal L 1″×1/8″
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.braceCheck.chkDiagonal.KLr.toFixed(0)}</p>
                <p>F<sub>cr</sub> = {result.braceCheck.chkDiagonal.Fcr.toFixed(0)} MPa</p>
                <p>&phi;·P<sub>n</sub> = {result.braceCheck.chkDiagonal.phiPn.toFixed(2)} kN</p>
                <p>N = {result.braceCheck.chkDiagonal.force.toFixed(2)} kN</p>
                <p className={`font-bold ${result.braceCheck.chkDiagonal.ok ? "text-success" : "text-danger"}`}>
                  Ratio = {result.braceCheck.chkDiagonal.ratio.toFixed(2)}{" "}
                  {result.braceCheck.chkDiagonal.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}

          {result.braceCheck.chkMontant && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Puntal — Montante L 1″×1/8″
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.braceCheck.chkMontant.KLr.toFixed(0)}</p>
                <p>F<sub>cr</sub> = {result.braceCheck.chkMontant.Fcr.toFixed(0)} MPa</p>
                <p>&phi;·P<sub>n</sub> = {result.braceCheck.chkMontant.phiPn.toFixed(2)} kN</p>
                <p>N = {result.braceCheck.chkMontant.force.toFixed(2)} kN</p>
                <p className={`font-bold ${result.braceCheck.chkMontant.ok ? "text-success" : "text-danger"}`}>
                  Ratio = {result.braceCheck.chkMontant.ratio.toFixed(2)}{" "}
                  {result.braceCheck.chkMontant.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}

          {result.braceCheck.lateralBracing_cm !== undefined && (
            <div className="bg-surface-alt rounded-lg p-4 col-span-full">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Arriostramiento lateral
              </span>
              <p className="text-lg font-bold text-primary mt-1">
                Requerido cada {result.braceCheck.lateralBracing_cm.toFixed(0)} cm
              </p>
              <span className="text-xs text-text-muted">
                &lambda;<sub>lim</sub> = &pi;·&radic;(E/F<sub>y</sub>)
              </span>
            </div>
          )}
        </div>
      )}

      {/* T1: Flexocompression result card */}
      {state.tipoColumna === 1 && result.flexoResult && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Flexocompresión — {state.perfilIPN}
          </span>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-text-muted">KL/r<sub>x</sub></span>
              <p className="font-bold">{result.flexoResult.KLrx.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">KL/r<sub>y</sub></span>
              <p className="font-bold">{result.flexoResult.KLry.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">Estado límite</span>
              <p className="font-bold">{result.flexoResult.limitState}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">φ·P<sub>n</sub></span>
              <p className="font-bold">{result.flexoResult.phiPn.toFixed(1)} kN</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-text-muted">φ·M<sub>n,x</sub></span>
              <p className="font-bold">{result.flexoResult.phiMnx.toFixed(1)} kN·m</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">φ·M<sub>n,y</sub></span>
              <p className="font-bold">{result.flexoResult.phiMny.toFixed(1)} kN·m</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">Ratio interacción</span>
              <p className={`font-bold ${result.flexoResult.passes ? "text-success" : "text-danger"}`}>
                {result.flexoResult.ratio.toFixed(3)} {result.flexoResult.passes ? "✓" : "✗"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* T2/T4: Per-bar verification cards */}
      {state.tipoColumna !== 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {result.chkCordon && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Cordón — {result.chkCordon.name}
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.chkCordon.KLr.toFixed(0)}</p>
                <p>
                  F<sub>cr</sub> = {result.chkCordon.Fcr.toFixed(0)} MPa
                </p>
                <p>
                  φ·P<sub>n</sub> = {result.chkCordon.phiPn.toFixed(1)} kN
                </p>
                <p>N = {result.chkCordon.force.toFixed(1)} kN</p>
                <p
                  className={`font-bold ${result.chkCordon.ok ? "text-success" : "text-danger"}`}
                >
                  Ratio = {result.chkCordon.ratio.toFixed(2)}{" "}
                  {result.chkCordon.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}
          {result.chkDiag && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Diagonal — {result.chkDiag.name}
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.chkDiag.KLr.toFixed(0)}</p>
                <p>
                  F<sub>cr</sub> = {result.chkDiag.Fcr.toFixed(0)} MPa
                </p>
                <p>
                  φ·P<sub>n</sub> = {result.chkDiag.phiPn.toFixed(1)} kN
                </p>
                <p>N = {result.chkDiag.force.toFixed(1)} kN</p>
                <p
                  className={`font-bold ${result.chkDiag.ok ? "text-success" : "text-danger"}`}
                >
                  Ratio = {result.chkDiag.ratio.toFixed(2)}{" "}
                  {result.chkDiag.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}
          {result.chkMont && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Montante — {result.chkMont.name}
              </span>
              <div className="mt-2 space-y-1 text-sm">
                <p>KL/r = {result.chkMont.KLr.toFixed(0)}</p>
                <p>
                  F<sub>cr</sub> = {result.chkMont.Fcr.toFixed(0)} MPa
                </p>
                <p>
                  φ·P<sub>n</sub> = {result.chkMont.phiPn.toFixed(1)} kN
                </p>
                <p>N = {result.chkMont.force.toFixed(1)} kN</p>
                <p
                  className={`font-bold ${result.chkMont.ok ? "text-success" : "text-danger"}`}
                >
                  Ratio = {result.chkMont.ratio.toFixed(2)}{" "}
                  {result.chkMont.ok ? "✓" : "✗"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* T2/T4: Global column check */}
      {state.tipoColumna !== 1 && result.globalCheck && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Verificación global del conjunto (CIRSOC 301 Grupo 4)
          </span>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div>
              <span className="text-xs text-text-muted">λ₀</span>
              <p className="font-bold">{result.globalCheck.lambda0.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">λ₁</span>
              <p className="font-bold">{result.globalCheck.lambda1.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">λₘ</span>
              <p className="font-bold">{result.globalCheck.lambdaM.toFixed(1)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">λ<sub>c</sub></span>
              <p className="font-bold">{result.globalCheck.lambdaC.toFixed(3)}</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">F<sub>cr</sub> (MPa)</span>
              <p className="font-bold">{result.globalCheck.Fcr_MPa.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-text-muted">&phi;·P<sub>n</sub></span>
              <p className="font-bold">{result.globalCheck.phiPn_kN.toFixed(1)} kN</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">P<sub>u</sub></span>
              <p className="font-bold">{result.globalCheck.Pu_kN.toFixed(1)} kN</p>
            </div>
            <div>
              <span className="text-xs text-text-muted">Ratio</span>
              <p
                className={`font-bold ${result.globalCheck.passes ? "text-success" : "text-danger"}`}
              >
                {result.globalCheck.ratio.toFixed(2)}{" "}
                {result.globalCheck.passes ? "✓" : "✗"}
              </p>
            </div>
            <div>
              <span className="text-xs text-text-muted">&phi;<sub>c</sub></span>
              <p className="font-bold">0.85</p>
            </div>
          </div>
        </div>
      )}

      {/* Wind params */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">
            q<sub>z</sub>
          </span>
          <p className="text-sm font-bold">{result.wind.qz.toFixed(0)} N/m²</p>
        </div>
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">p</span>
          <p className="text-sm font-bold">{result.wind.p.toFixed(0)} N/m²</p>
        </div>
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">
            K<sub>z</sub>
          </span>
          <p className="text-sm font-bold">{result.wind.Kz.toFixed(3)}</p>
          <span className="text-xs text-text-muted">z = {result.wind.z.toFixed(1)} m</span>
        </div>
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">I</span>
          <p className="text-sm font-bold">{result.wind.I.toFixed(2)}</p>
        </div>
        <div className="bg-surface-alt rounded-lg p-3">
          <span className="text-xs text-text-muted">
            A<sub>cartel</sub>
          </span>
          <p className="text-sm font-bold">{result.wind.areaCartel.toFixed(1)} m²</p>
        </div>
      </div>

      {/* Column steel summary — hidden for T1, adapted for T4 */}
      {state.tipoColumna !== 1 && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Acero por columna
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">L cordones</span>
              <p className="text-sm font-bold">{result.longCordones.toFixed(1)} m</p>
              {state.tipoColumna === 4 && (
                <span className="text-xs text-text-muted">× 4 cordones</span>
              )}
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">L montantes</span>
              <p className="text-sm font-bold">{result.longMontantes.toFixed(1)} m</p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">L diagonales</span>
              <p className="text-sm font-bold">{result.longDiagonales.toFixed(1)} m</p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">Total / columna</span>
              <p className="text-sm font-bold">{result.longTotal.toFixed(1)} m</p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <span className="text-xs text-text-muted">Total obra</span>
              <p className="text-sm font-bold">
                {(result.longTotal * result.nColumnas).toFixed(1)} m
              </p>
              <span className="text-xs text-text-muted">
                × {result.nColumnas} columnas
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Full steps */}
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
