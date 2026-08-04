import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { listSaves, type SavedBeam } from "../lib/storage";
import { calculateCartel } from "../lib/cartel-calc";
import type { CartelState } from "./CartelForm";

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

// ---------------------------------------------------------------------------
// Nav-state printout
// ---------------------------------------------------------------------------
function NavCartelPrintout({ state }: { state: CartelState }) {
  const navigate = useNavigate();
  const result = useMemo(() => calculateCartel(state), [state]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imprimir planilla — Cartel</h1>
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

      <div className="max-w-4xl mx-auto print:max-w-none text-[10px] print:text-[9px]">
        {/* HEADER */}
        <div className="border-b-4 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold">MEMORIA DE CÁLCULO</h1>
          <p className="text-sm text-gray-600">
            Cartel publicitario — CIRSOC 102 (viento) + CIRSOC 301 (columnas)
          </p>
          <p className="text-sm">
            Fecha: <strong>{todayISO()}</strong>
          </p>
        </div>

        {/* 1. DATOS DEL CARTEL */}
        <h2 className="font-bold text-sm mb-1">1. DATOS DEL CARTEL</h2>
        <table className="w-full text-xs mb-4 border border-black">
          <tbody>
            <tr>
              <td className="font-bold p-1 border w-36">Ancho cartel</td>
              <td className="p-1 border">{state.anchoCartel.toFixed(2)} m</td>
              <td className="font-bold p-1 border w-36">Alto cartel</td>
              <td className="p-1 border">{state.altoCartel.toFixed(2)} m</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Despegue</td>
              <td className="p-1 border">{state.despegue.toFixed(2)} m</td>
              <td className="font-bold p-1 border">Área cartel</td>
              <td className="p-1 border">{result.wind.areaCartel.toFixed(1)} m²</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Sep. columnas</td>
              <td className="p-1 border">{state.sepColumnas.toFixed(2)} m</td>
              <td className="font-bold p-1 border">Sep. correas</td>
              <td className="p-1 border">{state.sepCorreas.toFixed(2)} m</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Tipo columna</td>
              <td className="p-1 border">{state.tipoColumna}</td>
              <td className="font-bold p-1 border">Con puntal</td>
              <td className="p-1 border">
                {state.tienePuntal
                  ? `Sí — h=${state.hPuntal}m, d=${state.dPuntal}m, tipo ${state.tipoPuntal}`
                  : "No"}
              </td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Cant. columnas</td>
              <td className="p-1 border">{result.nColumnas}</td>
              <td className="font-bold p-1 border">Vuelo lateral</td>
              <td className="p-1 border">
                {(state.vueloLateral ?? 0) > 0 ? `${(state.vueloLateral ?? 0).toFixed(2)} m` : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. VIENTO */}
        <h2 className="font-bold text-sm mb-1">2. VIENTO — CIRSOC 102</h2>
        <table className="w-full text-xs mb-4 border border-black">
          <tbody>
            <tr>
              <td className="font-bold p-1 border w-36">Velocidad básica V</td>
              <td className="p-1 border">{state.velocidadViento} m/s</td>
              <td className="font-bold p-1 border w-36">Categoría</td>
              <td className="p-1 border">{state.categoria}</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Exposición</td>
              <td className="p-1 border">{state.exposicion}</td>
              <td className="font-bold p-1 border">I (importancia)</td>
              <td className="p-1 border">{result.wind.I.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">z (altura media)</td>
              <td className="p-1 border">{result.wind.z.toFixed(2)} m</td>
              <td className="font-bold p-1 border">K<sub>z</sub></td>
              <td className="p-1 border">{result.wind.Kz.toFixed(4)}</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">q<sub>z</sub></td>
              <td className="p-1 border">{result.wind.qz.toFixed(0)} N/m²</td>
              <td className="font-bold p-1 border">p (diseño)</td>
              <td className="p-1 border">{result.wind.p.toFixed(0)} N/m²</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                F<sub>viento</sub> (total)
              </td>
              <td className="p-1 border font-mono" colSpan={3}>
                {result.wind.Fviento.toFixed(1)} kN
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. GEOMETRÍA DE COLUMNA */}
        <h2 className="font-bold text-sm mb-1">3. GEOMETRÍA DE COLUMNA</h2>
        <table className="w-full text-xs mb-4 border border-black">
          <tbody>
            {state.tipoColumna === 1 ? (
              <>
                <tr>
                  <td className="font-bold p-1 border w-40">Perfil IPN</td>
                  <td className="p-1 border">{state.perfilIPN}</td>
                  <td className="font-bold p-1 border w-40">F<sub>y</sub></td>
                  <td className="p-1 border">{state.Fy} MPa</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Altura total</td>
                  <td className="p-1 border">{result.alturaColumna.toFixed(2)} m</td>
                  <td className="font-bold p-1 border">Columnas</td>
                  <td className="p-1 border">{result.nColumnas}</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">L<sub>b</sub> fuerte (x-x)</td>
                  <td className="p-1 border">
                    {state.tienePuntal ? `${state.hPuntal} m (con puntal)` : `${(2 * result.alturaColumna).toFixed(2)} m (K=2.0 voladizo)`}
                  </td>
                  <td className="font-bold p-1 border">L<sub>b</sub> débil (y-y)</td>
                  <td className="p-1 border">{state.sepCorreas} m (sep. correas)</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Correas</td>
                  <td className="p-1 border">{result.nCorreas} líneas</td>
                  <td className="font-bold p-1 border"></td>
                  <td className="p-1 border"></td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td className="font-bold p-1 border w-40">
                    h<sub>col</sub> (ancho)
                  </td>
                  <td className="p-1 border">{state.hCol} m</td>
                  <td className="font-bold p-1 border w-40">
                    a<sub>col</sub> (panel)
                  </td>
                  <td className="p-1 border">{state.aCol} m</td>
                </tr>
                {state.tipoColumna === 4 && (
                  <tr>
                    <td className="font-bold p-1 border">
                      sep<sub>col</sub> (prof.)
                    </td>
                    <td className="p-1 border">{state.separacionCol} m</td>
                    <td className="font-bold p-1 border">Cordones</td>
                    <td className="p-1 border">4</td>
                  </tr>
                )}
                <tr>
                  <td className="font-bold p-1 border">Altura total</td>
                  <td className="p-1 border">{result.alturaColumna.toFixed(2)} m</td>
                  <td className="font-bold p-1 border">N° paneles</td>
                  <td className="p-1 border">{result.nPaneles}</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    d<sub>diag</sub>
                  </td>
                  <td className="p-1 border">{result.dDiag.toFixed(2)} m</td>
                  <td className="font-bold p-1 border">Columnas</td>
                  <td className="p-1 border">{result.nColumnas}</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    F<sub>y</sub>
                  </td>
                  <td className="p-1 border">{state.Fy} MPa</td>
                  <td className="font-bold p-1 border">Correas</td>
                  <td className="p-1 border">{result.nCorreas} líneas</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* 4. SOLICITACIONES */}
        <h2 className="font-bold text-sm mb-1">4. SOLICITACIONES EN COLUMNA</h2>
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
              <td className="font-bold p-1 border">F<sub>col</sub> (por columna)</td>
              <td className="p-1 border text-right font-mono">{result.forces.Fcol.toFixed(2)}</td>
              <td className="p-1 border">kN (ancho trib.)</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Peso propio (por columna)</td>
              <td className="p-1 border text-right font-mono">{(0.3 * state.sepColumnas * state.altoCartel).toFixed(2)}</td>
              <td className="p-1 border">kN</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                M<sub>máx,sup</sub> (sobre C)
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.MmaxSup.toFixed(1)}</td>
              <td className="p-1 border">kN·m</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                M<sub>máx,inf</sub> (entre A y C)
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.MmaxInf.toFixed(1)}</td>
              <td className="p-1 border">kN·m</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                M<sub>máx</sub> (diseño)
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.Mmax.toFixed(1)}</td>
              <td className="p-1 border">kN·m</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                N<sub>cordón</sub>
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.Nchord.toFixed(1)}</td>
              <td className="p-1 border">kN</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                N<sub>diag</sub>
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.Ndiag.toFixed(1)}</td>
              <td className="p-1 border">kN</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                N<sub>mont</sub>
              </td>
              <td className="p-1 border text-right font-mono">{result.forces.Nmont.toFixed(1)}</td>
              <td className="p-1 border">kN</td>
            </tr>
            {result.brace && (
              <>
                <tr>
                  <td className="font-bold p-1 border" colSpan={3}>
                    — Reacciones (arco triarticulado) —
                  </td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    R<sub>av</sub> (base A, ↓)
                  </td>
                  <td className="p-1 border text-right font-mono">{result.brace.Rav.toFixed(2)}</td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    R<sub>ah</sub> (base A, ←)
                  </td>
                  <td className="p-1 border text-right font-mono">{result.brace.Rah.toFixed(2)}</td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    R<sub>bv</sub> (base B, ↑)
                  </td>
                  <td className="p-1 border text-right font-mono">{result.brace.Rbv.toFixed(2)}</td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">
                    R<sub>bh</sub> (base B, ←)
                  </td>
                  <td className="p-1 border text-right font-mono">{result.brace.Rbh.toFixed(2)}</td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">N<sub>puntal</sub> (axil)</td>
                  <td className="p-1 border text-right font-mono">{result.brace.axilPuntal.toFixed(1)}</td>
                  <td className="p-1 border">kN (compresión)</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Puntal — α</td>
                  <td className="p-1 border text-right font-mono">{result.brace.alphaPuntal.toFixed(1)}</td>
                  <td className="p-1 border">°</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Puntal — L</td>
                  <td className="p-1 border text-right font-mono">{result.brace.lPuntal.toFixed(2)}</td>
                  <td className="p-1 border">m</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* 5. VERIFICACIÓN */}
        <h2 className="font-bold text-sm mb-1">
          5. {state.tipoColumna === 1
            ? "VERIFICACIÓN FLEXOCOMPRESIÓN — CIRSOC 301 (φc = 0.85, φb = 0.90)"
            : "VERIFICACIÓN DE BARRAS — CIRSOC 301 (φc = 0.85)"}
        </h2>
        {state.tipoColumna === 1 && result.flexoResult ? (
          <table className="w-full text-xs mb-4 border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border text-left">Parámetro</th>
                <th className="p-1 border text-right">Valor</th>
                <th className="p-1 border text-left">Unidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold p-1 border">KL/r<sub>x</sub> (fuerte)</td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.KLrx.toFixed(1)}</td>
                <td className="p-1 border">—</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">KL/r<sub>y</sub> (débil)</td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.KLry.toFixed(1)}</td>
                <td className="p-1 border">—</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">φ·P<sub>n</sub></td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.phiPn.toFixed(1)}</td>
                <td className="p-1 border">kN</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">φ·M<sub>n,x</sub></td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.phiMnx.toFixed(1)}</td>
                <td className="p-1 border">kN·m</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">φ·M<sub>n,y</sub></td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.phiMny.toFixed(1)}</td>
                <td className="p-1 border">kN·m</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">Ratio interacción</td>
                <td className="p-1 border text-right font-mono">{result.flexoResult.ratio.toFixed(3)}</td>
                <td className="p-1 border">{result.flexoResult.passes ? "✓" : "✗"}</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">Estado límite</td>
                <td className="p-1 border text-right font-mono" colSpan={2}>{result.flexoResult.limitState}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs mb-4 border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border text-left">Barra</th>
                <th className="p-1 border text-left">Perfil</th>
                <th className="p-1 border text-right">KL/r</th>
                <th className="p-1 border text-right">
                  F<sub>cr</sub> (MPa)
                </th>
                <th className="p-1 border text-right">
                  φP<sub>n</sub> (kN)
                </th>
                <th className="p-1 border text-right">N (kN)</th>
                <th className="p-1 border text-right">Ratio</th>
                <th className="p-1 border text-center">Verifica</th>
              </tr>
            </thead>
            <tbody>
              {result.chkCordon && (
                <tr>
                  <td className="p-1 border font-bold">Cordón</td>
                  <td className="p-1 border">{state.perfilCordon}</td>
                  <td className="p-1 border text-right font-mono">{result.chkCordon.KLr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkCordon.Fcr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkCordon.phiPn.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkCordon.force.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkCordon.ratio.toFixed(2)}</td>
                  <td className="p-1 border text-center">{result.chkCordon.ok ? "✓" : "✗"}</td>
                </tr>
              )}
              {result.chkDiag && (
                <tr>
                  <td className="p-1 border font-bold">Diagonal</td>
                  <td className="p-1 border">{state.perfilDiagonal}</td>
                  <td className="p-1 border text-right font-mono">{result.chkDiag.KLr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkDiag.Fcr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkDiag.phiPn.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkDiag.force.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkDiag.ratio.toFixed(2)}</td>
                  <td className="p-1 border text-center">{result.chkDiag.ok ? "✓" : "✗"}</td>
                </tr>
              )}
              {result.chkMont && (
                <tr>
                  <td className="p-1 border font-bold">Montante</td>
                  <td className="p-1 border">{state.perfilMontante}</td>
                  <td className="p-1 border text-right font-mono">{result.chkMont.KLr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkMont.Fcr.toFixed(0)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkMont.phiPn.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkMont.force.toFixed(1)}</td>
                  <td className="p-1 border text-right font-mono">{result.chkMont.ratio.toFixed(2)}</td>
                  <td className="p-1 border text-center">{result.chkMont.ok ? "✓" : "✗"}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* 5b. VERIFICACIÓN GLOBAL — Grupo 4 (T2/T4 only) */}
        {state.tipoColumna !== 1 && result.globalCheck && (
          <>
            <h2 className="font-bold text-sm mb-1">
              5b. VERIFICACIÓN GLOBAL DEL CONJUNTO — CIRSOC 301 Grupo 4 (φc = 0.85)
            </h2>
            <table className="w-full text-xs mb-4 border border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border text-left">Parámetro</th>
                  <th className="p-1 border text-right">Valor</th>
                  <th className="p-1 border text-left">Unidad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold p-1 border">λ₀ (global)</td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.lambda0.toFixed(1)}
                  </td>
                  <td className="p-1 border">—</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">λ₁ (cordón)</td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.lambda1.toFixed(1)}
                  </td>
                  <td className="p-1 border">—</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">λₘ (modificada)</td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.lambdaM.toFixed(1)}
                  </td>
                  <td className="p-1 border">—</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">λ<sub>c</sub></td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.lambdaC.toFixed(3)}
                  </td>
                  <td className="p-1 border">—</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">F<sub>cr</sub></td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.Fcr_MPa.toFixed(0)}
                  </td>
                  <td className="p-1 border">MPa</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">φ·P<sub>n</sub></td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.phiPn_kN.toFixed(1)}
                  </td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">P<sub>u</sub></td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.Pu_kN.toFixed(1)}
                  </td>
                  <td className="p-1 border">kN</td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Ratio</td>
                  <td className="p-1 border text-right font-mono">
                    {result.globalCheck.ratio.toFixed(2)}
                  </td>
                  <td className="p-1 border">
                    {result.globalCheck.passes ? "✓ Verifica" : "✗ No verifica"}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* 5c. VERIFICACIÓN DEL PUNTAL — independent (only when brace exists) */}
        {result.braceCheck && (
          <>
            <h2 className="font-bold text-sm mb-1">
              5c. VERIFICACIÓN DEL PUNTAL — Tipo {result.braceCheck.tipo}
            </h2>
            <table className="w-full text-xs mb-4 border border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border text-left">Elemento</th>
                  <th className="p-1 border text-left">Perfil</th>
                  <th className="p-1 border text-right">KL/r</th>
                  <th className="p-1 border text-right">F<sub>cr</sub> (MPa)</th>
                  <th className="p-1 border text-right">&phi;P<sub>n</sub> (kN)</th>
                  <th className="p-1 border text-right">N (kN)</th>
                  <th className="p-1 border text-right">Ratio</th>
                  <th className="p-1 border text-center">Verifica</th>
                </tr>
              </thead>
              <tbody>
                {result.braceCheck.chkAngle && (
                  <tr>
                    <td className="p-1 border font-bold">Ángulo (×2)</td>
                    <td className="p-1 border">L 2″×3/16″</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkAngle.KLr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkAngle.Fcr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkAngle.phiPn.toFixed(1)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkAngle.force.toFixed(1)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkAngle.ratio.toFixed(2)}</td>
                    <td className="p-1 border text-center">{result.braceCheck.chkAngle.ok ? "✓" : "✗"}</td>
                  </tr>
                )}
                {result.braceCheck.chkDiagonal && (
                  <tr>
                    <td className="p-1 border font-bold">Diagonal</td>
                    <td className="p-1 border">L 1″×1/8″</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkDiagonal.KLr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkDiagonal.Fcr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkDiagonal.phiPn.toFixed(2)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkDiagonal.force.toFixed(2)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkDiagonal.ratio.toFixed(2)}</td>
                    <td className="p-1 border text-center">{result.braceCheck.chkDiagonal.ok ? "✓" : "✗"}</td>
                  </tr>
                )}
                {result.braceCheck.chkMontant && (
                  <tr>
                    <td className="p-1 border font-bold">Montante</td>
                    <td className="p-1 border">L 1″×1/8″</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkMontant.KLr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkMontant.Fcr.toFixed(0)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkMontant.phiPn.toFixed(2)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkMontant.force.toFixed(2)}</td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.chkMontant.ratio.toFixed(2)}</td>
                    <td className="p-1 border text-center">{result.braceCheck.chkMontant.ok ? "✓" : "✗"}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {result.braceCheck.globalCheck && (
              <table className="w-full text-xs mb-4 border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border text-left" colSpan={2}>Verificación global — Grupo 4</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold p-1 border w-40">&lambda;<sub>0</sub></td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.globalCheck.lambda0.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td className="font-bold p-1 border">&lambda;<sub>c</sub></td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.globalCheck.lambdaC.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="font-bold p-1 border">F<sub>cr</sub></td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.globalCheck.Fcr_MPa.toFixed(0)} MPa</td>
                  </tr>
                  <tr>
                    <td className="font-bold p-1 border">&phi;·P<sub>n</sub></td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.globalCheck.phiPn_kN.toFixed(1)} kN</td>
                  </tr>
                  <tr>
                    <td className="font-bold p-1 border">P<sub>u</sub></td>
                    <td className="p-1 border text-right font-mono">{result.braceCheck.globalCheck.Pu_kN.toFixed(1)} kN</td>
                  </tr>
                  <tr>
                    <td className="font-bold p-1 border">Ratio</td>
                    <td className={`p-1 border text-right font-mono font-bold ${result.braceCheck.globalCheck.passes ? "text-green-700" : "text-red-700"}`}>
                      {result.braceCheck.globalCheck.ratio.toFixed(2)} {result.braceCheck.globalCheck.passes ? "✓" : "✗"}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {result.braceCheck.lateralBracing_cm !== undefined && (
              <div className="p-2 mb-4 border border-black rounded bg-blue-50 text-xs">
                <strong>Arriostramiento lateral requerido cada {result.braceCheck.lateralBracing_cm.toFixed(0)} cm</strong>
                <br />
                &lambda;<sub>lim</sub> = &pi;·&radic;(E/F<sub>y</sub>) = {(Math.PI * Math.sqrt(200000 / state.Fy)).toFixed(1)}{" "}
                &middot; L<sub>max</sub> = r<sub>y</sub> · &lambda;<sub>lim</sub>
              </div>
            )}

            <div className={`p-2 rounded mb-4 text-xs font-bold border ${
              result.braceCheck.passesBrace
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-red-100 text-red-800 border-red-300"
            }`}>
              Ratio puntal = {result.braceCheck.ratioBrace.toFixed(2)} —{" "}
              {result.braceCheck.passesBrace ? "✓ VERIFICA" : "✗ NO VERIFICA"}
            </div>
          </>
        )}

        {/* 6. RESULTADO FINAL */}
        <div
          className={`p-3 rounded mb-4 text-sm font-bold border ${
            result.passes
              ? "bg-green-100 text-green-800 border-green-300"
              : "bg-red-100 text-red-800 border-red-300"
          }`}
        >
          Ratio máximo = {result.ratioColumna.toFixed(2)} —{" "}
          {result.passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}
        </div>

        {/* 7. Acero total — hidden for T1 */}
        {state.tipoColumna !== 1 && (
          <>
            <h2 className="font-bold text-sm mb-1">7. RESUMEN DE ACERO</h2>
            <table className="w-full text-xs mb-4 border border-black">
              <tbody>
                <tr>
                  <td className="font-bold p-1 border w-40">Cordones / col</td>
                  <td className="p-1 border text-right font-mono">{result.longCordones.toFixed(1)} m</td>
                  <td className="font-bold p-1 border w-40">Total obra</td>
                  <td className="p-1 border text-right font-mono">
                    {(result.longTotal * result.nColumnas).toFixed(1)} m
                  </td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Montantes / col</td>
                  <td className="p-1 border text-right font-mono">{result.longMontantes.toFixed(1)} m</td>
                  <td className="font-bold p-1 border">× {result.nColumnas} col.</td>
                  <td className="p-1 border"></td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Diagonales / col</td>
                  <td className="p-1 border text-right font-mono">{result.longDiagonales.toFixed(1)} m</td>
                  <td className="font-bold p-1 border">Total / col.</td>
                  <td className="p-1 border text-right font-mono">{result.longTotal.toFixed(1)} m</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* 8. CUENTAS COMPLETAS */}
        <h2 className="font-bold text-sm mb-1">8. CUENTAS COMPLETAS</h2>
        <pre className="p-3 border border-black rounded text-[8px] text-black font-mono whitespace-pre-wrap overflow-x-auto mb-4">
          {result.steps}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved-cartel mode
// ---------------------------------------------------------------------------
function SavedCartelPrintout() {
  const [selected, setSelected] = useState<SavedBeam | null>(null);
  const saves = listSaves();
  const cartelSaves = saves.filter((s) => s.type === "cartel");

  const col = selected;
  const d = (col?.data || {}) as Record<string, unknown>;

  const state = useMemo((): CartelState | null => {
    if (!col) return null;
    return {
      anchoCartel: (d.anchoCartel as number) ?? 12,
      altoCartel: (d.altoCartel as number) ?? 4.8,
      despegue: (d.despegue as number) ?? 3,
      sepColumnas: (d.sepColumnas as number) ?? 4,
      sepCorreas: (d.sepCorreas as number) ?? 1,
      tipoColumna: ((d.tipoColumna as number) ?? 2) === 3 ? 2 : ((d.tipoColumna as number) ?? 2),
      tienePuntal: (d.tienePuntal as boolean) ?? false,
      hPuntal: (d.hPuntal as number) ?? 3.84,
      dPuntal: (d.dPuntal as number) ?? 3.44,
      velocidadViento: (d.velocidadViento as number) ?? 45,
      categoria: (d.categoria as string) ?? "II",
      exposicion: (d.exposicion as string) ?? "B",
      hCol: (d.hCol as number) ?? 0.5,
      aCol: (d.aCol as number) ?? 0.6,
      perfilCordon: (d.perfilCordon as string) ?? 'L 2 1/2" x 1/4"',
      perfilDiagonal: (d.perfilDiagonal as string) ?? 'L 1 1/2" x 3/16"',
      perfilMontante: (d.perfilMontante as string) ?? 'L 1 1/4" x 1/8"',
      Fy: (d.Fy as number) ?? 235,
      perfilIPN: d.perfilIPN as string | undefined,
      separacionCol: d.separacionCol as number | undefined,
      cantColumnas: d.cantColumnas as number | undefined,
      vueloLateral: d.vueloLateral as number | undefined,
      tipoPuntal: (d.tipoPuntal as number) ?? 1,
    };
  }, [col, d]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Imprimir planilla — Cartel</h1>
        {cartelSaves.length === 0 && (
          <p className="text-gray-500">
            No hay carteles guardados. Guardá uno desde la calculadora de carteles.
          </p>
        )}
        <div className="grid gap-2 mb-6">
          {cartelSaves.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`text-left p-3 rounded border ${selected?.id === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-gray-500 ml-2">— Cartel — {s.date}</span>
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

      {state && <NavCartelPrintout state={state} />}
    </div>
  );
}

// =========================================================================
// Main CartelPrintPage
// =========================================================================
export default function CartelPrintPage() {
  const location = useLocation();
  const navState = location.state as CartelState | null;

  // window.print() on mount when planilla is ready
  useEffect(() => {
    if (navState) {
      const t = setTimeout(() => window.print(), 200);
      return () => clearTimeout(t);
    }
  }, [navState]);

  if (navState) {
    return <NavCartelPrintout state={navState} />;
  }

  return <SavedCartelPrintout />;
}
