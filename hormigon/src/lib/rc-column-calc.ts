// CIRSOC 201-05 — Reinforced Concrete Column Design
// Strain compatibility approach with symmetric reinforcement
// Biaxial analysis: two directions independently, adopt worst case

export interface RCColumnInput {
  fc: number;    // MPa — concrete compressive strength
  fy: number;    // MPa — steel yield stress
  PD: number;    // kN — dead load
  PL: number;    // kN — live load
  lu: number;    // m — unbraced length
  MxSup: number; // kN·m — moment about X, top
  MxInf: number; // kN·m — moment about X, bottom
  MySup: number; // kN·m — moment about Y, top
  MyInf: number; // kN·m — moment about Y, bottom
  Cx?: number;   // cm — column side in X direction
  Cy?: number;   // cm — column side in Y direction
  betaD?: number; // creep factor (default 0.6)
  nEsquinas?: number;   // barras en las 4 esquinas (default 4)
  nCarasX?: number;     // barras intermedias por cara X (default 0)
  nCarasY?: number;     // barras intermedias por cara Y (default 0)
  dbEsquinas?: number;  // mm — diámetro de barras en esquinas (default 12)
  dbCarasX?: number;    // mm — diámetro de barras en caras X (default 12)
  dbCarasY?: number;    // mm — diámetro de barras en caras Y (default 12)
}

export interface DirectionResult {
  label: string;       // "X" | "Y"
  M1u: number;
  M2u: number;
  k: number;
  r: number;
  lambda: number;
  lambdaLim: number;
  columnType: "SHORT" | "SLENDER";
  Mmin?: number;
  Ec?: number;
  Ig?: number;
  EI?: number;
  Pc?: number;
  Cm?: number;
  deltaS?: number;
  Mc?: number;
  Mu: number;
  gamma: number;
  n_reduced: number;
  m_reduced: number;
  n_raw: number;       // kN/cm² — without dividing by f'c
  m_raw: number;       // kN·m/cm² — without dividing by f'c
  rho: number;
  Ast: number;
  passes: boolean;
  steps: string[];
}

export interface RCColumnResult {
  Pu: number;
  Ag: number;       // cm²
  Cx: number;       // cm
  Cy: number;       // cm
  // Per-direction results
  dirX: DirectionResult;
  dirY: DirectionResult;
  // Combined (worst case)
  columnType: "SHORT" | "SLENDER";
  rho: number;
  Ast: number;       // cm²
  dbLong: number;    // mm — longitudinal bar diameter
  phiStirrup: number;// mm — stirrup diameter
  sStirrup: number;  // cm — stirrup spacing
  lambdaOK: boolean;
  passes: boolean;
  steps: string[];
  barLayout: BiaxialBarLayout;
}

export interface BiaxialBarLayout {
  dbEsquinas: number;            // mm — diámetro barras de esquina
  dbCarasX: number;              // mm — diámetro barras caras X
  dbCarasY: number;              // mm — diámetro barras caras Y
  aBarEsquinas: number;          // cm² por barra de esquina
  aBarX: number;                 // cm² por barra cara X
  aBarY: number;                 // cm² por barra cara Y
  // Dirección X: barras en caras de ancho b (perpendiculares a X, 2 caras)
  nXperFace: number;             // barras por cara X (incluye 2 esquinas)
  nXtotal: number;               // total barras caras X = 2 × nXperFace (incluye 4 esquinas)
  astXprovided: number;          // cm² provisto en dirección X (ambas caras)
  // Dirección Y: las esquinas ya están
  astYneeded: number;            // cm² necesarios según dirY.Ast
  cornerContribY: number;        // cm² que aportan las 4 esquinas a Y
  astYremaining: number;         // cm² que faltan para Y (= max(0, astYneeded - cornerContribY))
  nYadditionalPerFace: number;   // barras intermedias adicionales por cara Y (caras de ancho h)
  nYadditionalTotal: number;     // total barras adicionales en Y
  astYprovided: number;          // cm² provisto en dirección Y (ambas caras)
  // Totales
  totalBars: number;             // total de barras distintas (nXtotal + nYadditionalTotal)
  astTotalProvided: number;      // acero total colocado (cm²)
}

// Standard rebar areas (mm²)
const BAR_AREAS: Record<number, number> = {
  8: 50, 10: 79, 12: 113, 16: 201, 20: 314, 25: 491, 32: 804,
};
const BAR_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

export interface ManualAstResult {
  totalBars: number;       // nEsquinas + 2*nCarasX + 2*nCarasY
  astTotal: number;        // cm² total
  astXface: number;        // cm² por cara X (2 esquinas + nCarasX intermedias)
  astYface: number;        // cm² por cara Y (2 esquinas + nCarasY intermedias)
  perBarEsquinas: number;  // cm² por barra esquina
  perBarX: number;         // cm² por barra cara X
  perBarY: number;         // cm² por barra cara Y
  astEsquinas: number;     // cm² total de las nEsquinas barras de esquina
  astCarasX: number;       // cm² total de las 2*nCarasX barras de cara X
  astCarasY: number;       // cm² total de las 2*nCarasY barras de cara Y
}

/**
 * Compute total steel area from manual bar layout with 3 independent diameters.
 * X faces are the faces perpendicular to X (parallel to Y), width = Cx.
 * Y faces are the faces perpendicular to Y (parallel to X), width = Cy.
 * Each X face gets 2 corner bars + nCarasX intermediate bars.
 * Each Y face gets 2 corner bars + nCarasY intermediate bars.
 */
export function computeManualAst(
  nEsquinas: number,
  nCarasX: number,
  nCarasY: number,
  dbEsquinas: number,
  dbCarasX: number,
  dbCarasY: number,
): ManualAstResult {
  const area = (d: number) => (Math.PI * d * d / 4) / 100; // mm² → cm²
  const perBarEsquinas = area(dbEsquinas);
  const perBarX = area(dbCarasX);
  const perBarY = area(dbCarasY);

  const totalBars = nEsquinas + 2 * nCarasX + 2 * nCarasY;

  // Corner bars contribution
  const astEsquinas = nEsquinas * perBarEsquinas;

  // Intermediate bars contribution (total across both faces each)
  const astCarasX = 2 * nCarasX * perBarX;
  const astCarasY = 2 * nCarasY * perBarY;

  const astTotal = astEsquinas + astCarasX + astCarasY;

  // Per-face areas: 2 corner bars per face + n intermediates (each face)
  // X face (left or right): 2 esquinas + nCarasX intermedias
  const astXface = 2 * perBarEsquinas + nCarasX * perBarX;
  // Y face (top or bottom): 2 esquinas + nCarasY intermedias
  const astYface = 2 * perBarEsquinas + nCarasY * perBarY;

  return {
    totalBars,
    astTotal,
    astXface,
    astYface,
    perBarEsquinas,
    perBarX,
    perBarY,
    astEsquinas,
    astCarasX,
    astCarasY,
  };
}

const PHI_C = 0.65; // tied column
const ES = 200000;   // MPa — steel elastic modulus
const EPS_CU = 0.003;

function fmt(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

function f2(n: number): string { return fmt(n, 1); }
function f3(n: number): string { return fmt(n, 3); }

/**
 * Compute β₁ per CIRSOC 10.2.7.3
 */
function computeBeta1(fc: number): number {
  if (fc <= 30) return 0.85;
  return Math.max(0.85 - 0.05 * ((fc - 30) / 7), 0.65);
}

/**
 * Build interaction curve (φP_n, φM_n) for given section and reinforcement.
 * Symmetric reinforcement: As_tension = As_compression = Ast/2.
 */
function buildInteractionCurve(
  Cx_cm: number,
  Cy_cm: number,
  fc_mpa: number,
  fy_mpa: number,
  Ast_cm2: number,
  d_prime: number = 3,
): { pn: number[]; mn: number[] } {
  const fc_kNcm2 = fc_mpa * 0.1; // MPa → kN/cm²
  const beta1 = computeBeta1(fc_mpa);
  const As_mm2 = (Ast_cm2 / 2) * 100; // half on each face
  const d_cm = Cy_cm - d_prime;
  const hHalf = Cy_cm / 2;

  const pnVals: number[] = [];
  const mnVals: number[] = [];

  // Scan neutral axis depth c from small to large
  const nPts = 200;
  for (let i = 0; i < nPts; i++) {
    const t = i / (nPts - 1);
    const cMin = 0.05;
    const cMax = Cy_cm + 15;
    const c = cMin * Math.pow(cMax / cMin, t);

    const a = Math.min(beta1 * c, Cy_cm);

    // Concrete compressive force
    const Cc = 0.85 * fc_kNcm2 * a * Cx_cm;

    // Compression steel strain and force
    const epsSC = (c > 0) ? EPS_CU * (c - d_prime) / c : 0;
    const fsSC = Math.max(-fy_mpa, Math.min(fy_mpa, ES * epsSC));
    const Cs = (As_mm2 * fsSC) / 1000; // kN

    // Tension steel strain and force
    const epsST = (c > 0) ? EPS_CU * (c - d_cm) / c : 0;
    const fsST = Math.max(-fy_mpa, Math.min(fy_mpa, ES * epsST));
    const T = (As_mm2 * fsST) / 1000; // kN (negative when in tension)

    // Axial force (compression positive)
    const Pn = Cc + Cs + T;

    // Moment about centroid (kN·cm)
    const Mn_kNcm =
      Cc * (hHalf - a / 2) +
      Cs * (hHalf - d_prime) -
      T * (hHalf - d_cm);
    const Mn_kNm = Mn_kNcm / 100;

    pnVals.push(Pn * PHI_C);
    mnVals.push(Mn_kNm * PHI_C);
  }

  return { pn: pnVals, mn: mnVals };
}

/**
 * Find maximum φM_n on the interaction curve at a given φP_n = Pu target.
 */
function maxMomentAtPu(
  pnVals: number[],
  mnVals: number[],
  Pu: number,
): number {
  let maxMn = 0;
  const points = pnVals.map((p, i) => ({ p, m: mnVals[i] }));
  points.sort((a, b) => a.p - b.p);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i].p;
    const p2 = points[i + 1].p;
    const m1 = points[i].m;
    const m2 = points[i + 1].m;

    if ((Pu - p1) * (Pu - p2) <= 0 && Math.abs(p2 - p1) > 1e-9) {
      const t = (Pu - p1) / (p2 - p1);
      const mInterp = m1 + t * (m2 - m1);
      if (mInterp > maxMn) maxMn = mInterp;
    }
  }

  for (const pt of points) {
    if (Math.abs(pt.p - Pu) < 1e-3 && pt.m > maxMn) {
      maxMn = pt.m;
    }
  }

  return maxMn;
}

/**
 * Check if a given ρ satisfies the (Pu, Mu) demand.
 */
function checkRho(
  Cx: number,
  Cy: number,
  fc: number,
  fy: number,
  Pu: number,
  Mu: number,
  rho: number,
): { works: boolean; maxPhiMn: number } {
  const Ast = rho * Cx * Cy; // cm² (ρ = Ast/Ag, Ag = Cx·Cy in cm²)
  const { pn, mn } = buildInteractionCurve(Cx, Cy, fc, fy, Ast);
  const maxPhiMn = maxMomentAtPu(pn, mn, Pu);
  return { works: maxPhiMn >= Mu, maxPhiMn };
}

/**
 * Select standard longitudinal bars based on required Ast.
 */
function selectLongitudinalBars(
  Ast_cm2: number,
  _Cx_cm: number,
): { nBars: number; db: number } {
  for (let nBars = 4; nBars <= 12; nBars += 2) {
    const perBar = (Ast_cm2 * 100) / nBars;
    for (const db of BAR_DIAMETERS) {
      if (BAR_AREAS[db] >= perBar) return { nBars, db };
    }
  }
  return { nBars: 12, db: 32 };
}

/**
 * Select biaxial bar layout considering corner bars work in both directions.
 * X-direction bars on faces of width b include the 4 corners.
 * Y-direction gets corner contribution; intermediate bars are added only if needed.
 */
function selectBiaxialBars(
  astX: number,   // cm² requeridos dirección X (dirX.Ast)
  astY: number,   // cm² requeridos dirección Y (dirY.Ast)
  _Cx: number,    // cm — reserved for future use
  _Cy: number,    // cm — reserved for future use
): BiaxialBarLayout {
  for (const db of BAR_DIAMETERS) {
    const aBar = BAR_AREAS[db] / 100; // cm²

    // Dirección X
    const nXperFace = Math.max(2, Math.ceil(astX / (2 * aBar)));
    const nXtotal = 2 * nXperFace;
    const astXprovided = nXtotal * aBar;

    // Dirección Y
    const cornerContribY = 4 * aBar;
    const astYremaining = Math.max(0, astY - cornerContribY);
    const nYadditionalPerFace = Math.ceil(astYremaining / (2 * aBar));
    const nYadditionalTotal = 2 * nYadditionalPerFace;
    const astYprovided = cornerContribY + nYadditionalTotal * aBar;

    const totalBars = nXtotal + nYadditionalTotal;

    if (totalBars <= 12 && astXprovided >= astX && astYprovided >= astY) {
      return {
        dbEsquinas: db,
        dbCarasX: db,
        dbCarasY: db,
        aBarEsquinas: aBar,
        aBarX: aBar,
        aBarY: aBar,
        nXperFace,
        nXtotal,
        astXprovided,
        astYneeded: astY,
        cornerContribY,
        astYremaining,
        nYadditionalPerFace,
        nYadditionalTotal,
        astYprovided,
        totalBars,
        astTotalProvided: nXtotal * aBar + nYadditionalTotal * aBar,
      };
    }
  }

  // Fallback: use largest diameter (accepting more than 12 bars)
  const db = 32;
  const aBar = BAR_AREAS[db] / 100;
  const nXperFace = Math.max(2, Math.ceil(astX / (2 * aBar)));
  const nXtotal = 2 * nXperFace;
  const astXprovided = nXtotal * aBar;
  const cornerContribY = 4 * aBar;
  const astYremaining = Math.max(0, astY - cornerContribY);
  const nYadditionalPerFace = Math.ceil(astYremaining / (2 * aBar));
  const nYadditionalTotal = 2 * nYadditionalPerFace;
  const astYprovided = cornerContribY + nYadditionalTotal * aBar;
  const totalBars = nXtotal + nYadditionalTotal;

  return {
    dbEsquinas: db,
    dbCarasX: db,
    dbCarasY: db,
    aBarEsquinas: aBar,
    aBarX: aBar,
    aBarY: aBar,
    nXperFace,
    nXtotal,
    astXprovided,
    astYneeded: astY,
    cornerContribY,
    astYremaining,
    nYadditionalPerFace,
    nYadditionalTotal,
    astYprovided,
    totalBars,
    astTotalProvided: nXtotal * aBar + nYadditionalTotal * aBar,
  };
}

/**
 * Internal: design a column for a single bending direction.
 * Cx = section width (perpendicular to bending)
 * Cy = section depth (parallel to bending) — used for r=0.3·Cy and moment eqns
 */
interface SingleDirInput {
  fc: number;
  fy: number;
  PD: number;
  PL: number;
  lu: number;
  M1u: number;
  M2u: number;
  b: number;      // cm — ancho perpendicular a la flexión (dimensión secundaria)
  h: number;      // cm — canto en dirección de flexión (dimensión de estudio)
  betaD?: number;
  astProvided?: number; // cm² — optional manual steel area
}

function designOneDirection(
  input: SingleDirInput,
  label: string,
): DirectionResult {
  const { fc, fy, PD, PL, lu, M1u, M2u, b, h, betaD, astProvided } = input;

  const st: string[] = [];
  st.push(`====== DIRECCIÓN ${label} ======`);
  st.push(`M_1u = ${M1u} kN·m, M_2u = ${M2u} kN·m`);
  st.push(`b = ${b} cm, h = ${h} cm`);
  st.push("");

  // ─── Load analysis ───
  st.push(`--- ${label}: Análisis de cargas ---`);
  const Pu1 = 1.4 * PD;
  const Pu2Force = 1.2 * PD + 1.6 * PL;
  const Pu = Math.max(Pu1, Pu2Force);
  st.push(`P_u = max(1.4·${PD}, 1.2·${PD}+1.6·${PL}) = ${f2(Pu)} kN`);
  st.push(`A_g = ${b}·${h} = ${b * h} cm²`);
  st.push("");

  // ─── Effective length and slenderness ───
  st.push(`--- ${label}: Longitud efectiva y esbeltez ---`);
  const k = 0.9;
  const r = 0.3 * h; // cm — radio de giro en la dirección de estudio (h = canto de flexión = dimensión de pandeo)
  const lambda = (k * lu * 100) / r;
  st.push(`k = ${k} (pórtico arriostrado)`);
  st.push(`r = 0.3·h = 0.3·${h} = ${f2(r)} cm`);
  st.push(`λ = k·l_u·100 / r = ${k}·${lu}·100 / ${f2(r)} = ${f2(lambda)}`);
  const lambdaOK = lambda <= 100;
  if (!lambdaOK) {
    st.push(`⚠ λ = ${f2(lambda)} > 100 → esbeltez excesiva.`);
  } else {
    st.push(`λ = ${f2(lambda)} ≤ 100 ✓`);
  }
  st.push("");

  // ─── Slenderness limit ───
  st.push(`--- ${label}: Límite de esbeltez ---`);
  let lambdaLim: number;
  if (M1u === 0 && M2u === 0) {
    lambdaLim = 22;
    st.push(`M_1u = M_2u = 0 → λ_lim = 22`);
  } else if (M2u === 0) {
    lambdaLim = 22;
    st.push(`M_2u = 0 → λ_lim = 22`);
  } else {
    const ratio = M1u / M2u;
    lambdaLim = 34 - 12 * ratio;
    if (lambdaLim > 40) lambdaLim = 40;
    st.push(`M_1u/M_2u = ${M1u}/${M2u} = ${f3(ratio)}`);
    st.push(`λ_lim = 34 − 12·(M_1u/M_2u) = ${f2(lambdaLim)} (máx 40)`);
  }

  let columnType: "SHORT" | "SLENDER";
  let Mu: number;
  let Mmin: number | undefined;
  let Ec: number | undefined;
  let Ig: number | undefined;
  let EI: number | undefined;
  let Pc: number | undefined;
  let Cm: number | undefined;
  let deltaS: number | undefined;
  let Mc: number | undefined;

  if (lambda <= lambdaLim) {
    columnType = "SHORT";
    Mu = Math.max(Math.abs(M1u), Math.abs(M2u));
    st.push(`λ = ${f2(lambda)} ≤ λ_lim = ${f2(lambdaLim)} → COLUMNA CORTA`);
    st.push(`M_u = max(|M_1u|, |M_2u|) = ${f2(Mu)} kN·m`);
  } else {
    columnType = "SLENDER";
    st.push(`λ = ${f2(lambda)} > λ_lim = ${f2(lambdaLim)} → COLUMNA ESBELTA`);
    st.push("Se deben considerar efectos de segundo orden.");
  }
  st.push("");

  // ─── Second-order effects (slender only) ───
  if (columnType === "SLENDER") {
    st.push(`--- ${label}: Efectos de segundo orden ---`);

    Mmin = Pu * (0.015 + 0.03 * (h / 100));
    st.push(`M_min = P_u·(0.015 + 0.03·h) = ${f2(Pu)}·(0.015 + 0.03·${(h / 100)}) = ${f2(Mmin)} kN·m`);

    Ec = 4700 * Math.sqrt(fc);
    st.push(`E_c = 4700·√f'_c = ${f2(Ec)} MPa`);

    const b_mm = b * 10;
    const h_mm = h * 10;
    Ig = (b_mm * h_mm * h_mm * h_mm) / 12;
    st.push(`I_g = b·h³/12 = ${b_mm}·${h_mm}³/12 = ${Ig.toExponential(2)} mm⁴`);

    // βd = factored dead / factored total (CIRSOC 10.11.1). Auto-computed if not provided.
    const betaDv = betaD ?? (Pu > 0 ? (1.2 * PD) / Pu : 0.6);
    const EI_nmm2 = (0.4 * Ec * Ig) / (1 + betaDv);
    EI = EI_nmm2;
    st.push(`β_d = ${f3(betaDv)}${betaD === undefined ? " (auto)" : ""}`);
    st.push(`EI = 0.4·E_c·I_g/(1+β_d) = ${EI_nmm2.toExponential(2)} N·mm²`);

    const L_mm = k * lu * 1000;
    Pc = (Math.PI * Math.PI * EI_nmm2) / (L_mm * L_mm) / 1000;
    st.push(`P_c = π²·EI/(k·l_u)² = ${f2(Pc)} kN`);

    if (Pu > 0.75 * Pc) {
      st.push(`⚠ P_u = ${f2(Pu)} > 0.75·P_c = ${f2(0.75 * Pc)} → Inestabilidad.`);
    } else {
      st.push(`P_u = ${f2(Pu)} ≤ 0.75·P_c = ${f2(0.75 * Pc)} ✓`);
    }

    if (M1u === 0 && M2u === 0) {
      Cm = 1.0;
      st.push(`C_m = 1.0 (M_1u = M_2u = 0)`);
    } else if (M2u === 0) {
      Cm = 1.0;
      st.push(`C_m = 1.0 (M_2u = 0)`);
    } else {
      Cm = Math.max(0.6 + 0.4 * (M1u / M2u), 0.4);
      st.push(`C_m = 0.6 + 0.4·(M_1u/M_2u) = ${f3(Cm)} (mín 0.4)`);
    }

    const denom = 1 - Pu / (0.75 * Pc);
    if (denom <= 0) {
      deltaS = 999;
      st.push(`δ_s → denominador ≤ 0 → inestabilidad`);
    } else {
      deltaS = Math.max(Cm / denom, 1.0);
      st.push(`δ_s = C_m / (1 − P_u/(0.75·P_c)) = ${f3(deltaS)} (mín 1.0)`);
    }

    const M_base = Math.max(Math.abs(M1u), Math.abs(M2u), Mmin);
    if (M1u === 0 && M2u === 0) {
      Mc = deltaS * Mmin;
      st.push(`M_c = δ_s·M_min = ${f2(Mc)} kN·m`);
    } else {
      Mc = deltaS * M_base;
      st.push(`M_base = max(|M_1u|,|M_2u|,M_min) = ${f2(M_base)} kN·m`);
      st.push(`M_c = δ_s·M_base = ${f2(Mc)} kN·m`);
    }

    Mu = Mc;
  }
  st.push("");

  // ─── Strain compatibility ───
  st.push(`--- ${label}: Armadura por compatibilidad de deformaciones ---`);

  const d_prime = 3;
  const d_eff = h - d_prime;
  const gamma = (h - 2 * d_prime) / h;
  st.push(`Cubrimiento estimado = ${d_prime} cm`);
  st.push(`d = h − cub = ${f2(d_eff)} cm`);
  st.push(`γ = (h − 6)/h = ${f3(gamma)}`);

  const n_red = (10 * Pu) / (b * h * fc);
  const m_red = (10 * Mu!) / (b * h * h * fc);
  st.push(`ν = 10·P_u/(b·h·f'_c) = ${f3(n_red)}`);
  st.push(`μ = 10·M_u/(b·h²·f'_c) = ${f3(m_red)}`);

  // Sin dividir por f'c
  const n_raw = (10 * Pu) / (b * h);
  const m_raw = (10 * Mu!) / (b * h * h);
  st.push(`ν* = 10·P_u/(b·h) = ${f2(n_raw)} kN/cm²`);
  st.push(`μ* = 10·M_u/(b·h²) = ${f2(m_raw)} kN·m/cm² (sin /f'c)`);

  let rhoLo = 0.01;
  let rhoHi = 0.08;
  let rho = 0;
  let finalAst = 0;
  let passes = false;

  const checkMax = checkRho(b, h, fc, fy, Pu, Mu!, rhoHi);
  if (!checkMax.works) {
    st.push(`Aún con ρ = 8% la sección no verifica.`);
    st.push(`φM_n máx = ${f2(checkMax.maxPhiMn)} kN·m vs M_u = ${f2(Mu!)} kN·m`);
    passes = false;
    rho = rhoHi;
    finalAst = rhoHi * b * h;
  } else {
    for (let iter = 0; iter < 25; iter++) {
      const mid = (rhoLo + rhoHi) / 2;
      const chk = checkRho(b, h, fc, fy, Pu, Mu!, mid);
      if (chk.works) {
        rhoHi = mid;
      } else {
        rhoLo = mid;
      }
    }
    rho = rhoHi;
    finalAst = rho * b * h;
    passes = true;

    st.push(`ρ encontrada = ${(rho * 100).toFixed(2)}% → A_st = ${f2(finalAst)} cm²`);
    st.push(`A_st mín = 0.01·${b}·${h} = ${f2(0.01 * b * h)} cm²`);
  }

  // ─── Manual reinforcement check ───
  if (astProvided !== undefined) {
    const rhoProvided = astProvided / (b * h);
    const passesManual = rhoProvided >= rho;
    st.push(`Armadura manual: ${astProvided.toFixed(2)} cm² → ρ = ${(rhoProvided * 100).toFixed(2)}%`);
    st.push(`  ρ necesaria = ${(rho * 100).toFixed(2)}%`);
    if (passesManual) {
      st.push(`  ✓ ρ provista ≥ ρ necesaria`);
    } else {
      st.push(`  ⚠ ρ provista < ρ necesaria — NO VERIFICA`);
    }
    passes = passesManual;
  }

  const effectiveAst = astProvided ?? finalAst;

  // ─── Local longitudinal bars for this direction ───
  st.push("");
  st.push(`--- ${label}: Armado longitudinal ---`);
  const { nBars, db: dbLong } = selectLongitudinalBars(effectiveAst, b);
  st.push(`${nBars} Ø${dbLong} mm → A_st = ${f2((nBars * BAR_AREAS[dbLong]) / 100)} cm²`);

  st.push("");
  st.push(`Estado dir ${label}: ${passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}`);

  return {
    label,
    M1u,
    M2u,
    k,
    r,
    lambda,
    lambdaLim,
    columnType,
    Mmin,
    Ec,
    Ig,
    EI,
    Pc,
    Cm,
    deltaS,
    Mc,
    Mu: Mu!,
    gamma,
    n_reduced: n_red,
    m_reduced: m_red,
    n_raw,
    m_raw,
    rho,
    Ast: effectiveAst,
    passes,
    steps: st,
  };
}

/**
 * Propose an initial armado layout based on the required steel area.
 * Always starts with 4 × Ø12 corners and adds intermediates or increases
 * diameter if needed. Returns 3 independent diameters ready for user adjustment.
 */
export function proposeArmado(
  astNeeded: number,
  _dirX: DirectionResult,
  _dirY: DirectionResult,
): {
  nEsquinas: number;
  dbEsquinas: number;
  nCarasX: number;
  dbCarasX: number;
  nCarasY: number;
  dbCarasY: number;
} {
  const area = (d: number) => (Math.PI * d * d / 4) / 100; // cm² per bar

  function tryDiameter(db: number): {
    nEsquinas: number;
    nCarasX: number;
    nCarasY: number;
    ok: boolean;
  } {
    const total = Math.ceil(astNeeded / area(db));
    if (total <= 4) return { nEsquinas: 4, nCarasX: 0, nCarasY: 0, ok: true };
    if (total <= 8) return { nEsquinas: 4, nCarasX: 2, nCarasY: 0, ok: true };
    if (total <= 12) return { nEsquinas: 4, nCarasX: 2, nCarasY: 2, ok: true };
    return { nEsquinas: 4, nCarasX: 3, nCarasY: 3, ok: total <= 16 };
  }

  // Try Ø12
  let r = tryDiameter(12);
  if (r.ok) return { ...r, dbEsquinas: 12, dbCarasX: 12, dbCarasY: 12 };

  // Try Ø16
  r = tryDiameter(16);
  if (r.ok) return { ...r, dbEsquinas: 16, dbCarasX: 16, dbCarasY: 16 };

  // Try Ø20
  r = tryDiameter(20);
  if (r.ok) return { ...r, dbEsquinas: 20, dbCarasX: 20, dbCarasY: 20 };

  // Fallback: Ø25
  r = tryDiameter(25);
  return { ...r, dbEsquinas: 25, dbCarasX: 25, dbCarasY: 25 };
}

export function designRCColumn(input: RCColumnInput): RCColumnResult {
  const { fc, fy, PD, PL, lu, MxSup, MxInf, MySup, MyInf } = input;

  // Build header block
  const header: string[] = [];
  header.push("====== COLUMNA DE HORMIGÓN ARMADO — CIRSOC 201 ======");
  header.push(`f'_c = ${fc} MPa, f_y = ${fy} MPa`);
  header.push(`P_D = ${PD} kN, P_L = ${PL} kN`);
  header.push(`l_u = ${lu} m`);
  header.push(`M_x sup = ${MxSup} kN·m, M_x inf = ${MxInf} kN·m`);
  header.push(`M_y sup = ${MySup} kN·m, M_y inf = ${MyInf} kN·m`);
  header.push("");

  // ─── Predimensioning (once) ───
  const predim: string[] = [];
  predim.push("--- Paso 1: Análisis de cargas y predimensionamiento ---");
  const Pu1 = 1.4 * PD;
  const Pu2Force = 1.2 * PD + 1.6 * PL;
  const Pu = Math.max(Pu1, Pu2Force);
  predim.push(`P_u = max(1.4·${PD}, 1.2·${PD}+1.6·${PL}) = ${f2(Pu)} kN`);

  let Cx = input.Cx ?? 0;
  let Cy_cm = input.Cy ?? 0;
  const userDims = Cx > 0 && Cy_cm > 0;

  if (!userDims) {
    const Ag_req = Math.max(
      ((PD + PL) * 10) / (0.4 * fc),
      400,
    );
    predim.push(`Predimensionamiento: A_g ≈ (P_D+P_L)/(0.4·f'_c·0.1) = (${PD}+${PL})/(0.4·${fc}·0.1) = ${f2(Ag_req)} cm²`);
    predim.push(`A_g mín = 400 cm²`);
    const Ag = Math.max(Ag_req, 400);

    Cx = 20;
    Cy_cm = Math.ceil(Ag / Cx);
    if (Cy_cm < 20) Cy_cm = 20;

    while (Cx * Cy_cm < Ag) {
      Cy_cm++;
    }

    const aspect = Cy_cm / Cx;
    if (aspect > 2.5) {
      const targetB = Math.ceil(Math.sqrt(Ag));
      Cx = Math.max(20, Math.ceil(targetB * 0.7));
      Cy_cm = Math.ceil(Ag / Cx);
      while (Cx * Cy_cm < Ag) Cy_cm++;
    }

    predim.push(`Dimensiones propuestas: Cx = ${Cx} cm, Cy = ${Cy_cm} cm (${Cx}×${Cy_cm})`);
    predim.push(`A_g = ${Cx}·${Cy_cm} = ${Cx * Cy_cm} cm² ≥ ${f2(Ag)} cm² ✓`);
  } else {
    predim.push(`Dimensiones dadas: Cx = ${Cx} cm, Cy = ${Cy_cm} cm`);
    predim.push(`A_g = ${Cx}·${Cy_cm} = ${Cx * Cy_cm} cm²`);
  }
  predim.push("");

  // ─── Manual reinforcement (if specified) ───
  const nEsquinas = input.nEsquinas ?? 4;
  const nCarasX = input.nCarasX ?? 0;
  const nCarasY = input.nCarasY ?? 0;
  const dbEsquinas = input.dbEsquinas ?? 12;
  const dbCarasX = input.dbCarasX ?? 12;
  const dbCarasY = input.dbCarasY ?? 12;

  const useManual =
    nCarasX > 0 ||
    nCarasY > 0 ||
    nEsquinas !== 4 ||
    dbEsquinas !== 12 ||
    dbCarasX !== 12 ||
    dbCarasY !== 12;
  const astManual = useManual
    ? computeManualAst(nEsquinas, nCarasX, nCarasY, dbEsquinas, dbCarasX, dbCarasY)
    : undefined;

  // ─── Direction X: flexión en plano X → canto = Cx, ancho = Cy ───
  const absMxSup = Math.abs(MxSup);
  const absMxInf = Math.abs(MxInf);
  let M1u_x: number;
  let M2u_x: number;
  if (absMxSup <= absMxInf) {
    M1u_x = MxSup;
    M2u_x = MxInf;
  } else {
    M1u_x = MxInf;
    M2u_x = MxSup;
  }

  const dirX = designOneDirection(
    {
      fc, fy, PD, PL, lu,
      M1u: M1u_x, M2u: M2u_x,
      b: Cy_cm, h: Cx,
      betaD: input.betaD,
      astProvided: astManual?.astTotal,
    },
    "X",
  );

  // ─── Direction Y: flexión en plano Y → canto = Cy, ancho = Cx ───
  const absMySup = Math.abs(MySup);
  const absMyInf = Math.abs(MyInf);
  let M1u_y: number;
  let M2u_y: number;
  if (absMySup <= absMyInf) {
    M1u_y = MySup;
    M2u_y = MyInf;
  } else {
    M1u_y = MyInf;
    M2u_y = MySup;
  }

  const dirY = designOneDirection(
    {
      fc, fy, PD, PL, lu,
      M1u: M1u_y, M2u: M2u_y,
      b: Cx, h: Cy_cm,
      betaD: input.betaD,
      astProvided: astManual?.astTotal,
    },
    "Y",
  );

  // ─── Combine ───
  const combo: string[] = [];
  combo.push("");
  combo.push("====== RESUMEN COMBINADO (BIAXIAL) ======");

  const passes = dirX.passes && dirY.passes;
  const columnType: "SHORT" | "SLENDER" =
    dirX.columnType === "SLENDER" || dirY.columnType === "SLENDER"
      ? "SLENDER"
      : "SHORT";
  const lambdaOK = dirX.lambda <= 100 && dirY.lambda <= 100;

  combo.push(`Dir X: A_st = ${f2(dirX.Ast)} cm², ρ = ${(dirX.rho * 100).toFixed(2)}%, ${dirX.columnType === "SHORT" ? "Corta" : "Esbelta"}, ${dirX.passes ? "✓" : "✗"}`);
  combo.push(`Dir Y: A_st = ${f2(dirY.Ast)} cm², ρ = ${(dirY.rho * 100).toFixed(2)}%, ${dirY.columnType === "SHORT" ? "Corta" : "Esbelta"}, ${dirY.passes ? "✓" : "✗"}`);
  combo.push(`→ Tipo: Columna ${columnType === "SHORT" ? "Corta" : "Esbelta"}`);
  combo.push(`→ Verificación: ${passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}`);

  // ─── Biaxial bar layout ───
  const barLayout: BiaxialBarLayout = useManual
    ? {
        dbEsquinas,
        dbCarasX,
        dbCarasY,
        aBarEsquinas: astManual!.perBarEsquinas,
        aBarX: astManual!.perBarX,
        aBarY: astManual!.perBarY,
        nXperFace: nEsquinas / 2 + nCarasX,
        nXtotal: nEsquinas + 2 * nCarasX,
        astXprovided: astManual!.astXface * 2,
        astYneeded: dirY.Ast,
        cornerContribY: nEsquinas * astManual!.perBarEsquinas,
        astYremaining: Math.max(0, dirY.Ast - nEsquinas * astManual!.perBarEsquinas),
        nYadditionalPerFace: nCarasY,
        nYadditionalTotal: 2 * nCarasY,
        astYprovided: astManual!.astYface * 2,
        totalBars: astManual!.totalBars,
        astTotalProvided: astManual!.astTotal,
      }
    : selectBiaxialBars(dirX.Ast, dirY.Ast, Cx, Cy_cm);
  const rho_final = barLayout.astTotalProvided / (Cx * Cy_cm);
  const dbLong = Math.max(barLayout.dbEsquinas, barLayout.dbCarasX, barLayout.dbCarasY);

  combo.push("");
  combo.push("--- Armado biaxial ---");
  if (useManual) {
    combo.push(`Armadura manual: ${astManual!.totalBars} barras (Ø${dbEsquinas} esquinas + Ø${dbCarasX} caras X + Ø${dbCarasY} caras Y)`);
    combo.push(`  n_esquinas=${nEsquinas} + n_caras_x=${nCarasX} + n_caras_y=${nCarasY}`);
    combo.push(`Dirección X: Ast_nec = ${f2(dirX.Ast)} cm² → ${barLayout.nXtotal} barras en caras de ${Cx} cm (${barLayout.nXperFace} por cara, incluye 2×2 esquinas)`);
    combo.push(`Dirección Y: Ast_nec = ${f2(dirY.Ast)} cm² → esquinas aportan ${f2(barLayout.cornerContribY)} cm²`);
    combo.push(`  Resta: ${f2(barLayout.astYremaining)} cm² (manual, no se agregan barras automáticamente)`);
    combo.push(`Total: ${astManual!.totalBars} barras | Ast_total = ${f2(astManual!.astTotal)} cm² | ρ = ${(rho_final * 100).toFixed(2)}%`);
  } else {
    combo.push(`Dirección X: Ast_nec = ${f2(dirX.Ast)} cm² → ${barLayout.nXtotal} Ø${dbLong} en caras de ${Cx} cm (${barLayout.nXperFace} por cara, incluye 4 esquinas)`);
    combo.push(`Dirección Y: Ast_nec = ${f2(dirY.Ast)} cm² → esquinas aportan ${f2(barLayout.cornerContribY)} cm²`);
    combo.push(`  Resta: ${f2(barLayout.astYremaining)} cm² → ${barLayout.nYadditionalTotal} Ø${dbLong} adicionales en caras de ${Cy_cm} cm (${barLayout.nYadditionalPerFace} por cara)`);
    combo.push(`Total: ${barLayout.totalBars} Ø${dbLong} | Ast_total = ${f2(barLayout.astTotalProvided)} cm² | ρ = ${(rho_final * 100).toFixed(2)}%`);
  }

  // ─── Combined stirrups ───
  combo.push("");
  combo.push("--- Estribos ---");

  const phiStirrup = dbLong <= 16 ? 6 : 8;
  combo.push(`φ_e ≥ ${phiStirrup} mm (φ_L = ${dbLong} ${dbLong <= 16 ? "≤ 16 mm" : "> 16 mm"})`);

  const s1 = Math.min(Cx, Cy_cm);
  const s2 = 12 * (dbLong / 10);
  const s3 = 48 * (phiStirrup / 10);
  const sStirrup = Math.min(s1, s2, s3);
  combo.push(`Separación: s ≤ min(${s1}, ${f2(s2)}, ${f2(s3)}) = ${f2(sStirrup)} cm`);

  combo.push("");
  combo.push("=============== RESUMEN FINAL ===============");
  combo.push(`Sección: ${Cx}×${Cy_cm} cm, A_g = ${Cx * Cy_cm} cm²`);
  combo.push(`Armadura: ${(rho_final * 100).toFixed(2)}% = ${f2(barLayout.astTotalProvided)} cm² (${barLayout.totalBars} Ø${dbLong})`);
  combo.push(`Estribos: φ${phiStirrup} c/${f2(sStirrup)} cm`);
  combo.push(`Estado: ${passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}`);

  // Build combined steps: header + predimensioning + dirX + dirY + combo
  const combinedSteps = [
    ...header,
    ...predim,
    ...dirX.steps,
    "",
    ...dirY.steps,
    ...combo,
  ];

  return {
    Pu,
    Ag: Cx * Cy_cm,
    Cx,
    Cy: Cy_cm,
    dirX,
    dirY,
    columnType,
    rho: rho_final,
    Ast: barLayout.astTotalProvided,
    dbLong,
    phiStirrup,
    sStirrup,
    lambdaOK,
    passes,
    steps: combinedSteps,
    barLayout,
  };
}
