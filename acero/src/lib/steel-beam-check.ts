// Verificación completa de la viga de acero (usada por Resultados e
// Impresión): envolvente última con 1.4·D y sobrecarga alternada, flexión
// positiva con Lb1 y negativa con Lb2, corte y flecha real por tramo.
import type { BeamConfig, Load } from "@mascalculador/shared";
import type { SteelDesignParams } from "@mascalculador/shared";
import type { Classification } from "@mascalculador/shared";
import { checkBeam, type DesignResult } from "./steel-design";
import type { ProfileData } from "./profiles";
import {
  computeDeflections,
  computeSteelEnvelope,
  type DeflectionRegion,
  type SteelEnvelope,
} from "./steel-beam-envelope";

const E_MPA = 200000;

export interface FlexCheck {
  sign: "+" | "−";
  Mu: number; // N·mm (valor absoluto)
  position: number; // m
  Lb: number; // mm
  phiMn: number; // N·mm
  ratio: number;
  limitingState: string;
}

export interface SteelBeamCheck {
  profile: string;
  phiMn: number;
  Mu: number;
  ratioFlex: number;
  /** Verificaciones de flexión: positiva (Lb1) y negativa (Lb2). */
  flexChecks: FlexCheck[];
  phiVn: number;
  Vu: number;
  ratioShear: number;
  limitingState: string;
  maxDeflection: number;
  allowableDeflection: number;
  deflectionOK: boolean;
  deflectionLabel: string;
  deflectionRegions: DeflectionRegion[];
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
  effectiveLb: number;
  Mr: number;
  Fe: number;
  Mcr: number;
  Md1: number;
  Md2: number;
  Zx_selected: number;
  Zx_req: number;
  subdimensioned: boolean;
  envelope: SteelEnvelope;
}

function regionLabel(r: DeflectionRegion, idx: number): string {
  const span = `${r.start.toFixed(2)}–${r.end.toFixed(2)} m`;
  return r.kind === "voladizo"
    ? `voladizo (${span}, luz de comparación 2·L)`
    : `tramo ${idx + 1} (${span})`;
}

export function runSteelBeamCheck(
  profile: ProfileData,
  designParams: SteelDesignParams,
  beamConfig: BeamConfig,
  loads: Load[],
  ZxDisplay: number = profile.Zx,
): SteelBeamCheck {
  const envelope = computeSteelEnvelope(beamConfig, loads);

  // ---- Flecha de servicio (D + L) por tramo ----
  const EI_kNm2 = (E_MPA * 1e3 * profile.Ix) / 1e8; // kN/m² · m⁴
  const serviceM = (x: number) =>
    envelope.d.bendingMoment(x) + envelope.lAll.bendingMoment(x);
  const regions = computeDeflections(beamConfig, serviceM, EI_kNm2);
  let tramoIdx = 0;
  const labeled = regions.map((r) => {
    const label = regionLabel(r, r.kind === "tramo" ? tramoIdx : 0);
    if (r.kind === "tramo") tramoIdx++;
    return { r, label };
  });
  // Región que gobierna: la de mayor relación δ / δadm.
  const governing = labeled.reduce<(typeof labeled)[number] | null>(
    (best, cur) =>
      !best || cur.r.delta / cur.r.refLength > best.r.delta / best.r.refLength
        ? cur
        : best,
    null,
  );
  const deflection = governing
    ? {
        delta: governing.r.delta,
        refLength: governing.r.refLength * 1000,
        label: governing.label,
      }
    : { delta: 0, refLength: 1, label: "—" };

  const params = {
    Fy: designParams.Fy,
    Lb: designParams.Lb,
    Lb1: designParams.Lb1,
    Lb2: designParams.Lb2,
    Cb: designParams.Cb,
    deflectionLimit: designParams.deflectionLimit,
    beamLength: deflection.refLength,
    loadPosition: designParams.loadPosition ?? "top",
  };

  // ---- Flexión: M+ con Lb1 y M− con Lb2 ----
  const cases: Array<{ sign: "+" | "−"; Mu: number; position: number }> = [];
  if (envelope.MuPos.value > 1e-9)
    cases.push({
      sign: "+",
      Mu: envelope.MuPos.value,
      position: envelope.MuPos.position,
    });
  if (envelope.MuNeg.value < -1e-9)
    cases.push({
      sign: "−",
      Mu: envelope.MuNeg.value,
      position: envelope.MuNeg.position,
    });
  if (cases.length === 0) cases.push({ sign: "+", Mu: 0, position: 0 });

  const results: Array<{ c: (typeof cases)[number]; dr: DesignResult }> =
    cases.map((c) => ({
      c,
      dr: checkBeam(profile, params, deflection, c.Mu * 1e6),
    }));
  const flexChecks: FlexCheck[] = results.map(({ c, dr }) => ({
    sign: c.sign,
    Mu: Math.abs(c.Mu) * 1e6,
    position: c.position,
    Lb:
      c.sign === "+"
        ? (designParams.Lb1 ?? designParams.Lb)
        : (designParams.Lb2 ?? designParams.Lb),
    phiMn: dr.phiMn,
    ratio: dr.phiMn > 0 ? (Math.abs(c.Mu) * 1e6) / dr.phiMn : Infinity,
    limitingState: dr.limitingState,
  }));
  // La que gobierna: mayor relación Mu/φMn.
  let gi = 0;
  flexChecks.forEach((f, i) => {
    if (f.ratio > flexChecks[gi].ratio) gi = i;
  });
  const g = flexChecks[gi];
  const dr = results[gi].dr;

  const Vu = envelope.Vu * 1e3; // N
  const MuMaxAbs = Math.max(...flexChecks.map((f) => f.Mu));
  const Zx_req = MuMaxAbs / (0.9 * designParams.Fy) / 1000; // cm³

  const steps = [
    "--- Envolvente de estado último ---",
    "U = máx(1.4·D ; 1.2·D + 1.6·L), con la sobrecarga de cada tramo activada o no (alternancia de cargas).",
    ...flexChecks.map(
      (f) =>
        `M_u${f.sign} = ${(f.Mu / 1e6).toFixed(2)} kN·m en x = ${f.position.toFixed(2)} m → L_b = ${f.Lb.toFixed(0)} mm → φM_n = ${(f.phiMn / 1e6).toFixed(2)} kN·m → M_u/φM_n = ${f.ratio.toFixed(2)} (${f.limitingState})`,
    ),
    `V_u = ${envelope.Vu.toFixed(2)} kN`,
    "",
    "--- Flecha de servicio por tramo (D + L) ---",
    ...labeled.map(
      ({ r, label }) =>
        `${label}: δ = ${r.delta.toFixed(1)} mm, δ_adm = ${((r.refLength * 1000) / designParams.deflectionLimit).toFixed(1)} mm`,
    ),
    "",
    `--- Detalle de la flexión que gobierna (M_u${g.sign}, L_b = ${g.Lb.toFixed(0)} mm) ---`,
    ...dr.steps,
  ];

  return {
    profile: profile.name,
    phiMn: g.phiMn,
    Mu: g.Mu,
    ratioFlex: g.ratio,
    flexChecks,
    phiVn: dr.phiVn,
    Vu,
    ratioShear: Vu / dr.phiVn,
    limitingState: g.limitingState,
    maxDeflection: dr.maxDeflection,
    allowableDeflection: dr.allowableDeflection,
    deflectionOK: labeled.every(
      ({ r }) =>
        r.delta <= (r.refLength * 1000) / designParams.deflectionLimit + 1e-9,
    ),
    deflectionLabel: deflection.label,
    deflectionRegions: regions,
    steps,
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
    effectiveLb: g.Lb,
    Mr: dr.Mr,
    Fe: dr.Fe,
    Mcr: dr.Mcr,
    Md1: dr.Md1,
    Md2: dr.Md2,
    Zx_selected: ZxDisplay,
    Zx_req,
    subdimensioned: ZxDisplay < Zx_req,
    envelope,
  };
}
