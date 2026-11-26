// CIRSOC 201-05 — Reinforced Concrete Column Design
// Strain compatibility approach with symmetric reinforcement
// Biaxial analysis: two directions independently, adopt worst case

export interface RCColumnInput {
  fc: number; // MPa — concrete compressive strength
  fy: number; // MPa — steel yield stress
  PD: number; // kN — dead load
  PL: number; // kN — live load
  lu: number; // m — unbraced length
  MxSup: number; // kN·m — moment about X, top
  MxInf: number; // kN·m — moment about X, bottom
  MySup: number; // kN·m — moment about Y, top
  MyInf: number; // kN·m — moment about Y, bottom
  Cx?: number; // cm — column side in X direction
  Cy?: number; // cm — column side in Y direction
  betaD?: number; // creep factor (default 0.6)
  nEsquinas?: number; // barras en las 4 esquinas (default 4)
  nCarasX?: number; // barras intermedias por cara X (default 0)
  nCarasY?: number; // barras intermedias por cara Y (default 0)
  dbEsquinas?: number; // mm — diámetro de barras en esquinas (default 12)
  dbCarasX?: number; // mm — diámetro de barras en caras X (default 12)
  dbCarasY?: number; // mm — diámetro de barras en caras Y (default 12)
}

// Cuantía geométrica máxima adoptada (el reglamento permite 8%, pero
// con empalmes se adopta 4%).
export const MAX_COLUMN_RHO = 0.04;

export interface DirectionResult {
  label: string; // "X" | "Y"
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
  n_raw: number; // kN/cm² — without dividing by f'c
  m_raw: number; // kN·m/cm² — without dividing by f'c
  rho: number;
  /** As total requerida para esta dirección (cm²). */
  AstReq: number;
  /** As total adoptada/provista para esta dirección (cm²). Para el cálculo
   *  automático coincide con la requerida; con armado manual es la suma de
   *  esquinas + barras intermedias de esa dirección. */
  AstProv: number;
  /** Área efectiva usada por el motor (adoptada si hay armado manual). */
  Ast: number;
  /** La sección/armado excede la cuantía geométrica máxima adoptada (4%). */
  rhoMaxExceeded: boolean;
  passes: boolean;
  steps: string[];
}

export interface RCColumnResult {
  Pu: number;
  Ag: number; // cm²
  Cx: number; // cm
  Cy: number; // cm
  // Per-direction results
  dirX: DirectionResult;
  dirY: DirectionResult;
  // Combined (worst case)
  columnType: "SHORT" | "SLENDER";
  rho: number;
  Ast: number; // cm²
  /** La cuantía geométrica total adoptada supera el 4% (o la sección no
   *  alcanza con ese máximo). */
  rhoMaxExceeded: boolean;
  dbLong: number; // mm — longitudinal bar diameter
  phiStirrup: number; // mm — stirrup diameter
  sStirrup: number; // cm — stirrup spacing
  lambdaOK: boolean;
  passes: boolean;
  /** Verificación biaxial adicional (null si hay momento en una sola dirección). */
  biaxial: BiaxialCheck | null;
  steps: string[];
  barLayout: BiaxialBarLayout;
}

export interface BiaxialBarLayout {
  dbEsquinas: number; // mm — diámetro barras de esquina
  dbCarasX: number; // mm — diámetro barras caras X
  dbCarasY: number; // mm — diámetro barras caras Y
  aBarEsquinas: number; // cm² por barra de esquina
  aBarX: number; // cm² por barra cara X
  aBarY: number; // cm² por barra cara Y
  // Dirección X: barras en caras de ancho b (perpendiculares a X, 2 caras)
  nXperFace: number; // barras por cara X (incluye 2 esquinas)
  nXtotal: number; // total barras caras X = 2 × nXperFace (incluye 4 esquinas)
  astXprovided: number; // cm² provisto en dirección X (ambas caras)
  // Dirección Y: las esquinas ya están
  astYneeded: number; // cm² necesarios según dirY.Ast
  cornerContribY: number; // cm² que aportan las 4 esquinas a Y
  astYremaining: number; // cm² que faltan para Y (= max(0, astYneeded - cornerContribY))
  nYadditionalPerFace: number; // barras intermedias adicionales por cara Y (caras de ancho h)
  nYadditionalTotal: number; // total barras adicionales en Y
  astYprovided: number; // cm² provisto en dirección Y (ambas caras)
  // Totales
  totalBars: number; // total de barras distintas (nXtotal + nYadditionalTotal)
  astTotalProvided: number; // acero total colocado (cm²)
  /** false: el armado automático no encontró combinación que verifique
   *  (se muestra la más cercana). En armado manual siempre true. */
  found: boolean;
}

// Standard rebar areas (mm²)
const BAR_AREAS: Record<number, number> = {
  8: 50,
  10: 79,
  12: 113,
  16: 201,
  20: 314,
  25: 491,
  32: 804,
};
const BAR_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];

export interface ManualAstResult {
  totalBars: number; // nEsquinas + 2*nCarasX + 2*nCarasY
  astTotal: number; // cm² total
  astXface: number; // cm² por cara X (2 esquinas + nCarasX intermedias)
  astYface: number; // cm² por cara Y (2 esquinas + nCarasY intermedias)
  perBarEsquinas: number; // cm² por barra esquina
  perBarX: number; // cm² por barra cara X
  perBarY: number; // cm² por barra cara Y
  astEsquinas: number; // cm² total de las nEsquinas barras de esquina
  astCarasX: number; // cm² total de las 2*nCarasX barras de cara X
  astCarasY: number; // cm² total de las 2*nCarasY barras de cara Y
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
  const area = (d: number) => (Math.PI * d * d) / 4 / 100; // mm² → cm²
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
const ES = 200000; // MPa — steel elastic modulus
const EPS_CU = 0.003;

function fmt(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

function f2(n: number): string {
  return fmt(n, 1);
}
function f3(n: number): string {
  return fmt(n, 3);
}

/**
 * Compute β₁ per CIRSOC 10.2.7.3
 */
function computeBeta1(fc: number): number {
  if (fc <= 30) return 0.85;
  return Math.max(0.85 - 0.05 * ((fc - 30) / 7), 0.65);
}

/**
 * Tope de carga axial para columnas con estribos (kN) — CIRSOC 201-05
 * Art. 10.3.6.2: φ·Pn,máx = 0.80·φ·P₀, P₀ = 0.85·f'c·(Ag − Ast) + fy·Ast.
 */
export function phiPnMaxTied(
  Cx_cm: number,
  Cy_cm: number,
  fc_mpa: number,
  fy_mpa: number,
  Ast_cm2: number,
): number {
  const Ag_mm2 = Cx_cm * Cy_cm * 100;
  const Ast_mm2 = Ast_cm2 * 100;
  const P0 = (0.85 * fc_mpa * (Ag_mm2 - Ast_mm2) + fy_mpa * Ast_mm2) / 1000; // kN
  return 0.8 * PHI_C * P0;
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
  capped: boolean = true,
): { pn: number[]; mn: number[] } {
  const fc_kNcm2 = fc_mpa * 0.1; // MPa → kN/cm²
  const beta1 = computeBeta1(fc_mpa);
  const As_mm2 = (Ast_cm2 / 2) * 100; // half on each face
  const d_cm = Cy_cm - d_prime;
  const hHalf = Cy_cm / 2;

  const pnVals: number[] = [];
  const mnVals: number[] = [];

  // Tope de carga axial — CIRSOC 201-05 Art. 10.3.6.2 (columnas con estribos):
  //   φ·Pn,máx = 0.80·φ·[0.85·f'c·(Ag − Ast) + fy·Ast]
  // (capped = false solo para el método de Bresler, que usa la curva completa
  // y aplica el tope aparte.)
  const phiPnMax = capped
    ? phiPnMaxTied(Cx_cm, Cy_cm, fc_mpa, fy_mpa, Ast_cm2)
    : Infinity;

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
    const epsSC = c > 0 ? (EPS_CU * (c - d_prime)) / c : 0;
    const fsSC = Math.max(-fy_mpa, Math.min(fy_mpa, ES * epsSC));
    // Barras dentro del bloque comprimido: se descuenta el hormigón que
    // desplazan (fs − 0.85·f'c) para no contar dos veces esa área.
    const fsSCnet = d_prime < a ? fsSC - 0.85 * fc_mpa : fsSC;
    const Cs = (As_mm2 * fsSCnet) / 1000; // kN

    // Tension steel strain and force
    const epsST = c > 0 ? (EPS_CU * (c - d_cm)) / c : 0;
    const fsST = Math.max(-fy_mpa, Math.min(fy_mpa, ES * epsST));
    const fsSTnet = d_cm < a ? fsST - 0.85 * fc_mpa : fsST;
    const T = (As_mm2 * fsSTnet) / 1000; // kN (negative when in tension)

    // Axial force (compression positive)
    const Pn = Cc + Cs + T;

    // Momento respecto del baricentro (kN·cm): M = Σ F_i·(h/2 − y_i), con F
    // positiva en compresión e y_i medida desde la fibra comprimida.
    // La capa inferior (y = d) entra con el MISMO signo que las demás: si está
    // traccionada (T < 0) y está debajo del baricentro (h/2 − d < 0), su aporte
    // es positivo. Antes figuraba "− T·(h/2 − d)", que restaba el aporte de la
    // armadura traccionada y subestimaba mucho φMn con poca carga axial.
    const Mn_kNcm =
      Cc * (hHalf - a / 2) + Cs * (hHalf - d_prime) + T * (hHalf - d_cm);
    const Mn_kNm = Mn_kNcm / 100;

    // Corte horizontal del diagrama en φ·Pn,máx (Art. 10.3.6.2).
    pnVals.push(Math.min(Pn * PHI_C, phiPnMax));
    mnVals.push(Mn_kNm * PHI_C);
  }

  return { pn: pnVals, mn: mnVals };
}

/**
 * Find maximum φM_n on the interaction curve at a given φP_n = Pu target.
 */
function maxMomentAtPu(pnVals: number[], mnVals: number[], Pu: number): number {
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
 * φ·Pn a excentricidad e = M/P dada (m), sobre la curva SIN tope axial.
 * Recorre la curva (c creciente → e decreciente) e interpola en P.
 */
function phiPnAtEccentricity(
  b_cm: number,
  h_cm: number,
  fc: number,
  fy: number,
  Ast_cm2: number,
  e_m: number,
): number {
  const { pn, mn } = buildInteractionCurve(
    b_cm,
    h_cm,
    fc,
    fy,
    Ast_cm2,
    3,
    false,
  );
  let best = 0;
  for (let i = 0; i < pn.length - 1; i++) {
    if (pn[i] <= 0 || pn[i + 1] <= 0) continue;
    const e1 = mn[i] / pn[i];
    const e2 = mn[i + 1] / pn[i + 1];
    if ((e_m - e1) * (e_m - e2) <= 0 && Math.abs(e2 - e1) > 1e-12) {
      const t = (e_m - e1) / (e2 - e1);
      best = Math.max(best, pn[i] + t * (pn[i + 1] - pn[i]));
    }
  }
  // e ≈ 0 → compresión pura (último punto de la curva)
  if (e_m <= 1e-9) best = Math.max(best, pn[pn.length - 1]);
  return best;
}

export interface BiaxialCheck {
  method: "bresler" | "contorno";
  /** Pu / φPni (Bresler) o Mux/φMnx + Muy/φMny (contorno). ≤ 1 verifica. */
  ratio: number;
  ok: boolean;
  steps: string[];
}

/**
 * Verificación adicional a flexión biaxial (CIRSOC 201-05, comentario
 * C10.3.6 / ACI 318 R10.3.6):
 *  - Si Pu ≥ 0.1·f'c·Ag → método de la carga recíproca de Bresler:
 *      1/φPni = 1/φPnx + 1/φPny − 1/φP₀ ; verifica si Pu ≤ φPni
 *    (φPnx, φPny: capacidad uniaxial a la misma excentricidad e = Mu/Pu).
 *  - Si Pu < 0.1·f'c·Ag → contorno de carga lineal (conservador):
 *      Mux/φMnx + Muy/φMny ≤ 1, con φMn a la carga Pu.
 * Cada dirección usa la armadura de sus dos caras (la misma de la
 * verificación uniaxial); las barras de las otras caras se desprecian
 * (conservador). Mu incluye magnificación por esbeltez y momento mínimo.
 */
function checkBiaxial(
  Cx: number,
  Cy: number,
  fc: number,
  fy: number,
  Pu: number,
  MuX: number,
  MuY: number,
  AstX: number,
  AstY: number,
  AstTotal: number = Math.max(AstX, AstY),
): BiaxialCheck {
  const st: string[] = [];
  const Ag = Cx * Cy; // cm²
  st.push("--- Verificación biaxial (adicional) ---");
  st.push(
    `M_ux = ${f2(MuX)} kN·m (flexión en X), M_uy = ${f2(MuY)} kN·m (flexión en Y), P_u = ${f2(Pu)} kN`,
  );
  const limite = (0.1 * fc * Ag * 100) / 1000; // kN
  if (Pu >= limite) {
    // Dirección X: canto Cx, ancho Cy. Dirección Y: canto Cy, ancho Cx.
    const eX = Pu > 0 ? MuX / Pu : 0;
    const eY = Pu > 0 ? MuY / Pu : 0;
    const phiPnx = phiPnAtEccentricity(Cy, Cx, fc, fy, AstX, eX);
    const phiPny = phiPnAtEccentricity(Cx, Cy, fc, fy, AstY, eY);
    // P₀ con TODA la armadura colocada en la sección.
    const AstT = AstTotal;
    const P0 = (0.85 * fc * (Ag - AstT) * 100 + fy * AstT * 100) / 1000;
    const phiP0 = PHI_C * P0;
    const inv = 1 / phiPnx + 1 / phiPny - 1 / phiP0;
    const phiPni = inv > 0 ? 1 / inv : 0;
    const ratio = phiPni > 0 ? Pu / phiPni : Infinity;
    const ok = ratio <= 1;
    st.push(
      `P_u = ${f2(Pu)} kN ≥ 0.1·f'c·A_g = ${f2(limite)} kN → método de Bresler (carga recíproca)`,
    );
    st.push(
      `  e_x = M_ux/P_u = ${(eX * 100).toFixed(1)} cm → φP_nx = ${f2(phiPnx)} kN ; e_y = ${(eY * 100).toFixed(1)} cm → φP_ny = ${f2(phiPny)} kN`,
    );
    st.push(
      `  φP₀ = 0.65·[0.85·f'c·(A_g − A_st) + f_y·A_st] = ${f2(phiP0)} kN`,
    );
    st.push(
      `  1/φP_ni = 1/${f2(phiPnx)} + 1/${f2(phiPny)} − 1/${f2(phiP0)} → φP_ni = ${f2(phiPni)} kN`,
    );
    st.push(
      `  P_u/φP_ni = ${ratio.toFixed(2)} ${ok ? "≤ 1 ✓ verifica biaxial" : "> 1 ✗ NO verifica biaxial"}`,
    );
    return { method: "bresler", ratio, ok, steps: st };
  }
  const cx = buildInteractionCurve(Cy, Cx, fc, fy, AstX);
  const cy = buildInteractionCurve(Cx, Cy, fc, fy, AstY);
  const phiMnx = maxMomentAtPu(cx.pn, cx.mn, Pu);
  const phiMny = maxMomentAtPu(cy.pn, cy.mn, Pu);
  const ratio =
    (phiMnx > 0 ? MuX / phiMnx : MuX > 0 ? Infinity : 0) +
    (phiMny > 0 ? MuY / phiMny : MuY > 0 ? Infinity : 0);
  const ok = ratio <= 1;
  st.push(
    `P_u = ${f2(Pu)} kN < 0.1·f'c·A_g = ${f2(limite)} kN → contorno de carga lineal`,
  );
  st.push(
    `  M_ux/φM_nx + M_uy/φM_ny = ${f2(MuX)}/${f2(phiMnx)} + ${f2(MuY)}/${f2(phiMny)} = ${ratio.toFixed(2)} ${ok ? "≤ 1 ✓ verifica biaxial" : "> 1 ✗ NO verifica biaxial"}`,
  );
  return { method: "contorno", ratio, ok, steps: st };
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
function selectLongitudinalBars(Ast_cm2: number): {
  nBars: number;
  db: number;
} {
  for (let nBars = 4; nBars <= 12; nBars += 2) {
    const perBar = (Ast_cm2 * 100) / nBars;
    for (const db of BAR_DIAMETERS) {
      if (BAR_AREAS[db] >= perBar) return { nBars, db };
    }
  }
  return { nBars: 12, db: 32 };
}

/** Diámetros que prueba el armado automático (Ø12 mínimo para columnas). */
const AUTO_DIAMETERS = [12, 16, 20, 25, 32];
/** Barras intermedias por cara que prueba el armado automático. */
const AUTO_MAX_INTER = 6;
/** Distancia del borde al eje de las barras de esquina adoptada para
 *  verificar la separación (recubrimiento + estribo + medio diámetro). */
const BAR_EDGE_CM = 4;
/** Separación máxima entre ejes de barras de una cara (buena práctica
 *  constructiva; evita caras largas con barras solo en las esquinas). */
const MAX_BAR_SPACING_CM = 30;

/** n barras (esquinas incluidas) en una cara: separación libre mínima
 *  max(1.5·db, 40 mm) (CIRSOC 201-05 Art. 7.6.3) y separación entre ejes
 *  ≤ 30 cm. */
function barsFitFace(faceCm: number, nBars: number, db: number): boolean {
  if (nBars <= 1) return true;
  const span = faceCm - 2 * BAR_EDGE_CM;
  const pitch = span / (nBars - 1);
  const clear = pitch - db / 10;
  return (
    clear >= Math.max(1.5 * (db / 10), 4) && pitch <= MAX_BAR_SPACING_CM + 1e-9
  );
}

interface BiaxialDemand {
  Cx: number;
  Cy: number;
  fc: number;
  fy: number;
  Pu: number;
  MuX: number;
  MuY: number;
  astX: number; // cm² requeridos dirección X (2 caras X)
  astY: number; // cm² requeridos dirección Y (2 caras Y)
  checkBi: boolean; // hay momento en las dos direcciones
}

/**
 * Armado automático biaxial. Prueba diámetros (Ø12…Ø32) y barras
 * intermedias por cara (caras X = izquierda/derecha, largo Cy; caras Y =
 * arriba/abajo, largo Cx), de menor a mayor acero total, y adopta el primero
 * que cumple TODO con las barras reales:
 *   - dirección X: 2 caras × (2 esquinas + n_x) ≥ A_st,x necesaria
 *   - dirección Y: 2 caras × (2 esquinas + n_y) ≥ A_st,y necesaria
 *   - ρ total ≤ 4 %
 *   - verificación biaxial (Bresler / contorno) con esas barras
 *   - separación libre entre barras ≥ max(1.5·db, 40 mm)
 * Si ninguno cumple, devuelve el más cercano a verificar con found = false.
 */
function selectBiaxialBars(dem: BiaxialDemand): BiaxialBarLayout {
  const { Cx, Cy, fc, fy, Pu, MuX, MuY, astX, astY, checkBi } = dem;
  const Ag = Cx * Cy;
  type Cand = {
    db: number;
    a: number;
    nIX: number;
    nIY: number;
    total: number;
  };
  const cands: Cand[] = [];
  for (const db of AUTO_DIAMETERS) {
    const a = BAR_AREAS[db] / 100;
    for (let nIX = 0; nIX <= AUTO_MAX_INTER; nIX++) {
      if (!barsFitFace(Cy, nIX + 2, db)) continue;
      for (let nIY = 0; nIY <= AUTO_MAX_INTER; nIY++) {
        if (!barsFitFace(Cx, nIY + 2, db)) continue;
        cands.push({ db, a, nIX, nIY, total: (4 + 2 * nIX + 2 * nIY) * a });
      }
    }
  }
  const nBarsOf = (c: Cand) => 4 + 2 * c.nIX + 2 * c.nIY;
  cands.sort((p, q) => p.total - q.total || nBarsOf(p) - nBarsOf(q));

  const evaluate = (c: Cand) => {
    const provX = (4 + 2 * c.nIX) * c.a;
    const provY = (4 + 2 * c.nIY) * c.a;
    const rho = c.total / Ag;
    const dirOK = provX >= astX - 1e-9 && provY >= astY - 1e-9;
    return { provX, provY, rho, dirOK, rhoOK: rho <= MAX_COLUMN_RHO + 1e-12 };
  };
  const biRatio = (provX: number, provY: number, total: number) =>
    checkBi
      ? checkBiaxial(Cx, Cy, fc, fy, Pu, MuX, MuY, provX, provY, total).ratio
      : 0;

  let chosen: Cand | null = null;
  for (const c of cands) {
    const ev = evaluate(c);
    if (!ev.dirOK || !ev.rhoOK) continue;
    if (biRatio(ev.provX, ev.provY, c.total) <= 1) {
      chosen = c;
      break;
    }
  }
  const found = chosen !== null;
  if (!chosen) {
    // Ninguno verifica: el más cercano (menor "peor relación
    // demanda/capacidad"), preferentemente dentro del 4 %.
    const pool = cands.some((c) => evaluate(c).rhoOK)
      ? cands.filter((c) => evaluate(c).rhoOK)
      : cands;
    let best = Infinity;
    for (const c of pool) {
      const ev = evaluate(c);
      const score = Math.max(
        astX / ev.provX,
        astY / ev.provY,
        ev.rho / MAX_COLUMN_RHO,
        biRatio(ev.provX, ev.provY, c.total),
      );
      if (score < best - 1e-9) {
        best = score;
        chosen = c;
      }
    }
  }
  // Sin candidatos geométricos (sección muy chica): 4 Ø12 en esquinas.
  const c: Cand = chosen ?? {
    db: 12,
    a: BAR_AREAS[12] / 100,
    nIX: 0,
    nIY: 0,
    total: (4 * BAR_AREAS[12]) / 100,
  };
  const ev = evaluate(c);
  const cornerContribY = 4 * c.a;
  return {
    dbEsquinas: c.db,
    dbCarasX: c.db,
    dbCarasY: c.db,
    aBarEsquinas: c.a,
    aBarX: c.a,
    aBarY: c.a,
    nXperFace: 2 + c.nIX,
    nXtotal: 4 + 2 * c.nIX,
    astXprovided: ev.provX,
    astYneeded: astY,
    cornerContribY,
    astYremaining: Math.max(0, astY - cornerContribY),
    nYadditionalPerFace: c.nIY,
    nYadditionalTotal: 2 * c.nIY,
    astYprovided: ev.provY,
    totalBars: 4 + 2 * c.nIX + 2 * c.nIY,
    astTotalProvided: c.total,
    found,
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
  b: number; // cm — ancho perpendicular a la flexión (dimensión secundaria)
  h: number; // cm — canto en dirección de flexión (dimensión de estudio)
  betaD?: number;
  astProvided?: number; // cm² — optional manual steel area (dirección)
  /** Armado manual de esta dirección: 2 esquinas + intermedias por cara. */
  manualBars?: {
    nEsquinas: number;
    nIntermediates: number;
    dbEsquinas: number;
    dbInter: number;
  };
}

function designOneDirection(
  input: SingleDirInput,
  label: string,
): DirectionResult {
  const { fc, fy, PD, PL, lu, M1u, M2u, b, h, betaD, astProvided, manualBars } =
    input;

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
    st.push(
      `M_min = P_u·(0.015 + 0.03·h) = ${f2(Pu)}·(0.015 + 0.03·${h / 100}) = ${f2(Mmin)} kN·m`,
    );

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
      st.push(
        `⚠ P_u = ${f2(Pu)} > 0.75·P_c = ${f2(0.75 * Pc)} → Inestabilidad.`,
      );
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
  let rhoHi = MAX_COLUMN_RHO;
  let rho = 0;
  let finalAst = 0;
  let passes = false;
  let rhoMaxExceeded = false;

  const checkMax = checkRho(b, h, fc, fy, Pu, Mu!, rhoHi);
  if (!checkMax.works) {
    rhoMaxExceeded = true;
    st.push(
      `Aún con ρ = ${(MAX_COLUMN_RHO * 100).toFixed(0)}% (máximo adoptado) la sección no verifica.`,
    );
    st.push(
      `φM_n máx = ${f2(checkMax.maxPhiMn)} kN·m vs M_u = ${f2(Mu!)} kN·m`,
    );
    const capAtMax = phiPnMaxTied(b, h, fc, fy, rhoHi * b * h);
    if (Pu > capAtMax) {
      st.push(
        `P_u = ${f2(Pu)} kN > φ·P_n,máx = 0.80·φ·P₀ = ${f2(capAtMax)} kN con ρ = ${(MAX_COLUMN_RHO * 100).toFixed(0)}% (CIRSOC 201-05 Art. 10.3.6.2) → aumentar la sección`,
      );
    }
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

    const cap = phiPnMaxTied(b, h, fc, fy, finalAst);
    st.push(
      `Tope axial (CIRSOC 201-05 Art. 10.3.6.2): φ·P_n,máx = 0.80·φ·[0.85·f'c·(A_g − A_st) + f_y·A_st] = 0.80·0.65·[0.85·${fc}·(${f2(b * h)} − ${f2(finalAst)}) + ${fy}·${f2(finalAst)}]·0.1 = ${f2(cap)} kN ≥ P_u = ${f2(Pu)} kN ✓`,
    );
    st.push(
      `ρ encontrada = ${(rho * 100).toFixed(2)}% → A_st = ${f2(finalAst)} cm²`,
    );
    st.push(`A_st mín = 0.01·${b}·${h} = ${f2(0.01 * b * h)} cm²`);
  }

  // ─── Manual reinforcement check ───
  // Se compara la As total adoptada EN ESTA DIRECCIÓN (esquinas + barras
  // intermedias de la dirección) contra la As total requerida. Las barras
  // intermedias de la otra dirección no participan de esta verificación.
  if (astProvided !== undefined) {
    const rhoProvided = astProvided / (b * h);
    const rhoProvidedMaxExceeded = rhoProvided > MAX_COLUMN_RHO;
    if (rhoProvidedMaxExceeded) rhoMaxExceeded = true;
    const passesManual = rhoProvided >= rho && !rhoProvidedMaxExceeded;
    st.push(
      `Armadura manual: ${astProvided.toFixed(2)} cm² en esta dirección → ρ = ${(rhoProvided * 100).toFixed(2)}%`,
    );
    st.push(`  ρ necesaria = ${(rho * 100).toFixed(2)}%`);
    if (rhoProvidedMaxExceeded) {
      st.push(
        `  ⚠ ρ provista > ${(MAX_COLUMN_RHO * 100).toFixed(0)}% — NO VERIFICA cuantía máxima`,
      );
    } else if (passesManual) {
      st.push(`  ✓ ρ provista ≥ ρ necesaria`);
    } else {
      st.push(`  ⚠ ρ provista < ρ necesaria — NO VERIFICA`);
    }
    passes = passes && passesManual;
  }

  const effectiveAst = astProvided ?? finalAst;

  // ─── Local longitudinal bars / adopted layout for this direction ───
  st.push("");
  st.push(`--- ${label}: Armado longitudinal ---`);
  if (manualBars) {
    const areaBar = (d: number) => (Math.PI * d * d) / 4 / 100; // cm²
    const perFace =
      2 * areaBar(manualBars.dbEsquinas) +
      manualBars.nIntermediates * areaBar(manualBars.dbInter);
    st.push(
      `Adoptado por cara: 2 Ø${manualBars.dbEsquinas} (esquinas) + ${manualBars.nIntermediates} Ø${manualBars.dbInter} (intermedias) = ${perFace.toFixed(2)} cm²/cara`,
    );
    st.push(
      `Adoptado en las 2 caras: ${(2 * perFace).toFixed(2)} cm² (As total de esta dirección)`,
    );
    st.push(
      `Requerido total: ${finalAst.toFixed(2)} cm² (${(finalAst / 2).toFixed(2)} cm² por cara)`,
    );
    st.push(
      `Comparación por cara: ${perFace.toFixed(2)} ${perFace >= finalAst / 2 ? "≥" : "<"} ${(finalAst / 2).toFixed(2)} cm² → ${perFace >= finalAst / 2 ? "✓" : "✗"}`,
    );
  } else {
    const { nBars, db: dbLong } = selectLongitudinalBars(effectiveAst);
    st.push(
      `Referencia (solo esta dirección): ${nBars} Ø${dbLong} mm → A_st = ${f2((nBars * BAR_AREAS[dbLong]) / 100)} cm². El armado adoptado se define en el resumen biaxial.`,
    );
  }

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
    AstReq: finalAst,
    AstProv: effectiveAst,
    Ast: effectiveAst,
    rhoMaxExceeded,
    passes,
    steps: st,
  };
}

/**
 * Propuesta inicial de armado para la pantalla de columnas: el mismo armado
 * que eligió el motor automático (verificado en ambas direcciones, biaxial y
 * cuantía), expresado como esquinas + intermedias por cara.
 */
export function proposeArmado(layout: BiaxialBarLayout): {
  nEsquinas: number;
  dbEsquinas: number;
  nCarasX: number;
  dbCarasX: number;
  nCarasY: number;
  dbCarasY: number;
} {
  return {
    nEsquinas: 4,
    dbEsquinas: layout.dbEsquinas,
    nCarasX: Math.max(0, layout.nXperFace - 2),
    dbCarasX: layout.dbCarasX,
    nCarasY: layout.nYadditionalPerFace,
    dbCarasY: layout.dbCarasY,
  };
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
    const Ag_req = Math.max(((PD + PL) * 10) / (0.4 * fc), 400);
    predim.push(
      `Predimensionamiento: A_g ≈ (P_D+P_L)/(0.4·f'_c·0.1) = (${PD}+${PL})/(0.4·${fc}·0.1) = ${f2(Ag_req)} cm²`,
    );
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

    predim.push(
      `Dimensiones propuestas: Cx = ${Cx} cm, Cy = ${Cy_cm} cm (${Cx}×${Cy_cm})`,
    );
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
    ? computeManualAst(
        nEsquinas,
        nCarasX,
        nCarasY,
        dbEsquinas,
        dbCarasX,
        dbCarasY,
      )
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
      fc,
      fy,
      PD,
      PL,
      lu,
      M1u: M1u_x,
      M2u: M2u_x,
      b: Cy_cm,
      h: Cx,
      betaD: input.betaD,
      // En X cuentan las 4 esquinas + las barras intermedias de X, no las de Y.
      astProvided: astManual ? astManual.astXface * 2 : undefined,
      manualBars: astManual
        ? {
            nEsquinas,
            nIntermediates: nCarasX,
            dbEsquinas,
            dbInter: dbCarasX,
          }
        : undefined,
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
      fc,
      fy,
      PD,
      PL,
      lu,
      M1u: M1u_y,
      M2u: M2u_y,
      b: Cx,
      h: Cy_cm,
      betaD: input.betaD,
      // En Y cuentan las 4 esquinas + las barras intermedias de Y, no las de X.
      astProvided: astManual ? astManual.astYface * 2 : undefined,
      manualBars: astManual
        ? {
            nEsquinas,
            nIntermediates: nCarasY,
            dbEsquinas,
            dbInter: dbCarasY,
          }
        : undefined,
    },
    "Y",
  );

  // ─── Combine ───
  const combo: string[] = [];
  combo.push("");
  combo.push("====== RESUMEN COMBINADO (BIAXIAL) ======");

  const dirPasses = dirX.passes && dirY.passes;
  const columnType: "SHORT" | "SLENDER" =
    dirX.columnType === "SLENDER" || dirY.columnType === "SLENDER"
      ? "SLENDER"
      : "SHORT";
  const lambdaOK = dirX.lambda <= 100 && dirY.lambda <= 100;

  combo.push(
    `Dir X: A_st nec = ${f2(dirX.AstReq)} cm² | adoptada = ${f2(dirX.AstProv)} cm², ρ = ${(dirX.rho * 100).toFixed(2)}%, ${dirX.columnType === "SHORT" ? "Corta" : "Esbelta"}, ${dirX.passes ? "✓" : "✗"}`,
  );
  combo.push(
    `Dir Y: A_st nec = ${f2(dirY.AstReq)} cm² | adoptada = ${f2(dirY.AstProv)} cm², ρ = ${(dirY.rho * 100).toFixed(2)}%, ${dirY.columnType === "SHORT" ? "Corta" : "Esbelta"}, ${dirY.passes ? "✓" : "✗"}`,
  );
  combo.push(`→ Tipo: Columna ${columnType === "SHORT" ? "Corta" : "Esbelta"}`);
  combo.push(
    `→ Resistencia direccional: ${dirPasses ? "✓ VERIFICA" : "✗ NO VERIFICA"}`,
  );

  // ─── Biaxial bar layout ───
  // Verificación biaxial adicional: solo si hay momentos aplicados en ambas
  // direcciones (el momento mínimo se considera por separado en cada eje).
  const hasMx = MxSup !== 0 || MxInf !== 0;
  const hasMy = MySup !== 0 || MyInf !== 0;
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
        astYneeded: dirY.AstReq,
        cornerContribY: nEsquinas * astManual!.perBarEsquinas,
        astYremaining: Math.max(
          0,
          dirY.AstReq - nEsquinas * astManual!.perBarEsquinas,
        ),
        nYadditionalPerFace: nCarasY,
        nYadditionalTotal: 2 * nCarasY,
        astYprovided: astManual!.astYface * 2,
        totalBars: astManual!.totalBars,
        astTotalProvided: astManual!.astTotal,
        found: true,
      }
    : selectBiaxialBars({
        Cx,
        Cy: Cy_cm,
        fc,
        fy,
        Pu,
        MuX: dirX.Mu,
        MuY: dirY.Mu,
        astX: dirX.AstReq,
        astY: dirY.AstReq,
        checkBi: hasMx && hasMy,
      });
  if (!useManual) {
    // La armadura "adoptada" de cada dirección es la de las barras elegidas.
    dirX.AstProv = dirX.Ast = barLayout.astXprovided;
    dirY.AstProv = dirY.Ast = barLayout.astYprovided;
  }
  const rho_final = barLayout.astTotalProvided / (Cx * Cy_cm);
  const rhoMaxExceeded =
    dirX.rhoMaxExceeded || dirY.rhoMaxExceeded || rho_final > MAX_COLUMN_RHO;
  const biaxial: BiaxialCheck | null =
    hasMx && hasMy
      ? checkBiaxial(
          Cx,
          Cy_cm,
          fc,
          fy,
          Pu,
          dirX.Mu,
          dirY.Mu,
          dirX.Ast,
          dirY.Ast,
          barLayout.astTotalProvided,
        )
      : null;
  // Cada dirección debe quedar cubierta por las barras colocadas.
  const provOK =
    dirX.AstProv >= dirX.AstReq - 1e-9 && dirY.AstProv >= dirY.AstReq - 1e-9;
  const passes =
    dirPasses && !rhoMaxExceeded && (biaxial?.ok ?? true) && provOK;
  const dbLong = Math.max(
    barLayout.dbEsquinas,
    barLayout.dbCarasX,
    barLayout.dbCarasY,
  );

  combo.push(
    `Cuantía geométrica: ρ = ${(rho_final * 100).toFixed(2)}% ${rhoMaxExceeded ? `> ${(MAX_COLUMN_RHO * 100).toFixed(0)}% — NO VERIFICA cuantía máxima` : `≤ ${(MAX_COLUMN_RHO * 100).toFixed(0)}% (máx adoptado)`}`,
  );
  combo.push("");
  combo.push("--- Armado biaxial ---");
  if (useManual) {
    combo.push(
      `Armadura manual: ${astManual!.totalBars} barras (Ø${dbEsquinas} esquinas + Ø${dbCarasX} caras X + Ø${dbCarasY} caras Y)`,
    );
    combo.push(
      `  n_esquinas=${nEsquinas} + n_caras_x=${nCarasX} + n_caras_y=${nCarasY}`,
    );
    combo.push(
      `Dirección X: Ast_nec = ${f2(dirX.AstReq)} cm² | adoptada = ${f2(dirX.AstProv)} cm² → ${barLayout.nXtotal} barras en caras de ${Cx} cm (${barLayout.nXperFace} por cara, incluye 2×2 esquinas)`,
    );
    combo.push(
      `Dirección Y: Ast_nec = ${f2(dirY.AstReq)} cm² | adoptada = ${f2(dirY.AstProv)} cm² → esquinas aportan ${f2(barLayout.cornerContribY)} cm²`,
    );
    combo.push(
      `  Resta: ${f2(barLayout.astYremaining)} cm² (manual, no se agregan barras automáticamente)`,
    );
    combo.push(
      `Total: ${astManual!.totalBars} barras | Ast_total = ${f2(astManual!.astTotal)} cm² | ρ = ${(rho_final * 100).toFixed(2)}%`,
    );
  } else {
    combo.push(
      "Armado automático: se prueban Ø12 a Ø32 y barras intermedias por cara, de menor a mayor acero, y se adopta el primero que cumple con las barras reales: A_st de cada dirección, ρ ≤ 4 %, verificación biaxial y separación libre ≥ max(1.5·d_b, 4 cm) y entre ejes ≤ 30 cm.",
    );
    combo.push(
      `Dirección X (caras izq./der., largo ${Cy_cm} cm): ${barLayout.nXperFace} Ø${dbLong} por cara (2 esquinas + ${barLayout.nXperFace - 2} intermedias) → A_st,x = ${f2(barLayout.astXprovided)} cm² ${barLayout.astXprovided >= dirX.AstReq - 1e-9 ? "≥" : "<"} ${f2(dirX.AstReq)} cm² necesarios`,
    );
    combo.push(
      `Dirección Y (caras sup./inf., largo ${Cx} cm): ${barLayout.nYadditionalPerFace + 2} Ø${dbLong} por cara (2 esquinas + ${barLayout.nYadditionalPerFace} intermedias) → A_st,y = ${f2(barLayout.astYprovided)} cm² ${barLayout.astYprovided >= dirY.AstReq - 1e-9 ? "≥" : "<"} ${f2(dirY.AstReq)} cm² necesarios`,
    );
    combo.push(
      `Total: ${barLayout.totalBars} Ø${dbLong} | Ast_total = ${f2(barLayout.astTotalProvided)} cm² | ρ = ${(rho_final * 100).toFixed(2)}%`,
    );
    if (!barLayout.found) {
      combo.push(
        "⚠ Ninguna combinación de barras verifica todo en esta sección: se muestra la más cercana. Aumentar la sección (o f'c).",
      );
    }
  }

  // ─── Combined stirrups ───
  combo.push("");
  combo.push("--- Estribos ---");

  const phiStirrup = dbLong <= 16 ? 6 : 8;
  combo.push(
    `φ_e ≥ ${phiStirrup} mm (φ_L = ${dbLong} ${dbLong <= 16 ? "≤ 16 mm" : "> 16 mm"})`,
  );

  const s1 = Math.min(Cx, Cy_cm);
  const s2 = 12 * (dbLong / 10);
  const s3 = 48 * (phiStirrup / 10);
  const sStirrup = Math.min(s1, s2, s3);
  combo.push(
    `Separación: s ≤ min(${s1}, ${f2(s2)}, ${f2(s3)}) = ${f2(sStirrup)} cm`,
  );

  combo.push("");
  combo.push("=============== RESUMEN FINAL ===============");
  combo.push(`Sección: ${Cx}×${Cy_cm} cm, A_g = ${Cx * Cy_cm} cm²`);
  combo.push(
    `Armadura: ${(rho_final * 100).toFixed(2)}% = ${f2(barLayout.astTotalProvided)} cm² (${barLayout.totalBars} Ø${dbLong})`,
  );
  combo.push(`Estribos: φ${phiStirrup} c/${f2(sStirrup)} cm`);
  combo.push("");
  if (biaxial) {
    combo.push(...biaxial.steps);
  } else {
    combo.push("--- Verificación biaxial (adicional) ---");
    combo.push(
      "No aplica: hay momento aplicado en una sola dirección (o en ninguna).",
    );
  }
  combo.push("");
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
    rhoMaxExceeded,
    dbLong,
    phiStirrup,
    sStirrup,
    lambdaOK,
    passes,
    biaxial,
    steps: combinedSteps,
    barLayout,
  };
}
