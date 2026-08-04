import type { ProfileData } from "./profiles";

// CIRSOC 301-05 / AISC 360-05 LRFD
const E = 200000; // MPa
const G = 77200; // MPa (shear modulus, E / 2(1+ν) with ν=0.3)
const PHI_B = 0.9; // flexure
const PHI_V = 0.9; // shear

export interface DesignParams {
  Fy: number; // MPa (yield strength)
  Lb: number; // mm (legacy unbraced length, used as fallback)
  Lb1?: number; // mm (Lb for Mu ≥ 0 sections)
  Lb2?: number; // mm (Lb for Mu < 0 sections)
  Cb: number; // moment gradient factor (default 1.0)
  deflectionLimit: number; // e.g. L/300
  beamLength: number; // mm (total span for deflection check)
  loadPosition: "top" | "shear" | "bottom"; // punto de aplicación de carga
}

export interface DesignResult {
  Mn: number; // N·mm (nominal flexural strength)
  phiMn: number; // N·mm (design flexural strength)
  Vn: number; // N (nominal shear strength)
  phiVn: number; // N (design shear strength)
  limitingState: string;
  maxDeflection: number; // mm
  allowableDeflection: number;
  deflectionOK: boolean;
  steps: string[]; // calculation details
  // ---- Audit intermediates (exposed for ResultsPage) ----
  Mp: number; // N·mm (plastic moment)
  classification: Classification;
  lambdaF: number;
  lambdaW: number;
  lambdaPf: number;
  lambdaRf: number;
  lambdaPw: number;
  lambdaRw: number;
  MnFlange: number; // N·mm
  MnWeb: number; // N·mm
  MnLTB: number; // N·mm
  Lp: number; // mm (standard)
  Lr: number; // mm (standard)
  LpEff: number; // mm (load-position-adjusted)
  LrEff: number; // mm (load-position-adjusted)
  Mr: number; // N·mm = 0.7·Fy·Sx·1e3
  Fe: number; // MPa (tensión crítica elástica equivalente = Mcr/Sx)
  Mcr: number; // N·mm = 1.28·Cb·Sx·X1/(Lb/ry) capped at Mp (CIRSOC F.1.13.a)
  X1: number; // MPa (CIRSOC F.1.13.a)
  FL: number; // MPa
  X2: number; // 1/MPa² (CIRSOC, warping factor)
  Md1: number; // N·mm = φ·min(MnFlange, MnWeb)
  Md2: number; // N·mm = φ·MnLTB
}

export function checkBeam(
  profile: ProfileData,
  params: DesignParams,
  serviceM: number, // N·mm (max combined D+L service moment)
  Mu: number, // N·mm (signed ultimate moment at |Mu| max section)
): DesignResult {
  const { Fy, Lb, Lb1, Lb2, Cb, deflectionLimit, beamLength, loadPosition } =
    params;
  const { h, b, tw, tf, Ix, Iy, Sx, Zx, ry, J, Cw } = profile;

  // ---- Lb selection by moment sign ----
  const effectiveLb = Mu >= 0 ? (Lb1 ?? Lb) : (Lb2 ?? Lb);

  // ---- Section classification (Chapter B) ----
  // I-section: flange stiffened on both edges → λ_f = b/(2·tf)
  // C-section (channel): flange stiffened on ONE edge → λ_f = b/tf
  const lambdaF = profile.sectionType === "C" ? b / tf : b / (2 * tf);
  const lambdaPf = 0.38 * Math.sqrt(E / Fy);
  const lambdaRf = 1.0 * Math.sqrt(E / Fy);

  const dW = h - 2 * tf;
  const lambdaW = dW / tw;
  const lambdaPw = 3.76 * Math.sqrt(E / Fy);
  const lambdaRw = 5.7 * Math.sqrt(E / Fy);

  // ---- Flexure: Yielding ----
  const Mp = Fy * Zx * 1e3; // N·mm
  const Mr = 0.7 * Fy * Sx * 1e3; // N·mm

  const classification: Classification =
    lambdaF <= lambdaPf && lambdaW <= lambdaPw
      ? "COMPACT"
      : lambdaF > lambdaRf || lambdaW > lambdaRw
        ? "SLENDER"
        : "NON_COMPACT";

  // ---- Pandeo local de ala y alma (CIRSOC 301-05, Sección F4) ----
  // MnFlange: resistencia nominal considerando pandeo local del ala comprimida
  //   - Compacta (λf ≤ λpf): MnFlange = Mp (plastificación total)
  //   - No compacta (λpf < λf ≤ λrf): interpolación lineal Mp → Mr
  //   - Esbelta (λf > λrf): MnFlange = Mr (conservador)
  // MnWeb: análogo para el alma
  // Md1 = φ · min(MnFlange, MnWeb) — el menor controla el pandeo local
  let MnFlange = Mp;
  if (lambdaF > lambdaPf) {
    if (lambdaF <= lambdaRf) {
      MnFlange =
        Mp - (Mp - Mr) * ((lambdaF - lambdaPf) / (lambdaRf - lambdaPf));
    } else {
      MnFlange = Mr; // slender flange — conservatively use Mr
    }
  }

  let MnWeb = Mp;
  if (lambdaW > lambdaPw) {
    if (lambdaW <= lambdaRw) {
      MnWeb = Mp - (Mp - Mr) * ((lambdaW - lambdaPw) / (lambdaRw - lambdaPw));
    } else {
      MnWeb = Mr; // slender web — conservatively use Mr
    }
  }

  // ---- Lateral-Torsional Buckling ----
  // Lp / Lr según CIRSOC 301-05 para perfil doble T
  const ry_mm = ry * 10; // cm → mm
  const Sx_mm3 = Sx * 1e3; // cm³ → mm³
  const J_mm4 = J * 1e4; // cm⁴ → mm⁴
  const A_mm2 = (profile.A ?? (h * tw + 2 * b * tf) / 100) * 100; // cm² → mm²

  // X1 (CIRSOC F.1.13.a)
  const X1 = (Math.PI / Sx_mm3) * Math.sqrt((E * G * J_mm4 * A_mm2) / 2);

  // FL = menor entre (Fy_f - Fr) y Fy_w. Para perfiles laminados homogéneos: Fr = 0.3·Fy
  const FL = 0.7 * Fy; // MPa

  // X2 = 4·Cw/Iy·(Sx/(G·J))²  (CIRSOC, factor de alabeo)
  const Iy_mm4 = Iy * 1e4; // cm⁴ → mm⁴
  const Cw_mm6 = Cw * 1e6; // cm⁶ → mm⁶
  const X2 = (4 * Cw_mm6 / Iy_mm4) * Math.pow(Sx_mm3 / (G * J_mm4), 2); // 1/MPa²

  // Lp base (carga en ala superior): CIRSOC — factor 1.59 para doble T
  const Lp = 1.59 * ry_mm * Math.sqrt(E / Fy); // mm

  // Lr base (carga en ala superior): CIRSOC — Lr = 1.28·ry·X1/FL
  const Lr = (1.28 * ry_mm * X1) / FL; // mm

  // Ajuste por punto de aplicación de carga
  // Ala superior (default) = factor 1.0; centro de corte ≈ +10%; ala inferior ≈ +25%
  const lpFactor =
    loadPosition === "bottom" ? 1.25 : loadPosition === "shear" ? 1.10 : 1.0;
  const lrFactor =
    loadPosition === "bottom" ? 1.25 : loadPosition === "shear" ? 1.10 : 1.0;
  const LpEff = Lp * lpFactor;
  const LrEff = Lr * lrFactor;

  // Mcr = momento crítico elástico de PLT según CIRSOC 301-05 F.1.13.a
  // Mcr = 1.28·Cb·Sx·X1 / (Lb/ry)  →  Mcr = 1.28·Cb·π·√(E·G·J·A/2)·ry / Lb
  const Mcr_raw =
    (1.28 * Cb * Sx_mm3 * X1) / (effectiveLb / ry_mm); // N·mm
  // Simplified form (Sx cancels): Mcr = 1.28·Cb·π·√(E·G·J·A/2)·ry / Lb
  const Mcr = Math.min(Mcr_raw, Mp); // N·mm, capped at Mp

  // Fe = tensión crítica elástica equivalente (para reporte)
  const Fe = Mcr_raw / Sx_mm3; // MPa

  // LTB nominal moment
  let MnLTB: number;
  if (effectiveLb <= LpEff) {
    MnLTB = Mp;
  } else if (effectiveLb <= LrEff) {
    // Inelastic LTB
    MnLTB = Cb * (Mp - (Mp - Mr) * ((effectiveLb - LpEff) / (LrEff - LpEff)));
  } else {
    // Elastic LTB
    MnLTB = Mcr; // Mcr ya está capado a Mp
  }

  // ---- Design strengths ----
  const Md1 = PHI_B * Math.min(MnFlange, MnWeb); // local-buckling limit
  const Md2 = PHI_B * MnLTB; // LTB limit

  // ---- Nominal flexural strength Mn ----
  let Mn: number;
  let limitingState: string;

  if (lambdaF > lambdaRf || lambdaW > lambdaRw) {
    Mn = Mr;
    limitingState = "Sección esbelta (simplificado)";
  } else if (effectiveLb <= LpEff) {
    Mn = Mp;
    limitingState = "Plastificación (Lb ≤ Lp,eff)";
  } else {
    let MnCompact = Mp;
    if (lambdaF > lambdaPf) {
      MnCompact = Math.min(MnCompact, MnFlange);
    }
    if (lambdaW > lambdaPw) {
      MnCompact = Math.min(MnCompact, MnWeb);
    }

    if (effectiveLb <= LrEff) {
      // Inelastic LTB
      Mn = Math.min(MnCompact, MnLTB, Mp);
      limitingState = "Pandeo lateral-torsional inelástico";
    } else {
      // Elastic LTB
      Mn = Math.min(MnCompact, MnLTB);
      limitingState = "Pandeo lateral-torsional elástico";
    }
  }

  const phiMn = PHI_B * Mn;

  // ---- Shear (Chapter G) ----
  const Aw = h * tw; // mm² (CIRSOC G.2.1: altura total × espesor de alma)
  const kv = 5.0;
  const hOverTw = dW / tw;
  const Cv =
    hOverTw <= 1.1 * Math.sqrt((kv * E) / Fy)
      ? 1.0
      : hOverTw <= 1.37 * Math.sqrt((kv * E) / Fy)
        ? (1.1 * Math.sqrt((kv * E) / Fy)) / hOverTw
        : (1.51 * kv * E) / (Math.pow(hOverTw, 2) * Fy);

  const Vn = 0.6 * Fy * Aw * Cv; // N
  const phiVn = PHI_V * Vn;

  // ---- Deflection ----
  // δ = 5·M_serv·L² / (48·E·I) — fórmula exacta para viga simplemente apoyada
  // con carga uniforme; aproximación conservadora para otros casos.
  const I_mm4 = Ix * 1e4;
  const maxDeflection =
    (5 * serviceM * Math.pow(beamLength, 2)) / (48 * E * I_mm4);
  const allowableDeflection = beamLength / deflectionLimit;
  const deflectionOK = maxDeflection <= allowableDeflection;

  // ---- Build calculation steps ----
  const st: string[] = [];
  st.push(`Perfil: ${profile.name}, F_y = ${Fy} MPa, E = ${E} MPa`);
  st.push(`Carga aplicada en: ${loadPosition === "top" ? "ala superior" : loadPosition === "shear" ? "centro de corte" : "ala inferior"}`);
  st.push("");

  // Section classification
  st.push("--- Clasificación de sección ---");
  if (profile.sectionType === "C") {
    st.push("(Ala de canal: λ_f = b/t_f por ser rigidizada en un solo borde)");
    st.push(`Ala: λ_f = b/t_f = ${b}/${tf} = ${lambdaF.toFixed(2)}`);
  } else {
    st.push(`Ala: λ_f = b/(2·t_f) = ${b}/(2·${tf}) = ${lambdaF.toFixed(2)}`);
  }
  st.push(
    `  λ_pf = 0.38·√(E/F_y) = ${lambdaPf.toFixed(2)}, λ_rf = 1.0·√(E/F_y) = ${lambdaRf.toFixed(2)}`,
  );
  st.push(
    `Alma: λ_w = h_c/t_w = ${dW.toFixed(0)}/${tw} = ${lambdaW.toFixed(2)}`,
  );
  st.push(
    `  λ_pw = 3.76·√(E/F_y) = ${lambdaPw.toFixed(2)}, λ_rw = 5.70·√(E/F_y) = ${lambdaRw.toFixed(2)}`,
  );
  st.push(
    `Clasificación: ${classification === "COMPACT" ? "Compacta" : classification === "NON_COMPACT" ? "No compacta" : "Con elementos esbeltos"}`,
  );
  st.push("");

  // Flexure
  st.push("--- Resistencia a flexión ---");
  st.push(`M_p = F_y·Z_x = ${Fy}·${Zx} = ${(Mp / 1e6).toFixed(1)} kN·m`);
  st.push(
    `M_n,flange (pandeo local ala) = ${(MnFlange / 1e6).toFixed(1)} kN·m`,
  );
  st.push(
    `M_n,web (pandeo local alma) = ${(MnWeb / 1e6).toFixed(1)} kN·m`,
  );
  // Lp / Lr
  st.push(`--- Parámetros de PLT ---`);
  st.push(`X_1 = π/S_x·√(E·G·J·A/2) = ${X1.toFixed(0)} MPa`);
  st.push(`X_2 = 4·C_w/I_y·(S_x/(G·J))² = ${X2.toExponential(2)} 1/MPa²`);
  st.push(`F_L = min(F_yf − F_r, F_yw) = 0.7·F_y = ${FL.toFixed(0)} MPa`);
  if (lpFactor === 1.0) {
    st.push(`L_p = 1.59·r_y·√(E/F_y) = ${LpEff.toFixed(0)} mm`);
  } else {
    st.push(`L_p = 1.59·r_y·√(E/F_y) = ${Lp.toFixed(0)} mm → L_p,eff = L_p·${lpFactor} = ${LpEff.toFixed(0)} mm`);
  }
  st.push(`L_r = 1.28·r_y·X_1/F_L = ${LrEff.toFixed(0)} mm` +
    (lrFactor !== 1.0 ? ` (base = ${Lr.toFixed(0)} mm, factor = ${lrFactor})` : ''));
  st.push(`L_b = ${effectiveLb} mm, C_b = ${Cb}`);

  if (effectiveLb <= LpEff) {
    st.push(`L_b ≤ L_p,eff → M_n = M_p = ${(Mp / 1e6).toFixed(1)} kN·m`);
  } else if (effectiveLb <= LrEff) {
    st.push(`L_p,eff < L_b ≤ L_r,eff → PLT inelástico`);
    st.push(
      `M_n = C_b[M_p - (M_p - 0.7F_yS_x)((L_b-L_p,eff)/(L_r,eff-L_p,eff))] = ${(Mn / 1e6).toFixed(1)} kN·m`,
    );
  } else {
    st.push(`L_b > L_r,eff → PLT elástico`);
    st.push(`X_1 = π/S_x·√(E·G·J·A/2) = ${X1.toFixed(0)} MPa`);
    st.push(`M_cr = 1.28·C_b·S_x·X_1/(L_b/r_y) = ${(Mcr_raw / 1e6).toFixed(1)} kN·m (CIRSOC F.1.13.a)`);
    st.push(`M_n = min(M_cr, M_p) = ${(Mn / 1e6).toFixed(1)} kN·m`);
  }
  st.push(
    `φ_b·M_n = ${PHI_B}·${(Mn / 1e6).toFixed(1)} = ${(phiMn / 1e6).toFixed(1)} kN·m`,
  );
  st.push(`Estado límite: ${limitingState}`);
  st.push("");

  // Shear
  st.push("--- Resistencia a corte ---");
  st.push(`A_w = h·t_w = ${h}·${tw} = ${Aw.toFixed(0)} mm²`);
  st.push(`k_v = ${kv} (alma no rigidizada)`);
  st.push(`h/t_w = ${hOverTw.toFixed(2)}`);
  st.push(`C_v = ${Cv.toFixed(3)}`);
  st.push(
    `V_n = 0.6·F_y·A_w·C_v = 0.6·${Fy}·${Aw.toFixed(0)}·${Cv.toFixed(3)} = ${(Vn / 1000).toFixed(1)} kN`,
  );
  st.push(
    `φ_v·V_n = ${PHI_V}·${(Vn / 1000).toFixed(1)} = ${(phiVn / 1000).toFixed(1)} kN`,
  );
  st.push("");

  // Deflection
  st.push("--- Deformación ---");
  st.push(`δ = 5·M_serv·L² / (48·E·I_x)`);
  st.push(`  = 5·${(serviceM / 1e6).toFixed(1)}·10⁶·${beamLength}² / (48·${E}·${(Ix * 1e4).toFixed(0)})`);
  st.push(`  = ${maxDeflection.toFixed(1)} mm`);
  st.push(
    `δ_adm = L/${deflectionLimit} = ${beamLength}/${deflectionLimit} = ${allowableDeflection.toFixed(1)} mm`,
  );
  st.push(
    `${deflectionOK ? "✓" : "✗"} ${deflectionOK ? "Cumple" : "No cumple"} deformación`,
  );

  return {
    Mn,
    phiMn,
    Vn,
    phiVn,
    limitingState,
    maxDeflection,
    allowableDeflection,
    deflectionOK,
    steps: st,
    // Audit intermediates
    Mp,
    classification,
    lambdaF,
    lambdaW,
    lambdaPf,
    lambdaRf,
    lambdaPw,
    lambdaRw,
    MnFlange,
    MnWeb,
    MnLTB,
    Lp,
    Lr,
    LpEff,
    LrEff,
    Mr,
    Fe,
    Mcr,
    X1,
    FL,
    X2,
    Md1,
    Md2,
  };
}
