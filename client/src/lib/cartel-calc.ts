// CIRSOC 102 wind + CIRSOC 301 truss column design for billboard structures (Carteles publicitarios)

import { ANGLE_PROFILES, type AngleData } from "./angle-profiles";
import { designColumn, type ColumnCheck } from "./column-calc";
import { IPN_PROFILES } from "./profiles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const Ivals: Record<string, number> = {
  I: 0.87,
  II: 1.0,
  III: 1.15,
  IV: 1.15,
};

const expVals: Record<string, { alpha: number; zg: number }> = {
  A: { alpha: 5.0, zg: 457 },
  B: { alpha: 7.0, zg: 366 },
  C: { alpha: 9.5, zg: 274 },
  D: { alpha: 11.5, zg: 213 },
};

const Kd = 0.85;
const Kzt = 1.0;
const G = 0.85;
const Cp = 1.2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartelInput {
  anchoCartel: number; // m — sign width
  altoCartel: number; // m — sign height
  despegue: number; // m — clearance from ground to sign bottom
  sepColumnas: number; // m — spacing between columns
  sepCorreas: number; // m — vertical spacing between girts (correas)
  tipoColumna: number; // 1-4 column type
  tienePuntal: boolean;
  hPuntal: number; // m — vertical distance from sign bottom to brace anchor
  dPuntal: number; // m — horizontal distance from column to brace anchor
  velocidadViento: number; // m/s — basic wind speed
  categoria: string; // I, II, III, IV
  exposicion: string; // A, B, C, D
  hCol: number; // m — column section width (horizontal distance between chords)
  aCol: number; // m — panel height (vertical distance between nodes)
  perfilCordon: string; // angle profile name for chords
  perfilDiagonal: string; // angle profile name for diagonals
  perfilMontante: string; // angle profile name for verticals
  Fy: number; // MPa — steel yield strength
  perfilIPN?: string; // IPN profile name — Tipo 1 only
  separacionCol?: number; // m — section depth, Tipo 4 only
  KGlobal?: number; // effective length factor — Grupo 4 T2/T4 (default 1.0)
  cantColumnas?: number; // number of columns (front view)
  vueloLateral?: number; // lateral overhang (m)
  tipoPuntal: number; // 1-3 brace type
}

// ---------------------------------------------------------------------------
// Wind calculation result
// ---------------------------------------------------------------------------

export interface WindResult {
  I: number;
  Kz: number;
  qz: number; // N/m²
  p: number; // N/m² design pressure
  Fviento: number; // kN total wind force
  z: number; // mean height used (capped at 4.5 m min)
  areaCartel: number; // m²
  expAlpha: number;
  expZg: number;
  steps: string; // formatted step-by-step
}

// ---------------------------------------------------------------------------
// Column forces result
// ---------------------------------------------------------------------------

export interface ColumnForces {
  Fcol: number; // kN per column
  MmaxInf: number; // kN·m — max moment between A (base) and C (articulation)
  MmaxSup: number; // kN·m — max moment in cantilever above C
  Mmax: number; // kN·m — max(MmaxInf, MmaxSup) used for design
  Nchord: number; // kN chord axial force
  Ndiag: number; // kN diagonal axial force
  Nmont: number; // kN montante (vertical) axial force
}

export interface BraceForces {
  axilPuntal: number; // kN axial force in brace (compression +)
  alphaPuntal: number; // degrees
  lPuntal: number; // m length
  Rav: number; // kN — total downward on foundation at A (Rbv + Peso)
  Rah: number; // kN — horizontal on foundation at A, ← when Rbh > Fcol
  Rbv: number; // kN — ground pushes ↑ on strut at B
  Rbh: number; // kN — ground pushes ← on strut at B
}

// ---------------------------------------------------------------------------
// Angle verification
// ---------------------------------------------------------------------------

export interface AngleVerification {
  name: string;
  KLr: number;
  Fcr: number; // MPa
  phiPn: number; // kN
  force: number; // kN
  ratio: number;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Built-up section — CIRSOC 301 Grupo 4 Steiner properties
// ---------------------------------------------------------------------------

export interface BuiltUpSection {
  Ag_cm2: number; // Área total de la sección armada cm²
  Jx_cm4: number; // Inercia global x‑x cm⁴ (plano del cartel)
  Jy_cm4: number; // Inercia global y‑y cm⁴ (0 para T2)
  rx_cm: number; // Radio de giro x‑x cm
  ry_cm: number; // Radio de giro y‑y cm (0 para T2)
  hint_cm: number; // Altura interior efectiva entre centros de gravedad cm
}

// ---------------------------------------------------------------------------
// Global column check — CIRSOC 301 Grupo 4 macroscopic buckling
// ---------------------------------------------------------------------------

export interface GlobalColumnCheck {
  Ag_cm2: number; // Área total cm²
  rx_cm: number; // Radio de giro x‑x cm
  ry_cm: number; // Radio de giro y‑y cm
  lambda0: number; // Esbeltez global de la columna
  lambda1: number; // Esbeltez local del cordón
  lambdaM: number; // Esbeltez modificada λₘ
  lambdaC: number; // Esbeltez adimensional λc
  Fcr_MPa: number; // Tensión crítica MPa
  phiPn_kN: number; // Resistencia de diseño kN
  Pu_kN: number; // Axil aplicado kN
  ratio: number; // Pu / φPₙ
  passes: boolean; // ratio ≤ 1.0
}

// ---------------------------------------------------------------------------
// Brace check result
// ---------------------------------------------------------------------------

export interface BraceCheckResult {
  tipo: 1 | 2 | 3;
  chkAngle?: AngleVerification; // Type 1: single-angle check (Pu/2)
  chkAngle2?: AngleVerification; // Type 1: second angle (identical, for display)
  globalCheck?: GlobalColumnCheck; // Type 2 & 3: built-up buckling
  chkDiagonal?: AngleVerification; // Type 2: diagonal member
  chkMontant?: AngleVerification; // Type 3: montant member
  lateralBracing_cm?: number; // Type 2: required lateral spacing
  ratioBrace: number;
  passesBrace: boolean;
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

export interface CartelResult {
  nColumnas: number;
  nCorreas: number;
  alturaColumna: number; // m — total column height = despegue + altoCartel
  dDiag: number; // m — diagonal length
  nPaneles: number;
  longCordones: number; // m
  longMontantes: number; // m
  longDiagonales: number; // m
  longTotal: number; // m
  wind: WindResult;
  forces: ColumnForces;
  brace: BraceForces | null; // null if no brace
  chkCordon: AngleVerification | null;
  chkDiag: AngleVerification | null;
  chkMont: AngleVerification | null;
  ratioColumna: number;
  passes: boolean;
  steps: string; // complete step-by-step
  flexoResult?: ColumnCheck; // Tipo 1 only — from column-calc.ts
  globalCheck?: GlobalColumnCheck; // Grupo 4 only — populated for T2/T4
  braceCheck: BraceCheckResult | null; // brace verification when tienePuntal
}

// ===========================================================================
// 1. Wind calculation — CIRSOC 102
// ===========================================================================

export function calcWind(input: CartelInput): WindResult {
  const { velocidadViento, categoria, exposicion, anchoCartel, altoCartel, despegue } = input;
  const V = velocidadViento;

  const I = Ivals[categoria] ?? 1.0;
  const { alpha: expAlpha, zg: expZg } = expVals[exposicion] ?? expVals["B"];

  const zMean = despegue + altoCartel / 2;
  const zMin = 4.5;
  const z = Math.max(zMean, zMin);

  const Kz = 2.01 * Math.pow(z / expZg, 2 / expAlpha);
  const qz = 0.613 * Kz * Kzt * Kd * V * V * I;
  const p = qz * G * Cp;
  const areaCartel = anchoCartel * altoCartel;
  const Fviento = (p * areaCartel) / 1000; // kN

  const steps = [
    `--- Cálculo de viento (CIRSOC 102) ---`,
    ``,
    `1. Factor de importancia I:`,
    `   Categoría ${categoria} → I = ${I.toFixed(2)}`,
    ``,
    `2. Coeficiente de exposición K_z:`,
    `   Exposición ${exposicion}: α = ${expAlpha}, z_g = ${expZg} m`,
    `   z_mean = despegue + altoCartel/2 = ${despegue} + ${altoCartel}/2 = ${zMean.toFixed(2)} m`,
    `   z ≥ 4.5 m → z = ${z.toFixed(2)} m`,
    `   K_z = 2.01 · (z/z_g)^(2/α) = 2.01 · (${z.toFixed(2)}/${expZg})^(2/${expAlpha}) = ${Kz.toFixed(4)}`,
    ``,
    `3. Presión dinámica q_z:`,
    `   q_z = 0.613 · K_z · K_{zt} · K_d · V² · I`,
    `   q_z = 0.613 · ${Kz.toFixed(3)} · ${Kzt} · ${Kd} · ${V}² · ${I.toFixed(2)} = ${qz.toFixed(0)} N/m²`,
    `   (K_{zt} = 1.0 topografía plana, K_d = 0.85 direccionalidad)`,
    ``,
    `4. Presión de diseño p:`,
    `   p = q_z · G · C_p = ${qz.toFixed(0)} · ${G} · ${Cp} = ${p.toFixed(0)} N/m²`,
    `   (G = 0.85 factor de ráfaga, C_p = 1.2 cartel abierto)`,
    ``,
    `5. Fuerza total de viento:`,
    `   A_cartel = ancho · alto = ${anchoCartel.toFixed(2)} · ${altoCartel.toFixed(2)} = ${areaCartel.toFixed(2)} m²`,
    `   F_viento = p · A_cartel = ${p.toFixed(0)} · ${areaCartel.toFixed(2)} = ${(p * areaCartel).toFixed(0)} N`,
    `   F_viento = ${Fviento.toFixed(1)} kN`,
  ].join("\n");

  return { I, Kz, qz, p, Fviento, z, areaCartel, expAlpha, expZg, steps };
}

// ===========================================================================
// 2. Column and brace forces
// ===========================================================================

export function calcForces(
  input: CartelInput,
  wind: WindResult,
  _nColumnas: number,
  sepColumnas: number,
): { forces: ColumnForces; brace: BraceForces | null } {
  const { despegue, altoCartel, hCol, aCol, tienePuntal, hPuntal, dPuntal } = input;

  // F_col per column = design pressure × tributary width × sign height / 1000
  const Fcol = (wind.p * sepColumnas * altoCartel) / 1000; // kN
  const zMean = despegue + altoCartel / 2;
  const alturaColumna = despegue + altoCartel;

  // Self-weight per column
  const Peso = 0.3 * sepColumnas * altoCartel; // kN

  // Diagonal / montante forces (unchanged — diagonals take full shear)
  const dDiag = Math.sqrt(hCol * hCol + aCol * aCol);
  const sinAlphaCol = dDiag > 0 ? hCol / dDiag : 0;
  const Ndiag = sinAlphaCol > 0 ? Fcol / sinAlphaCol : 0;
  const Nmont = Fcol;

  // Distributed wind load for moment calculation
  const w = altoCartel > 0 ? Fcol / altoCartel : 0; // kN/m

  let MmaxSup: number;
  let MmaxInf: number;
  let Mmax: number;
  let Nchord: number;
  let brace: BraceForces | null = null;

  if (tienePuntal && hPuntal > 0 && dPuntal > 0) {
    // ===================================================================
    // Three-hinged arch reactions
    //   A = column base (0,0) pinned
    //   C = articulation at (0, hPuntal) — where strut connects
    //   B = strut base at (dPuntal, 0) pinned
    //   Wind pushes → with force Fcol at height zMean
    //
    // ΣM_A = 0: Fcol·zMean - Rbv·dPuntal = 0 → Rbv = Fcol·zMean/dPuntal (↑ at B)
    // ΣM_C (strut CB): Rbv·dPuntal - Rbh·hPuntal = 0 → Rbh = Fcol·zMean/hPuntal (← at B)
    // ΣFy: Rav = Rbv + Peso (↓ total on foundation at A)
    // ΣFx: Rah = Rbh - Fcol (← on foundation at A when Rbh > Fcol)
    // ===================================================================

    // Rbv: ground pushes UP on strut at B
    const Rbv = (Fcol * zMean) / dPuntal;
    // Rbh: ground pushes LEFT on strut at B
    const Rbh = (Fcol * zMean) / hPuntal;
    // Rav: total downward force on foundation at A (Rbv from arch + Peso)
    const Rav = Rbv + Peso;
    // Rah: horizontal force on foundation at A (← when Rbh > Fcol)
    const Rah = Math.abs(Rbh - Fcol);

    // Brace geometry
    const alphaRad = Math.atan(hPuntal / dPuntal);
    const alphaDeg = alphaRad * (180 / Math.PI);
    const lPuntal = Math.sqrt(hPuntal * hPuntal + dPuntal * dPuntal);

    // Axial force in brace: N = Rbh / cos(α)  (identical to previous formula, already correct)
    const axilPuntal = Math.cos(alphaRad) > 0 ? Rbh / Math.cos(alphaRad) : Rbh;

    // ===================================================================
    // Column moments — continuous beam analysis
    // ===================================================================

    // Rah (unsigned) used for moment calculation (already computed above)

    // M_sup: moment at C from wind above hPuntal (cantilever portion)
    if (hPuntal < despegue) {
      // Entire wind load is above hPuntal (typical case)
      MmaxSup = Fcol * (zMean - hPuntal);
    } else {
      // Wind also acts on the upper portion of the column
      const hAboveC = alturaColumna - hPuntal;
      MmaxSup = w * hAboveC * hAboveC / 2;
    }

    // M_inf: max moment between A (z=0) and C (z=hPuntal)
    if (hPuntal < despegue) {
      // No wind on A-C segment; moment varies linearly from 0 at A to M_sup at C
      MmaxInf = MmaxSup;
    } else {
      // Wind also acts below C on the A-C segment
      // Find zero-shear point: X = hPuntal - (Rbh - q·hVol) / q
      // where q = w, hVol = cantilever height = alturaColumna - hPuntal
      const hVol = alturaColumna - hPuntal;
      const Xzero = hPuntal - (Rbh - w * hVol) / w;
      const X = Math.max(despegue, Math.min(hPuntal, Xzero)); // clamp to [despegue, hPuntal]

      // Moment at zero-shear point
      const windArmX = Math.max(0, X - despegue);
      const Mx = Rah * X - w * windArmX * windArmX / 2;

      // Also check at C (upper boundary)
      const windArmC = Math.max(0, hPuntal - despegue);
      const MC = Rah * hPuntal - w * windArmC * windArmC / 2;

      MmaxInf = Math.max(Math.abs(Mx), Math.abs(MC));
    }

    Mmax = Math.max(Math.abs(MmaxInf), Math.abs(MmaxSup));
    Nchord = hCol > 0 ? Mmax / hCol : 0;

    brace = {
      axilPuntal,
      alphaPuntal: alphaDeg,
      lPuntal,
      Rav,
      Rah,
      Rbv,
      Rbh,
    };
  } else {
    // No brace — simple cantilever from base
    MmaxSup = Fcol * zMean;
    MmaxInf = 0;
    Mmax = Math.abs(MmaxSup);
    Nchord = hCol > 0 ? Mmax / hCol : 0;
    brace = null;
  }

  return {
    forces: { Fcol, MmaxInf, MmaxSup, Mmax, Nchord, Ndiag, Nmont },
    brace,
  };
}

// ===========================================================================
// 3. Angle compression verification — CIRSOC 301
// ===========================================================================

export function checkAngleCompForce(
  angle: AngleData,
  Fy: number,
  L_mm: number,
  K: number,
  force_kN: number,
): AngleVerification {
  const Ag = angle.A * 100; // mm²
  const r = angle.rz * 10; // mm
  const KLr = r > 0 ? (K * L_mm) / r : 999;
  const lambdaC = (KLr / Math.PI) * Math.sqrt(Fy / 200000);
  const Fcr =
    lambdaC <= 1.5
      ? Math.pow(0.658, lambdaC * lambdaC) * Fy
      : (0.877 / (lambdaC * lambdaC)) * Fy;
  const Pn = (Fcr * Ag) / 1000; // kN
  const phiPn = 0.85 * Pn;
  const ratio = phiPn > 0 ? force_kN / phiPn : 999;
  const ok = force_kN <= phiPn;

  return { name: angle.name, KLr, Fcr, phiPn, force: force_kN, ratio, ok };
}

// ===========================================================================
// 4. Built-up section properties — CIRSOC 301 Grupo 4 Steiner
// ===========================================================================

export function calcBuiltUpSectionProps(
  chord: AngleData,
  hCol_m: number,
  nChords: 2 | 4,
  separacionCol_m?: number,
): BuiltUpSection {
  if (hCol_m <= 0) {
    throw new Error("hCol must be > 0 for built-up section");
  }

  if (nChords === 2) {
    const hint_cm = hCol_m * 100 - 2 * chord.xg;
    if (hint_cm <= 0) {
      throw new Error(
        `hint must be > 0 (got ${hint_cm.toFixed(1)} cm). Check hCol and chord xg.`,
      );
    }
    const Jx_cm4 = 2 * (chord.Ix + chord.A * (hint_cm / 2) ** 2);
    const Jy_cm4 = 2 * chord.Ix;
    const Ag_cm2 = 2 * chord.A;
    const rx_cm = Math.sqrt(Jx_cm4 / Ag_cm2);
    const ry_cm = Math.sqrt(Jy_cm4 / Ag_cm2);
    return { Ag_cm2, Jx_cm4, Jy_cm4, rx_cm, ry_cm, hint_cm };
  }

  // nChords === 4
  if (separacionCol_m === undefined || separacionCol_m <= 0) {
    throw new Error(
      "separacionCol is required and must be > 0 for T4 columns",
    );
  }

  const hint_frente = hCol_m * 100 - 2 * chord.xg;
  const hint_costado = separacionCol_m * 100 - 2 * chord.xg;

  if (hint_frente <= 0) {
    throw new Error(
      `hint_frente must be > 0 (got ${hint_frente.toFixed(1)} cm)`,
    );
  }
  if (hint_costado <= 0) {
    throw new Error(
      `hint_costado must be > 0 (got ${hint_costado.toFixed(1)} cm)`,
    );
  }

  const Ix_global =
    2 * (chord.Ix + chord.A * (hint_frente / 2) ** 2);
  const Iy_global =
    2 * (chord.Ix + chord.A * (hint_costado / 2) ** 2);
  const Ag_cm2 = 4 * chord.A;
  const rx_cm = Math.sqrt(Ix_global / Ag_cm2);
  const ry_cm = Math.sqrt(Iy_global / Ag_cm2);

  return {
    Ag_cm2,
    Jx_cm4: Ix_global,
    Jy_cm4: Iy_global,
    rx_cm,
    ry_cm,
    hint_cm: hint_frente,
  };
}

// ===========================================================================
// 5. Modified slenderness — CIRSOC 301 Grupo 4
// ===========================================================================

export function calcModifiedSlenderness(
  K: number,
  L_m: number,
  rx_cm: number,
  aCol_m: number,
  rz_cm: number,
): { lambda0: number; lambda1: number; lambdaM: number } {
  if (rx_cm <= 0) {
    throw new Error("rx must be > 0 for slenderness calculation");
  }
  if (rz_cm <= 0) {
    throw new Error("rz must be > 0 for slenderness calculation");
  }

  const lambda0 = (K * L_m * 1000) / (rx_cm * 10);
  const lambda1 = (aCol_m * 1000) / (rz_cm * 10);
  const lambdaM = Math.sqrt(lambda0 ** 2 + lambda1 ** 2);

  return { lambda0, lambda1, lambdaM };
}

// ===========================================================================
// 6. P-Δ amplification — CIRSOC 301 Grupo 4
// ===========================================================================

export function calcPdeltaChordForce(
  Pu_kN: number,
  Pcm_kN: number,
  Mmax_kNm: number,
  nChords: number,
  hint_m: number,
  L_m: number,
): { Pu1_kN: number; MsL_kNm: number; e0_m: number } {
  const e0_m = L_m / 500;

  // Guard: Pu ≥ Pcm → MsL = Infinity (documented, no throw)
  const MsL_kNm =
    Pu_kN >= Pcm_kN
      ? Infinity
      : Mmax_kNm / (1 - Pu_kN / Pcm_kN);

  const M_e0_kNm = Pu_kN * e0_m;
  const M_total_kNm = MsL_kNm + M_e0_kNm;
  const Pu1_kN = Pu_kN / nChords + M_total_kNm / hint_m;

  return { Pu1_kN, MsL_kNm, e0_m };
}

// ===========================================================================
// 7. Beta coefficient — diagonal shear amplification
// ===========================================================================

export function calcBeta(Pu_kN: number, Pcm_kN: number): number {
  if (Pu_kN >= Pcm_kN) {
    return Infinity;
  }
  return Math.PI / 400 / (1 - Pu_kN / Pcm_kN);
}

// ===========================================================================
// 8. Global column check — CIRSOC 301 Grupo 4 macroscopic buckling
// ===========================================================================

export function checkGlobalColumn(
  builtUp: BuiltUpSection,
  K: number,
  L_m: number,
  Pu_kN: number,
  Fy_MPa: number,
): GlobalColumnCheck {
  const r_min = Math.min(builtUp.rx_cm, builtUp.ry_cm);
  const lambdaGlobal = (K * L_m * 1000) / (r_min * 10);
  const lambdaC =
    (lambdaGlobal / Math.PI) * Math.sqrt(Fy_MPa / 200000);

  const Fcr =
    lambdaC <= 1.5
      ? Math.pow(0.658, lambdaC * lambdaC) * Fy_MPa
      : (0.877 / (lambdaC * lambdaC)) * Fy_MPa;

  const phiPn = (0.85 * Fcr * builtUp.Ag_cm2 * 100) / 1000;
  const ratio = phiPn > 0 ? Pu_kN / phiPn : 999;
  const passes = ratio <= 1.0;

  return {
    Ag_cm2: builtUp.Ag_cm2,
    rx_cm: builtUp.rx_cm,
    ry_cm: builtUp.ry_cm,
    lambda0: lambdaGlobal,
    lambda1: 0,
    lambdaM: lambdaGlobal,
    lambdaC,
    Fcr_MPa: Fcr,
    phiPn_kN: phiPn,
    Pu_kN,
    ratio,
    passes,
  };
}

// ===========================================================================
// 9. Brace verification — CIRSOC 301 pure compression
// ===========================================================================

export function checkBrace(
  Pu_kN: number,
  tipo: number,
  Fy: number,
  L_puntal_m: number,
): BraceCheckResult {
  const L_mm = L_puntal_m * 1000;
  const E = 200000; // MPa

  if (tipo === 1) {
    // Type 1: Cruz — 2× L 2"×3/16" crossed angles, each takes Pu/2
    const ang1 = ANGLE_PROFILES.find((a) => a.name === 'L 2" x 3/16"');
    if (!ang1) throw new Error('Perfil L 2" x 3/16" no encontrado');

    const Pu_half = Pu_kN / 2;
    const chkAngle = checkAngleCompForce(ang1, Fy, L_mm, 1.0, Pu_half);
    const chkAngle2 = { ...chkAngle }; // identical second angle for display

    return {
      tipo: 1,
      chkAngle,
      chkAngle2,
      ratioBrace: chkAngle.ratio,
      passesBrace: chkAngle.ok,
    };
  }

  if (tipo === 2) {
    // Type 2: Plano 25 cm — flat lattice
    // Chords: L 1½"×1/8", hCol = 0.25 m, lattice spacing = 0.25 m
    const chordAngle = ANGLE_PROFILES.find((a) => a.name === 'L 1 1/2" x 1/8"');
    const diagAngle = ANGLE_PROFILES.find((a) => a.name === 'L 1" x 1/8"');
    if (!chordAngle) throw new Error('Perfil L 1 1/2" x 1/8" no encontrado');
    if (!diagAngle) throw new Error('Perfil L 1" x 1/8" no encontrado');

    const hColBrace = 0.25; // m
    const builtUp = calcBuiltUpSectionProps(chordAngle, hColBrace, 2);

    // Global column check
    const globalCheck = checkGlobalColumn(builtUp, 1.0, L_puntal_m, Pu_kN, Fy);

    // Diagonal check: d_diag = √(0.25² + 0.25²), takes shear from imperfections
    const d_diag_m = Math.sqrt(hColBrace * hColBrace + 0.25 * 0.25);
    const sinAlpha = hColBrace / d_diag_m;
    const V_kN = 0.02 * Pu_kN;
    const Nd_kN = sinAlpha > 0 ? V_kN / sinAlpha : V_kN;
    const chkDiagonal = checkAngleCompForce(diagAngle, Fy, d_diag_m * 1000, 1.0, Nd_kN);

    // Lateral bracing requirement via Euler: λ_lim = π·√(E/Fy), L_max = ry·λ_lim
    const lambdaLim = Math.PI * Math.sqrt(E / Fy);
    const L_max_cm = builtUp.ry_cm * lambdaLim; // K = 1.0

    const ratioBrace = Math.max(globalCheck.ratio, chkDiagonal.ratio);
    const passesBrace = globalCheck.passes && chkDiagonal.ok;

    return {
      tipo: 2,
      globalCheck,
      chkDiagonal,
      lateralBracing_cm: L_max_cm,
      ratioBrace,
      passesBrace,
    };
  }

  if (tipo === 3) {
    // Type 3: Cuadrado 20 cm — 4-chord box
    // Chords: L 1"×1/8", hCol = 0.20 m, depth = 0.20 m, montant spacing = 0.20 m
    const chordAngle = ANGLE_PROFILES.find((a) => a.name === 'L 1" x 1/8"');
    const montAngle = ANGLE_PROFILES.find((a) => a.name === 'L 1" x 1/8"');
    if (!chordAngle) throw new Error('Perfil L 1" x 1/8" no encontrado');
    if (!montAngle) throw new Error('Perfil L 1" x 1/8" no encontrado');

    const hColBrace = 0.20; // m
    const builtUp = calcBuiltUpSectionProps(chordAngle, hColBrace, 4, 0.20);

    // Global column check
    const globalCheck = checkGlobalColumn(builtUp, 1.0, L_puntal_m, Pu_kN, Fy);

    // Montant check: L_pandeo = 0.20 m, takes minimum shear
    const Nm_kN = 0.02 * Pu_kN;
    const chkMontant = checkAngleCompForce(montAngle, Fy, 200, 1.0, Nm_kN);

    const ratioBrace = Math.max(globalCheck.ratio, chkMontant.ratio);
    const passesBrace = globalCheck.passes && chkMontant.ok;

    return {
      tipo: 3,
      globalCheck,
      chkMontant,
      ratioBrace,
      passesBrace,
    };
  }

  throw new Error(`Tipo de puntal inválido: ${tipo}. Debe ser 1, 2 o 3.`);
}

export interface TrussVerification {
  chkCordon: AngleVerification | null;
  chkDiag: AngleVerification | null;
  chkMont: AngleVerification | null;
  ratioColumna: number;
}

export function checkTruss2Chords(
  perfilCordon: string,
  perfilDiagonal: string,
  perfilMontante: string,
  aCol: number,
  hCol: number,
  dDiag: number,
  Fy: number,
  forces: ColumnForces,
): TrussVerification {
  const angCordon = ANGLE_PROFILES.find((a) => a.name === perfilCordon) ?? null;
  const angDiag = ANGLE_PROFILES.find((a) => a.name === perfilDiagonal) ?? null;
  const angMont = ANGLE_PROFILES.find((a) => a.name === perfilMontante) ?? null;

  const chkCordon = angCordon
    ? checkAngleCompForce(angCordon, Fy, aCol * 1000, 1.0, forces.Nchord)
    : null;
  const chkDiag = angDiag
    ? checkAngleCompForce(angDiag, Fy, dDiag * 1000, 1.0, forces.Ndiag)
    : null;
  const chkMont = angMont
    ? checkAngleCompForce(angMont, Fy, hCol * 1000, 1.0, forces.Nmont)
    : null;

  const ratioColumna = Math.max(
    chkCordon?.ratio ?? 0,
    chkDiag?.ratio ?? 0,
    chkMont?.ratio ?? 0,
  );

  return { chkCordon, chkDiag, chkMont, ratioColumna };
}

// ===========================================================================
// 4.5 T4 — 4-chord box truss helper
// ===========================================================================

export interface Truss4Verification {
  plane1: TrussVerification;
  plane2: TrussVerification;
  ratioColumna: number;
}

export function checkTruss4Chords(
  perfilCordon: string,
  perfilDiagonal: string,
  perfilMontante: string,
  aCol: number,
  hCol: number,
  dDiag: number,
  Fy: number,
  forces: ColumnForces,
): Truss4Verification {
  const halfForces: ColumnForces = {
    Fcol: forces.Fcol / 2,
    MmaxInf: forces.MmaxInf / 2,
    MmaxSup: forces.MmaxSup / 2,
    Mmax: forces.Mmax / 2,
    Nchord: forces.Nchord / 2,
    Ndiag: forces.Ndiag / 2,
    Nmont: forces.Nmont / 2,
  };

  const plane1 = checkTruss2Chords(
    perfilCordon, perfilDiagonal, perfilMontante,
    aCol, hCol, dDiag, Fy, halfForces,
  );
  const plane2 = checkTruss2Chords(
    perfilCordon, perfilDiagonal, perfilMontante,
    aCol, hCol, dDiag, Fy, halfForces,
  );

  const ratioColumna = Math.max(plane1.ratioColumna, plane2.ratioColumna);

  return { plane1, plane2, ratioColumna };
}

export function calculateCartel(input: CartelInput): CartelResult {
  const {
    anchoCartel,
    altoCartel,
    despegue,
    sepColumnas,
    sepCorreas,
    tipoColumna,
    hCol,
    aCol,
    tienePuntal,
    hPuntal,
    dPuntal,
    perfilCordon,
    perfilDiagonal,
    perfilMontante,
    Fy,
    perfilIPN,
    separacionCol,
    tipoPuntal,
  } = input;

  // ---- Shared geometry ----
  const zMean = despegue + altoCartel / 2;
  const nColumnas =
    input.cantColumnas && input.cantColumnas > 0
      ? input.cantColumnas
      : sepColumnas > 0
        ? Math.round(anchoCartel / sepColumnas) + 1
        : 1;
  const nCorreas = sepCorreas > 0 ? Math.round(altoCartel / sepCorreas) + 1 : 1;
  const alturaColumna = despegue + altoCartel;
  const dDiag = Math.sqrt(hCol * hCol + aCol * aCol);
  const nPaneles = aCol > 0 ? Math.ceil(alturaColumna / aCol) : 1;

  // ---- Shared wind & forces ----
  const wind = calcWind(input);
  const { forces, brace } = calcForces(input, wind, nColumnas, sepColumnas);

  // --- Brace verification (independent from column) ---
  let braceCheck: BraceCheckResult | null = null;
  if (tienePuntal && brace) {
    braceCheck = checkBrace(brace.axilPuntal, tipoPuntal, Fy, brace.lPuntal);
  }

  // ---- Geometry & verification per type ----
  let longCordones: number;
  let longMontantes: number;
  let longDiagonales: number;
  let longTotal: number;
  let chkCordon: AngleVerification | null;
  let chkDiag: AngleVerification | null;
  let chkMont: AngleVerification | null;
  let ratioColumna: number;
  let passes: boolean;
  let flexoResult: ColumnCheck | undefined;

  // Grupo 4 pipeline results (populated for T2/T4, undefined for T1)
  let globalCheck: GlobalColumnCheck | undefined;
  let builtUp: BuiltUpSection | undefined;
  let slendResult: { lambda0: number; lambda1: number; lambdaM: number } | undefined;
  let pdeltaResult: { Pu1_kN: number; MsL_kNm: number; e0_m: number } | undefined;
  let betaValue: number | undefined;
  let pcmValue: number | undefined;
  let nudigValue: number | undefined;

  // For side-face diagonals in T4
  const dDiagSide = Math.sqrt((separacionCol ?? 0) * (separacionCol ?? 0) + aCol * aCol);

  if (tipoColumna === 1) {
    // --- T1: Simple IPN flexocompression ---
    longCordones = 0;
    longMontantes = 0;
    longDiagonales = 0;
    longTotal = 0;

    const ipn = IPN_PROFILES.find((p) => p.name === perfilIPN);
    if (!ipn) {
      throw new Error(`Perfil IPN "${perfilIPN}" no encontrado.`);
    }

    const L_mm = alturaColumna * 1000;
    const Lb_strong = tienePuntal ? hPuntal : 2.0 * alturaColumna;
    const Lb_weak = sepCorreas;
    const Kx = Lb_strong / alturaColumna;
    const Ky = Lb_weak / alturaColumna;

    flexoResult = designColumn(
      {
        Pu: 0,
        Mux: forces.Mmax,
        Muy: 0,
        Kx,
        Ky,
        L: L_mm,
        Fy,
      },
      ipn.A,
      ipn.Ix,
      ipn.Iy,
      ipn.Zx,
      ipn.Zy ?? 0,
      ipn.name,
      { section: "I", bf: ipn.b, tf: ipn.tf, h: ipn.h, tw: ipn.tw },
    );

    chkCordon = null;
    chkDiag = null;
    chkMont = null;
    ratioColumna = flexoResult.ratio;
    passes = flexoResult.passes;
  } else if (tipoColumna === 4) {
    // --- T4: 4-chord box truss (Grupo 4 pipeline) ---
    longCordones = 4 * alturaColumna;
    longMontantes = 2 * (nPaneles + 1) * (hCol + (separacionCol ?? 0));
    longDiagonales = 2 * nPaneles * (dDiag + dDiagSide);
    longTotal = longCordones + longMontantes + longDiagonales;

    const angCordon4 = ANGLE_PROFILES.find((a) => a.name === perfilCordon);
    if (!angCordon4) {
      throw new Error(`Perfil "${perfilCordon}" no encontrado`);
    }

    const K = input.KGlobal ?? 1.0;
    const Peso = 0.3 * sepColumnas * altoCartel;

    builtUp = calcBuiltUpSectionProps(angCordon4, hCol, 4, separacionCol);
    slendResult = calcModifiedSlenderness(
      K, alturaColumna, builtUp.rx_cm, aCol, angCordon4.rz,
    );

    pcmValue =
      (Math.PI ** 2 * 200000 * builtUp.Ag_cm2 * 100) /
      slendResult.lambda0 ** 2;

    pdeltaResult = calcPdeltaChordForce(
      Peso, pcmValue, forces.Mmax, 4,
      builtUp.hint_cm / 100, alturaColumna,
    );

    chkCordon = checkAngleCompForce(
      angCordon4, Fy, aCol * 1000, 1.0, pdeltaResult.Pu1_kN,
    );

    betaValue = calcBeta(Peso, pcmValue);
    const Veu4 = betaValue * forces.Fcol;
    const sinA4 = dDiag > 0 ? hCol / dDiag : 0;
    nudigValue = sinA4 > 0 ? Veu4 / sinA4 : Veu4;

    const angDiag4 = ANGLE_PROFILES.find((a) => a.name === perfilDiagonal) ?? null;
    chkDiag = angDiag4
      ? checkAngleCompForce(angDiag4, Fy, dDiag * 1000, 1.0, nudigValue)
      : null;

    const angMont4 = ANGLE_PROFILES.find((a) => a.name === perfilMontante) ?? null;
    chkMont = angMont4
      ? checkAngleCompForce(angMont4, Fy, hCol * 1000, 1.0, forces.Nmont)
      : null;

    globalCheck = checkGlobalColumn(builtUp, K, alturaColumna, Peso, Fy);

    ratioColumna = Math.max(
      chkCordon?.ratio ?? 0,
      chkDiag?.ratio ?? 0,
      chkMont?.ratio ?? 0,
      globalCheck.ratio,
    );
    passes = ratioColumna <= 1.0;
    flexoResult = undefined;
  } else {
    // --- T2: 2-chord truss (Grupo 4 pipeline) ---
    longCordones = 2 * alturaColumna;
    longMontantes = (nPaneles + 1) * hCol;
    longDiagonales = nPaneles * dDiag;
    longTotal = longCordones + longMontantes + longDiagonales;

    const angCordon2 = ANGLE_PROFILES.find((a) => a.name === perfilCordon);
    if (!angCordon2) {
      throw new Error(`Perfil "${perfilCordon}" no encontrado`);
    }

    const K = input.KGlobal ?? 1.0;
    const Peso = 0.3 * sepColumnas * altoCartel;

    builtUp = calcBuiltUpSectionProps(angCordon2, hCol, 2);
    slendResult = calcModifiedSlenderness(
      K, alturaColumna, builtUp.rx_cm, aCol, angCordon2.rz,
    );

    pcmValue =
      (Math.PI ** 2 * 200000 * builtUp.Ag_cm2 * 100) /
      slendResult.lambda0 ** 2;

    pdeltaResult = calcPdeltaChordForce(
      Peso, pcmValue, forces.Mmax, 2,
      builtUp.hint_cm / 100, alturaColumna,
    );

    chkCordon = checkAngleCompForce(
      angCordon2, Fy, aCol * 1000, 1.0, pdeltaResult.Pu1_kN,
    );

    betaValue = calcBeta(Peso, pcmValue);
    const Veu2 = betaValue * forces.Fcol;
    const sinA2 = dDiag > 0 ? hCol / dDiag : 0;
    nudigValue = sinA2 > 0 ? Veu2 / sinA2 : Veu2;

    const angDiag2 = ANGLE_PROFILES.find((a) => a.name === perfilDiagonal) ?? null;
    chkDiag = angDiag2
      ? checkAngleCompForce(angDiag2, Fy, dDiag * 1000, 1.0, nudigValue)
      : null;

    const angMont2 = ANGLE_PROFILES.find((a) => a.name === perfilMontante) ?? null;
    chkMont = angMont2
      ? checkAngleCompForce(angMont2, Fy, hCol * 1000, 1.0, forces.Nmont)
      : null;

    globalCheck = checkGlobalColumn(builtUp, K, alturaColumna, Peso, Fy);

    ratioColumna = Math.max(
      chkCordon?.ratio ?? 0,
      chkDiag?.ratio ?? 0,
      chkMont?.ratio ?? 0,
      globalCheck.ratio,
    );
    passes = ratioColumna <= 1.0;
    flexoResult = undefined;
  }

  // ---- Profile lookup (for T2/T4 steps display) ----
  const angCordon = ANGLE_PROFILES.find((a) => a.name === perfilCordon) ?? null;
  const angDiag = ANGLE_PROFILES.find((a) => a.name === perfilDiagonal) ?? null;
  const angMont = ANGLE_PROFILES.find((a) => a.name === perfilMontante) ?? null;

  // ---- Steps ----
  const sinAlphaCol = dDiag > 0 ? hCol / dDiag : 0;

  const steps = [
    wind.steps,
    ``,
    `--- Geometría de la estructura ---`,
    ``,
    `Altura total columna: h_total = despegue + altoCartel = ${despegue} + ${altoCartel} = ${alturaColumna.toFixed(2)} m`,
    `Columnas: n = ${input.cantColumnas && input.cantColumnas > 0 ? input.cantColumnas : `anchoCartel / sepColumnas + 1 = ${anchoCartel} / ${sepColumnas} + 1 = ${nColumnas}`}`,
    `Correas: n = altoCartel / sepCorreas + 1 = ${altoCartel} / ${sepCorreas} + 1 = ${nCorreas}`,
    `Tipo de columna: ${tipoColumna === 1 ? "1 — Simple IPN" : tipoColumna === 4 ? "4 — Celosía completa" : "2 — Celosía"}`,
    ``,
  ];

  if (tipoColumna === 1) {
    // T1: IPN geometry steps
    const ipnSteps = IPN_PROFILES.find((p) => p.name === perfilIPN);
    steps.push(
      `--- Columna Simple IPN ---`,
      `Perfil: ${perfilIPN} (A=${ipnSteps?.A ?? "?"} cm², Ix=${ipnSteps?.Ix ?? "?"} cm⁴, Iy=${ipnSteps?.Iy ?? "?"} cm⁴)`,
      `Longitud de pandeo fuerte (x-x): L_b = ${tienePuntal ? hPuntal : (2 * alturaColumna).toFixed(2)} m ${tienePuntal ? "(con puntal)" : "(K=2.0 voladizo)"}`,
      `Longitud de pandeo débil (y-y): L_b = ${sepCorreas} m (sep. correas)`,
      ``,
    );
  } else {
    // T2/T4: truss geometry steps
    const trussTitle = tipoColumna === 4 ? "Celosía completa (4 cordones)" : "Reticulado de columna";
    steps.push(
      `--- ${trussTitle} ---`,
      `h_col = ${hCol} m (ancho sección), a_col = ${aCol} m (alto panel)`,
    );
    if (tipoColumna === 4) {
      steps.push(
        `separacion_col = ${separacionCol} m (profundidad sección)`,
        `d_diag (frente) = √(h_col² + a_col²) = √(${hCol}² + ${aCol}²) = ${dDiag.toFixed(2)} m`,
        `d_diag (costado) = √(separacion² + a_col²) = √(${separacionCol}² + ${aCol}²) = ${dDiagSide.toFixed(2)} m`,
      );
    } else {
      steps.push(
        `d_diag = √(h_col² + a_col²) = √(${hCol}² + ${aCol}²) = ${dDiag.toFixed(2)} m`,
      );
    }
    steps.push(
      `Número de paneles: n = ⌈alturaColumna / a_col⌉ = ⌈${alturaColumna.toFixed(2)} / ${aCol}⌉ = ${nPaneles}`,
      `Longitud cordones: ${tipoColumna === 4 ? "4" : "2"} × ${alturaColumna.toFixed(2)} = ${longCordones.toFixed(1)} m`,
      `Longitud montantes: ${tipoColumna === 4 ? "2 faces ×" : ""} (${nPaneles}+1) × ${hCol}${tipoColumna === 4 ? ` + 2 faces × (${nPaneles}+1) × ${separacionCol}` : ""} = ${longMontantes.toFixed(1)} m`,
      `Longitud diagonales: ${tipoColumna === 4 ? `2 × ${nPaneles} × (${dDiag.toFixed(2)} + ${dDiagSide.toFixed(2)})` : `${nPaneles} × ${dDiag.toFixed(2)}`} = ${longDiagonales.toFixed(1)} m`,
      `Longitud total por columna: ${longTotal.toFixed(1)} m`,
      ``,
    );
  }

  steps.push(
    `--- Solicitaciones en la columna ---`,
    ``,
    `F_viento total = ${wind.Fviento.toFixed(1)} kN (presión p × ancho total × alto)`,
    `Columnas = ${nColumnas}`,
    `F_col = p · sep_columnas · alto_cartel = ${wind.p.toFixed(0)} · ${sepColumnas} · ${altoCartel} = ${(wind.p * sepColumnas * altoCartel).toFixed(0)} N → ${forces.Fcol.toFixed(2)} kN (por ancho tributario)`,
    `Peso propio: 0.3 kN/m² · sep · h_cartel = 0.3 · ${sepColumnas.toFixed(2)} · ${altoCartel.toFixed(2)} = ${(0.3 * sepColumnas * altoCartel).toFixed(2)} kN por columna`,
    ``,
    `Altura media: z_mean = despegue + altoCartel/2 = ${despegue} + ${altoCartel}/2 = ${zMean.toFixed(2)} m`,
    `Carga distribuida: w = F_col / alto_cartel = ${forces.Fcol.toFixed(2)} / ${altoCartel} = ${(forces.Fcol / altoCartel).toFixed(3)} kN/m`,
    ``,
  );

  if (tienePuntal && brace) {
    const w = altoCartel > 0 ? forces.Fcol / altoCartel : 0;
    // signed value for display; actual moment calc uses |Rah| (brace.Rah)
    const HA_signed = brace.Rbh - forces.Fcol;

    steps.push(
      `--- Puntal de arriostramiento ---`,
      ``,
      `α_puntal = atan(hPuntal / dPuntal) = atan(${hPuntal} / ${dPuntal}) = ${brace.alphaPuntal.toFixed(2)}°`,
      `L_puntal = √(hPuntal² + dPuntal²) = √(${hPuntal}² + ${dPuntal}²) = ${brace.lPuntal.toFixed(2)} m`,
      ``,
      `Reacciones (arco triarticulado):`,
      `ΣM_A = 0: R_bv = F_col · z_mean / d_puntal = ${forces.Fcol.toFixed(2)} · ${zMean.toFixed(2)} / ${dPuntal} = ${brace.Rbv.toFixed(2)} kN (↑ en B)`,
      `ΣM_C = 0: R_bh = F_col · z_mean / h_puntal = ${forces.Fcol.toFixed(2)} · ${zMean.toFixed(2)} / ${hPuntal} = ${brace.Rbh.toFixed(2)} kN (← en B)`,
      `ΣF_y: R_av = R_bv + Peso = ${brace.Rbv.toFixed(2)} + ${(0.3 * sepColumnas * altoCartel).toFixed(2)} = ${brace.Rav.toFixed(2)} kN (↓ sobre fundación A)`,
      `ΣF_x: R_ah = R_bh − F_col = ${brace.Rbh.toFixed(2)} − ${forces.Fcol.toFixed(2)} = ${brace.Rah.toFixed(2)} kN (← sobre fundación A)`,
      `N_puntal = R_bh / cos(α) = ${brace.Rbh.toFixed(2)} / cos(${brace.alphaPuntal.toFixed(2)}°) = ${brace.axilPuntal.toFixed(1)} kN (compresión)`,
      ``,
    );

    // ---- Brace verification (dimensionado del puntal) ----
    if (braceCheck) {
      const BRACE_TYPE_NAMES: Record<number, string> = {
        1: "Cruz — 2× L 2″×3/16″",
        2: "Plano 25 cm — L 1½″×1/8″ cordones con L 1″×1/8″ diagonales @25 cm",
        3: "Cuadrado 20 cm — 4× L 1″×1/8″ cordones con montantes @20 cm",
      };

      steps.push(
        `--- Verificación del puntal — Tipo ${tipoPuntal} ---`,
        ``,
        `${BRACE_TYPE_NAMES[tipoPuntal] ?? `Tipo ${tipoPuntal}`}`,
        ``,
      );

      if (braceCheck.chkAngle) {
        const lc = (braceCheck.chkAngle.KLr / Math.PI) * Math.sqrt(Fy / 200000);
        steps.push(
          `Ángulo L 2″×3/16″: A=4.65 cm², r_z=1.01 cm, L_pandeo=L_puntal=${brace.lPuntal.toFixed(2)} m`,
          `  Carga por ángulo: Pu/2 = ${(brace.axilPuntal / 2).toFixed(2)} kN`,
          `  KL/r = 1.0·${(brace.lPuntal * 1000).toFixed(0)} / ${(1.01 * 10).toFixed(0)} = ${braceCheck.chkAngle.KLr.toFixed(0)}, λ_c = ${lc.toFixed(3)}`,
          `  F_cr = ${braceCheck.chkAngle.Fcr.toFixed(0)} MPa, φ·P_n = ${braceCheck.chkAngle.phiPn.toFixed(1)} kN`,
          `  Ratio = ${braceCheck.chkAngle.force.toFixed(2)} / ${braceCheck.chkAngle.phiPn.toFixed(1)} = ${braceCheck.chkAngle.ratio.toFixed(2)} ${braceCheck.chkAngle.ok ? "✓" : "✗"}`,
          ``,
        );
      }

      if (braceCheck.globalCheck) {
        steps.push(
          `Verificación global del conjunto (φ_c = 0.85):`,
          `  λ_global = ${braceCheck.globalCheck.lambda0.toFixed(1)}, λ_c = ${braceCheck.globalCheck.lambdaC.toFixed(3)}`,
          `  F_cr = ${braceCheck.globalCheck.Fcr_MPa.toFixed(0)} MPa, φ·P_n = ${braceCheck.globalCheck.phiPn_kN.toFixed(1)} kN`,
          `  Ratio = ${braceCheck.globalCheck.ratio.toFixed(2)} ${braceCheck.globalCheck.passes ? "✓" : "✗"}`,
          ``,
        );
      }

      if (braceCheck.chkDiagonal) {
        steps.push(
          `Diagonal L 1″×1/8″: A=1.54 cm², r_z=0.50 cm, L_pandeo=√(0.25²+0.25²)=0.354 m`,
          `  KL/r = 1.0·354 / 5 = ${braceCheck.chkDiagonal.KLr.toFixed(0)}`,
          `  F_cr = ${braceCheck.chkDiagonal.Fcr.toFixed(0)} MPa, φ·P_n = ${braceCheck.chkDiagonal.phiPn.toFixed(2)} kN`,
          `  N_diag = ${braceCheck.chkDiagonal.force.toFixed(2)} kN (V=2%·Pu / sin α)`,
          `  Ratio = ${braceCheck.chkDiagonal.ratio.toFixed(2)} ${braceCheck.chkDiagonal.ok ? "✓" : "✗"}`,
          ``,
        );
      }

      if (braceCheck.chkMontant) {
        steps.push(
          `Montante L 1″×1/8″: A=1.54 cm², r_z=0.50 cm, L_pandeo=0.20 m`,
          `  KL/r = 1.0·200 / 5 = ${braceCheck.chkMontant.KLr.toFixed(0)}`,
          `  F_cr = ${braceCheck.chkMontant.Fcr.toFixed(0)} MPa, φ·P_n = ${braceCheck.chkMontant.phiPn.toFixed(2)} kN`,
          `  N_mont = ${braceCheck.chkMontant.force.toFixed(2)} kN (V=2%·Pu)`,
          `  Ratio = ${braceCheck.chkMontant.ratio.toFixed(2)} ${braceCheck.chkMontant.ok ? "✓" : "✗"}`,
          ``,
        );
      }

      if (braceCheck.lateralBracing_cm !== undefined) {
        steps.push(
          `Arriostramiento lateral requerido:`,
          `  λ_lim = π·√(E/Fy) = π·√(200000/${Fy}) = ${(
            Math.PI *
            Math.sqrt(200000 / Fy)
          ).toFixed(1)}`,
          `  L_max = ry · λ_lim = ${calcBuiltUpSectionProps(ANGLE_PROFILES.find((a) => a.name === 'L 1 1/2" x 1/8"')!, 0.25, 2).ry_cm.toFixed(2)} · ${(
            Math.PI *
            Math.sqrt(200000 / Fy)
          ).toFixed(1)} = ${braceCheck.lateralBracing_cm.toFixed(1)} cm`,
          `  → Arriostramiento lateral requerido cada ${braceCheck.lateralBracing_cm.toFixed(0)} cm`,
          ``,
        );
      }

      steps.push(
        `--- Resultado del puntal ---`,
        `Ratio = ${braceCheck.ratioBrace.toFixed(2)} ${braceCheck.passesBrace ? "✓ Verifica" : "✗ No verifica"}`,
        ``,
      );
    }

    // ---- Detailed moment calculation ----
    steps.push(`--- Momentos en la columna ---`, ``);

    // a) Cantilever above C
    steps.push(`a) Voladizo sobre C (z > ${hPuntal} m):`);
    if (hPuntal < despegue) {
      steps.push(
        `   Toda la carga de viento actúa por encima de C.`,
        `   M_sup = F_col · (z_mean − hPuntal)`,
        `   M_sup = ${forces.Fcol.toFixed(2)} · (${zMean.toFixed(2)} − ${hPuntal}) = ${forces.MmaxSup.toFixed(2)} kN·m`,
      );
    } else {
      const hAboveC = alturaColumna - hPuntal;
      steps.push(
        `   h_sobre_C = altura_columna − hPuntal = ${alturaColumna.toFixed(2)} − ${hPuntal} = ${hAboveC.toFixed(2)} m`,
        `   M_sup = w · h_sobre_C² / 2`,
        `   M_sup = ${w.toFixed(3)} · ${hAboveC.toFixed(2)}² / 2 = ${forces.MmaxSup.toFixed(2)} kN·m`,
      );
    }
    steps.push(``);

    // b) Segment A-C
    steps.push(`b) Tramo entre A (z=0) y C (z=${hPuntal} m):`);
    if (hPuntal < despegue) {
      steps.push(
        `   Sin carga de viento en este tramo.`,
        `   H_A = R_bh − F_col = ${brace.Rbh.toFixed(2)} − ${forces.Fcol.toFixed(2)} = ${HA_signed.toFixed(2)} kN`,
        `   M(z) = |R_ah| · z  →  variación lineal de 0 en A a M_sup en C.`,
        `   M_inf_max = |M(z=${hPuntal})| = ${forces.MmaxInf.toFixed(2)} kN·m`,
      );
    } else {
      const hVol = alturaColumna - hPuntal;
      const Xzero = hPuntal - (brace.Rbh - w * hVol) / w;
      const X = Math.max(despegue, Math.min(hPuntal, Xzero));
      const windArmX = Math.max(0, X - despegue);
      const Mx = brace.Rah * X - w * windArmX * windArmX / 2;

      const windArmC = Math.max(0, hPuntal - despegue);
      const MC = brace.Rah * hPuntal - w * windArmC * windArmC / 2;

      steps.push(
        `   Viento también actúa bajo C. Carga distribuida q = ${w.toFixed(3)} kN/m`,
        `   h_voladizo = altura_columna − hPuntal = ${alturaColumna.toFixed(2)} − ${hPuntal} = ${hVol.toFixed(2)} m`,
        ``,
        `   Punto de corte nulo (máximo momento):`,
        `   X = hPuntal − (R_bh − q · h_voladizo) / q`,
        `   X = ${hPuntal} − (${brace.Rbh.toFixed(2)} − ${w.toFixed(3)} · ${hVol.toFixed(2)}) / ${w.toFixed(3)}`,
        `   X = ${Xzero.toFixed(2)} m  →  acotado a [${despegue}, ${hPuntal}]: X = ${X.toFixed(2)} m`,
        ``,
        `   M(X) = R_ah · X − q · (X − despegue)² / 2`,
        `   M(X) = ${brace.Rah.toFixed(2)} · ${X.toFixed(2)} − ${w.toFixed(3)} · (${X.toFixed(2)} − ${despegue})² / 2`,
        `   M(X) = ${Mx.toFixed(2)} kN·m`,
        ``,
        `   En el extremo C (z = ${hPuntal} m):`,
        `   M_C = R_ah · hPuntal − q · (hPuntal − despegue)² / 2`,
        `   M_C = ${brace.Rah.toFixed(2)} · ${hPuntal} − ${w.toFixed(3)} · ${windArmC.toFixed(2)}² / 2 = ${MC.toFixed(2)} kN·m`,
        ``,
        `   M_inf_max = max(|M_X|, |M_C|) = ${forces.MmaxInf.toFixed(2)} kN·m`,
      );
    }
    steps.push(``);

    // c) Design moment
    steps.push(
      `c) M_máx = max(|M_sup|, |M_inf_max|) = max(${Math.abs(forces.MmaxSup).toFixed(2)}, ${Math.abs(forces.MmaxInf).toFixed(2)}) = ${forces.Mmax.toFixed(2)} kN·m`,
      `   (mayor valor absoluto, usado para dimensionado)`,
      ``,
    );
  } else {
    steps.push(
      `--- Momento en la columna ---`,
      ``,
      `Sin puntal — voladizo desde base:`,
      `M_máx = F_col · z_mean = ${forces.Fcol.toFixed(2)} · ${zMean.toFixed(2)} = ${forces.Mmax.toFixed(2)} kN·m`,
      ``,
    );
  }

  if (tipoColumna !== 1) {
    steps.push(
      `Fuerza en cordón: N = M_max / h_col = ${forces.Mmax.toFixed(1)} / ${hCol} = ${forces.Nchord.toFixed(1)} kN`,
      `  (compresión en un cordón, tracción en el otro)`,
      ``,
      `sin α = h_col / d_diag = ${hCol} / ${dDiag.toFixed(2)} = ${sinAlphaCol.toFixed(4)}`,
      `Fuerza en diagonal: N = F_col / sin α = ${forces.Fcol.toFixed(2)} / ${sinAlphaCol.toFixed(4)} = ${forces.Ndiag.toFixed(1)} kN`,
      ``,
      `Fuerza en montante: N ≈ F_col = ${forces.Nmont.toFixed(1)} kN (simplificado)`,
      ``,
    );
  }

  if (!tienePuntal) {
    steps.push(
      tipoColumna === 1
        ? `--- Modelo (sin puntal) ---`
        : `--- Modelo en voladizo (sin puntal) ---`,
      ``,
      tipoColumna === 1
        ? `Columna IPN empotrada en base. Toda la carga horizontal y momento son resistidos por la sección.`
        : `La columna trabaja como voladizo empotrado en la base.`,
      `Toda la carga horizontal es resistida por ${tipoColumna === 1 ? "el perfil" : "el reticulado de la columna"}.`,
      ``,
    );
  }

  if (tipoColumna === 1 && flexoResult) {
    steps.push(
      `--- Verificación flexocompresión (CIRSOC 301, φ_c = 0.85, φ_b = 0.90) ---`,
      ``,
      ...flexoResult.steps,
      ``,
      `--- Resultado ---`,
      `Ratio = ${flexoResult.ratio.toFixed(3)} ${flexoResult.passes ? "✓ Verifica" : "✗ No verifica"}`,
      `Estado límite: ${flexoResult.limitState}`,
    );
  } else {
    // T2 / T4 — Grupo 4 verification steps
    const chord = angCordon!;
    const diag = angDiag;
    const mont = angMont;
    const K = input.KGlobal ?? 1.0;
    const Peso = 0.3 * sepColumnas * altoCartel;

    // ---- Sección armada ----
    steps.push(
      `--- Sección armada (CIRSOC 301 Grupo 4) ---`,
      ``,
      `Perfil cordón: ${chord.name} (A=${chord.A}cm², Ix=${chord.Ix}cm⁴, rx=${chord.rx}cm, rz=${chord.rz}cm, xg=${chord.xg}cm)`,
    );

    if (builtUp) {
      steps.push(
        `h_int = hCol·100 − 2·xg = ${hCol}·100 − 2·${chord.xg} = ${builtUp.hint_cm.toFixed(
          1,
        )} cm`,
        `A_total = ${builtUp.Ag_cm2.toFixed(1)} cm²`,
        `J_x = ${builtUp.Jx_cm4.toFixed(0)} cm⁴, r_x = ${builtUp.rx_cm.toFixed(2)} cm`,
      );
      if (tipoColumna === 4) {
        steps.push(
          `J_y = ${builtUp.Jy_cm4.toFixed(0)} cm⁴, r_y = ${builtUp.ry_cm.toFixed(2)} cm`,
        );
      }
      steps.push(``);
    }

    // ---- Esbeltez modificada ----
    if (slendResult) {
      steps.push(
        `--- Esbeltez modificada ---`,
        ``,
        `K = ${K}`,
        `λ₀ = K·L/r_x = ${K}·${alturaColumna.toFixed(
          2,
        )}/${builtUp!.rx_cm.toFixed(2)} = ${slendResult.lambda0.toFixed(2)}`,
        `λ₁ = a_col/r_z = ${aCol}/${
          chord.rz
        } = ${slendResult.lambda1.toFixed(2)}`,
        `λ_m = √(λ₀² + λ₁²) = ${slendResult.lambdaM.toFixed(2)}`,
        ``,
      );
    }

    // ---- Efectos de 2° orden (P-Δ) ----
    if (pdeltaResult && pcmValue !== undefined) {
      const Me0_kNm = Peso * pdeltaResult.e0_m;
      const Mtotal_kNm =
        pdeltaResult.MsL_kNm === Infinity
          ? Infinity
          : pdeltaResult.MsL_kNm + Me0_kNm;
      steps.push(
        `--- Efectos de 2° orden (P-Δ) ---`,
        ``,
        `P_cm = π²·E·A_total / λ₀² = ${pcmValue.toFixed(1)} kN`,
        `e₀ = L/500 = ${alturaColumna.toFixed(2)}/500 = ${pdeltaResult.e0_m.toFixed(
          4,
        )} m`,
        `M_sL = M_max / (1 − Pu/P_cm) = ${forces.Mmax.toFixed(
          2,
        )} / (1 − ${Peso.toFixed(2)}/${pcmValue.toFixed(1)}) = ${
          pdeltaResult.MsL_kNm === Infinity
            ? "∞"
            : pdeltaResult.MsL_kNm.toFixed(2)
        } kN·m`,
        `M_e0 = Pu·e₀ = ${Peso.toFixed(
          2,
        )}·${pdeltaResult.e0_m.toFixed(4)} = ${Me0_kNm.toFixed(2)} kN·m`,
        `M_total = ${Mtotal_kNm === Infinity ? "∞" : Mtotal_kNm.toFixed(2)} kN·m`,
        `P_u1 = Pu/${
          tipoColumna === 4 ? "4" : "2"
        } + M_total/h_int = ${pdeltaResult.Pu1_kN.toFixed(2)} kN (por cordón)`,
        ``,
      );
    }

    // ---- Verificación cordón ----
    steps.push(
      `--- Verificación cordón (CIRSOC 301, φ_c = 0.85) ---`,
      ``,
    );
    if (chkCordon) {
      const lc = (chkCordon.KLr / Math.PI) * Math.sqrt(Fy / 200000);
      steps.push(
        `Cordón ${perfilCordon}: A=${chord.A}cm², r_z=${chord.rz}cm, L_pandeo = a_col = ${aCol} m`,
        `  KL/r = 1.0·${(aCol * 1000).toFixed(0)} / ${(chord.rz * 10).toFixed(
          0,
        )} = ${chkCordon.KLr.toFixed(0)}, λ_c = ${lc.toFixed(3)}`,
        `  F_cr = ${chkCordon.Fcr.toFixed(0)} MPa, φ·P_n = ${chkCordon.phiPn.toFixed(
          1,
        )} kN`,
        `  Ratio = ${chkCordon.force.toFixed(2)} / ${chkCordon.phiPn.toFixed(
          1,
        )} = ${chkCordon.ratio.toFixed(2)} ${chkCordon.ok ? "✓" : "✗"}`,
        ``,
      );
    } else {
      steps.push(
        `Cordón ${perfilCordon}: no encontrado en la tabla de perfiles.`,
        ``,
      );
    }

    // ---- Verificación diagonal ----
    if (betaValue !== undefined && nudigValue !== undefined) {
      steps.push(
        `--- Verificación diagonal ---`,
        ``,
        `β = (π/400)/(1−Pu/P_cm) = ${betaValue === Infinity ? "∞" : betaValue.toFixed(6)}`,
      );
      const VeuVal =
        betaValue === Infinity ? Infinity : betaValue * forces.Fcol;
      steps.push(
        `V_eu = β·F_col = ${VeuVal === Infinity ? "∞" : VeuVal.toFixed(2)} kN`,
        `N_u_dig = V_eu/sinα = ${nudigValue.toFixed(2)} kN`,
        ``,
      );
    }

    if (chkDiag) {
      steps.push(
        `Diagonal ${perfilDiagonal}: A=${diag?.A}cm², r_z=${diag?.rz}cm, L_pandeo = d_diag = ${dDiag.toFixed(
          2,
        )} m`,
        `  KL/r = 1.0·${(dDiag * 1000).toFixed(0)} / ${(
          (diag?.rz ?? 0) * 10
        ).toFixed(0)} = ${chkDiag.KLr.toFixed(0)}`,
        `  F_cr = ${chkDiag.Fcr.toFixed(0)} MPa, φ·P_n = ${chkDiag.phiPn.toFixed(
          1,
        )} kN`,
        `  Ratio = ${chkDiag.force.toFixed(2)} / ${chkDiag.phiPn.toFixed(
          1,
        )} = ${chkDiag.ratio.toFixed(2)} ${chkDiag.ok ? "✓" : "✗"}`,
        ``,
      );
    } else {
      steps.push(
        `Diagonal ${perfilDiagonal}: no encontrado en la tabla de perfiles.`,
        ``,
      );
    }

    // ---- Verificación montante ----
    if (chkMont) {
      steps.push(
        `--- Verificación montante (φ_c = 0.85) ---`,
        ``,
        `Montante ${perfilMontante}: A=${mont?.A}cm², r_z=${mont?.rz}cm, L_pandeo = h_col = ${hCol} m`,
        `  KL/r = 1.0·${(hCol * 1000).toFixed(0)} / ${(
          (mont?.rz ?? 0) * 10
        ).toFixed(0)} = ${chkMont.KLr.toFixed(0)}`,
        `  F_cr = ${chkMont.Fcr.toFixed(0)} MPa, φ·P_n = ${chkMont.phiPn.toFixed(
          1,
        )} kN`,
        `  Ratio = ${chkMont.force.toFixed(2)} / ${chkMont.phiPn.toFixed(
          1,
        )} = ${chkMont.ratio.toFixed(2)} ${chkMont.ok ? "✓" : "✗"}`,
        ``,
      );
    } else {
      steps.push(
        `Montante ${perfilMontante}: no encontrado en la tabla de perfiles.`,
        ``,
      );
    }

    // ---- Verificación global del conjunto ----
    if (globalCheck) {
      steps.push(
        `--- Verificación global del conjunto (φ_c = 0.85) ---`,
        ``,
        `λ_global = K·L/r_min = ${K}·${alturaColumna.toFixed(
          2,
        )}/${globalCheck.rx_cm.toFixed(2)} = ${globalCheck.lambda0.toFixed(
          2,
        )}`,
        `λ_c = ${globalCheck.lambdaC.toFixed(4)}`,
        `F_cr = ${globalCheck.Fcr_MPa.toFixed(0)} MPa`,
        `φ·P_n = ${globalCheck.phiPn_kN.toFixed(1)} kN`,
        `Ratio = Pu/φ·P_n = ${globalCheck.ratio.toFixed(2)} ${globalCheck.passes ? "✓" : "✗"}`,
        ``,
      );
    }

    steps.push(
      `--- Columna como unidad ---`,
      `Ratio máximo = ${ratioColumna.toFixed(2)} ${passes ? "✓ Verifica" : "✗ No verifica"}`,
    );
  }

  const stepsStr = steps.join("\n");

  return {
    nColumnas,
    nCorreas,
    alturaColumna,
    dDiag,
    nPaneles,
    longCordones,
    longMontantes,
    longDiagonales,
    longTotal,
    wind,
    forces,
    brace,
    chkCordon,
    chkDiag,
    chkMont,
    ratioColumna,
    passes,
    steps: stepsStr,
    flexoResult,
    globalCheck,
    braceCheck,
  };
}
