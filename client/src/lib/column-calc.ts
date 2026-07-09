// CIRSOC 301-05 — Column design (axial + bending)

const E = 200000; // MPa
const PHI_C = 0.85; // CIRSOC 301-05 Cap. E — φc compresión
const PHI_B = 0.9;

// ---- Local Buckling Verification (CIRSOC 301-05 Tabla B.4.1a) ----

export interface LocalBucklingParams {
  section: "I" | "C" | "HSS";
  bf: number; // mm — flange width (I/C: full width; HSS: width dimension)
  tf: number; // mm — flange thickness (I/C) or wall thickness (HSS)
  h: number; // mm — section height
  tw: number; // mm — web thickness (I/C only; for HSS use same value as tf)
}

export interface LocalBucklingResult {
  flangeLambda: number;
  webLambda: number;
  flangeLambdaR: number;
  webLambdaR: number;
  flangeOk: boolean;
  webOk: boolean;
  isNonSlender: boolean;
  Q: number;
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
    // I-shape (IPN): Case 1 flange (unstiffened), Case 5 web (stiffened)
    flangeLambda = bf / (2 * tf);
    flangeLambdaR = 0.56 * lambdaR0;
    flangeDesc = `bf/(2·tf)`;

    const hw = h - 2 * tf; // clear web height (approximate)
    webLambda = hw / tw;
    webLambdaR = 1.49 * lambdaR0;
    webDesc = `hw/tw`;
  } else if (section === "C") {
    // Channel (UPN): Case 3 flange (unstiffened, free edge), Case 5 web (stiffened)
    flangeLambda = bf / tf;
    flangeLambdaR = 0.45 * lambdaR0;
    flangeDesc = `bf/tf`;

    const hw = h - 2 * tf;
    webLambda = hw / tw;
    webLambdaR = 1.49 * lambdaR0;
    webDesc = `hw/tw`;
  } else {
    // HSS (tube): Case 6 — both sides stiffened
    flangeLambda = bf / tf;
    webLambda = h / tw;
    flangeLambdaR = 1.40 * lambdaR0;
    webLambdaR = 1.40 * lambdaR0;
    flangeDesc = `b/t`;
    webDesc = `h/t`;
  }

  const flangeOk = flangeLambda <= flangeLambdaR;
  const webOk = webLambda <= webLambdaR;
  const isNonSlender = flangeOk && webOk;
  const Q = isNonSlender ? 1.0 : 0; // Q < 1 requires effective area (not implemented yet)

  st.push(
    `Ala: λ = ${flangeDesc} = ${flangeLambda.toFixed(1)} ≤ λ_r = ${flangeLambdaR.toFixed(1)} ${flangeOk ? "✓ no esbelta" : "✗ ESBELTA"}`,
  );
  st.push(
    `Alma: λ = ${webDesc} = ${webLambda.toFixed(1)} ≤ λ_r = ${webLambdaR.toFixed(1)} ${webOk ? "✓ no esbelta" : "✗ ESBELTA"}`,
  );
  st.push(
    `Sección ${isNonSlender ? "NO ESBELTA" : "ESBELTA"} → Q = ${Q.toFixed(2)}`,
  );
  st.push("");

  return {
    flangeLambda,
    webLambda,
    flangeLambdaR,
    webLambdaR,
    flangeOk,
    webOk,
    isNonSlender,
    Q,
    steps: st,
  };
}

export interface ColumnInput {
  Pu: number; // kN (axial)
  Mux: number; // kN·m (moment about x-x)
  Muy: number; // kN·m (moment about y-y)
  Kx: number; // effective length factor x-x
  Ky: number; // effective length factor y-y
  L: number; // mm (unbraced length)
  Fy: number; // MPa
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
): ColumnCheck {
  const { Pu, Mux, Muy, Kx, Ky, L, Fy } = input;
  const Ag_mm2 = Ag * 100;
  const rx = Math.sqrt(Ix / Ag); // cm
  const ry = Math.sqrt(Iy / Ag); // cm

  // ---- Compression ----
  const KLrx = (Kx * L) / (rx * 10);
  const KLry = (Ky * L) / (ry * 10);
  const lambdaCx = (KLrx / Math.PI) * Math.sqrt(Fy / E);
  const lambdaCy = (KLry / Math.PI) * Math.sqrt(Fy / E);

  function computeFcr(lambdaC: number): { Fcr: number; mode: string } {
    if (lambdaC <= 1.5) {
      return {
        Fcr: Math.pow(0.658, lambdaC * lambdaC) * Fy,
        mode: "inelástico",
      };
    }
    return { Fcr: (0.877 / (lambdaC * lambdaC)) * Fy, mode: "elástico" };
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

  // Simplified: assume Lb ≤ Lp (full plastic moment)
  const Mnx = Mpx;
  const Mny = Mpy;
  const phiMnx = PHI_B * Mnx;
  const phiMny = PHI_B * Mny;

  // ---- Interaction (Chapter H) ----
  const PrPc = Pu / phiPn;
  let ratio: number;
  let formula: string;

  if (PrPc >= 0.2) {
    formula = "P_r/P_c + 8/9·(M_rx/M_cx + M_ry/M_cy)";
    ratio = PrPc + (8 / 9) * (Mux / phiMnx + Muy / phiMny);
  } else {
    formula = "P_r/(2·P_c) + (M_rx/M_cx + M_ry/M_cy)";
    ratio = Pu / (2 * phiPn) + (Mux / phiMnx + Muy / phiMny);
  }

  const passes = ratio <= 1.0;

  // Steps
  const st: string[] = [];
  st.push(`Perfil: ${profileName}, F_y = ${Fy} MPa`);
  st.push(`L = ${L} mm, K_x = ${Kx}, K_y = ${Ky}`);
  st.push("");

  // Local buckling check (if geometry provided)
  if (localBuckling) {
    const lb = checkLocalBuckling(localBuckling, Fy);
    st.push(...lb.steps);
    if (!lb.isNonSlender) {
      st.push("⚠ ADVERTENCIA: Sección esbelta — Q < 1. Se requiere área efectiva (no implementado).");
      st.push("");
    }
  }

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
  st.push(
    `φ_b·M_{n,x} = ${PHI_B}·${Mnx.toFixed(1)} = ${phiMnx.toFixed(1)} kN·m`,
  );
  st.push(`M_{p,y} = F_y·Z_y = ${Fy}·${Zy} = ${Mpy.toFixed(1)} kN·m`);
  st.push(
    `φ_b·M_{n,y} = ${PHI_B}·${Mny.toFixed(1)} = ${phiMny.toFixed(1)} kN·m`,
  );
  st.push("");

  st.push("--- Interacción (Capítulo H) ---");
  st.push(
    `P_r/P_c = ${Pu.toFixed(1)}/${phiPn.toFixed(1)} = ${PrPc.toFixed(3)} ${PrPc >= 0.2 ? "≥ 0.2" : "< 0.2"}`,
  );
  st.push(`Fórmula: ${formula}`);
  st.push(
    `= ${PrPc >= 0.2 ? `${PrPc.toFixed(3)} + 0.889·(${(Mux / phiMnx).toFixed(3)} + ${(Muy / phiMny).toFixed(3)})` : `${(Pu / (2 * phiPn)).toFixed(3)} + (${(Mux / phiMnx).toFixed(3)} + ${(Muy / phiMny).toFixed(3)})`}`,
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
    ratio,
    passes,
    limitState:
      governComp === "eje x-x"
        ? `Pandeo ${x.mode} (x-x)`
        : `Pandeo ${y.mode} (y-y)`,
    steps: st,
  };
}
