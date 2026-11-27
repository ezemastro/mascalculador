// CIRSOC 301-05 — Column design (axial + bending)
import { checkBeam } from "./steel-design";
import type { ProfileData } from "./profiles";

const E = 200000; // MPa
const PHI_C = 0.85; // CIRSOC 301-05 Cap. E — φc compresión
const PHI_B = 0.9;

// ---- Local Buckling Verification (CIRSOC 301-05 Tabla B.4.1a) ----

export interface LocalBucklingParams {
  section: "I" | "C" | "HSS" | "I_BUILTUP" | "CAJON";
  bf: number; // mm — flange width (I/C: full width; HSS/CAJON: width dimension)
  tf: number; // mm — flange thickness (I/C) or wall thickness (HSS/CAJON)
  h: number; // mm — section height (total for I/C; outer dim for HSS/CAJON)
  tw: number; // mm — web thickness (I/C/I_BUILTUP); for HSS/CAJON use same as tf
}

export interface LocalBucklingResult {
  flangeLambda: number;
  webLambda: number;
  flangeLambdaR: number;
  webLambdaR: number;
  flangeOk: boolean;
  webOk: boolean;
  isNonSlender: boolean;
  steps: string[];
}

/**
 * Verifica pandeo local según CIRSOC 301-05 Tabla B.4.1a.
 * Retorna Q = 1.0 si la sección es no-esbelta.
 */
export function checkLocalBuckling(
  params: LocalBucklingParams,
  Fy: number,
): LocalBucklingResult {
  const { section, bf, tf, h, tw } = params;
  const lambdaR0 = Math.sqrt(E / Fy);
  const st: string[] = [];

  st.push("--- Pandeo Local (Tabla B.4.1a) ---");

  let flangeLambda: number;
  let flangeLambdaR: number;
  let flangeDesc: string;

  let webLambda: number;
  let webLambdaR: number;
  let webDesc: string;

  if (section === "I") {
    // I-shape rolled (IPN): Case 1 flange (unstiffened), Case 5 web (stiffened)
    flangeLambda = bf / (2 * tf);
    flangeLambdaR = 0.56 * lambdaR0;
    flangeDesc = `bf/(2·tf)`;

    const hw = h - 2 * tf;
    webLambda = hw / tw;
    webLambdaR = 1.49 * lambdaR0;
    webDesc = `hw/tw`;
  } else if (section === "I_BUILTUP") {
    // I-shape built-up (doble T armada): Case 2 flange, Case 5 web
    const hw = h - 2 * tf;
    const kc = Math.max(0.35, Math.min(0.76, 4 / Math.sqrt(hw / tw)));

    flangeLambda = bf / (2 * tf);
    flangeLambdaR = 0.64 * Math.sqrt(kc) * lambdaR0;
    flangeDesc = `bf/(2·tf)`;
    webLambda = hw / tw;
    webLambdaR = 1.49 * lambdaR0;
    webDesc = `hw/tw`;

    st.push(`  k_c = 4/√(hw/tw) = ${kc.toFixed(3)} (0.35 ≤ k_c ≤ 0.76)`);
  } else if (section === "C") {
    // Channel (UPN): ala de perfil U laminado (mismo caso que el ala del
    // doble T laminado, Tabla B.5-1): b/t ≤ 0.56·√(E/Fy), b = ancho total.
    // Antes se usaba 0.45 (límite de ángulos simples).
    flangeLambda = bf / tf;
    flangeLambdaR = 0.56 * lambdaR0;
    flangeDesc = `bf/tf`;

    const hw = h - 2 * tf;
    webLambda = hw / tw;
    webLambdaR = 1.49 * lambdaR0;
    webDesc = `hw/tw`;
  } else {
    // HSS or CAJON (tube/box): Case 6 — both sides stiffened
    flangeLambda = bf / tf;
    webLambda = h / tw;
    flangeLambdaR = 1.4 * lambdaR0;
    webLambdaR = 1.4 * lambdaR0;
    flangeDesc = `b/t`;
    webDesc = `h/t`;
  }

  const flangeOk = flangeLambda <= flangeLambdaR;
  const webOk = webLambda <= webLambdaR;
  const isNonSlender = flangeOk && webOk;

  st.push(
    `Ala: λ = ${flangeDesc} = ${flangeLambda.toFixed(1)} ≤ λ_r = ${flangeLambdaR.toFixed(1)} ${flangeOk ? "✓ no esbelta" : "✗ ESBELTA"}`,
  );
  st.push(
    `Alma: λ = ${webDesc} = ${webLambda.toFixed(1)} ≤ λ_r = ${webLambdaR.toFixed(1)} ${webOk ? "✓ no esbelta" : "✗ ESBELTA"}`,
  );
  st.push(`Sección ${isNonSlender ? "NO ESBELTA" : "ESBELTA"}`);
  st.push("");

  return {
    flangeLambda,
    webLambda,
    flangeLambdaR,
    webLambdaR,
    flangeOk,
    webOk,
    isNonSlender,
    steps: st,
  };
}

/**
 * Calcula factor Q = Qs·Qa para secciones esbeltas según CIRSOC 301-05 E.7.
 * Qs: reducción por elementos no rigidizados (alas).
 * Qa: reducción por elementos rigidizados (almas, paredes de tubos).
 */
export function computeSlenderQ(
  lb: LocalBucklingResult,
  params: LocalBucklingParams,
  Fy: number,
  Ag_mm2: number,
): { Q: number; Qs: number; Qa: number; steps: string[] } {
  if (lb.isNonSlender) {
    return {
      Q: 1.0,
      Qs: 1.0,
      Qa: 1.0,
      steps: ["Q = 1.0 (sección no esbelta)", ""],
    };
  }

  const lambdaR0 = Math.sqrt(E / Fy);
  const st: string[] = [];
  st.push("--- Factor Q por esbeltez local (CIRSOC E.7) ---");

  const { section, bf, tf, h, tw } = params;

  // ---- Qs: unstiffened elements (flanges) ----
  let Qs = 1.0;
  if (!lb.flangeOk && (section === "I" || section === "C")) {
    // Alas de perfiles laminados doble T y U (CIRSOC 301 A-B.5.3a)
    const lambda = section === "C" ? bf / tf : bf / (2 * tf);
    const lambdaR = 1.03 * lambdaR0;
    if (lambda <= lambdaR) {
      Qs = 1.415 - (0.74 * lambda) / lambdaR0;
      st.push(
        `Q_s ala: λ=${lambda.toFixed(1)} ≤ 1.03√(E/F_y)=${lambdaR.toFixed(1)} → Q_s=1.415−0.74·λ·√(F_y/E)=${Qs.toFixed(3)}`,
      );
    } else {
      Qs = (0.69 * E) / (Fy * lambda * lambda);
      st.push(
        `Q_s ala: λ=${lambda.toFixed(1)} > 1.03√(E/F_y) → Q_s=0.69·E/(F_y·λ²)=${Qs.toFixed(3)}`,
      );
    }
    Qs = Math.min(1.0, Qs);
  } else if (!lb.flangeOk && section === "I_BUILTUP") {
    // Alas de secciones armadas (CIRSOC 301 A-B.5.3a, con k_c)
    const lambda = bf / (2 * tf);
    const hw = h - 2 * tf;
    const kc = Math.max(0.35, Math.min(0.76, 4 / Math.sqrt(hw / tw)));
    const lambdaR = 1.17 * Math.sqrt((kc * E) / Fy);
    if (lambda <= lambdaR) {
      Qs = 1.415 - 0.65 * lambda * Math.sqrt(Fy / (kc * E));
      st.push(
        `Q_s ala: λ=${lambda.toFixed(1)} ≤ 1.17√(k_c·E/F_y)=${lambdaR.toFixed(1)} → Q_s=1.415−0.65·λ·√(F_y/(k_c·E))=${Qs.toFixed(3)}`,
      );
    } else {
      Qs = (0.9 * kc * E) / (Fy * lambda * lambda);
      st.push(
        `Q_s ala: λ=${lambda.toFixed(1)} > 1.17√(k_c·E/F_y) → Q_s=0.90·k_c·E/(F_y·λ²)=${Qs.toFixed(3)}`,
      );
    }
    Qs = Math.min(1.0, Qs);
  }
  // HSS/CAJON: no unstiffened elements → Qs stays 1.0

  // ---- Qa: stiffened elements (webs / HSS walls) ----
  let Qa = 1.0;
  let Ae = Ag_mm2;
  if (!lb.webOk) {
    if (section === "I" || section === "I_BUILTUP" || section === "C") {
      const hw = h - 2 * tf;
      const lambda = hw / tw;
      const be = 1.92 * tw * lambdaR0 * (1 - (0.34 / lambda) * lambdaR0);
      const beEff = Math.min(Math.max(be, 0), hw);
      const areaLoss = (hw - beEff) * tw;
      Ae = Ag_mm2 - areaLoss;
      st.push(
        `Q_a alma: h_w/t_w=${lambda.toFixed(1)}, b_e=1.92·t_w√(E/f)·[1−0.34/λ·√(E/f)]=${beEff.toFixed(0)} mm`,
      );
    } else {
      // HSS/CAJON: check both sides
      const lambdaH = h / tw;
      const lambdaB = bf / tf;
      const lambdaSlender = Math.max(lambdaH, lambdaB);
      const bSlender = lambdaSlender === lambdaH ? h : bf;
      const tSlender = lambdaSlender === lambdaH ? tw : tf;
      const be =
        1.92 * tSlender * lambdaR0 * (1 - (0.34 / lambdaSlender) * lambdaR0);
      const beEff = Math.min(Math.max(be, 0), bSlender);
      // HSS: simplify — reduce both sides proportionally if one is slender
      const aLoss =
        (bSlender - beEff) * tSlender * (section === "CAJON" ? 1 : 2);
      Ae = Math.max(Ag_mm2 - aLoss, Ag_mm2 * 0.6);
      st.push(
        `Q_a pared: λ=${lambdaSlender.toFixed(1)}, b_e=${beEff.toFixed(0)} mm`,
      );
    }
    Qa = Ae / Ag_mm2;
    st.push(
      `A_e = ${(Ae / 100).toFixed(1)} cm² (A_g = ${(Ag_mm2 / 100).toFixed(1)} cm²) → Q_a = ${Qa.toFixed(3)}`,
    );
  }

  const Q = +(Qs * Qa).toFixed(3);
  st.push(`Q = Q_s·Q_a = ${Qs.toFixed(3)}·${Qa.toFixed(3)} = ${Q.toFixed(3)}`);
  st.push("");

  return { Q, Qs, Qa, steps: st };
}

export interface ColumnInput {
  Pu: number; // kN (axial)
  Mux: number; // kN·m (moment about x-x)
  Muy: number; // kN·m (moment about y-y)
  Kx: number; // effective length factor x-x
  Ky: number; // effective length factor y-y
  L: number; // mm (unbraced length)
  Fy: number; // MPa
  /** Coeficiente Cm para la amplificación B1 (default 1.0, lo más seguro). */
  Cm?: number;
  /** Longitud sin arriostrar para el pandeo lateral-torsional (mm);
   *  por defecto L. */
  Lb?: number;
}

/** Datos para la resistencia a flexión de la columna. */
export interface ColumnFlexSection {
  /** "I"/"C": doble T o U con pandeo lateral-torsional; "2C": dos U (se
   *  toma el doble de la resistencia de un U solo); "box": tubo o cajón
   *  (sin pandeo lateral-torsional). */
  kind: "I" | "C" | "2C" | "box";
  /** Perfil para el pandeo lateral-torsional (en "2C", el U individual). */
  profile?: ProfileData;
  /** Módulo elástico del eje débil (cm³) para el tope 1.6·Fy·Sy. */
  Sy?: number;
}

// ---- Built-Up Section Computations ----

export interface BuiltUpProperties {
  name: string;
  Ag: number; // cm²
  Ix: number; // cm⁴
  Iy: number; // cm⁴
  Zx: number; // cm³
  Zy: number; // cm³
  localBuckling: LocalBucklingParams;
  /** Datos del perfil para el pandeo lateral-torsional (doble T armada). */
  profile?: ProfileData;
}

/**
 * Doble T armada (built-up I-section).
 * Inputs in mm: bf (ala), tf (espesor ala), hw (alma altura), tw (espesor alma).
 */
export function computeBuiltUpI(
  bf: number,
  tf: number,
  hw: number,
  tw: number,
): BuiltUpProperties {
  const h = hw + 2 * tf; // total height
  // Area
  const A_mm2 = 2 * bf * tf + hw * tw;
  const Ag = Math.round((A_mm2 / 100) * 10) / 10; // cm²

  // Ix: parallel axis — flanges about centroid
  const d = (hw + tf) / 2; // distance from centroid to flange centroid
  const Ix_mm4 =
    2 * ((bf * Math.pow(tf, 3)) / 12 + bf * tf * d * d) +
    (tw * Math.pow(hw, 3)) / 12;
  const Ix = Math.round(Ix_mm4 / 10000); // cm⁴

  // Iy: flanges + web about y-axis
  const Iy_mm4 =
    2 * ((tf * Math.pow(bf, 3)) / 12) + (hw * Math.pow(tw, 3)) / 12;
  const Iy = Math.round(Iy_mm4 / 10000);

  // Plastic moduli (approximate)
  // Zx: flanges + web plastic contributions
  const Zx_flanges = 2 * bf * tf * (hw / 2 + tf / 2); // mm³
  const Zx_web = (tw * (hw * hw)) / 4; // mm³
  const Zx = Math.round(((Zx_flanges + Zx_web) / 1000) * 10) / 10; // cm³

  // Zy: flanges + web
  const Zy_flanges = (2 * tf * (bf * bf)) / 4; // mm³
  const Zy_web = (hw * (tw * tw)) / 4; // mm³
  const Zy = Math.round(((Zy_flanges + Zy_web) / 1000) * 10) / 10;

  const name = `T armada ${bf}×${tf}+${hw}×${tw}`;
  const localBuckling: LocalBucklingParams = {
    section: "I_BUILTUP",
    bf,
    tf,
    h,
    tw,
  };

  // Datos para pandeo lateral-torsional (sección de paredes delgadas)
  const J_mm4 = (2 * bf * Math.pow(tf, 3) + hw * Math.pow(tw, 3)) / 3;
  const ho = h - tf;
  const Cw_mm6 = (tf * Math.pow(bf, 3) * ho * ho) / 24;
  const profile: ProfileData = {
    name,
    h,
    b: bf,
    tw,
    tf,
    A: Ag,
    Ix,
    Sx: Ix_mm4 / (h / 2) / 1000,
    Zx,
    Iy,
    ry: Math.sqrt(Iy / Ag),
    J: J_mm4 / 1e4,
    Cw: Cw_mm6 / 1e6,
    Sy: Iy_mm4 / (bf / 2) / 1000,
    Zy,
    sectionType: "I",
  };

  return { name, Ag, Ix, Iy, Zx, Zy, localBuckling, profile };
}

/**
 * Cajón armado (built-up box section).
 * Inputs in mm: h (altura), b (ancho), t (espesor).
 */
export function computeBuiltUpBox(
  h: number,
  b: number,
  t: number,
): BuiltUpProperties {
  // Area: 2*t*(h+b-2*t)
  const A_mm2 = 2 * t * (h + b - 2 * t);
  const Ag = Math.round((A_mm2 / 100) * 10) / 10;

  // Ix = (b*h³ - (b-2t)*(h-2t)³) / 12
  const Ix_mm4 =
    (b * Math.pow(h, 3) - (b - 2 * t) * Math.pow(h - 2 * t, 3)) / 12;
  const Ix = Math.round(Ix_mm4 / 10000);

  // Iy = (h*b³ - (h-2t)*(b-2t)³) / 12
  const Iy_mm4 =
    (h * Math.pow(b, 3) - (h - 2 * t) * Math.pow(b - 2 * t, 3)) / 12;
  const Iy = Math.round(Iy_mm4 / 10000);

  // Elastic moduli
  const Sx = (2 * Ix * 10) / h; // cm³  (20*Ix/h)
  const Sy = (2 * Iy * 10) / b;

  // Módulos plásticos exactos del rectángulo hueco
  const Zx_mm3 = (b * h * h - (b - 2 * t) * Math.pow(h - 2 * t, 2)) / 4;
  const Zy_mm3 = (h * b * b - (h - 2 * t) * Math.pow(b - 2 * t, 2)) / 4;
  const Zx = Math.round((Zx_mm3 / 1000) * 10) / 10;
  const Zy = Math.round((Zy_mm3 / 1000) * 10) / 10;
  void Sx;
  void Sy;

  const name = `Cajón ${h}×${b}×${t}`;
  const localBuckling: LocalBucklingParams = {
    section: "CAJON",
    bf: b,
    tf: t,
    h,
    tw: t,
  };

  return { name, Ag, Ix, Iy, Zx, Zy, localBuckling };
}

export interface ColumnCheck {
  Ag: number; // mm²
  KLrx: number;
  KLry: number;
  lambdaCx: number;
  lambdaCy: number;
  Fcrx: number;
  Fcry: number;
  Pnx: number; // kN
  Pny: number; // kN
  phiPnx: number;
  phiPny: number;
  phiPn: number; // governing (min)
  Mnx: number; // kN·m
  Mny: number; // kN·m
  phiMnx: number;
  phiMny: number;
  /** Factores de amplificación de momentos (segundo orden, CIRSOC C.1). */
  B1x: number;
  B1y: number;
  /** Momentos amplificados usados en la interacción (kN·m). */
  MuxAmp: number;
  MuyAmp: number;
  ratio: number; // interaction ratio
  passes: boolean;
  limitState: string;
  steps: string[];
}

export function designColumn(
  input: ColumnInput,
  Ag: number, // cm²
  Ix: number, // cm⁴
  Iy: number, // cm⁴
  Zx: number, // cm³
  Zy: number, // cm³
  profileName: string,
  localBuckling?: LocalBucklingParams,
  flex?: ColumnFlexSection,
): ColumnCheck {
  const { Pu, Kx, Ky, L, Fy } = input;
  const Mux = Math.abs(input.Mux);
  const Muy = Math.abs(input.Muy);
  const Cm = input.Cm ?? 1.0;
  const Ag_mm2 = Ag * 100;
  const rx = Math.sqrt(Ix / Ag); // cm
  const ry = Math.sqrt(Iy / Ag); // cm

  // ---- Compression ----
  const KLrx = (Kx * L) / (rx * 10);
  const KLry = (Ky * L) / (ry * 10);
  const lambdaCx = (KLrx / Math.PI) * Math.sqrt(Fy / E);
  const lambdaCy = (KLry / Math.PI) * Math.sqrt(Fy / E);

  // Steps accumulator (declared early for local buckling output)
  const st: string[] = [];
  st.push(`Perfil: ${profileName}, F_y = ${Fy} MPa`);
  st.push(`L = ${L} mm, K_x = ${Kx}, K_y = ${Ky}`);
  st.push("");

  // Local buckling check and Q factor
  let Q = 1.0;
  if (localBuckling) {
    const lb = checkLocalBuckling(localBuckling, Fy);
    st.push(...lb.steps);
    if (!lb.isNonSlender) {
      const qResult = computeSlenderQ(lb, localBuckling, Fy, Ag_mm2);
      Q = qResult.Q;
      st.push(...qResult.steps);
    } else {
      st.push("Q = 1.0 (sección no esbelta)", "");
    }
  }

  function computeFcr(lambdaC: number): { Fcr: number; mode: string } {
    if (Q >= 1.0) {
      // Non-slender: standard column curve
      if (lambdaC <= 1.5) {
        return {
          Fcr: Math.pow(0.658, lambdaC * lambdaC) * Fy,
          mode: "inelástico",
        };
      }
      return { Fcr: (0.877 / (lambdaC * lambdaC)) * Fy, mode: "elástico" };
    }
    // Slender: modified column curve per CIRSOC E.7
    const lambdaCe = lambdaC * Math.sqrt(Q);
    if (lambdaCe <= 1.5) {
      return {
        Fcr: Q * Math.pow(0.658, Q * lambdaC * lambdaC) * Fy,
        mode: `inelástico (Q=${Q.toFixed(3)})`,
      };
    }
    return {
      Fcr: (0.877 / (lambdaC * lambdaC)) * Fy,
      mode: `elástico (Q=${Q.toFixed(3)})`,
    };
  }

  const x = computeFcr(lambdaCx);
  const y = computeFcr(lambdaCy);

  const Pnx = (x.Fcr * Ag_mm2) / 1000; // kN
  const Pny = (y.Fcr * Ag_mm2) / 1000;
  const phiPnx = PHI_C * Pnx;
  const phiPny = PHI_C * Pny;
  const phiPn = Math.min(phiPnx, phiPny);
  const governComp = phiPnx <= phiPny ? "eje x-x" : "eje y-y";

  // ---- Flexure ----
  const Mpx = (Fy * Zx) / 1e3; // kN·m
  const Mpy = (Fy * Zy) / 1e3;

  // Eje fuerte: con pandeo lateral-torsional (L_b = L, C_b = 1) para doble
  // T y U; en tubos y cajones no hay PLT. Eje débil: M_p con tope 1.6·Fy·Sy.
  let Mnx = Mpx;
  let flexNote = "M_n,x = M_p,x (tubo/cajón: sin pandeo lateral-torsional)";
  const LbFlex = input.Lb ?? L;
  if (flex && flex.kind !== "box" && flex.profile) {
    const dr = checkBeam(
      flex.profile,
      {
        Fy,
        Lb: LbFlex,
        Lb1: LbFlex,
        Lb2: LbFlex,
        Cb: 1,
        deflectionLimit: 300,
        beamLength: L,
        loadPosition: "top",
      },
      { delta: 0, refLength: L, label: "" },
      1,
    );
    const mult = flex.kind === "2C" ? 2 : 1;
    Mnx = Math.min(Mpx, (mult * dr.Mn) / 1e6);
    flexNote = `M_n,x con pandeo lateral-torsional (L_b = ${LbFlex} mm, C_b = 1${flex.kind === "2C" ? ", 2 × U individual" : ""}): ${dr.limitingState}`;
  }
  const MyLimit = flex?.Sy ? (1.6 * Fy * flex.Sy) / 1e3 : Infinity;
  const Mny = Math.min(Mpy, MyLimit);
  const phiMnx = PHI_B * Mnx;
  const phiMny = PHI_B * Mny;

  // ---- Amplificación de momentos (segundo orden, CIRSOC 301 C.1) ----
  // B1 = Cm / (1 − Pu/Pe1) ≥ 1, Pe1 = π²·E·I/(K·L)². Se supone pórtico
  // arriostrado (sin desplazamiento lateral de los extremos).
  const Pe1x = (Math.PI * Math.PI * E * Ix * 1e4) / Math.pow(Kx * L, 2) / 1000; // kN
  const Pe1y = (Math.PI * Math.PI * E * Iy * 1e4) / Math.pow(Ky * L, 2) / 1000;
  const b1 = (Pe: number) =>
    Pu >= Pe ? Infinity : Math.max(1, Cm / (1 - Pu / Pe));
  const B1x = Mux > 0 ? b1(Pe1x) : 1;
  const B1y = Muy > 0 ? b1(Pe1y) : 1;
  const MuxAmp = B1x * Mux;
  const MuyAmp = B1y * Muy;

  // ---- Interaction (Chapter H) ----
  const PrPc = Pu / phiPn;
  let ratio: number;
  let formula: string;

  if (PrPc >= 0.2) {
    formula = "P_r/P_c + 8/9·(M_rx/M_cx + M_ry/M_cy)";
    ratio = PrPc + (8 / 9) * (MuxAmp / phiMnx + MuyAmp / phiMny);
  } else {
    formula = "P_r/(2·P_c) + (M_rx/M_cx + M_ry/M_cy)";
    ratio = Pu / (2 * phiPn) + (MuxAmp / phiMnx + MuyAmp / phiMny);
  }
  if (!Number.isFinite(ratio)) ratio = Infinity;

  const passes = ratio <= 1.0;

  st.push("--- Compresión (Capítulo E) ---");
  st.push(`A_g = ${Ag} cm² = ${Ag_mm2.toFixed(0)} mm²`);
  st.push(
    `r_x = √(${Ix}/${Ag}) = ${rx.toFixed(2)} cm, r_y = √(${Iy}/${Ag}) = ${ry.toFixed(2)} cm`,
  );
  st.push(
    `Eje x: KL/r = ${Kx}·${L}/${(rx * 10).toFixed(1)} = ${KLrx.toFixed(1)}`,
  );
  st.push(`  λ_c = (${KLrx.toFixed(1)}/π)·√(${Fy}/E) = ${lambdaCx.toFixed(3)}`);
  st.push(`  F_{cr,x} = ${x.Fcr.toFixed(1)} MPa (${x.mode})`);
  st.push(
    `  P_{n,x} = ${x.Fcr.toFixed(1)}·${Ag_mm2.toFixed(0)} = ${Pnx.toFixed(1)} kN`,
  );
  st.push(
    `  φ_c·P_{n,x} = ${PHI_C}·${Pnx.toFixed(1)} = ${phiPnx.toFixed(1)} kN`,
  );
  st.push(
    `Eje y: KL/r = ${Ky}·${L}/${(ry * 10).toFixed(1)} = ${KLry.toFixed(1)}`,
  );
  st.push(`  λ_c = (${KLry.toFixed(1)}/π)·√(${Fy}/E) = ${lambdaCy.toFixed(3)}`);
  st.push(`  F_{cr,y} = ${y.Fcr.toFixed(1)} MPa (${y.mode})`);
  st.push(
    `  P_{n,y} = ${y.Fcr.toFixed(1)}·${Ag_mm2.toFixed(0)} = ${Pny.toFixed(1)} kN`,
  );
  st.push(
    `  φ_c·P_{n,y} = ${PHI_C}·${Pny.toFixed(1)} = ${phiPny.toFixed(1)} kN`,
  );
  st.push(
    `φ_c·P_n = min(${phiPnx.toFixed(1)}, ${phiPny.toFixed(1)}) = ${phiPn.toFixed(1)} kN (gobierna ${governComp})`,
  );
  st.push("");

  st.push("--- Flexión (Capítulo F) ---");
  st.push(`M_{p,x} = F_y·Z_x = ${Fy}·${Zx} = ${Mpx.toFixed(1)} kN·m`);
  st.push(flexNote);
  st.push(
    `φ_b·M_{n,x} = ${PHI_B}·${Mnx.toFixed(1)} = ${phiMnx.toFixed(1)} kN·m`,
  );
  st.push(`M_{p,y} = F_y·Z_y = ${Fy}·${Zy} = ${Mpy.toFixed(1)} kN·m`);
  if (Number.isFinite(MyLimit))
    st.push(
      `  tope 1.6·F_y·S_y = 1.6·${Fy}·${flex?.Sy?.toFixed(1)} = ${MyLimit.toFixed(1)} kN·m → M_n,y = ${Mny.toFixed(1)} kN·m`,
    );
  st.push(
    `φ_b·M_{n,y} = ${PHI_B}·${Mny.toFixed(1)} = ${phiMny.toFixed(1)} kN·m`,
  );
  st.push("");

  st.push("--- Amplificación de momentos (segundo orden, CIRSOC C.1) ---");
  st.push(`Pórtico arriostrado: B_1 = C_m/(1 − P_u/P_e1) ≥ 1, C_m = ${Cm}`);
  st.push(
    `P_e1,x = π²·E·I_x/(K_x·L)² = ${Pe1x.toFixed(0)} kN → B_1x = ${Number.isFinite(B1x) ? B1x.toFixed(3) : "∞ (P_u ≥ P_e1: inestable)"}`,
  );
  st.push(
    `P_e1,y = π²·E·I_y/(K_y·L)² = ${Pe1y.toFixed(0)} kN → B_1y = ${Number.isFinite(B1y) ? B1y.toFixed(3) : "∞ (P_u ≥ P_e1: inestable)"}`,
  );
  st.push(
    `M_ux = ${B1x.toFixed(3)}·${Mux.toFixed(1)} = ${MuxAmp.toFixed(1)} kN·m ; M_uy = ${B1y.toFixed(3)}·${Muy.toFixed(1)} = ${MuyAmp.toFixed(1)} kN·m`,
  );
  st.push("");

  st.push("--- Interacción (Capítulo H) ---");
  st.push(
    `P_r/P_c = ${Pu.toFixed(1)}/${phiPn.toFixed(1)} = ${PrPc.toFixed(3)} ${PrPc >= 0.2 ? "≥ 0.2" : "< 0.2"}`,
  );
  st.push(`Fórmula: ${formula}`);
  st.push(
    `= ${PrPc >= 0.2 ? `${PrPc.toFixed(3)} + 0.889·(${(MuxAmp / phiMnx).toFixed(3)} + ${(MuyAmp / phiMny).toFixed(3)})` : `${(Pu / (2 * phiPn)).toFixed(3)} + (${(MuxAmp / phiMnx).toFixed(3)} + ${(MuyAmp / phiMny).toFixed(3)})`}`,
  );
  st.push(`= ${ratio.toFixed(3)} ${passes ? "≤ 1.0 ✓" : "> 1.0 ✗"}`);

  return {
    Ag: Ag_mm2,
    KLrx,
    KLry,
    lambdaCx,
    lambdaCy,
    Fcrx: x.Fcr,
    Fcry: y.Fcr,
    Pnx,
    Pny,
    phiPnx,
    phiPny,
    phiPn,
    Mnx,
    Mny,
    phiMnx,
    phiMny,
    B1x,
    B1y,
    MuxAmp,
    MuyAmp,
    ratio,
    passes,
    limitState:
      governComp === "eje x-x"
        ? `Pandeo ${x.mode} (x-x)`
        : `Pandeo ${y.mode} (y-y)`,
    steps: st,
  };
}
