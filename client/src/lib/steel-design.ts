import type { ProfileData } from "./profiles";

// CIRSOC 301-05 / AISC 360-05 LRFD
const E = 200000;   // MPa
const PHI_B = 0.90; // flexure
const PHI_V = 0.90; // shear

export interface DesignParams {
  Fy: number;       // MPa (yield strength)
  Lb: number;       // mm (unbraced length)
  Cb: number;       // moment gradient factor (default 1.0)
  deflectionLimit: number; // e.g. L/300
  beamLength: number;      // mm (total span for deflection check)
}

export interface DesignResult {
  Mn: number;        // N·mm (nominal flexural strength)
  phiMn: number;     // N·mm (design flexural strength)
  Vn: number;        // N (nominal shear strength)
  phiVn: number;     // N (design shear strength)
  limitingState: string;
  maxDeflection: number;  // mm
  allowableDeflection: number;
  deflectionOK: boolean;
  steps: string[];   // calculation details
}

export function checkBeam(
  profile: ProfileData,
  params: DesignParams,
  serviceM: number, // N·mm (service moment for deflection)
): DesignResult {
  const { Fy, Lb, Cb, deflectionLimit, beamLength } = params;
  const { h, b, tw, tf, Ix, Sx, Zx, ry, J } = profile;

  // ---- Section classification (Chapter B) ----
  // Flange: λ_f = b / (2 * tf)
  const lambdaF = b / (2 * tf);
  const lambdaPf = 0.38 * Math.sqrt(E / Fy);
  const lambdaRf = 1.0 * Math.sqrt(E / Fy);

  // Web: λ_w = (h - 2*tf) / tw  (height of straight portion)
  const dW = h - 2 * tf;
  const lambdaW = dW / tw;
  const lambdaPw = 3.76 * Math.sqrt(E / Fy);
  const lambdaRw = 5.70 * Math.sqrt(E / Fy);

  // ---- Flexure: Yielding ----
  const Mp = Fy * Zx; // N·mm

  // ---- Flexure: Lateral-Torsional Buckling ----
  const Lp = (1.76 * ry * 10) * Math.sqrt(E / Fy); // mm (ry in cm → *10)
  const ho = h - tf; // distance between flange centroids
  // rts from approximate formula (F4-11 simplified)
  const rtsApprox = (b / Math.sqrt(12)) / 
    Math.sqrt(1 + (h * tw) / (6 * b * tf));
  
  const Lr = (1.95 * rtsApprox * (E / (0.7 * Fy))) *
    Math.sqrt(
      (J * 1e4) / (Sx * ho * 10) +
      Math.sqrt(
        Math.pow((J * 1e4) / (Sx * ho * 10), 2) +
        6.76 * Math.pow((0.7 * Fy) / E, 2)
      )
    );

  let Mn: number;
  let limitingState: string;

  // Cross-section slenderness checks first
  let Fe = 0;
  if (lambdaF > lambdaRf || lambdaW > lambdaRw) {
    // Slender section — not covered, conservative: use elastic buckling
    Mn = (0.7 * Fy * Sx);
    limitingState = "Sección esbelta (simplificado)";
  } else if (Lb <= Lp) {
    // No LTB — plastic moment
    Mn = Mp;
    limitingState = "Plastificación (Lb ≤ Lp)";
  } else {
    // LTB possible
    // Non-compact flange reduction
    let MnCompact = Mp;
    if (lambdaF > lambdaPf) {
      const MnFlange = Mp - (Mp - 0.7 * Fy * Sx) *
        ((lambdaF - lambdaPf) / (lambdaRf - lambdaPf));
      MnCompact = Math.min(MnCompact, MnFlange);
    }
    if (lambdaW > lambdaPw) {
      const MnWeb = Mp - (Mp - 0.7 * Fy * Sx) *
        ((lambdaW - lambdaPw) / (lambdaRw - lambdaPw));
      MnCompact = Math.min(MnCompact, MnWeb);
    }

    if (Lb <= Lr) {
      // Inelastic LTB
      const MnLTB = Cb * (Mp - (Mp - 0.7 * Fy * Sx) *
        ((Lb - Lp) / (Lr - Lp)));
      Mn = Math.min(MnCompact, MnLTB, Mp);
      limitingState = "Pandeo lateral-torsional inelástico";
    } else {
      // Elastic LTB
      Fe = (Cb * Math.PI * Math.PI * E) /
        Math.pow(Lb * 10 / rtsApprox, 2) *
        Math.sqrt(1 + 0.078 * (J * 1e4) / (Sx * ho * 10) *
          Math.pow((Lb * 10) / rtsApprox, 2));
      const MnElastic = Math.min(Fe * Sx, Mp);
      Mn = Math.min(MnCompact, MnElastic);
      limitingState = "Pandeo lateral-torsional elástico";
    }
  }

  const phiMn = PHI_B * Mn;

  // ---- Shear (Chapter G) ----
  const Aw = dW * tw; // mm² (web area)
  const kv = 5.0; // unstiffened web
  const hOverTw = dW / tw;
  const Cv =
    hOverTw <= 1.10 * Math.sqrt(kv * E / Fy)
      ? 1.0
      : hOverTw <= 1.37 * Math.sqrt(kv * E / Fy)
        ? (1.10 * Math.sqrt(kv * E / Fy)) / hOverTw
        : (1.51 * kv * E) / (Math.pow(hOverTw, 2) * Fy);

  const Vn = 0.6 * Fy * Aw * Cv; // N
  const phiVn = PHI_V * Vn;

  // ---- Deflection ----
  // Max deflection for uniformly distributed load on simple span:
  // δ = 5 * w * L⁴ / (384 * E * I)
  // M_service = w * L² / 8 → w = 8 * M / L²
  // δ = 5 * (8M/L²) * L⁴ / (384 * E * I) = 5 * M * L² / (48 * E * I)
  const deflFormula = "(5·M_serv·L²)/(48·E·I_x)";
  const maxDeflection =
    (5 * serviceM * Math.pow(beamLength, 2)) /
    (48 * E * Ix * 1e4); // Ix in cm⁴ → mm⁴ (*1e4)
  const allowableDeflection = beamLength / deflectionLimit;
  const deflectionOK = maxDeflection <= allowableDeflection;

  // Build calculation steps
  const st: string[] = [];
  st.push(`Perfil: ${profile.name}, F_y = ${Fy} MPa, E = ${E} MPa`);
  st.push("");

  // Section classification
  st.push("--- Clasificación de sección ---");
  st.push(`Ala: λ_f = b/(2·t_f) = ${b}/(2·${tf}) = ${lambdaF.toFixed(2)}`);
  st.push(`  λ_pf = 0.38·√(E/F_y) = ${lambdaPf.toFixed(2)}, λ_rf = 1.0·√(E/F_y) = ${lambdaRf.toFixed(2)}`);
  st.push(`Alma: λ_w = h_c/t_w = ${dW.toFixed(0)}/${tw} = ${lambdaW.toFixed(2)}`);
  st.push(`  λ_pw = 3.76·√(E/F_y) = ${lambdaPw.toFixed(2)}, λ_rw = 5.70·√(E/F_y) = ${lambdaRw.toFixed(2)}`);
  st.push("");

  // Flexure
  st.push("--- Resistencia a flexión ---");
  st.push(`M_p = F_y·Z_x = ${Fy}·${Zx} = ${(Mp / 1e6).toFixed(1)} kN·m`);
  st.push(`L_p = 1.76·r_y·√(E/F_y) = 1.76·${ry}·√(${E}/${Fy}) = ${Lp.toFixed(0)} mm`);
  st.push(`L_r = 1.95·r_ts·(E/0.7F_y)·√(...) = ${Lr.toFixed(0)} mm`);
  st.push(`L_b = ${Lb} mm, C_b = ${Cb}`);

  if (Lb <= Lp) {
    st.push(`L_b ≤ L_p → M_n = M_p = ${(Mp / 1e6).toFixed(1)} kN·m`);
  } else if (Lb <= Lr) {
    st.push(`L_p < L_b ≤ L_r → PLT inelástico`);
    st.push(`M_n = C_b[M_p - (M_p - 0.7F_yS_x)((L_b-L_p)/(L_r-L_p))] = ${(Mn / 1e6).toFixed(1)} kN·m`);
  } else {
    st.push(`L_b > L_r → PLT elástico`);
    st.push(`F_e = C_b·π²·E/(L_b/r_ts)²·√(...) = ${Fe.toFixed(1)} MPa`);
    st.push(`M_n = min(F_e·S_x, M_p) = ${(Mn / 1e6).toFixed(1)} kN·m`);
  }
  st.push(`φ_b·M_n = ${PHI_B}·${(Mn / 1e6).toFixed(1)} = ${(phiMn / 1e6).toFixed(1)} kN·m`);
  st.push(`Estado límite: ${limitingState}`);
  st.push("");

  // Shear
  st.push("--- Resistencia a corte ---");
  st.push(`A_w = h_c·t_w = ${dW.toFixed(0)}·${tw} = ${Aw.toFixed(0)} mm²`);
  st.push(`k_v = ${kv} (alma no rigidizada)`);
  st.push(`h/t_w = ${hOverTw.toFixed(2)}`);
  st.push(`C_v = ${Cv.toFixed(3)}`);
  st.push(`V_n = 0.6·F_y·A_w·C_v = 0.6·${Fy}·${Aw.toFixed(0)}·${Cv.toFixed(3)} = ${(Vn / 1000).toFixed(1)} kN`);
  st.push(`φ_v·V_n = ${PHI_V}·${(Vn / 1000).toFixed(1)} = ${(phiVn / 1000).toFixed(1)} kN`);
  st.push("");

  // Deflection
  st.push("--- Deformación ---");
  st.push(`I_x = ${Ix} cm⁴ = ${(Ix * 1e4).toFixed(0)} mm⁴`);
  st.push(`${deflFormula} = (5·${(serviceM / 1e6).toFixed(1)}·10⁶·${beamLength}²)/(48·${E}·${(Ix * 1e4).toFixed(0)}) = ${maxDeflection.toFixed(1)} mm`);
  st.push(`δ_adm = L/${deflectionLimit} = ${beamLength}/${deflectionLimit} = ${allowableDeflection.toFixed(1)} mm`);
  st.push(`${deflectionOK ? "✓" : "✗"} ${deflectionOK ? "Cumple" : "No cumple"} deformación`);

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
  };
}
