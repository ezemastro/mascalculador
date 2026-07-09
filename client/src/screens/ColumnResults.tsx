import { useLocation, useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import { IPN_PROFILES } from "../lib/profiles";
import { UPN_PROFILES, getDoubleUPN } from "../lib/upn-profiles";
import { TUBE_PROFILES } from "../lib/tube-profiles";
import { designColumn } from "../lib/column-calc";
import type { ColumnState } from "./ColumnForm";

export default function ColumnResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ColumnState | null;

  if (!state) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/columns")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  const {
    profileType,
    profileName,
    upnName,
    upnGap,
    tubeName,
    Pu,
    Mux,
    Muy,
    L,
    Kx,
    Ky,
    Fy,
  } = state;

  let Ag: number,
    Ix: number,
    Iy: number,
    Zx: number,
    Zy: number,
    displayName: string;

  if (profileType === "IPN") {
    const p = IPN_PROFILES.find((x) => x.name === profileName);
    if (!p) {
      return (
        <MainLayout>
          <p className="text-danger p-8">Perfil {profileName} no encontrado.</p>
        </MainLayout>
      );
    }
    Ag = p.A;
    Ix = p.Ix;
    Iy = p.Iy;
    Zx = p.Zx;
    Zy = p.Zx * 0.6; // approximate Zy for IPN
    displayName = p.name;
  } else if (profileType === "UPN") {
    const upn = UPN_PROFILES.find((x) => x.name === upnName);
    if (!upn) {
      return (
        <MainLayout>
          <p className="text-danger p-8">UPN {upnName} no encontrado.</p>
        </MainLayout>
      );
    }
    Ag = upn.A;
    Ix = upn.Ix;
    Iy = upn.Iy;
    Zx = upn.Zx;
    Zy = upn.Zy;
    displayName = upn.name;
  } else if (profileType === "TUBO") {
    const tube = TUBE_PROFILES.find((x) => x.name === tubeName);
    if (!tube) {
      return (
        <MainLayout>
          <p className="text-danger p-8">Tubo {tubeName} no encontrado.</p>
        </MainLayout>
      );
    }
    Ag = tube.A;
    Ix = tube.Ix;
    Iy = tube.Iy;
    Zx = tube.Zx;
    Zy = tube.Zy;
    displayName = tube.name;
  } else {
    const upn = UPN_PROFILES.find((x) => x.name === upnName);
    if (!upn) {
      return (
        <MainLayout>
          <p className="text-danger p-8">UPN {upnName} no encontrado.</p>
        </MainLayout>
      );
    }
    const d = getDoubleUPN(upn, upnGap);
    Ag = d.A;
    Ix = d.Ix;
    Iy = d.Iy;
    Zx = d.Zx;
    Zy = d.Zy;
    displayName = d.name;
  }

  const result = designColumn(
    { Pu, Mux, Muy, L, Kx, Ky, Fy },
    Ag,
    Ix,
    Iy,
    Zx,
    Zy,
    displayName,
  );

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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text">
              Columna {displayName}
            </h1>
            <p className="text-sm text-text-muted">
              L = {L} mm &middot; K<sub>x</sub> = {Kx} &middot; K<sub>y</sub> ={" "}
              {Ky} &middot; F<sub>y</sub> = {Fy} MPa
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/columns")}
          className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
        >
          ← Volver
        </button>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            φ<sub>c</sub>P<sub>n</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.phiPn.toFixed(1)} kN
          </p>
          <span className="text-xs text-text-muted">
            P<sub>u</sub> = {Pu.toFixed(1)} kN
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            P<sub>r</sub>/P<sub>c</sub>
          </span>
          <p
            className={`text-2xl font-bold mt-1 ${Pu / result.phiPn < 0.2 ? "text-warning" : "text-primary"}`}
          >
            {(Pu / result.phiPn).toFixed(3)}
          </p>
          <span className="text-xs text-text-muted">
            {Pu / result.phiPn >= 0.2 ? "≥ 0.2" : "< 0.2"}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            φ<sub>b</sub>M<sub>n,x</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.phiMnx.toFixed(1)} kN·m
          </p>
          <span className="text-xs text-text-muted">
            M<sub>ux</sub> = {Mux.toFixed(1)} kN·m
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            φ<sub>b</sub>M<sub>n,y</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.phiMny.toFixed(1)} kN·m
          </p>
          <span className="text-xs text-text-muted">
            M<sub>uy</sub> = {Muy.toFixed(1)} kN·m
          </span>
        </div>
      </div>

      {/* Interaction ratio */}
      <div
        className={`p-4 rounded-xl border-2 text-center ${result.passes ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
      >
        <span className="text-xs uppercase tracking-wider font-semibold">
          Relación de interacción (Cap. H)
        </span>
        <p
          className={`text-3xl font-bold ${result.passes ? "text-success" : "text-danger"}`}
        >
          {result.ratio.toFixed(3)} {result.passes ? "✓" : "✗"}
        </p>
        <span className="text-xs text-text-muted">{result.limitState}</span>
      </div>

      {/* Detailed steps */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Cuentas completas
        </h2>
        <pre className="p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {result.steps.join("\n")}
        </pre>
      </section>
    </MainLayout>
  );
}
