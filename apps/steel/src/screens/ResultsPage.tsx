import { useLocation, useNavigate } from "react-router";
import { Mafs, Plot, Text, Vector } from "mafs";
import { MainLayout } from "@mascalculador/shared";
import {
  calculateBeamDual,
  formatForce,
  formatLength,
  formatMoment,
} from "../lib/beam-calculations";
import { checkBeam } from "../lib/steel-design";
import { getD, getBf, IPN_PROFILES, type ProfileData } from "../lib/profiles";
import { UPN_PROFILES, upnToProfileData } from "../lib/upn-profiles";
import type { UPNData } from "../lib/upn-profiles";

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    loads?: Load[];
    beamConfig?: BeamConfig;
    designParams?: SteelDesignParams;
  } | null;

  if (!state?.loads || !state?.beamConfig) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos para mostrar.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver al formulario
          </button>
        </div>
      </MainLayout>
    );
  }

  const { loads, beamConfig } = state;
  const designParams = state.designParams;
  const { spans, supportTypes } = beamConfig;
  const L = spans.reduce((a, b) => a + b, 0);

  const supportPositions: number[] = [0];
  for (const s of spans) {
    supportPositions.push(supportPositions[supportPositions.length - 1] + s);
  }
  const supports: Support[] = supportPositions.map((pos, i) => ({
    position: pos,
    type: supportTypes[i],
  }));

  const dual = calculateBeamDual(beamConfig, loads);
  const {
    d,
    l,
    shearForceU,
    bendingMomentU,
    maxMomentU,
    maxShearU,
    criticalPointsU,
  } = dual;

  const reactionsU = beamConfig.supportTypes.map(
    (_, i) => 1.2 * d.reactions[i] + 1.6 * l.reactions[i],
  );

  const maxLoad = Math.max(
    ...loads.map((ld) => (ld.deadLoad ?? 0) + (ld.liveLoad ?? 0)),
    ...reactionsU.map((r) => Math.abs(r)),
    1,
  );
  const maxMomentAbs = Math.max(Math.abs(maxMomentU.value), 1);
  const xMin = -L * 0.1;
  const xMax = L * 1.1;

  // Steel design check
  let designCheck: {
    profile: string;
    phiMn: number;
    Mu: number;
    ratioFlex: number;
    phiVn: number;
    Vu: number;
    ratioShear: number;
    limitingState: string;
    maxDeflection: number;
    allowableDeflection: number;
    deflectionOK: boolean;
    steps: string[];
    Mp: number;
    classification: Classification;
    lambdaF: number;
    lambdaW: number;
    lambdaPf: number;
    lambdaRf: number;
    lambdaPw: number;
    lambdaRw: number;
    MnFlange: number;
    MnWeb: number;
    MnLTB: number;
    Lp: number;
    Lr: number;
    LpEff: number;
    LrEff: number;
    effectiveLb: number; // mm — unbraced length used for this sign
    Mr: number;
    Fe: number;
    Mcr: number;
    Md1: number;
    Md2: number;
    Zx_selected: number;
    Zx_req: number;
    subdimensioned: boolean;
  } | null = null;
  let selectedProfileCalc: ProfileData | undefined;
  // Captured for JSX — set inside the if block below
  let profileType: "IPN" | "UPN" = "IPN";
  let upnProfile: UPNData | undefined;

  if (designParams) {
    const profileType2 = designParams.profileType ?? "IPN";
    let profile: ProfileData | undefined;
    let upnPro: UPNData | undefined;

    if (profileType2 === "UPN") {
      const upn = UPN_PROFILES.find((p) => p.name === designParams.profileName);
      if (upn) {
        upnPro = upn;
        profile = upnToProfileData(upn);
      }
    } else {
      profile = IPN_PROFILES.find((p) => p.name === designParams.profileName);
    }
    selectedProfileCalc = profile;

    // Capture for use in JSX scope
    profileType = profileType2 as "IPN" | "UPN";
    upnProfile = upnPro;
    if (profile) {
      const totalBeamMm = L * 1000;
      const Mu_signed = maxMomentU.value * 1e6; // kN·m → N·mm (signed)
      const Mu_abs = Math.abs(Mu_signed);
      const Vu = maxShearU * 1e3; // kN → N (ultimate)
      const effectiveLb =
        Mu_signed >= 0
          ? (designParams.Lb1 ?? designParams.Lb)
          : (designParams.Lb2 ?? designParams.Lb);

      // Max combined D+L service moment (evaluated at all critical points)
      let maxServiceM_kNm = 0;
      for (const x of criticalPointsU) {
        const m = Math.abs(d.bendingMoment(x) + l.bendingMoment(x));
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
        Mu_signed, // signed — used for sign-based Lb selection
      );

      // Zx_req (cm³) for subdimensioned banner (task 1.14)
      const Zx_req_cm3 = Mu_abs / (0.9 * designParams.Fy) / 1000;

      designCheck = {
        profile: profile.name,
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
        // Audit fields from engine (task 1.13)
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
        effectiveLb, // mm — unbraced length for this sign
        Mr: dr.Mr,
        Fe: dr.Fe,
        Mcr: dr.Mcr,
        Md1: dr.Md1,
        Md2: dr.Md2,
        // Subdimensioned data
        Zx_selected: upnProfile ? upnProfile.Zx : profile.Zx,
        Zx_req: Zx_req_cm3,
        subdimensioned: (upnProfile ? upnProfile.Zx : profile.Zx) < Zx_req_cm3,
      };
    }
  }

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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text">Resultados</h1>
            <p className="text-sm text-text-muted">Viga de {formatLength(L)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              navigate("/", {
                state: { loads, beamConfig, designParams },
              })
            }
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
          <button
            onClick={() =>
              navigate("/print", {
                state: { loads, beamConfig, designParams },
              })
            }
            className="text-sm bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            🖨 Imprimir
          </button>

        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {supports.map((s, i) => {
          const rD = d.reactions[i];
          const rL = l.reactions[i];
          const momentLabel = formatMoment(
            1.2 * d.supportMoments[i] + 1.6 * l.supportMoments[i],
          );
          return (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border p-4"
            >
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                {supportTypes.length === 2
                  ? `Reacción en Apoyo ${i === 0 ? "A" : "B"}`
                  : `Reacción en Apoyo ${i + 1}`}
              </span>
              {s.type === "free" ? (
                <p className="text-2xl font-bold text-primary mt-1">—</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-text-muted">
                    D:{" "}
                    <span className="font-semibold text-primary">
                      {formatForce(rD)}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    L:{" "}
                    <span className="font-semibold text-primary">
                      {formatForce(rL)}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    U:{" "}
                    <span className="font-bold text-warning">
                      {formatForce(1.2 * rD + 1.6 * rL)}
                    </span>
                  </p>
                </div>
              )}
              {s.type === "fixed" && (
                <p className="text-sm text-warning mt-0.5">M = {momentLabel}</p>
              )}
              <span className="text-xs text-text-muted">
                Tipo:{" "}
                {s.type === "simple"
                  ? "Articulado"
                  : s.type === "fixed"
                    ? "Empotrado"
                    : "Libre"}{" "}
                &middot; Posición: x = {formatLength(s.position)}
              </span>
            </div>
          );
        })}
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Momento Flector Máximo
          </span>
          <p className="text-2xl font-bold text-warning mt-1">
            {formatMoment(maxMomentU.value)}
          </p>
          <span className="text-xs text-text-muted">
            Posición: x = {formatLength(maxMomentU.position)}
          </span>
        </div>
      </div>

      {/* Mostrar cálculos — Audit trail (task 1.13) */}
      {designCheck &&
        selectedProfileCalc &&
        (() => {
          const dc = designCheck;
          const profile = selectedProfileCalc;
          const E = 200000; // MPa (from engine constants)

          return (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
                Mostrar cálculos &mdash; {dc.profile}
              </h2>

              {/* Características del perfil */}
              <details className="mb-4">
                <summary className="cursor-pointer text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Características del perfil ▼
                </summary>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="text-left py-1 pr-2">Propiedad</th>
                        <th className="text-right py-1 px-2">Valor</th>
                        <th className="text-left py-1 pl-2">Unidad</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[
                        ["d = h", getD(profile), "mm"],
                        ["b_f = b", getBf(profile), "mm"],
                        ["t_f", profile.tf, "mm"],
                        ["t_w", profile.tw, "mm"],
                        ["A", profile.A, "cm²"],
                        ["peso", profile.peso ?? null, "kg/m"],
                        ["I_x", profile.Ix, "cm⁴"],
                        ["I_y", profile.Iy, "cm⁴"],
                        ["Z_x", profile.Zx, "cm³"],
                        ["S_x", profile.Sx, "cm³"],
                        ["Z_y", profile.Zy ?? null, "cm³"],
                        ["S_y", profile.Sy ?? null, "cm³"],
                        ["r_x", profile.rx ?? null, "cm"],
                        ["r_y", profile.ry, "cm"],
                        ["J", profile.J, "cm⁴"],
                        ["C_w", profile.Cw, "cm⁶"],
                        ["h_o = h − t_f", profile.h - profile.tf, "mm"],
                        ...(profileType === "UPN" && upnProfile
                          ? [
                              [
                                "x_g (centroide al alma)",
                                upnProfile.xg,
                                "cm",
                              ],
                              [
                                "Centro de corte (aprox)",
                                upnProfile.xg + upnProfile.tw / 10,
                                "cm",
                              ],
                            ]
                          : []),
                      ].map(([label, val, unit]) => (
                        <tr key={label} className="border-b border-border/50">
                          <td className="py-1 pr-2 text-text-muted">{label}</td>
                          <td className="text-right py-1 px-2">
                            {val != null
                              ? typeof val === "number"
                                ? val.toFixed(val < 10 ? 2 : 1)
                                : val
                              : "—"}
                          </td>
                          <td className="py-1 pl-2 text-text-muted">{unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* λ audit — Flange */}
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                λ — Ala (flange)
              </h3>
              <div className="text-xs font-mono space-y-0.5 mb-3">
                <p>
                  {profileType === "UPN" ? (
                    <>
                      λ<sub>f</sub> = b / t<sub>f</sub> = {getBf(profile)} /{" "}
                      {profile.tf} = {dc.lambdaF.toFixed(2)}
                    </>
                  ) : (
                    <>
                      λ<sub>f</sub> = b / (2·t<sub>f</sub>) = {getBf(profile)} / (2·
                      {profile.tf}) = {dc.lambdaF.toFixed(2)}
                    </>
                  )}
                </p>
                <p>
                  λ<sub>pf</sub> = 0.38·√(E/F<sub>y</sub>) = 0.38·√({E}/
                  {designParams!.Fy}) = {dc.lambdaPf.toFixed(2)}
                </p>
                <p className="text-text-muted">
                  {dc.lambdaF <= dc.lambdaPf
                    ? "λ_f ≤ λ_pf → ala compacta"
                    : dc.lambdaF <= dc.lambdaRf
                      ? "λ_pf < λ_f ≤ λ_rf → ala no compacta"
                      : "λ_f > λ_rf → ala esbelta"}
                </p>
              </div>

              {/* λ audit — Web */}
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                λ — Alma (web)
              </h3>
              <div className="text-xs font-mono space-y-0.5 mb-3">
                <p>
                  λ<sub>w</sub> = (h − 2·t<sub>f</sub>) / t<sub>w</sub> = (
                  {profile.h} − 2·{profile.tf}) / {profile.tw} ={" "}
                  {dc.lambdaW.toFixed(2)}
                </p>
                <p>
                  λ<sub>pw</sub> = 3.76·√(E/F<sub>y</sub>) = 3.76·√({E}/
                  {designParams!.Fy}) = {dc.lambdaPw.toFixed(2)}
                </p>
                <p className="text-text-muted">
                  {dc.lambdaW <= dc.lambdaPw
                    ? "λ_w ≤ λ_pw → alma compacta"
                    : dc.lambdaW <= dc.lambdaRw
                      ? "λ_pw < λ_w ≤ λ_rw → alma no compacta"
                      : "λ_w > λ_rw → alma esbelta"}
                </p>
              </div>

              {/* Classification banner */}
              <div
                className={`p-3 rounded-lg mb-4 text-sm font-semibold ${
                  dc.classification === "COMPACT"
                    ? "bg-success/10 text-success border border-success/30"
                    : dc.classification === "NON_COMPACT"
                      ? "bg-warning/10 text-warning border border-warning/30"
                      : "bg-danger/10 text-danger border border-danger/30"
                }`}
              >
                {dc.classification === "COMPACT"
                  ? "Compacta"
                  : dc.classification === "NON_COMPACT"
                    ? "No compacta"
                    : "Con elementos esbeltos"}
                <span className="block text-xs font-normal mt-0.5 opacity-75">
                  {dc.classification === "COMPACT"
                    ? "λ_f ≤ λ_pf y λ_w ≤ λ_pw"
                    : dc.classification === "NON_COMPACT"
                      ? "Al menos un λ entre λ_p y λ_r, ninguno > λ_r"
                      : "Al menos un λ > λ_r"}
                </span>
              </div>

              {/* Ver cuentas completas: LTB + corte + deformación */}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-text-muted font-semibold uppercase tracking-wider">
                  Ver cuentas completas ▼
                </summary>
                <div className="mt-2">
                  {/* LTB audit */}
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Pandeo Lateral-Torsional (LTB)
                  </h3>
                  <div className="text-xs font-mono space-y-1 mb-3">
                    <p>
                      M<sub>d1</sub> = φ·min(M<sub>n,flange</sub>, M<sub>n,web</sub>
                      ) = 0.9·min({(dc.MnFlange / 1e6).toFixed(1)},{" "}
                      {(dc.MnWeb / 1e6).toFixed(1)}) = {(dc.Md1 / 1e6).toFixed(2)}{" "}
                      kN·m
                    </p>
                    <p className="text-text-muted">
                      Donde: M<sub>n,flange</sub> = resistencia por pandeo local del
                      ala, M<sub>n,web</sub> = resistencia por pandeo local del alma.
                      Se toma el menor de ambos como límite por pandeo local.
                    </p>
                    <p>
                      M<sub>p</sub> = F<sub>y</sub>·Z<sub>x</sub> ={" "}
                      {designParams!.Fy}·{profile.Zx} = {(dc.Mp / 1e6).toFixed(2)}{" "}
                      kN·m
                    </p>
                    <p>
                      M<sub>r</sub> = 0.7·F<sub>y</sub>·S<sub>x</sub> = 0.7·
                      {designParams!.Fy}·{profile.Sx} = {(dc.Mr / 1e6).toFixed(2)}{" "}
                      kN·m
                    </p>
                    <p>
                      L<sub>p,eff</sub> = {(dc.LpEff / 10).toFixed(0)} cm
                      {dc.LpEff !== dc.Lp && (
                        <span className="text-text-muted">
                          {" "}(L<sub>p</sub> = {(dc.Lp / 10).toFixed(0)} cm)
                        </span>
                      )}
                    </p>
                    <p>
                      L<sub>r,eff</sub> = {(dc.LrEff / 10).toFixed(0)} cm
                      {dc.LrEff !== dc.Lr && (
                        <span className="text-text-muted">
                          {" "}(L<sub>r</sub> = {(dc.Lr / 10).toFixed(0)} cm)
                        </span>
                      )}
                    </p>
                    <p>
                      L = {(dc.effectiveLb / 10).toFixed(0)} cm
                    </p>
                    <p>
                      F<sub>e</sub> = {dc.Fe.toFixed(1)} MPa
                    </p>
                    <p>
                      M<sub>cr</sub> = min(F<sub>e</sub>·S<sub>x</sub>, M
                      <sub>p</sub>) = min({(dc.Fe * profile.Sx / 1000).toFixed(1)},{" "}
                      {(dc.Mp / 1e6).toFixed(1)}) ={" "}
                      {(dc.Mcr / 1e6).toFixed(2)} kN·m
                    </p>
                    <p>
                      M<sub>d2</sub> = φ·M<sub>n,LTB</sub> = 0.9·
                      {(dc.MnLTB / 1e6).toFixed(2)} = {(dc.Md2 / 1e6).toFixed(2)}{" "}
                      kN·m
                    </p>
                    <p>
                      M<sub>d</sub> = φ·M<sub>n</sub> = min(M<sub>d1</sub>, M
                      <sub>d2</sub>) = {(dc.phiMn / 1e6).toFixed(2)} kN·m
                    </p>
                  </div>
                  {/* Steps: flexión + corte + deformación (perfil y clasificación ya están arriba) */}
                  {(() => {
                    const flexIdx = dc.steps.findIndex((l: string) =>
                      l.startsWith("--- Resistencia a flexión ---"),
                    );
                    const filtered =
                      flexIdx >= 0 ? dc.steps.slice(flexIdx) : dc.steps;
                    return (
                      <pre className="p-3 rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
                        {filtered.join("\n")}
                      </pre>
                    );
                  })()}
                </div>
              </details>
            </section>
          );
        })()}

      {/* Mostrar resultados (task 1.14) */}
      {designCheck && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Mostrar resultados {designCheck.profile} &mdash; CIRSOC 301-05
          </h2>

          {/* Subdimensioned banner (task 1.14) */}
          {designCheck.subdimensioned && (
            <div className="mb-4 p-3 border border-danger/30 rounded-lg bg-danger/10 text-sm text-danger font-semibold">
              Perfil subdimensionado: Z<sub>x</sub> ={" "}
              {designCheck.Zx_selected.toFixed(0)} cm³, necesario ≥{" "}
              {designCheck.Zx_req.toFixed(0)} cm³
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Flexión</span>
              <span className="text-sm font-semibold">
                φM<sub>n</sub> = {(designCheck.phiMn / 1e6).toFixed(1)} kN·m
              </span>
              <span
                className={`text-sm ${designCheck.subdimensioned || designCheck.ratioFlex > 1 ? "text-danger font-semibold" : ""}`}
              >
                M<sub>u</sub> = {(designCheck.Mu / 1e6).toFixed(1)} kN·m
              </span>
              <span
                className={`text-sm font-bold ${designCheck.ratioFlex <= 1 ? "text-success" : "text-danger"}`}
              >
                {designCheck.ratioFlex <= 1 ? "✓" : "✗"} Ratio:{" "}
                {designCheck.ratioFlex.toFixed(2)}
              </span>
              <span className="text-xs text-text-muted">
                {designCheck.limitingState}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Corte</span>
              <span className="text-sm font-semibold">
                φV<sub>n</sub> = {(designCheck.phiVn / 1000).toFixed(1)} kN
              </span>
              <span className="text-sm">
                V<sub>u</sub> = {(designCheck.Vu / 1000).toFixed(1)} kN
              </span>
              <span
                className={`text-sm font-bold ${designCheck.ratioShear <= 1 ? "text-success" : "text-danger"}`}
              >
                {designCheck.ratioShear <= 1 ? "✓" : "✗"} Ratio:{" "}
                {designCheck.ratioShear.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Deformación</span>
              <span className="text-sm">
                δ<sub>max</sub> = {designCheck.maxDeflection.toFixed(1)} mm
              </span>
              <span className="text-sm">
                δ<sub>adm</sub> = {designCheck.allowableDeflection.toFixed(1)}{" "}
                mm
              </span>
              <span
                className={`text-sm font-bold ${designCheck.deflectionOK ? "text-success" : "text-danger"}`}
              >
                {designCheck.deflectionOK ? "✓ Cumple" : "✗ No cumple"}
              </span>
            </div>
          </div>
        </section>
      )}


      {/* Load Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Diagrama de Cargas
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Fuerzas externas aplicadas sobre la viga
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{ x: [xMin, xMax], y: [-maxLoad * 0.2, maxLoad * 1.3] }}
            height={200}
            preserveAspectRatio={false}
          >
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {loads.map((load) => (
              <g key={load.id}>
                {load.type === "point" && (
                  <Vector
                    tip={[load.position ?? 0, 0]}
                    tail={[
                      load.position ?? 0,
                      (load.deadLoad ?? 0) + (load.liveLoad ?? 0),
                    ]}
                  />
                )}
                {load.type === "distributed" && (
                  <>
                    <Plot.OfX
                      y={() => (load.deadLoad ?? 0) + (load.liveLoad ?? 0)}
                      domain={[load.start ?? 0, load.end ?? 0]}
                    />
                    <Plot.OfY
                      x={() => load.start ?? 0}
                      domain={[0, (load.deadLoad ?? 0) + (load.liveLoad ?? 0)]}
                    />
                    <Plot.OfY
                      x={() => load.end ?? 0}
                      domain={[0, (load.deadLoad ?? 0) + (load.liveLoad ?? 0)]}
                    />
                  </>
                )}
              </g>
            ))}
            {supports.map((s, i) => (
              <Vector
                key={`support-${i}`}
                tip={[s.position, 0]}
                tail={[s.position, -reactionsU[i]]}
                color="#4ade80"
              />
            ))}
          </Mafs>
        </div>
      </section>

      {/* Shear Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Esfuerzo Cortante
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Fuerza interna V(x) &mdash; integral del diagrama de cargas
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxLoad * 1.3, maxLoad * 1.3],
            }}
            height={200}
            preserveAspectRatio={false}
          >
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {(() => {
              const eps = 0.001;
              const isJump = (pos: number) =>
                supports.some((s) => Math.abs(s.position - pos) < eps) ||
                loads.some(
                  (l) =>
                    l.type === "point" &&
                    Math.abs((l.position ?? 0) - pos) < eps,
                );

              const elements: React.ReactNode[] = [];

              for (let i = 1; i < criticalPointsU.length; i++) {
                const xPrev = criticalPointsU[i - 1];
                const x = criticalPointsU[i];
                const jumpAtPrev = isJump(xPrev);
                const jumpAtX = isJump(x);

                let startV: number;
                if (jumpAtPrev) {
                  const vBefore = shearForceU(xPrev - eps);
                  const vAfter = shearForceU(xPrev + eps);
                  elements.push(
                    <Plot.OfY
                      key={`jump-${xPrev}`}
                      x={() => xPrev}
                      domain={[
                        Math.min(vBefore, vAfter),
                        Math.max(vBefore, vAfter),
                      ]}
                      color="#f87171"
                    />,
                  );
                  startV = vAfter;
                } else {
                  startV = shearForceU(xPrev);
                }

                const endV = jumpAtX ? shearForceU(x - eps) : shearForceU(x);

                elements.push(
                  <Plot.OfX
                    key={`seg-${xPrev}-${x}`}
                    y={(t) => {
                      const slope = (endV - startV) / (x - xPrev);
                      return startV + slope * (t - xPrev);
                    }}
                    domain={[xPrev, x]}
                    color="#f87171"
                  />,
                );
              }

              // Jump at the last critical point (e.g. right support)
              const last = criticalPointsU[criticalPointsU.length - 1];
              if (isJump(last)) {
                const vBefore = shearForceU(last - eps);
                const vAfter = shearForceU(last + eps);
                elements.push(
                  <Plot.OfY
                    key={`jump-last`}
                    x={() => last}
                    domain={[
                      Math.min(vBefore, vAfter),
                      Math.max(vBefore, vAfter),
                    ]}
                    color="#f87171"
                  />,
                );
              }

              // Labels at critical points
              const labeled = new Set<number>();
              for (const cp of criticalPointsU) {
                if (labeled.has(cp)) continue;
                labeled.add(cp);
                if (isJump(cp)) {
                  const vb = shearForceU(cp - eps);
                  const va = shearForceU(cp + eps);
                  const attachVb = vb >= 0 ? "n" : "s";
                  const attachVa = va >= 0 ? "n" : "s";
                  elements.push(
                    <Text
                      key={`label-before-${cp}`}
                      x={cp}
                      y={vb}
                      attach={attachVb}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(vb)}
                    </Text>,
                  );
                  elements.push(
                    <Text
                      key={`label-after-${cp}`}
                      x={cp}
                      y={va}
                      attach={attachVa}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(va)}
                    </Text>,
                  );
                } else {
                  const v = shearForceU(cp);
                  elements.push(
                    <Text
                      key={`label-${cp}`}
                      x={cp}
                      y={v}
                      attach={v >= 0 ? "n" : "s"}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(v)}
                    </Text>,
                  );
                }
              }

              return elements;
            })()}
          </Mafs>
        </div>
      </section>

      {/* Moment Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Momento Flector
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Momento interno M(x) &mdash; integral del esfuerzo cortante
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxMomentAbs * 1.2, maxMomentAbs * 1.2],
            }}
            height={200}
            preserveAspectRatio={false}
          >
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {criticalPointsU.map((x, i) => {
              if (i === 0) return null;
              const xPrev = criticalPointsU[i - 1];
              return (
                <Plot.OfX
                  key={x}
                  y={(t) => {
                    // Plot inverted: positive moment below baseline
                    return -bendingMomentU(t);
                  }}
                  domain={[xPrev, x]}
                  color="#fbbf24"
                />
              );
            })}
            {criticalPointsU.map((cp) => {
              const m = bendingMomentU(cp);
              const absM = Math.abs(m);
              const label =
                absM >= 1000
                  ? `${(m / 1000).toFixed(2)} MN·m`
                  : absM >= 1
                    ? `${m.toFixed(2)} kN·m`
                    : `${(m * 1000).toFixed(2)} N·m`;
              return (
                <Text
                  key={`m-${cp}`}
                  x={cp}
                  y={-m}
                  attach={m >= 0 ? "s" : "n"}
                  attachDistance={8}
                  color="#fbbf24"
                  size={9}
                >
                  {label}
                </Text>
              );
            })}
            <Text
              x={maxMomentU.position}
              y={-maxMomentU.value}
              attach="s"
              attachDistance={15}
              color="#fbbf24"
              size={10}
            >
              Mmax
            </Text>
          </Mafs>
        </div>
      </section>
    </MainLayout>
  );
}
