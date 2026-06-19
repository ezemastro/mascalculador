import type { AngleData } from "./angle-profiles";

export interface TrussConfig {
  height: number;      // m (distance between chord centroids)
  panelSpacing: number; // m
}

export interface TrussForces {
  maxTopChord: number;      // kN (compression, negative)
  maxBottomChord: number;   // kN (tension, positive)
  maxDiagonal: number;      // kN (absolute value)
  maxVertical: number;      // kN (absolute value)
  chordLength: number;      // m (panel spacing)
  diagonalLength: number;   // m
  verticalLength: number;   // m (truss height)
}

export interface AngleCheck {
  memberType: string;
  force: number;       // kN (absolute)
  length: number;      // mm
  phiPn: number;       // kN (design strength)
  ratio: number;       // force / phiPn
  passes: boolean;
  limitState: string;
  steps: string[];     // calculation details
}

export function computeTrussForces(
  maxMoment: number,    // kN·m
  maxShear: number,     // kN
  reactions: number[],  // kN
  config: TrussConfig,
): TrussForces {
  const { height, panelSpacing } = config;
  const h = height;
  const s = panelSpacing;

  const absM = Math.abs(maxMoment);
  const chordForce = absM / h;

  const diagLength = Math.sqrt(h * h + s * s);
  const sinAlpha = h / diagLength;

  let maxV = maxShear;
  for (const r of reactions) {
    maxV = Math.max(maxV, Math.abs(r));
  }

  return {
    maxTopChord: -chordForce,
    maxBottomChord: chordForce,
    maxDiagonal: maxShear / sinAlpha,
    maxVertical: maxV,
    chordLength: s,
    diagonalLength: diagLength,
    verticalLength: h,
  };
}

// ---- Angle verification per CIRSOC 301-05 ----

const E = 200000; // MPa
const PHI_T_YIELD = 0.90;
const PHI_T_RUPT = 0.75;
const PHI_C = 0.90;

export function checkAngleTension(
  angle: AngleData,
  Fy: number,  // MPa
  Fu: number,  // MPa
  force: number, // kN
): AngleCheck {
  const Ag = angle.A * 100; // cm² → mm²
  const Ae = Ag; // welded, U = 1.0

  const PnYield = (Fy * Ag) / 1000;       // kN
  const phiPnYield = PHI_T_YIELD * PnYield;

  const PnRupt = Fu * Ae / 1000;           // kN
  const phiPnRupt = PHI_T_RUPT * PnRupt;

  const phiPn = Math.min(phiPnYield, phiPnRupt);
  const limitState = phiPnYield <= phiPnRupt ? "Fluencia (φ·Fy·Ag)" : "Rotura (φ·Fu·Ae)";

  const steps = [
    `A_g = ${angle.A} cm² = ${Ag.toFixed(0)} mm²`,
    `A_e = A_g = ${Ag.toFixed(0)} mm² (U = 1.0)`,
    `P_n fluencia = F_y · A_g = ${Fy} · ${Ag} = ${(Fy * Ag / 1000).toFixed(1)} kN`,
    `φ·P_n fluencia = ${PHI_T_YIELD} · ${PnYield.toFixed(1)} = ${phiPnYield.toFixed(1)} kN`,
    `P_n rotura = F_u · A_e = ${Fu} · ${Ag} = ${(Fu * Ag / 1000).toFixed(1)} kN`,
    `φ·P_n rotura = ${PHI_T_RUPT} · ${PnRupt.toFixed(1)} = ${phiPnRupt.toFixed(1)} kN`,
    `φ·P_n = min(${phiPnYield.toFixed(1)}, ${phiPnRupt.toFixed(1)}) = ${phiPn.toFixed(1)} kN`,
  ];

  return {
    memberType: "Tracción",
    force,
    length: 0,
    phiPn,
    ratio: force / phiPn,
    passes: force <= phiPn,
    limitState,
    steps,
  };
}

export function checkAngleCompression(
  angle: AngleData,
  Fy: number,  // MPa
  L: number,    // mm (unbraced length)
  K: number,    // effective length factor
  force: number, // kN
): AngleCheck {
  const Ag = angle.A * 100; // cm² → mm²
  const r = angle.rz * 10;  // cm → mm

  // Slenderness
  const KLr = (K * L) / r;
  const lambdaC = (KLr / Math.PI) * Math.sqrt(Fy / E);

  let Fcr: number;
  let formula: string;
  if (lambdaC <= 1.5) {
    Fcr = Math.pow(0.658, lambdaC * lambdaC) * Fy;
    formula = `F_{cr} = 0.658^{λ_c²} · F_y`;
  } else {
    Fcr = (0.877 / (lambdaC * lambdaC)) * Fy;
    formula = `F_{cr} = 0.877 / λ_c² · F_y`;
  }

  const Pn = (Fcr * Ag) / 1000; // kN
  const phiPn = PHI_C * Pn;

  const Fe = (Math.PI * Math.PI * E) / (KLr * KLr);
  const limitState = lambdaC <= 1.5 ? "Pandeo inelástico" : "Pandeo elástico";

  const steps = [
    `A_g = ${angle.A} cm² = ${Ag.toFixed(0)} mm²`,
    `r_z = ${angle.rz} cm = ${r.toFixed(1)} mm`,
    `L = ${L} mm, K = ${K}`,
    `KL/r = ${K}·${L}/${r.toFixed(1)} = ${KLr.toFixed(1)}`,
    `λ_c = (KL/r) / π · √(F_y/E) = ${KLr.toFixed(1)}/${Math.PI.toFixed(3)} · √(${Fy}/${E}) = ${lambdaC.toFixed(3)}`,
    `F_e = π²·E / (KL/r)² = ${(Math.PI * Math.PI * E / 1e6).toFixed(1)}·10⁶ / ${KLr.toFixed(1)}² = ${Fe.toFixed(1)} MPa`,
    formula,
    `F_{cr} = ${Fcr.toFixed(1)} MPa`,
    `P_n = F_{cr} · A_g = ${Fcr.toFixed(1)} · ${Ag} = ${Pn.toFixed(1)} kN`,
    `φ_c·P_n = ${PHI_C} · ${Pn.toFixed(1)} = ${phiPn.toFixed(1)} kN`,
  ];

  return {
    memberType: "Compresión",
    force,
    length: L,
    phiPn,
    ratio: force / phiPn,
    passes: force <= phiPn,
    limitState,
    steps,
  };
}

export function designTrussMembers(
  topAngle: AngleData,
  botAngle: AngleData,
  diagAngle: AngleData,
  vertAngle: AngleData,
  forces: TrussForces,
  Fy: number,
  Fu: number,
): AngleCheck[] {
  const results: AngleCheck[] = [];

  // Top chord: compression
  const topForceAbs = Math.abs(forces.maxTopChord);
  const top = checkAngleCompression(topAngle, Fy, forces.chordLength * 1000, 1.0, topForceAbs);
  top.memberType = "Cordón superior";
  results.push(top);

  // Bottom chord: tension
  const bot = checkAngleTension(botAngle, Fy, Fu, forces.maxBottomChord);
  bot.memberType = "Cordón inferior";
  results.push(bot);

  // Diagonal: compression (worst case)
  const diag = checkAngleCompression(diagAngle, Fy, forces.diagonalLength * 1000, 1.0, forces.maxDiagonal);
  diag.memberType = "Diagonal";
  results.push(diag);

  // Vertical: compression
  const vert = checkAngleCompression(vertAngle, Fy, forces.verticalLength * 1000, 1.0, forces.maxVertical);
  vert.memberType = "Montante";
  results.push(vert);

  return results;
}
