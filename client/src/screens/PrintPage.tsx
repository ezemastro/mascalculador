import { Fragment, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { listSaves, type SavedBeam } from "../lib/storage";
import {
  calculateBeam,
  calculateBeamDual,
} from "../lib/beam-calculations";
import { designConcreteDetailed } from "../lib/concrete-design";
import { checkBeam } from "../lib/steel-design";
import { getD, getBf, IPN_PROFILES } from "../lib/profiles";

// ---------------------------------------------------------------------------
// Print CSS shared across both modes
// ---------------------------------------------------------------------------
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

// =========================================================================
// Nav-state steel beam printout
// =========================================================================
function NavSteelPrintout({
  loads,
  beamConfig,
  designParams,
}: {
  loads: Load[];
  beamConfig: BeamConfig;
  designParams: SteelDesignParams;
}) {
  const navigate = useNavigate();
  const dual = useMemo(
    () => calculateBeamDual(beamConfig, loads),
    [beamConfig, loads],
  );

  const L = beamConfig.spans.reduce((a, b) => a + b, 0);

  const profile = useMemo(
    () => IPN_PROFILES.find((p) => p.name === designParams.profileName),
    [designParams.profileName],
  );

  const designCheck = useMemo(() => {
    if (!profile) return null;
    const totalBeamMm = L * 1000;
    const Mu_signed = dual.maxMomentU.value * 1e6; // kN·m → N·mm
    const Mu_abs = Math.abs(Mu_signed);
    const Vu = dual.maxShearU * 1e3; // kN → N
    const effectiveLb =
      Mu_signed >= 0
        ? (designParams.Lb1 ?? designParams.Lb)
        : (designParams.Lb2 ?? designParams.Lb);
    let maxServiceM_kNm = 0;
    for (const x of dual.criticalPointsU) {
      const m = Math.abs(dual.d.bendingMoment(x) + dual.l.bendingMoment(x));
      if (m > maxServiceM_kNm) maxServiceM_kNm = m;
    }
    const serviceM = maxServiceM_kNm * 1e6; // kN·m → N·mm

    const dr = checkBeam(
      profile,
      {
        Fy: designParams.Fy,
        Lb: designParams.Lb,
        Lb1: designParams.Lb1,
        Lb2: designParams.Lb2,
        Cb: designParams.Cb,
        deflectionLimit: designParams.deflectionLimit,
        beamLength: totalBeamMm,
        loadPosition: designParams.loadPosition ?? "top",
      },
      serviceM,
      Mu_signed,
    );

    const Zx_req_cm3 = Mu_abs / (0.9 * designParams.Fy) / 1000;

    return {
      phiMn: dr.phiMn,
      Mu: Mu_abs,
      ratioFlex: Mu_abs / dr.phiMn,
      phiVn: dr.phiVn,
      Vu,
      ratioShear: Vu / dr.phiVn,
      limitingState: dr.limitingState,
      maxDeflection: dr.maxDeflection,
      allowableDeflection: dr.allowableDeflection,
      deflectionOK: dr.deflectionOK,
      steps: dr.steps,
      Mp: dr.Mp,
      classification: dr.classification,
      lambdaF: dr.lambdaF,
      lambdaW: dr.lambdaW,
      lambdaPf: dr.lambdaPf,
      lambdaRf: dr.lambdaRf,
      lambdaPw: dr.lambdaPw,
      lambdaRw: dr.lambdaRw,
      MnFlange: dr.MnFlange,
      MnWeb: dr.MnWeb,
      MnLTB: dr.MnLTB,
      Lp: dr.Lp,
      Lr: dr.Lr,
      LpEff: dr.LpEff,
      LrEff: dr.LrEff,
      effectiveLb,
      Mr: dr.Mr,
      Fe: dr.Fe,
      Mcr: dr.Mcr,
      Md1: dr.Md1,
      Md2: dr.Md2,
      Zx_selected: profile.Zx,
      Zx_req: Zx_req_cm3,
      subdimensioned: profile.Zx < Zx_req_cm3,
    };
  }, [dual, L, profile, designParams]);

  const reactionsU = beamConfig.supportTypes.map(
    (_, i) => 1.2 * dual.d.reactions[i] + 1.6 * dual.l.reactions[i],
  );

  const supportLabels: Record<string, string> = {
    simple: "Articulado",
    fixed: "Empotrado",
    free: "Libre",
  };

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      {/* Print button */}
      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imprimir planilla</h1>
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
        {/* ============================================================= */}
        {/* HEADER                                                       */}
        {/* ============================================================= */}
        <div className="border-b-4 border-black pb-3 mb-4">
          <h1 className="text-lg font-bold">PLANILLA DE CÁLCULO</h1>
          <p className="text-sm text-gray-600">
            Viga de acero — CIRSOC 301-05
          </p>
          <p className="text-sm">
            Perfil: <strong>{designParams.profileName}</strong>
            &nbsp;&mdash;&nbsp; Fecha: {todayISO()}
          </p>
        </div>

        {/* ============================================================= */}
        {/* 1. DATOS DE LA VIGA                                          */}
        {/* ============================================================= */}
        <h2 className="font-bold text-sm mb-1">1. DATOS DE LA VIGA</h2>
        <table className="w-full text-xs mb-4 border border-black">
          <tbody>
            <tr>
              <td className="font-bold p-1 border w-32">
                Cantidad de tramos
              </td>
              <td className="p-1 border">{beamConfig.spans.length}</td>
              <td className="font-bold p-1 border w-24">Longitudes</td>
              <td className="p-1 border">
                {beamConfig.spans.map((s) => s.toFixed(2) + " m").join(", ")}
              </td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Luz total</td>
              <td className="p-1 border">{L.toFixed(2)} m</td>
              <td className="font-bold p-1 border">Apoyos</td>
              <td className="p-1 border">
                {beamConfig.supportTypes
                  .map((t) => supportLabels[t] ?? t)
                  .join(", ")}
              </td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Reacciones (U)</td>
              <td className="p-1 border" colSpan={3}>
                {reactionsU
                  .map((r, i) => {
                    const label =
                      beamConfig.supportTypes.length === 2
                        ? `R${i === 0 ? "A" : "B"}`
                        : `R${i + 1}`;
                    return `${label} = ${r.toFixed(2)} kN`;
                  })
                  .join(", ")}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============================================================= */}
        {/* 2. CARGAS                                                     */}
        {/* ============================================================= */}
        <h2 className="font-bold text-sm mb-1">2. CARGAS</h2>
        <table className="w-full text-xs mb-4 border border-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">N°</th>
              <th className="p-1 border text-left">Tipo</th>
              <th className="p-1 border text-right">D</th>
              <th className="p-1 border text-right">L</th>
              <th className="p-1 border text-right">U (1.2D+1.6L)</th>
              <th className="p-1 border text-right">Posición</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((ld, i) => {
              const dVal = ld.deadLoad ?? 0;
              const lVal = ld.liveLoad ?? 0;
              const uVal = 1.2 * dVal + 1.6 * lVal;
              const unit = ld.type === "distributed" ? "kN/m" : "kN";
              return (
                <tr key={ld.id ?? i}>
                  <td className="p-1 border">C{i + 1}</td>
                  <td className="p-1 border">
                    {ld.type === "point" ? "Puntual" : "Distribuida"}
                  </td>
                  <td className="p-1 border text-right">
                    {dVal.toFixed(1)} {unit}
                  </td>
                  <td className="p-1 border text-right">
                    {lVal.toFixed(1)} {unit}
                  </td>
                  <td className="p-1 border text-right">
                    {uVal.toFixed(1)} {unit}
                  </td>
                  <td className="p-1 border text-right">
                    {ld.type === "point"
                      ? (ld.position ?? 0).toFixed(2) + " m"
                      : `${(ld.start ?? 0).toFixed(2)} – ${(ld.end ?? 0).toFixed(2)} m`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ============================================================= */}
        {/* 3. PARÁMETROS DE DISEÑO                                       */}
        {/* ============================================================= */}
        <h2 className="font-bold text-sm mb-1">
          3. PARÁMETROS DE DISEÑO
        </h2>
        <table className="w-full text-xs mb-4 border border-black">
          <tbody>
            <tr>
              <td className="font-bold p-1 border w-32">Perfil</td>
              <td className="p-1 border">{designParams.profileName}</td>
              <td className="font-bold p-1 border w-16">Fy</td>
              <td className="p-1 border">{designParams.Fy} MPa</td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">Cb</td>
              <td className="p-1 border">{designParams.Cb}</td>
              <td className="font-bold p-1 border">
                Carga en
              </td>
              <td className="p-1 border">
                {designParams.loadPosition === "top"
                  ? "Ala superior"
                  : designParams.loadPosition === "shear"
                    ? "Centro de corte"
                    : "Ala inferior"}
              </td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                L<sub>1</sub>
              </td>
              <td className="p-1 border">
                {(designParams.Lb1 ?? designParams.Lb) / 10 > 100
                  ? ((designParams.Lb1 ?? designParams.Lb) / 1000).toFixed(2) +
                    " m"
                  : ((designParams.Lb1 ?? designParams.Lb) / 10).toFixed(0) +
                    " cm"}
              </td>
              <td className="font-bold p-1 border">
                L<sub>2</sub>
              </td>
              <td className="p-1 border">
                {(designParams.Lb2 ?? designParams.Lb) / 10 > 100
                  ? ((designParams.Lb2 ?? designParams.Lb) / 1000).toFixed(2) +
                    " m"
                  : ((designParams.Lb2 ?? designParams.Lb) / 10).toFixed(0) +
                    " cm"}
              </td>
            </tr>
            <tr>
              <td className="font-bold p-1 border">
                &delta;<sub>adm</sub>
              </td>
              <td className="p-1 border" colSpan={3}>
                L/{designParams.deflectionLimit} ={" "}
                {(L * 1000 / designParams.deflectionLimit).toFixed(1)} mm
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============================================================= */}
        {/* 4. CARACTERÍSTICAS DEL PERFIL                                 */}
        {/* ============================================================= */}
        {profile && (
          <>
            <h2 className="font-bold text-sm mb-1">
              4. CARACTERÍSTICAS DEL PERFIL — {profile.name}
            </h2>
            <table className="w-full text-xs mb-4 border border-black">
              <tbody>
                {[
                  [
                    ["d = h", `${getD(profile)} mm`],
                    ["b_f = b", `${getBf(profile)} mm`],
                  ],
                  [
                    ["t_f", `${profile.tf} mm`],
                    ["t_w", `${profile.tw} mm`],
                  ],
                  [
                    ["A", `${profile.A.toFixed(1)} cm²`],
                    ["I_x", `${profile.Ix.toFixed(1)} cm⁴`],
                  ],
                  [
                    ["S_x", `${profile.Sx.toFixed(1)} cm³`],
                    ["Z_x", `${profile.Zx.toFixed(1)} cm³`],
                  ],
                  [
                    ["I_y", `${profile.Iy.toFixed(1)} cm⁴`],
                    ["r_y", `${profile.ry.toFixed(2)} cm`],
                  ],
                  [
                    ["J", `${profile.J.toFixed(1)} cm⁴`],
                    ["C_w", `${profile.Cw.toFixed(1)} cm⁶`],
                  ],
                ].map((row, ri) => (
                  <tr key={ri}>
                    {row.map(([label, val], ci) => (
                      <Fragment key={ci}>
                        <td className="font-bold p-1 border w-24">
                          {label}
                        </td>
                        <td className="p-1 border font-mono">{val}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ============================================================= */}
        {/* 5. CLASIFICACIÓN DE SECCIÓN                                   */}
        {/* ============================================================= */}
        {designCheck && (
          <>
            <h2 className="font-bold text-sm mb-1">
              5. CLASIFICACIÓN DE SECCIÓN
            </h2>
            <div className="text-xs font-mono space-y-0.5 mb-2">
              <p>
                &lambda;<sub>f</sub> = b / (2·t<sub>f</sub>) ={" "}
                {designCheck.lambdaF.toFixed(2)} &le; &lambda;
                <sub>pf</sub> = 0.38·&radic;(E/F<sub>y</sub>) ={" "}
                {designCheck.lambdaPf.toFixed(2)} &rarr;{" "}
                {designCheck.lambdaF <= designCheck.lambdaPf
                  ? "ala compacta"
                  : designCheck.lambdaF <= designCheck.lambdaRf
                    ? "ala no compacta"
                    : "ala esbelta"}
              </p>
              <p>
                &lambda;<sub>w</sub> = h<sub>c</sub> / t<sub>w</sub> ={" "}
                {designCheck.lambdaW.toFixed(2)} &le; &lambda;
                <sub>pw</sub> = 3.76·&radic;(E/F<sub>y</sub>) ={" "}
                {designCheck.lambdaPw.toFixed(2)} &rarr;{" "}
                {designCheck.lambdaW <= designCheck.lambdaPw
                  ? "alma compacta"
                  : designCheck.lambdaW <= designCheck.lambdaRw
                    ? "alma no compacta"
                    : "alma esbelta"}
              </p>
            </div>
            <div
              className={`p-2 rounded mb-4 text-xs font-semibold ${
                designCheck.classification === "COMPACT"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : designCheck.classification === "NON_COMPACT"
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                    : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {designCheck.classification === "COMPACT"
                ? "Sección compacta"
                : designCheck.classification === "NON_COMPACT"
                  ? "Sección no compacta"
                  : "Sección con elementos esbeltos"}
            </div>

            {/* 5. Subdimensioned banner */}
            {designCheck.subdimensioned && (
              <div className="mb-4 p-2 border border-red-400 bg-red-50 text-red-800 text-xs font-semibold">
                Perfil subdimensionado: Z<sub>x</sub> ={" "}
                {designCheck.Zx_selected.toFixed(0)} cm&sup3;, necesario &ge;{" "}
                {designCheck.Zx_req.toFixed(0)} cm&sup3;
              </div>
            )}

            {/* ========================================================= */}
            {/* 6. FÓRMULAS Y CUENTAS                                     */}
            {/* ========================================================= */}
            <h2 className="font-bold text-sm mb-1">
              6. FÓRMULAS Y CUENTAS
            </h2>

            {/* --- Pandeo Lateral-Torsional --- */}
            <h3 className="font-semibold text-xs mb-1">Pandeo Lateral-Torsional</h3>
            <div className="text-xs font-mono space-y-0.5 mb-2">
              <p>
                M<sub>d1</sub> = &phi;&middot;min(M<sub>n,flange</sub>, M
                <sub>n,web</sub>) = 0.9&middot;min(
                {(designCheck.MnFlange / 1e6).toFixed(1)},{" "}
                {(designCheck.MnWeb / 1e6).toFixed(1)}) ={" "}
                {(designCheck.Md1 / 1e6).toFixed(2)} kN&middot;m
              </p>
              <p>
                M<sub>p</sub> = F<sub>y</sub>&middot;Z<sub>x</sub> ={" "}
                {designParams.Fy}&middot;{profile?.Zx} ={" "}
                {(designCheck.Mp / 1e6).toFixed(2)} kN&middot;m
              </p>
              <p>
                M<sub>r</sub> = 0.7&middot;F<sub>y</sub>&middot;S
                <sub>x</sub> = 0.7&middot;{designParams.Fy}&middot;
                {profile?.Sx} = {(designCheck.Mr / 1e6).toFixed(2)}
                &nbsp;kN&middot;m
              </p>
              <p>
                L<sub>p,eff</sub> = {(designCheck.LpEff / 10).toFixed(0)} cm
                {designCheck.LpEff !== designCheck.Lp &&
                  ` (L_p = ${(designCheck.Lp / 10).toFixed(0)} cm)`}
              </p>
              <p>
                L<sub>r,eff</sub> = {(designCheck.LrEff / 10).toFixed(0)} cm
                {designCheck.LrEff !== designCheck.Lr &&
                  ` (L_r = ${(designCheck.Lr / 10).toFixed(0)} cm)`}
              </p>
              <p>
                L = {(designCheck.effectiveLb / 10).toFixed(0)} cm
              </p>
              <p>
                F<sub>e</sub> = {designCheck.Fe.toFixed(1)} MPa
              </p>
              <p>
                M<sub>cr</sub> = min(F<sub>e</sub>&middot;S<sub>x</sub>, M
                <sub>p</sub>) ={" "}
                {designCheck.Fe * (profile?.Sx ?? 0) / 1000 <
                designCheck.Mp / 1e6
                  ? (designCheck.Mcr / 1e6).toFixed(2)
                  : (designCheck.Mp / 1e6).toFixed(2)}{" "}
                kN&middot;m
              </p>
              <p>
                M<sub>d2</sub> = &phi;&middot;M<sub>n,LTB</sub> = 0.9&middot;
                {(designCheck.MnLTB / 1e6).toFixed(2)} ={" "}
                {(designCheck.Md2 / 1e6).toFixed(2)} kN&middot;m
              </p>
              <p className="font-bold mb-2">
                M<sub>d</sub> = &phi;&middot;M<sub>n</sub> = min(M
                <sub>d1</sub>, M<sub>d2</sub>) ={" "}
                {(designCheck.phiMn / 1e6).toFixed(2)} kN&middot;m
              </p>
            </div>

            {/* --- Desarrollo completo (engine steps) --- */}
            <pre className="p-3 border border-black rounded text-[8px] text-black font-mono whitespace-pre-wrap overflow-x-auto mb-4">
              {designCheck.steps.join("\n")}
            </pre>

            {/* ========================================================= */}
            {/* 7. RESULTADOS                                             */}
            {/* ========================================================= */}
            <h2 className="font-bold text-sm mb-1">7. RESULTADOS</h2>
            <table className="w-full text-xs mb-4 border border-black">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border text-left">Verificación</th>
                  <th className="p-1 border text-right">Solicitación</th>
                  <th className="p-1 border text-right">Resistencia</th>
                  <th className="p-1 border text-right">Ratio</th>
                  <th className="p-1 border text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold p-1 border">Flexión</td>
                  <td className="p-1 border text-right font-mono">
                    M<sub>u</sub> = {(designCheck.Mu / 1e6).toFixed(1)}{" "}
                    kN&middot;m
                  </td>
                  <td className="p-1 border text-right font-mono">
                    &phi;M<sub>n</sub> ={" "}
                    {(designCheck.phiMn / 1e6).toFixed(1)} kN&middot;m
                  </td>
                  <td
                    className={`p-1 border text-right font-mono font-bold ${designCheck.ratioFlex <= 1 ? "text-green-700" : "text-red-700"}`}
                  >
                    {designCheck.ratioFlex.toFixed(2)}
                  </td>
                  <td className="p-1 border text-xs">
                    {designCheck.limitingState}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Corte</td>
                  <td className="p-1 border text-right font-mono">
                    V<sub>u</sub> = {(designCheck.Vu / 1000).toFixed(1)} kN
                  </td>
                  <td className="p-1 border text-right font-mono">
                    &phi;V<sub>n</sub> ={" "}
                    {(designCheck.phiVn / 1000).toFixed(1)} kN
                  </td>
                  <td
                    className={`p-1 border text-right font-mono font-bold ${designCheck.ratioShear <= 1 ? "text-green-700" : "text-red-700"}`}
                  >
                    {designCheck.ratioShear.toFixed(2)}
                  </td>
                  <td className="p-1 border text-xs">
                    {designCheck.ratioShear <= 1 ? "✓ OK" : "✗ No cumple"}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold p-1 border">Deformación</td>
                  <td className="p-1 border text-right font-mono">
                    &delta;<sub>max</sub> ={" "}
                    {designCheck.maxDeflection.toFixed(1)} mm
                  </td>
                  <td className="p-1 border text-right font-mono">
                    &delta;<sub>adm</sub> ={" "}
                    {designCheck.allowableDeflection.toFixed(1)} mm
                  </td>
                  <td className="p-1 border text-right font-mono font-bold">
                    —
                  </td>
                  <td
                    className={`p-1 border text-xs font-bold ${designCheck.deflectionOK ? "text-green-700" : "text-red-700"}`}
                  >
                    {designCheck.deflectionOK
                      ? "✓ Cumple"
                      : "✗ No cumple"}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Saved-beam mode (existing functionality preserved)
// =========================================================================
function SavedBeamPrintout() {
  const [selected, setSelected] = useState<SavedBeam | null>(null);
  const saves = listSaves();

  const beam = selected;
  const d = (beam?.data || {}) as Record<string, unknown>;
  const isAcero = beam?.type === "acero";
  const spans = (d.spans as number[]) || [];
  const totalL = spans.reduce((a: number, b: number) => a + b, 0);

  // Recompute results from saved data
  const computed = useMemo(() => {
    if (!beam) return null;
    const supportTypes = (d.supportTypes || [
      "simple",
      "simple",
    ]) as SupportType[];
    const cfg: BeamConfig = { spans, supportTypes };

    if (isAcero) {
      const loads = (d.loads || []) as Load[];
      if (loads.length === 0) return null;
      const r = calculateBeam(cfg, loads);
      let maxM = 0,
        maxV = 0;
      for (let k = 0; k <= 300; k++) {
        const x = (k / 300) * totalL;
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      return {
        Mu: maxM,
        Vu: maxV,
        reactions: r.reactions,
        type: "acero" as const,
      };
    } else {
      const concreteLoads = (d.concreteLoads || []) as {
        D: number;
        L: number;
        type: string;
        position?: number;
        start?: number;
        end?: number;
      }[];
      if (concreteLoads.length === 0) return null;
      const uls: Load[] = concreteLoads.map((cl) => ({
        id: "x",
        type: cl.type as "point" | "distributed",
        magnitude: 1.2 * cl.D + 1.6 * cl.L,
        position: cl.position,
        start: cl.start,
        end: cl.end,
      }));
      const r = calculateBeam(cfg, uls);
      let maxM = 0,
        maxV = 0;
      for (let k = 0; k <= 300; k++) {
        const x = (k / 300) * totalL;
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      const bw = (d.bw as number) || 200;
      const h = (d.h as number) || 500;
      const cover = (d.cover as number) || 30;
      const fc = (d.fc as number) || 25;
      const fy = (d.fy as number) || 420;
      const qu = concreteLoads
        .filter((l) => l.type === "distributed")
        .reduce((s, l) => s + 1.2 * l.D + 1.6 * l.L, 0);
      const cRes = designConcreteDetailed({
        bw,
        h,
        d: 0,
        dp: 0,
        cover,
        fc,
        fy,
        Mu: maxM,
        Vu: maxV,
        qu,
        c: 300,
        directSupport: true,
        As: 0,
        Av: 0,
        nLegs: 0,
        s: 0,
      });
      return {
        Mu: maxM,
        Vu: maxV,
        reactions: r.reactions,
        concrete: cRes,
        type: "hormigon" as const,
      };
    }
  }, [beam]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Imprimir planilla</h1>
        {saves.length === 0 && (
          <p className="text-gray-500">
            No hay vigas guardadas. Guardá una desde Viga Acero o Viga H°.
          </p>
        )}
        <div className="grid gap-2 mb-6">
          {saves.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`text-left p-3 rounded border ${selected?.id === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-gray-500 ml-2">
                — {s.type === "acero" ? "Acero" : "H° A°"} — {s.date}
              </span>
            </button>
          ))}
        </div>
        {beam && (
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700"
          >
            Imprimir
          </button>
        )}
      </div>

      {beam && computed && (
        <div className="max-w-4xl mx-auto mt-4 print:mt-0">
          <div className="border-b-4 border-black pb-3 mb-4">
            <h1 className="text-xl font-bold">PLANILLA DE CÁLCULO</h1>
            <p className="text-sm text-gray-600">
              {isAcero
                ? "Viga de acero — CIRSOC 301-05"
                : "Viga de H° A° — CIRSOC 201-05"}
            </p>
          </div>

          <table className="w-full text-sm mb-4 border border-black">
            <tbody>
              <tr>
                <td className="font-bold p-1 border w-32">Obra / Viga:</td>
                <td className="p-1 border">{beam.name}</td>
                <td className="font-bold p-1 border w-20">Fecha:</td>
                <td className="p-1 border w-36">{beam.date}</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">Tramos:</td>
                <td className="p-1 border">
                  {spans.length} (
                  {spans.map((l: number) => l.toFixed(1) + "m").join(" + ")})
                </td>
                <td className="font-bold p-1 border">Luz total:</td>
                <td className="p-1 border">{totalL.toFixed(2)} m</td>
              </tr>
              <tr>
                <td className="font-bold p-1 border">Apoyos:</td>
                <td className="p-1 border">
                  {((d.supportTypes as string[]) || [])
                    .map((t: string) =>
                      t === "simple"
                        ? "Articulado"
                        : t === "fixed"
                          ? "Empotrado"
                          : "Libre",
                    )
                    .join(", ")}
                </td>
                <td className="font-bold p-1 border">Reacciones:</td>
                <td className="p-1 border">
                  {computed.reactions
                    .map((r: number) => r.toFixed(1) + " kN")
                    .join(", ")}
                </td>
              </tr>
              {isAcero && (
                <tr>
                  <td className="font-bold p-1 border">Perfil:</td>
                  <td className="p-1 border">
                    {(d.profileName as string) || "—"}
                  </td>
                  <td className="font-bold p-1 border">
                    F<sub>y</sub>:
                  </td>
                  <td className="p-1 border">
                    {(d.Fy as number) || "—"} MPa
                  </td>
                </tr>
              )}
              {!isAcero && (
                <tr>
                  <td className="font-bold p-1 border">Sección:</td>
                  <td className="p-1 border">
                    b<sub>w</sub>={(d.bw as number) || "—"} mm, h=
                    {(d.h as number) || "—"} mm, rec=
                    {(d.cover as number) || "—"} mm
                  </td>
                  <td className="font-bold p-1 border">
                    f'<sub>c</sub> / f<sub>y</sub>:
                  </td>
                  <td className="p-1 border">
                    {(d.fc as number) || "—"} / {(d.fy as number) || "—"} MPa
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Solicitaciones */}
          <h3 className="font-bold text-sm mb-1">SOLICITACIONES</h3>
          <table className="w-full text-sm mb-4 border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border text-left">Carga</th>
                <th className="p-1 border text-right">Tipo</th>
                <th className="p-1 border text-right">D</th>
                <th className="p-1 border text-right">L</th>
                <th className="p-1 border text-right">U</th>
                <th className="p-1 border text-right">Posición (m)</th>
              </tr>
            </thead>
            <tbody>
              {isAcero &&
                ((d.loads as Load[]) || []).map((l: Load, i: number) => (
                  <tr key={i}>
                    <td className="p-1 border">C{i + 1}</td>
                    <td className="p-1 border text-right">
                      {l.type === "point" ? "Puntual" : "Distrib."}
                    </td>
                    <td className="p-1 border text-right">—</td>
                    <td className="p-1 border text-right">—</td>
                    <td className="p-1 border text-right">
                      {(l.magnitude ?? 0).toFixed(1)}{" "}
                      {l.type === "distributed" ? "kN/m" : "kN"}
                    </td>
                    <td className="p-1 border text-right">
                      {l.type === "point"
                        ? (l.position ?? "—")
                        : `${l.start ?? "—"} – ${l.end ?? "—"}`}
                    </td>
                  </tr>
                ))}
              {!isAcero &&
                (
                  (d.concreteLoads as {
                    D: number;
                    L: number;
                    type: string;
                    position?: number;
                    start?: number;
                    end?: number;
                  }[]) || []
                ).map((l, i: number) => (
                  <tr key={i}>
                    <td className="p-1 border">C{i + 1}</td>
                    <td className="p-1 border text-right">
                      {l.type === "point" ? "Puntual" : "Distrib."}
                    </td>
                    <td className="p-1 border text-right">
                      {l.D.toFixed(1)}
                    </td>
                    <td className="p-1 border text-right">
                      {l.L.toFixed(1)}
                    </td>
                    <td className="p-1 border text-right">
                      {(1.2 * l.D + 1.6 * l.L).toFixed(1)}{" "}
                      {l.type === "distributed" ? "kN/m" : "kN"}
                    </td>
                    <td className="p-1 border text-right">
                      {l.type === "point"
                        ? (l.position ?? "—")
                        : `${l.start ?? "—"} – ${l.end ?? "—"}`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Results */}
          <h3 className="font-bold text-sm mb-1">
            RESULTADOS DEL ANÁLISIS
          </h3>
          <table className="w-full text-sm mb-4 border border-black">
            <tbody>
              <tr>
                <td className="font-bold p-1 border w-40">
                  M<sub>u</sub> máximo:
                </td>
                <td className="p-1 border font-bold text-right w-32">
                  {computed.Mu.toFixed(1)} kN·m
                </td>
                <td className="font-bold p-1 border w-40">
                  V<sub>u</sub> máximo:
                </td>
                <td className="p-1 border font-bold text-right w-32">
                  {computed.Vu.toFixed(1)} kN
                </td>
              </tr>
            </tbody>
          </table>

          {/* Concrete design results */}
          {computed.type === "hormigon" && computed.concrete && (
            <>
              <h3 className="font-bold text-sm mb-1">
                DIMENSIONAMIENTO — ARMADURA DE FLEXIÓN
              </h3>
              <table className="w-full text-sm mb-4 border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border text-left">Parámetro</th>
                    <th className="p-1 border text-right">Valor</th>
                    <th className="p-1 border text-left">Parámetro</th>
                    <th className="p-1 border text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1 border">
                      K<sub>a</sub>
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.Ka.toFixed(4)}
                    </td>
                    <td className="p-1 border">
                      K<sub>a</sub> min
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.KaMin.toFixed(4)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 border">
                      K<sub>a</sub> max
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.KaMax.toFixed(4)}
                    </td>
                    <td className="p-1 border">Caso</td>
                    <td className="p-1 border text-right">
                      {computed.concrete.caseLabel}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="p-1 border">
                      A<sub>s</sub> requerida
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.AsReq} mm²
                    </td>
                    <td className="p-1 border">
                      A<sub>s</sub> mínima
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.AsMin} mm²
                    </td>
                  </tr>
                  {computed.concrete.AspReq > 0 && (
                    <tr>
                      <td className="p-1 border">
                        A<sub>s</sub>' requerida
                      </td>
                      <td className="p-1 border text-right">
                        {computed.concrete.AspReq} mm²
                      </td>
                      <td className="p-1 border"></td>
                      <td className="p-1 border text-right"></td>
                    </tr>
                  )}
                </tbody>
              </table>

              <h3 className="font-bold text-sm mb-1">ARMADURA DE CORTE</h3>
              <table className="w-full text-sm mb-4 border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 border text-left">Parámetro</th>
                    <th className="p-1 border text-right">Valor</th>
                    <th className="p-1 border text-left">Parámetro</th>
                    <th className="p-1 border text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1 border">
                      V<sub>u</sub> sección crítica
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.VuCalc.toFixed(1)} kN
                    </td>
                    <td className="p-1 border">
                      V<sub>n</sub>
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.Vn.toFixed(1)} kN
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 border">
                      V<sub>c</sub>
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.Vc.toFixed(1)} kN
                    </td>
                    <td className="p-1 border">
                      V<sub>s</sub> requerido
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.VsReq.toFixed(1)} kN
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="p-1 border">
                      A<sub>v</sub>/s mínimo
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.AvSMin.toFixed(1)} mm²/m
                    </td>
                    <td className="p-1 border">
                      s<sub>máx</sub>
                    </td>
                    <td className="p-1 border text-right">
                      {computed.concrete.sMax} mm
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <p className="text-xs text-gray-500 mt-4 print:hidden">
            Usá Ctrl+P o el botón Imprimir para guardar como PDF.
          </p>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Main PrintPage — delegates to nav-state or saved-beam mode
// =========================================================================
export default function PrintPage() {
  const location = useLocation();
  const navState = location.state as {
    loads?: Load[];
    beamConfig?: BeamConfig;
    designParams?: SteelDesignParams;
  } | null;

  const hasNavState = !!(
    navState?.loads &&
    navState?.beamConfig &&
    navState?.designParams
  );

  if (hasNavState) {
    return (
      <NavSteelPrintout
        loads={navState!.loads!}
        beamConfig={navState!.beamConfig!}
        designParams={navState!.designParams!}
      />
    );
  }

  return <SavedBeamPrintout />;
}
