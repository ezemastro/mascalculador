import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { listSaves, type SavedBeam } from "../lib/storage";
import { IPN_PROFILES } from "../lib/profiles";
import { UPN_PROFILES, getDoubleUPN } from "../lib/upn-profiles";
import { TUBE_PROFILES } from "../lib/tube-profiles";
import {
  designColumn,
  computeBuiltUpI,
  computeBuiltUpBox,
  type LocalBucklingParams,
} from "../lib/column-calc";
import type { ColumnState } from "./ColumnForm";

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 12mm; }
  body { font-size: 9px; color: #000; }
  .no-print { display: none !important; }
  table { page-break-inside: avoid; font-size: 9px; }
  h1 { font-size: 14px; }
  h2 { font-size: 12px; }
  h3 { font-size: 10px; }
}`;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const PROFILE_TYPE_LABELS: Record<string, string> = {
  IPN: "IPN (Doble T)",
  UPN: "UPN (Canal)",
  "2UPN": "Doble UPN (cajón)",
  TUBO: "Tubo (SHS/RHS)",
  ARMADA_I: "Doble T armada",
  ARMADA_CAJON: "Cajón armado",
};

// ---------------------------------------------------------------------------
// Nav-state column printout
// ---------------------------------------------------------------------------
function NavColumnPrintout({ state }: { state: ColumnState }) {
  const navigate = useNavigate();

  const { result, displayName } = useMemo(() => {
    let Ag: number,
      Ix: number,
      Iy: number,
      Zx: number,
      Zy: number,
      name: string;
    let localBuckling: LocalBucklingParams | undefined;

    if (state.profileType === "IPN") {
      const p = IPN_PROFILES.find((x) => x.name === state.profileName);
      if (!p) return { result: null, displayName: state.profileName };
      Ag = p.A; Ix = p.Ix; Iy = p.Iy; Zx = p.Zx; Zy = p.Zx * 0.6;
      name = p.name;
      localBuckling = { section: "I", bf: p.b, tf: p.tf, h: p.h, tw: p.tw };
    } else if (state.profileType === "UPN") {
      const upn = UPN_PROFILES.find((x) => x.name === state.upnName);
      if (!upn) return { result: null, displayName: state.upnName };
      Ag = upn.A; Ix = upn.Ix; Iy = upn.Iy; Zx = upn.Zx; Zy = upn.Zy;
      name = upn.name;
      localBuckling = { section: "C", bf: upn.b, tf: upn.tf, h: upn.h, tw: upn.tw };
    } else if (state.profileType === "TUBO") {
      const tube = TUBE_PROFILES.find((x) => x.name === state.tubeName);
      if (!tube) return { result: null, displayName: state.tubeName ?? "—" };
      Ag = tube.A; Ix = tube.Ix; Iy = tube.Iy; Zx = tube.Zx; Zy = tube.Zy;
      name = tube.name;
      localBuckling = { section: "HSS", bf: tube.b, tf: tube.t, h: tube.h, tw: tube.t };
    } else if (state.profileType === "ARMADA_I") {
      if (state.armadaBf === undefined || state.armadaTf === undefined ||
          state.armadaHw === undefined || state.armadaTw === undefined)
        return { result: null, displayName: "Armada I" };
      const built = computeBuiltUpI(state.armadaBf, state.armadaTf, state.armadaHw, state.armadaTw);
      Ag = built.Ag; Ix = built.Ix; Iy = built.Iy; Zx = built.Zx; Zy = built.Zy;
      name = built.name;
      localBuckling = built.localBuckling;
    } else if (state.profileType === "ARMADA_CAJON") {
      if (state.cajonH === undefined || state.cajonB === undefined || state.cajonT === undefined)
        return { result: null, displayName: "Cajón armado" };
      const built = computeBuiltUpBox(state.cajonH, state.cajonB, state.cajonT);
      Ag = built.Ag; Ix = built.Ix; Iy = built.Iy; Zx = built.Zx; Zy = built.Zy;
      name = built.name;
      localBuckling = built.localBuckling;
    } else {
      // 2UPN
      const upn = UPN_PROFILES.find((x) => x.name === state.upnName);
      if (!upn) return { result: null, displayName: state.upnName };
      const d = getDoubleUPN(upn, state.upnGap);
      Ag = d.A; Ix = d.Ix; Iy = d.Iy; Zx = d.Zx; Zy = d.Zy;
      name = d.name;
      localBuckling = { section: "C", bf: upn.b, tf: upn.tf, h: upn.h, tw: upn.tw };
    }

    const r = designColumn(
      { Pu: state.Pu, Mux: state.Mux, Muy: state.Muy, L: state.L, Kx: state.Kx, Ky: state.Ky, Fy: state.Fy },
      Ag, Ix, Iy, Zx, Zy,
      name,
      localBuckling,
    );

    return { result: r, displayName: name };
  }, [state]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imprimir planilla — Columna</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            ← Volver
          </button>
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700"
          >
            Imprimir
          </button>
        </div>
      </div>

      {!result && (
        <div className="max-w-4xl mx-auto text-center text-red-600 font-semibold py-12">
          No se pudo recalcular la columna. Verifique los datos.
        </div>
      )}

      {result && (
        <div className="max-w-4xl mx-auto print:max-w-none text-[10px] print:text-[9px]">
          {/* HEADER */}
          <div className="border-b-4 border-black pb-3 mb-4">
            <h1 className="text-lg font-bold">PLANILLA DE CÁLCULO</h1>
            <p className="text-sm text-gray-600">Columna de acero — CIRSOC 301-05</p>
            <p className="text-sm">
              Perfil: <strong>{displayName}</strong>
              &nbsp;&mdash;&nbsp; Fecha: {todayISO()}
            </p>
          </div>

          {/* 1. DATOS DE LA COLUMNA */}
          <h2 className="font-bold text-sm mb-1">1. DATOS DE LA COLUMNA</h2>
          <table className="w-full text-xs mb-4 border border-black">
            <tbody>
              <tr>
                <td className="font-bold p-1 border w-32">Tipo de perfil</td>
                <td className="p-1 border">{PROFILE_TYPE_LABELS[state.profileType] ?? state.profileType}</td>
                <td className="font-bold p-1 border w-24">Perfil</td>
                <td className="p-1 border">
                  {state.profileType === "IPN" ? state.profileName
                   : state.profileType === "UPN" || state.profileType === "2UPN" ? state.upnName
                   : state.profileType === "TUBO" ? state.tubeName
                   : state.profileType === "ARMADA_I" ? `bf=${state.armadaBf} tf=${state.armadaTf} hw=${state.armadaHw} tw=${state.armadaTw}`
                   : `h=${state.cajonH} b=${state.cajonB} t=${state.cajonT}`}
                </td>
              </tr>
              {state.profileType === "2UPN" && (
                <tr>
                  <td className="font-bold p-1 border">Separación</td>
                  <td className="p-1 border" colSpan={3}>{state.upnGap} mm</td>
                </tr>
              )}
              <tr>
                <td className="font-bold p-1 border">
                  F<sub>y</sub>
                </td>
                <td className="p-1 border">{state.Fy} MPa</td>
                <td className="font-bold p-1 border">L</td>
                <td className="p-1 border">{state.L} mm</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">
                  K<sub>x</sub>
                </td>
                <td className="p-1 border">{state.Kx}</td>
                <td className="font-bold p-1 border">
                  K<sub>y</sub>
                </td>
                <td className="p-1 border">{state.Ky}</td>
              </tr>
            </tbody>
          </table>

          {/* 2. SOLICITACIONES */}
          <h2 className="font-bold text-sm mb-1">2. SOLICITACIONES</h2>
          <table className="w-full text-xs mb-4 border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border text-left">Carga</th>
                <th className="p-1 border text-right">Valor</th>
                <th className="p-1 border text-left">Unidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold p-1 border">
                  P<sub>u</sub>
                </td>
                <td className="p-1 border text-right font-mono">{state.Pu.toFixed(1)}</td>
                <td className="p-1 border">kN</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">
                  M<sub>u,x</sub>
                </td>
                <td className="p-1 border text-right font-mono">{state.Mux.toFixed(1)}</td>
                <td className="p-1 border">kN·m</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">
                  M<sub>u,y</sub>
                </td>
                <td className="p-1 border text-right font-mono">{state.Muy.toFixed(1)}</td>
                <td className="p-1 border">kN·m</td>
              </tr>
            </tbody>
          </table>

          {/* 3. RESULTADOS */}
          <h2 className="font-bold text-sm mb-1">3. RESULTADOS — CIRSOC 301-05</h2>

          <table className="w-full text-xs mb-4 border border-black">
            <tbody>
              <tr>
                <td className="font-bold p-1 border w-40">
                  &phi;<sub>c</sub>P<sub>n</sub>
                </td>
                <td className="p-1 border text-right font-mono">{result.phiPn.toFixed(1)} kN</td>
                <td className="font-bold p-1 border w-40">
                  P<sub>u</sub> / &phi;<sub>c</sub>P<sub>n</sub>
                </td>
                <td className="p-1 border text-right font-mono">{(state.Pu / result.phiPn).toFixed(3)}</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">
                  &phi;<sub>b</sub>M<sub>n,x</sub>
                </td>
                <td className="p-1 border text-right font-mono">{result.phiMnx.toFixed(1)} kN·m</td>
                <td className="font-bold p-1 border">
                  &phi;<sub>b</sub>M<sub>n,y</sub>
                </td>
                <td className="p-1 border text-right font-mono">{result.phiMny.toFixed(1)} kN·m</td>
              </tr>
            </tbody>
          </table>

          {/* 4. RELACIÓN DE INTERACCIÓN */}
          <h2 className="font-bold text-sm mb-1">4. RELACIÓN DE INTERACCIÓN (Cap. H)</h2>
          <div
            className={`p-3 rounded mb-4 text-sm font-bold border ${
              result.passes
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-red-100 text-red-800 border-red-300"
            }`}
          >
            Ratio = {result.ratio.toFixed(3)} &mdash; {result.passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}
          </div>
          <p className="text-xs text-gray-600 mb-4">{result.limitState}</p>

          {/* 5. CUENTAS COMPLETAS */}
          <h2 className="font-bold text-sm mb-1">5. CUENTAS COMPLETAS</h2>
          <pre className="p-3 border border-black rounded text-[8px] text-black font-mono whitespace-pre-wrap overflow-x-auto mb-4">
            {result.steps.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved-column mode
// ---------------------------------------------------------------------------
function SavedColumnPrintout() {
  const [selected, setSelected] = useState<SavedBeam | null>(null);
  const saves = listSaves();
  const columnSaves = saves.filter((s) => s.type === "columna");

  const col = selected;
  const d = (col?.data || {}) as Record<string, unknown>;

  const state = useMemo((): ColumnState | null => {
    if (!col) return null;
    return {
      profileType: (d.profileType as ColumnState["profileType"]) ?? "IPN",
      profileName: (d.profileName as string) ?? "IPN 200",
      upnName: (d.upnName as string) ?? "UPN 200",
      upnGap: (d.upnGap as number) ?? 10,
      tubeName: d.tubeName as string | undefined,
      armadaBf: d.armadaBf as number | undefined,
      armadaTf: d.armadaTf as number | undefined,
      armadaHw: d.armadaHw as number | undefined,
      armadaTw: d.armadaTw as number | undefined,
      cajonH: d.cajonH as number | undefined,
      cajonB: d.cajonB as number | undefined,
      cajonT: d.cajonT as number | undefined,
      Pu: (d.Pu as number) ?? 0,
      Mux: (d.Mux as number) ?? 0,
      Muy: (d.Muy as number) ?? 0,
      L: (d.L as number) ?? 3000,
      Kx: (d.Kx as number) ?? 1.0,
      Ky: (d.Ky as number) ?? 1.0,
      Fy: (d.Fy as number) ?? 235,
    };
  }, [col, d]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Imprimir planilla — Columna</h1>
        {columnSaves.length === 0 && (
          <p className="text-gray-500">
            No hay columnas guardadas. Guardá una desde la calculadora de columnas.
          </p>
        )}
        <div className="grid gap-2 mb-6">
          {columnSaves.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`text-left p-3 rounded border ${selected?.id === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-gray-500 ml-2">— Columna — {s.date}</span>
            </button>
          ))}
        </div>
        {col && (
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700"
          >
            Imprimir
          </button>
        )}
      </div>

      {state && <NavColumnPrintout state={state} />}
    </div>
  );
}

// =========================================================================
// Main ColumnPrintPage
// =========================================================================
export default function ColumnPrintPage() {
  const location = useLocation();
  const navState = location.state as ColumnState | null;

  // window.print() on mount when planilla is ready
  useEffect(() => {
    if (navState) {
      // Small delay to let the render finish before print dialog
      const t = setTimeout(() => window.print(), 200);
      return () => clearTimeout(t);
    }
  }, [navState]);

  if (navState) {
    return <NavColumnPrintout state={navState} />;
  }

  return <SavedColumnPrintout />;
}
