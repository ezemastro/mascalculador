// muro-calc.ts — Dimensionado de muro de contención (CIRSOC 201-2005 / ACI 318)
//
// Muro de hormigón armado analizado por metro lineal (corrida). Modelo de
// empujes activos de Rankine con grieta de tracción (cohesión), napa y
// sobrecarga de lindero. El tabique se resuelve en dos estados:
//   - Estado definitivo: biapoyado (cabeza arriostrada en la losa, base en la
//     zapata). Empuja la losa ya vinculada.
//   - Estado provisorio: muro apuntalado a la altura H_puntal con el pie
//     apoyado en la zapata (voladizo superior + tramo inferior apuntalado-pie).
// El dimensionamiento usa el mayor M_u entre ambos estados.
//
// Unidades del contrato público:
//   m        → geometría (H, e_muro, B_zap, H_zap, e_losa, ancho_inf, H_puntal, h_napa)
//   mm       → recubrimientos (rec_muro, rec_zap)
//   kN/m³    → gamma, gamma_sat
//   kN/m²    → c, q_lindero, sigma_adm (si viene en MPa ya es tensión; kg/cm² se convierte)
//   MPa      → fc, fy
//   kN·m/m   → momentos por metro lineal (resultado)
//   kN/m     → fuerzas/empujes por metro lineal
//   cm       → d, b, separaciones, espesores para el hormigón armado
//   cm²/m    → armaduras por metro lineal
//
// Conversión clave: 1 MPa = 0.1 kN/cm² = 1000 kN/m².
// El recubrimiento en mm se pasa a cm dividiendo por 10.

import { BAR_AREA_MM2 } from "./computo";
import { CONCRETE_DENSITY } from "./constants";

const GAMMA_W = 9.81; // kN/m³ — peso específico del agua
const PHI_B = 0.9; // flexión hormigón
const PHI_V = 0.75; // corte
const PHI_P = 0.65; // compresión axial de columnas/muros

export type MuroTipoZapata = "centrada" | "excentrica";

export interface MuroInput {
  // A. Geometría
  H: number; // m — altura total libre
  e_muro: number; // m — espesor del tabique
  rec_muro: number; // mm — recubrimiento del tabique
  H_puntal: number; // m — nivel de apuntalamiento desde la base
  // B. Geotecnia
  gamma: number; // kN/m³
  gamma_sat: number; // kN/m³
  phi: number; // °
  c: number; // kN/m²
  FS_c: number; // factor de seguridad al corte (cohesión)
  h_napa: number; // m — altura de napa desde la base (0 = sin napa)
  q_lindero: number; // kN/m²
  sigma_adm_suelo: number; // MPa (o kg/cm² si sigma_adm_unit = "kg/cm2")
  sigma_adm_unit: "MPa" | "kg/cm2";
  // C. Hormigón / cargas
  fc: number; // MPa
  fy: number; // MPa
  e_losa: number; // m
  ancho_inf: number; // m — ancho de influencia de la losa
  CM_losa: number; // kN/m² — carga de mampostería/terminación sobre losa
  L_losa: number; // kN/m² — sobrecarga sobre losa
  // D. Zapata
  B_zap: number; // m
  H_zap: number; // m
  rec_zap: number; // mm — recubrimiento de la zapata
  tipo_zapata: MuroTipoZapata;
  // E. Adopción manual de armaduras (override dentro del input del motor).
  // Si un grupo está presente, el motor sobreescribe la selección automática
  // con ese Ø/separación y recalcula As provisto, verificaciones y cómputo.
  adopcion?: MuroAdopcion;
}

/** Grupo de armadura adoptado manualmente: Ø (mm), separación (cm) y,
 *  para longitudinales de zapata, cantidad por metro; para estribos, ramas. */
export interface MuroAdopcionGrupo {
  diam: number; // mm
  sep: number; // cm
  count?: number; // barras por metro (longitudinales de zapata)
  legs?: number; // ramas (estribos, default 2)
}

/** Adopción manual por grupo de armadura del muro. */
export interface MuroAdopcion {
  vertInt?: MuroAdopcionGrupo; // vertical interior (tabique)
  vertExt?: MuroAdopcionGrupo; // vertical exterior (tabique)
  horizInt?: MuroAdopcionGrupo; // horizontal interior (tabique)
  horizExt?: MuroAdopcionGrupo; // horizontal exterior (tabique)
  trans?: MuroAdopcionGrupo; // transversal (flexión del vuelo, zapata)
  longInf?: MuroAdopcionGrupo; // longitudinal inferior (reparto, zapata)
  longSup?: MuroAdopcionGrupo; // longitudinal superior (montaje/reparto, zapata)
  estribo?: MuroAdopcionGrupo; // estribos de la zapata
}

export interface MuroVerification {
  label: string;
  value: string;
  ratio: number;
  ok: boolean;
}

export interface MuroBarSelection {
  diam: number; // mm
  sep: number; // cm — separación (muros) o paso de barras
  asProv: number; // cm²/m — armadura provista
  count?: number; // barras por metro (zapata longitudinal de reparto)
  legs?: number; // ramas (estribos)
  ok?: boolean; // cumple As provisto ≥ As requerido (o regla de estribos)
}

export interface MuroResult {
  // Geometría / modelo
  H: number;
  e_muro: number;
  d_cm: number; // peralte útil del tabique
  Ka: number;
  z0: number; // m — altura de la grieta de tracción desde el coronamiento
  z_wt: number; // m — altura del nivel freático desde el coronamiento
  // Presiones de estado definitivo (kN/m²) en puntos clave
  p_q: number;
  p_s_wt: number; // suelo no sumergido en el nivel freático
  p_s_base: number; // suelo (efectiva) en la base
  p_sub_base: number; // suelo sumergido extra en la base
  p_w_base: number; // hidrostática en la base
  p_net_0: number;
  p_net_z0: number;
  p_net_wt: number;
  p_net_base: number;
  // Estado definitivo
  W_def: number; // kN/m — empuje total de servicio
  R_sup: number; // kN/m — reacción en la cabeza
  R_inf: number; // kN/m — reacción en la base
  M_max_def: number; // kN·m/m
  z_M_max_def: number; // m desde coronamiento
  V_max_def: number; // kN/m
  // Estado provisorio
  z_strut: number; // m desde coronamiento — altura del puntal
  M_cant: number; // kN·m/m — momento del voladizo superior en el puntal
  R_strut: number; // kN/m — reacción del puntal
  R_base_lower: number; // kN/m — reacción de la base en el tramo inferior
  M_max_prov: number; // kN·m/m
  z_M_max_prov: number; // m desde coronamiento
  V_max_prov: number; // kN/m
  // Gobernante
  which: "definitivo" | "provisorio";
  M_gov: number; // kN·m/m (servicio)
  M_u_gov: number; // kN·m/m (último)
  z_M_gov: number; // m desde coronamiento
  // Dimensionamiento del tabique
  Pu: number; // kN/m — compresión axial última
  PP_muro: number; // kN/m
  PP_losa: number; // kN/m²
  mn: number; // cuantía mecánica
  omega: number;
  As_cal: number; // cm²/m
  As_min: number; // cm²/m
  As_req: number; // cm²/m
  As_ext: number; // cm²/m — vertical exterior
  vertInt: MuroBarSelection;
  vertExt: MuroBarSelection;
  horizInt: MuroBarSelection; // horizontal interior (cara del suelo)
  horizExt: MuroBarSelection; // horizontal exterior (cara libre)
  // Corte del tabique
  Vu: number; // kN/m
  phiVc: number; // kN/m
  shearRatio: number;
  shearOK: boolean;
  // Zapata
  P_serv: number; // kN/m
  M_base: number; // kN·m/m (servicio)
  sigma_adm_kPa: number;
  sigma_cent: number; // kPa (centrada)
  e0: number; // m (excéntrica)
  sigma_max: number; // kPa
  sigmaOK: boolean;
  vuelo: number; // m
  rigidOK: boolean;
  q_u: number; // kPa — presión mayorada en el vuelo
  M_u_zap: number; // kN·m/m
  d_zap_cm: number;
  As_trans_cal: number;
  As_trans_min: number;
  As_trans_req: number;
  As_long: number;
  As_longSup: number; // cm²/m — longitudinal superior (mínimo retracción)
  trans: MuroBarSelection;
  longInf: MuroBarSelection; // longitudinal inferior (reparto actual)
  longSup: MuroBarSelection; // longitudinal superior (montaje/reparto)
  // Estribos de la zapata
  Vu_zap: number; // kN/m — corte en la cara del muro
  phiVc_zap: number; // kN/m — capacidad al corte de la zapata
  avsReq: number; // cm²/cm — Av/s requerida por corte (0 si no rige)
  avsMin: number; // cm²/cm — Av/s mínima (retracción, 0 si no aplica)
  sMax: number; // cm — separación máxima de estribos
  legs: number; // ramas adoptadas (default 2)
  estribo: MuroBarSelection;
  // Compresión axial
  axialRatio: number;
  axialOK: boolean;
  // Verificaciones (D/C) y traza
  verifications: MuroVerification[];
  steps: string[];
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}
const f1 = (n: number) => fmt(n, 1);
const f2 = (n: number) => fmt(n, 2);
function f3(n: number): string {
  return fmt(n, 3);
}
function f4(n: number): string {
  return fmt(n, 4);
}

/** Área de una barra (mm) en cm². */
function aBarCm2(diamMm: number): number {
  return BAR_AREA_MM2[diamMm] / 100;
}

const DIAMS = [8, 10, 12, 16, 20, 25, 32];
const DIAMS_ESTRIBO = [6, 8, 10, 12]; // Ø comerciales de estribos

/**
 * Aplica (si existe) la adopción manual de un grupo de flexión. Devuelve la
 * selección final con As provisto recalculado desde el Ø/sep elegido y el flag
 * `ok` (As prov ≥ As req). Sin override, devuelve la propuesta automática.
 */
function adoptSelection(
  calc: MuroBarSelection,
  asReq: number,
  adopt?: MuroAdopcionGrupo,
): MuroBarSelection {
  if (adopt && BAR_AREA_MM2[adopt.diam] > 0 && adopt.sep > 0) {
    const area = aBarCm2(adopt.diam); // cm²
    const asProv = (area * 100) / adopt.sep; // cm²/m
    return {
      diam: adopt.diam,
      sep: adopt.sep,
      asProv,
      count: adopt.count,
      ok: asProv >= asReq - 1e-6,
    };
  }
  return { ...calc, ok: calc.asProv >= asReq - 1e-6 };
}

/** Longitudinal de zapata (reparto/montaje): igual que adoptSelection pero
 *  completa `count` (barras por metro) si no viene en la adopción. */
function longitudinalSelection(
  asReq: number,
  smax: number,
  adopt?: MuroAdopcionGrupo,
): MuroBarSelection {
  const sel = adoptSelection(selectBars(asReq, smax), asReq, adopt);
  if (sel.count === undefined) {
    const area = aBarCm2(sel.diam);
    sel.count = Math.max(1, Math.ceil(asReq / area));
  }
  return sel;
}

/** Estribos de la zapata: elige Ø/sep (ramas = legs, default 2) para cubrir
 *  Av/s requerida (cm²/cm → cm²/m ×100). Si avsReq = 0 (no rige corte) propone
 *  una armadura mínima de montaje al separado máximo. */
function selectStirrups(
  avsReq: number,
  sMax: number,
  legs = 2,
): MuroBarSelection {
  const avsReqM2 = avsReq * 100; // cm²/m
  for (const diam of DIAMS_ESTRIBO) {
    const area = aBarCm2(diam); // cm²
    if (avsReqM2 <= 0) {
      // Sin corte que rija: montaje al separado máximo.
      return {
        diam,
        sep: sMax,
        asProv: (legs * area * 100) / sMax,
        legs,
        ok: true,
      };
    }
    // Sep necesario (más económico) para cumplir Av/s prov ≥ Av/s req:
    // Av/s prov = legs·area·100/sep ≥ avsReqM2 ⇒ sep ≤ legs·area·100/avsReqM2.
    let sep = Math.floor((legs * area * 100) / avsReqM2 / 5) * 5;
    if (sep < 5) sep = 5;
    if (sep <= sMax && (legs * area * 100) / sep >= avsReqM2 - 1e-9) {
      return { diam, sep, asProv: (legs * area * 100) / sep, legs, ok: true };
    }
  }
  const diam = DIAMS_ESTRIBO[DIAMS_ESTRIBO.length - 1];
  const area = aBarCm2(diam);
  return {
    diam,
    sep: sMax,
    asProv: (legs * area * 100) / sMax,
    legs,
    ok: false,
  };
}

/** Elige Ø y separación (múltiplo de 5 cm) para un As requerido (cm²/m).
 *  Devuelve el Ø menor que cumple y el separado MÁS ECONÓMICO (mayor) que
 *  aún verifica As prov ≥ As req (sep ≤ area·100/As_req, redondeado hacia
 *  abajo a múltiplo de 5, entre 5 y smax). */
function selectBars(asReq: number, smax: number): MuroBarSelection {
  for (const diam of DIAMS) {
    const area = aBarCm2(diam); // cm²
    // As prov = area·100/sep ≥ asReq ⇒ sep ≤ area·100/asReq.
    let sep = Math.floor((area * 100) / asReq / 5) * 5;
    if (sep < 5) sep = 5;
    if (sep <= smax && (area * 100) / sep >= asReq - 1e-9) {
      return { diam, sep, asProv: (area * 100) / sep };
    }
  }
  // Fallback: mayor Ø al separado máximo (quedará como insuficiente ⇒ warning)
  const diam = DIAMS[DIAMS.length - 1];
  const area = aBarCm2(diam);
  return { diam, sep: smax, asProv: (area * 100) / smax };
}

/** Cuantía mecánica → ω (bloque rectangular): ω = 1 − √(1 − 2·mn). */
function omegaFromMn(mn: number): number {
  if (mn <= 0) return 0;
  const disc = 1 - 2 * mn;
  if (disc <= 0) return 1; // sección insuficiente (mn > 0.5)
  return 1 - Math.sqrt(disc);
}

/** Capacidad de flexión φ·Mn (kN·m/m) del tabique a partir de ω. */
function phiB_Mn(
  omega: number,
  fcKNcm2: number,
  b: number,
  d_cm: number,
): number {
  const a = omega * d_cm; // cm
  const Mn = 0.85 * fcKNcm2 * b * a * (d_cm - a / 2); // kN·cm/m
  return (PHI_B * Mn) / 100; // kN·m/m
}

// ---------------------------------------------------------------------------
// Presiones activas
// ---------------------------------------------------------------------------

interface PressureModel {
  Ka: number;
  z0: number; // m desde coronamiento
  z_wt: number; // m desde coronamiento (nivel freático)
  /** Presión activa total (sin clamp de z0) a la profundidad z (m, 0=coronamiento). */
  pActive(z: number): number;
  /** Presión neta (aplica regla z0): 0 por encima de z0. */
  pNet(z: number): number;
}

function buildPressure(input: MuroInput): PressureModel {
  const phiRad = (input.phi * Math.PI) / 180;
  const Ka = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
  // z0 (grieta de tracción) = max(0, 2·c/(FS·γ·√Ka) − q/γ)
  const z0 = Math.max(
    0,
    (2 * (input.c / input.FS_c)) / (input.gamma * Math.sqrt(Ka)) -
      input.q_lindero / input.gamma,
  );
  const z_wt = input.h_napa > 0 ? input.H - input.h_napa : input.H + 1; // fuera si no hay napa
  const p_q = Ka * input.q_lindero;

  const pActive = (z: number): number => {
    if (z <= 0) return 0;
    const pSoilAbove = Ka * input.gamma * Math.min(z, z_wt);
    const pSoilSub =
      z > z_wt ? Ka * (input.gamma_sat - GAMMA_W) * (z - z_wt) : 0;
    const pWater = z > z_wt ? GAMMA_W * (z - z_wt) : 0;
    return p_q + pSoilAbove + pSoilSub + pWater;
  };

  const pNet = (z: number): number => (z < z0 ? 0 : pActive(z));

  return { Ka, z0, z_wt, pActive, pNet };
}

// ---------------------------------------------------------------------------
// Integración de esfuerzos
// ---------------------------------------------------------------------------

interface Statics {
  W: number;
  R_sup: number;
  R_inf: number;
  Mmax: number;
  zMmax: number;
  Vmax: number;
}

/** Biapoyado (apoyos en z=0 y z=H) con carga horizontal pNet(z). */
function staticsDefinitivo(
  pNet: (z: number) => number,
  H: number,
  N = 400,
): Statics {
  const dz = H / N;
  let W = 0;
  let Mtop = 0;
  const loads: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const z = (i / N) * H;
    const w = pNet(z);
    loads.push([z, w]);
    W += w * dz;
    Mtop += w * z * dz;
  }
  const R_inf = Mtop / H;
  const R_sup = W - R_inf;

  let Mmax = 0;
  let zMmax = 0;
  let Vmax = 0;
  let Shear = R_sup;
  for (let i = 0; i <= N; i++) {
    const z = (i / N) * H;
    if (i > 0) {
      const wPrev = loads[i - 1][1];
      const wCur = loads[i][1];
      const wAvg = (wPrev + wCur) / 2;
      Shear -= wAvg * dz;
    }
    let M = R_sup * z;
    for (let j = 1; j <= i; j++) {
      const za = loads[j - 1][0];
      const zb = loads[j][0];
      const wa = loads[j - 1][1];
      const wb = loads[j][1];
      const dz2 = zb - za;
      M -= ((wa + wb) / 2) * dz2 * (z - (za + zb) / 2);
    }
    if (Math.abs(M) > Math.abs(Mmax)) {
      Mmax = M;
      zMmax = z;
    }
    if (Math.abs(Shear) > Math.abs(Vmax)) Vmax = Shear;
  }
  return { W, R_sup, R_inf, Mmax, zMmax, Vmax: Math.abs(Vmax) };
}

/** Provisorio: voladizo superior (0..z_strut) + tramo inferior apoyado en
 *  puntal (z_strut) y pie (H). Devuelve el momento máximo gobernante y la
 *  reacción en el puntal. */
function staticsProvisorio(
  pNet: (z: number) => number,
  H: number,
  z_strut: number,
  N = 400,
): Statics & { R_strut: number; R_base_lower: number; M_cant: number } {
  const loads: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const z = (i / N) * H;
    loads.push([z, pNet(z)]);
  }
  const at = (zq: number): number => {
    const idx = (zq / H) * N;
    const i0 = Math.max(0, Math.min(N - 1, Math.floor(idx)));
    const t = idx - i0;
    return loads[i0][1] * (1 - t) + loads[i0 + 1][1] * t;
  };
  const integ = (z0: number, z1: number, moment: boolean): number => {
    let sum = 0;
    const steps = 40;
    const dzz = (z1 - z0) / steps;
    for (let k = 0; k < steps; k++) {
      const za = z0 + k * dzz;
      const zb = za + dzz;
      const wa = at(za);
      const wb = at(zb);
      const wAvg = (wa + wb) / 2;
      if (!moment) {
        sum += wAvg * dzz;
      } else {
        sum += wAvg * dzz * (z1 - (za + zb) / 2); // momento respecto a z1
      }
    }
    return sum;
  };

  // Voladizo superior: 0..z_strut, empotrado en el puntal
  const T_up = integ(0, z_strut, false);
  const M_cant = integ(0, z_strut, true);

  // Tramo inferior: z_strut..H, apoyos en puntal y pie
  const W_low = integ(z_strut, H, false);
  const M_about_strut = integ(z_strut, H, true); // respecto a H
  const R_base_lower = M_about_strut / (H - z_strut);
  const R_strut_lower = W_low - R_base_lower;

  // Momento máximo en el tramo inferior
  const span = H - z_strut;
  let Mmax_low = 0;
  let zMmax_low = z_strut;
  const steps = 80;
  for (let k = 0; k <= steps; k++) {
    const z = z_strut + (k / steps) * span;
    const local = integ(z_strut, z, true);
    const M = R_strut_lower * (z - z_strut) - local;
    if (Math.abs(M) > Math.abs(Mmax_low)) {
      Mmax_low = M;
      zMmax_low = z;
    }
  }

  const Mmax = Math.max(Math.abs(M_cant), Math.abs(Mmax_low));
  const zMmax = Math.abs(M_cant) >= Math.abs(Mmax_low) ? z_strut : zMmax_low;
  const Vmax = Math.max(
    Math.abs(T_up),
    Math.abs(R_strut_lower),
    Math.abs(R_base_lower),
  );
  return {
    W: T_up + W_low,
    R_sup: T_up, // empuje del voladizo que absorbe el puntal (en la cabeza)
    R_inf: R_base_lower,
    Mmax,
    zMmax,
    Vmax,
    R_strut: T_up,
    R_base_lower,
    M_cant,
  };
}

// ---------------------------------------------------------------------------
// Diseño principal
// ---------------------------------------------------------------------------

export function designMuro(input: MuroInput): MuroResult {
  const st: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const gammaC = CONCRETE_DENSITY; // kN/m³

  st.push("=== MURO DE CONTENCIÓN — CIRSOC 201-2005 / ACI 318 ===");
  st.push("");
  if (!(input.H > 0)) errors.push("La altura H debe ser mayor que cero.");
  if (!(input.e_muro > 0))
    errors.push("El espesor del tabique e_muro debe ser mayor que cero.");
  if (!(input.B_zap > 0)) errors.push("El ancho de zapata B_zap es requerido.");
  if (!(input.H_zap > 0))
    errors.push("La altura de zapata H_zap es requerida.");
  if (input.B_zap <= input.e_muro)
    errors.push("La zapata B_zap debe ser mayor que el espesor del tabique.");
  if (!(input.phi > 0 && input.phi < 90))
    errors.push("El ángulo de fricción φ debe estar entre 0° y 90°.");
  if (![20, 25, 30, 35, 40].includes(input.fc))
    warnings.push("fc fuera de los valores usuales (20–40 MPa).");
  if (![420, 500].includes(input.fy))
    warnings.push("fy fuera de los valores usuales (420–500 MPa).");
  if (errors.length > 0) {
    return emptyResult(input, st, warnings, errors);
  }

  const H = input.H;
  const e_muro = input.e_muro;
  const recMuroCm = input.rec_muro / 10; // mm → cm
  const recZapCm = input.rec_zap / 10;
  const d_cm = e_muro * 100 - recMuroCm; // cm
  const fcMPa = input.fc;
  const fyMPa = input.fy;
  const fcKNcm2 = fcMPa * 0.1;
  const fyKNcm2 = fyMPa * 0.1;

  st.push(
    `Geometría: H = ${f2(H)} m, e_muro = ${f2(e_muro)} m → d = ${f2(e_muro * 100)} − ${f2(recMuroCm)} = ${f2(d_cm)} cm`,
  );
  st.push(`Materiales: f'c = ${fcMPa} MPa, fy = ${fyMPa} MPa`);

  // ── 1. Empujes ──
  const pm = buildPressure(input);
  const Ka = pm.Ka;
  const z0 = pm.z0;
  const z_wt = pm.z_wt;
  st.push("");
  st.push("1. Empujes activos de Rankine");
  st.push(
    `   Ka = tan²(45° − φ/2) = tan²(45° − ${f1(input.phi)}°/2) = ${f3(Ka)}`,
  );
  st.push(
    `   Grieta de tracción z0 = máx(0, 2·c/(FS·γ·√Ka) − q/γ) = ${f2(z0)} m`,
  );
  if (input.h_napa > 0)
    st.push(
      `   Nivel freático a ${f2(input.h_napa)} m desde la base → z_wt = H − h_napa = ${f2(z_wt)} m desde el coronamiento`,
    );
  else st.push(`   Sin napa (γw = ${f2(GAMMA_W)} kN/m³ no actúa).`);

  const p_q = Ka * input.q_lindero;
  const p_s_wt =
    input.h_napa > 0 ? Ka * input.gamma * z_wt : Ka * input.gamma * H;
  const p_s_base = Ka * input.gamma * Math.min(H, z_wt);
  const p_sub_base =
    input.h_napa > 0 ? Ka * (input.gamma_sat - GAMMA_W) * (H - z_wt) : 0;
  const p_w_base = input.h_napa > 0 ? GAMMA_W * (H - z_wt) : 0;
  const p_net_0 = pm.pNet(0);
  const p_net_z0 = pm.pNet(z0);
  const p_net_wt = pm.pNet(z_wt);
  const p_net_base = pm.pNet(H);

  st.push(
    `   p_q = Ka·q = ${f2(p_q)} kN/m² (uniforme) · p_s(base) = ${f2(p_s_base)} kN/m²`,
  );
  if (input.h_napa > 0)
    st.push(
      `   sumergido base = ${f2(p_sub_base)} kN/m² · hidrostática base = ${f2(p_w_base)} kN/m²`,
    );
  st.push(
    `   p_net: z=0 → ${f2(p_net_0)} · z=z0 (${f2(z0)} m) → ${f2(p_net_z0)} · z=z_wt (${f2(z_wt)} m) → ${f2(p_net_wt)} · z=H → ${f2(p_net_base)} kN/m²`,
  );

  // ── 2. Estática estado definitivo ──
  st.push("");
  st.push(
    "2. Estado definitivo — muro biapoyado (cabeza en losa, base en zapata)",
  );
  const def = staticsDefinitivo(pm.pNet, H);
  st.push(
    `   Empuje W = ${f2(def.W)} kN/m · R_cabeza = ${f2(def.R_sup)} kN/m · R_base = ${f2(def.R_inf)} kN/m`,
  );
  st.push(
    `   M_max = ${f2(Math.abs(def.Mmax))} kN·m/m en z = ${f2(def.zMmax)} m · V_max = ${f2(def.Vmax)} kN/m`,
  );

  // ── 3. Estado provisorio ──
  st.push("");
  st.push(
    "3. Estado provisorio — muro apuntalado a H_puntal con pie en zapata",
  );
  let z_strut = H - input.H_puntal;
  z_strut = Math.max(0.05 * H, Math.min(0.95 * H, z_strut));
  st.push(
    `   Modelo: voladizo libre superior 0..z_strut empotrado en el puntal + tramo inferior z_strut..H apoyado en puntal y pie.`,
  );
  const prov = staticsProvisorio(pm.pNet, H, z_strut);
  st.push(
    `   Voladizo superior: T_puntal = ${f2(prov.R_strut)} kN/m · M_cant(en puntal) = ${f2(Math.abs(prov.M_cant))} kN·m/m`,
  );
  st.push(
    `   Tramo inferior: R_puntal = ${f2(prov.R_strut)} kN/m · R_pie = ${f2(prov.R_base_lower)} kN/m · M_max = ${f2(Math.abs(prov.Mmax))} kN·m/m en z = ${f2(prov.zMmax)} m`,
  );

  // ── 4. Gobernante ──
  const M_def_abs = Math.abs(def.Mmax);
  const M_prov_abs = Math.abs(prov.Mmax);
  const which: "definitivo" | "provisorio" =
    M_prov_abs > M_def_abs ? "provisorio" : "definitivo";
  const M_gov = which === "definitivo" ? M_def_abs : M_prov_abs;
  const z_M_gov = which === "definitivo" ? def.zMmax : prov.zMmax;
  const V_gov = which === "definitivo" ? def.Vmax : prov.Vmax;
  const M_u_gov = 1.6 * M_gov;
  st.push("");
  st.push(
    `4. Momento gobernante: estado ${which} · M_s = ${f2(M_gov)} kN·m/m (z = ${f2(z_M_gov)} m) → M_u = 1.6·M_s = ${f2(M_u_gov)} kN·m/m`,
  );

  // ── 5. Cargas axiales (Pu por metro) ──
  st.push("");
  st.push("5. Compresión axial de servicio/última (por metro lineal)");
  const PP_muro = gammaC * e_muro * H; // kN/m
  const PP_losa = gammaC * input.e_losa; // kN/m²
  st.push(
    `   PP_muro = γc·e_muro·H = ${f2(gammaC)}·${f2(e_muro)}·${f2(H)} = ${f2(PP_muro)} kN/m`,
  );
  st.push(
    `   PP_losa = γc·e_losa = ${f2(gammaC)}·${f2(input.e_losa)} = ${f2(PP_losa)} kN/m²`,
  );
  const Pu =
    1.2 * (PP_muro + (PP_losa + input.CM_losa) * input.ancho_inf) +
    1.6 * (input.L_losa * input.ancho_inf);
  st.push(
    `   Pu = 1.2·(PP_muro + (PP_losa+CM_losa)·ancho_inf) + 1.6·(L_losa·ancho_inf) = ${f2(Pu)} kN/m`,
  );

  // ── 6. Dimensionamiento del tabique ──
  st.push("");
  st.push("6. Dimensionamiento del tabique (flexión + compresión, b = 100 cm)");
  const b = 100; // cm — ancho de diseño por metro
  const Mu_kNcm = M_u_gov * 100; // kN·cm/m
  const mn = Mu_kNcm / (PHI_B * 0.85 * fcKNcm2 * b * d_cm * d_cm);
  let omega = omegaFromMn(mn);
  st.push(
    `   m_n = M_u/(φb·0.85·f'c·b·d²) = ${f1(Mu_kNcm)}/(${PHI_B}·0.85·${f2(fcKNcm2)}·${b}·${f2(d_cm)}²) = ${f4(mn)}`,
  );
  if (mn > 0.32 || omega >= 1 || !Number.isFinite(omega)) {
    errors.push(
      "Sección insuficiente para el momento de diseño: aumentá e_muro (o fc).",
    );
    omega = Math.min(omega, 1);
  }
  const As_cal =
    (omega * 0.85 * fcKNcm2 * b * d_cm) / fyKNcm2 - Pu / (PHI_B * fyKNcm2);
  const As_min_flex =
    Math.max((0.25 * Math.sqrt(fcMPa)) / fyMPa, 1.4 / fyMPa) * b * d_cm;
  const As_min_rho = 0.0018 * b * d_cm;
  const As_min = Math.max(As_min_flex, As_min_rho);
  let As_req = As_cal;
  if (As_cal < As_min) {
    As_req = Math.max(As_min, (4 / 3) * As_cal);
    st.push(
      `   As_cal (${f2(As_cal)}) < As_mín (${f2(As_min)}) ⇒ As_req = máx(As_mín, 4/3·As_cal) = ${f2(As_req)} cm²/m`,
    );
  } else {
    As_req = Math.max(As_cal, As_min);
  }
  st.push(
    `   ω = 1 − √(1 − 2·m_n) = ${f4(omega)} · As_cal = ${f2(As_cal)} cm²/m · As_mín = ${f2(As_min)} cm²/m`,
  );
  st.push(`   As_req (tabique interior) = ${f2(As_req)} cm²/m`);

  const smaxInt = Math.min(3 * e_muro * 100, 30);
  const vertInt = adoptSelection(
    selectBars(As_req, smaxInt),
    As_req,
    input.adopcion?.vertInt,
  );
  st.push(
    `   Vertical interior: Ø${vertInt.diam} c/ ${vertInt.sep} cm → As_prov = ${f2(vertInt.asProv)} cm²/m ${vertInt.ok ? "✓" : "✗ insuficiente"}`,
  );
  if (vertInt.asProv < As_req)
    warnings.push(
      "Armadura vertical interior insuficiente con el separado máximo: aumentá e_muro o fc.",
    );
  if (input.adopcion?.vertInt && !vertInt.ok)
    warnings.push(
      "Vertical interior adoptada insuficiente respecto a As requerido.",
    );

  const As_ext = Math.max(As_min, 0.5 * As_req);
  const vertExt = adoptSelection(
    selectBars(As_ext, smaxInt),
    As_ext,
    input.adopcion?.vertExt,
  );
  st.push(
    `   Vertical exterior (cara libre): As = máx(As_mín, 0.5·As_int) = ${f2(As_ext)} cm²/m → Ø${vertExt.diam} c/ ${vertExt.sep} cm ${vertExt.ok ? "✓" : "✗"}`,
  );
  if (input.adopcion?.vertExt && !vertExt.ok)
    warnings.push(
      "Vertical exterior adoptada insuficiente respecto a As requerido (mín 0.5·As_int).",
    );

  const As_h = 0.0018 * b * (e_muro * 100); // cm²/m — mínimo de retracción POR CARA
  // Malla horizontal por cara: cada cara lleva su propia armadura de retracción
  // ρ = 0.0018·b·e (cm²/m), separación máxima 45 cm.
  const horizInt = adoptSelection(
    selectBars(As_h, 45),
    As_h,
    input.adopcion?.horizInt,
  );
  const horizExt = adoptSelection(
    selectBars(As_h, 45),
    As_h,
    input.adopcion?.horizExt,
  );
  st.push(
    `   Horizontal interior (cara suelo, ρ_mín 0.0018 por cara): As = ${f2(As_h)} cm²/m → Ø${horizInt.diam} c/ ${horizInt.sep} cm (s ≤ 45 cm) ${horizInt.ok ? "✓" : "✗"}`,
  );
  st.push(
    `   Horizontal exterior (cara libre, ρ_mín 0.0018 por cara): As = ${f2(As_h)} cm²/m → Ø${horizExt.diam} c/ ${horizExt.sep} cm (s ≤ 45 cm) ${horizExt.ok ? "✓" : "✗"}`,
  );
  if (horizInt.sep > 45 || horizExt.sep > 45)
    warnings.push("Separación horizontal supera los 45 cm recomendados.");
  if (input.adopcion?.horizInt && !horizInt.ok)
    warnings.push(
      "Horizontal interior adoptada insuficiente respecto al mínimo de retracción (0.18%).",
    );
  if (input.adopcion?.horizExt && !horizExt.ok)
    warnings.push(
      "Horizontal exterior adoptada insuficiente respecto al mínimo de retracción (0.18%).",
    );

  // ── 7. Corte del tabique ──
  st.push("");
  st.push("7. Verificación al corte del tabique");
  const Vu = 1.6 * V_gov;
  // φVc = 0.75·0.53·√f'c·b·d (SI, √f'c en psi) es numéricamente equivalente a
  // la forma métrica del proyecto 0.75·b·d·√f'c/60 (kN) con f'c MPa y b,d cm.
  const phiVcMetric = (PHI_V * b * d_cm * Math.sqrt(fcMPa)) / 60;
  const shearRatio = Vu / phiVcMetric;
  const shearOK = shearRatio <= 1;
  st.push(`   Vu = 1.6·V_máx = 1.6·${f2(V_gov)} = ${f2(Vu)} kN/m`);
  st.push(
    `   φVc ≈ 0.75·b·d·√f'c/60 = 0.75·${b}·${f2(d_cm)}·√${fcMPa}/60 = ${f2(phiVcMetric)} kN/m`,
  );
  st.push(
    `   D/C = Vu/φVc = ${f2(shearRatio)} ${shearOK ? "✓" : "✗ NO cumple — aumentar e_muro o H_zap"}`,
  );
  if (!shearOK)
    warnings.push(
      "Corte del tabique no verifica: aumentá e_muro o la altura de la zapata.",
    );

  // ── 8. Zapata ──
  st.push("");
  st.push("8. Zapata corrida");
  const B = input.B_zap;
  const H_z = input.H_zap;
  const sigma_adm_MPa =
    input.sigma_adm_unit === "kg/cm2"
      ? input.sigma_adm_suelo * 0.098
      : input.sigma_adm_suelo;
  const sigma_adm_kPa = sigma_adm_MPa * 1000;
  st.push(
    `   σ_adm suelo = ${f2(input.sigma_adm_suelo)} ${input.sigma_adm_unit} = ${f2(sigma_adm_kPa)} kPa`,
  );
  const P_serv =
    PP_muro + (PP_losa + input.CM_losa + input.L_losa) * input.ancho_inf;
  const M_base = Math.abs(def.Mmax); // momento de servicio en la base
  st.push(
    `   P_serv base = PP_muro + (PP_losa+CM_losa+L_losa)·ancho_inf = ${f2(P_serv)} kN/m (M_base servicio = ${f2(M_base)} kN·m/m)`,
  );

  let sigma_cent = 0;
  let sigma_max = 0;
  let e0 = 0;
  let sigmaOK = true;
  const vuelo = (B - e_muro) / 2;
  if (input.tipo_zapata === "centrada") {
    sigma_cent = P_serv / B;
    sigma_max = sigma_cent;
    sigmaOK = sigma_cent <= sigma_adm_kPa;
    st.push(
      `   Centrada: σ = P_serv/B = ${f2(sigma_cent)} kPa ≤ ${f2(sigma_adm_kPa)} kPa ${sigmaOK ? "✓" : "✗"}`,
    );
  } else {
    e0 = P_serv > 0 ? M_base / P_serv : 0;
    sigma_max = (P_serv / B) * (1 + (6 * e0) / B);
    sigmaOK = sigma_max <= 1.25 * sigma_adm_kPa;
    st.push(
      `   Excéntrica: e0 = M_base/P_serv = ${f2(e0)} m · σ_max = ${f2(sigma_max)} kPa ≤ 1.25·${f2(sigma_adm_kPa)} = ${f2(1.25 * sigma_adm_kPa)} kPa ${sigmaOK ? "✓" : "✗"}`,
    );
    if (e0 > B / 6)
      warnings.push(
        "Excentricidad e0 > B/6: hay tracción/despegue en la zapata (revisar几何).",
      );
  }

  const rigidOK = vuelo <= 2 * H_z;
  st.push(
    `   Vuelo v = (B − e_muro)/2 = ${f2(vuelo)} m ≤ 2·H_zap = ${f2(2 * H_z)} m ${rigidOK ? "✓" : "✗ — aumentar B o H_zap"}`,
  );
  if (!rigidOK)
    warnings.push(
      "Vuelo de la zapata excede 2·H_zap (ángulo de biela): aumentá B o H_zap.",
    );

  const d_zap_cm = H_z * 100 - recZapCm;
  const Pu_base =
    1.2 * (PP_muro + (PP_losa + input.CM_losa) * input.ancho_inf) +
    1.6 * (input.L_losa * input.ancho_inf);
  let q_u: number;
  if (input.tipo_zapata === "centrada") {
    q_u = Pu_base / B;
  } else {
    const e0_u = M_u_gov / Pu_base;
    q_u = (Pu_base / B) * (1 + (6 * e0_u) / B);
    st.push(`   e0,u = M_u/M_u,base = ${f2(e0_u)} m → q_u = ${f2(q_u)} kPa`);
  }
  st.push(`   d_zap = ${f2(H_z * 100)} − ${f2(recZapCm)} = ${f2(d_zap_cm)} cm`);
  st.push(`   q_u (mayorada 1.2G+1.6Q) en el vuelo = ${f2(q_u)} kPa`);
  const M_u_zap = (q_u * Math.pow(vuelo, 2)) / 2; // kN·m/m
  const Mu_zap_kNcm = M_u_zap * 100;
  const mn_zap =
    Mu_zap_kNcm / (PHI_B * 0.85 * fcKNcm2 * b * d_zap_cm * d_zap_cm);
  const omega_zap = omegaFromMn(mn_zap);
  const As_trans_cal = (omega_zap * 0.85 * fcKNcm2 * b * d_zap_cm) / fyKNcm2;
  const As_trans_min_flex =
    Math.max((0.25 * Math.sqrt(fcMPa)) / fyMPa, 1.4 / fyMPa) * b * d_zap_cm;
  const As_trans_min_rho = 0.0018 * b * d_zap_cm;
  const As_trans_min = Math.max(As_trans_min_flex, As_trans_min_rho);
  const As_trans_req = Math.max(As_trans_cal, As_trans_min);
  const smaxTrans = Math.min(3 * H_z * 100, 45);
  const trans = adoptSelection(
    selectBars(As_trans_req, smaxTrans),
    As_trans_req,
    input.adopcion?.trans,
  );
  st.push(
    `   M_u,zap = q_u·v²/2 = ${f2(M_u_zap)} kN·m/m · m_n,zap = ${f4(mn_zap)}`,
  );
  st.push(
    `   As_trans cal = ${f2(As_trans_cal)} cm²/m · As_mín = ${f2(As_trans_min)} cm²/m → As_req = ${f2(As_trans_req)} cm²/m`,
  );
  st.push(
    `   Transversal zapata: Ø${trans.diam} c/ ${trans.sep} cm → As_prov = ${f2(trans.asProv)} cm²/m ${trans.asProv >= As_trans_req ? "✓" : "✗"}`,
  );
  if (trans.asProv < As_trans_req)
    warnings.push("Armadura transversal de la zapata insuficiente.");
  if (input.adopcion?.trans && !trans.ok)
    warnings.push(
      "Transversal de zapata adoptada insuficiente respecto a As requerido.",
    );

  const As_long = Math.max(0.2 * As_trans_req, 0.0018 * b * (H_z * 100));
  const longInf = longitudinalSelection(As_long, 45, input.adopcion?.longInf);
  // Longitudinal superior de la zapata: armadura de montaje/reparto, mínimo de
  // retracción ρ = 0.0018·b·H_zap (cm²/m), separación máxima 45 cm.
  const As_longSup = 0.0018 * b * (H_z * 100);
  const longSup = longitudinalSelection(
    As_longSup,
    45,
    input.adopcion?.longSup,
  );
  st.push(
    `   Longitudinal inferior (reparto): As = máx(0.2·As_trans, 0.0018·100·${f2(H_z * 100)}) = ${f2(As_long)} cm²/m → Ø${longInf.diam} (${longInf.count} barras/m, c/ ${longInf.sep} cm) ${longInf.ok ? "✓" : "✗"}`,
  );
  st.push(
    `   Longitudinal superior (montaje/reparto, ρ_mín 0.0018): As = ${f2(As_longSup)} cm²/m → Ø${longSup.diam} (${longSup.count} barras/m, c/ ${longSup.sep} cm) ${longSup.ok ? "✓" : "✗"}`,
  );
  if (input.adopcion?.longInf && !longInf.ok)
    warnings.push(
      "Longitudinal inferior adoptada insuficiente respecto a As requerido.",
    );
  if (input.adopcion?.longSup && !longSup.ok)
    warnings.push(
      "Longitudinal superior adoptada insuficiente respecto al mínimo de retracción (0.18%).",
    );

  // ── 8b. Estribos de la zapata ──
  st.push("");
  st.push("8b. Estribos de la zapata (corte en la cara del muro)");
  // Corte mayorado en la cara del muro: Vu = q_u · vuelo (kN/m).
  const Vu_zap = q_u * vuelo;
  // φVc de la zapata con la MISMA forma métrica que el corte del tabique
  // (0.75·b·d·√f'c/60, kN/m; b,d en cm; f'c en MPa):
  const phiVc_zap = (PHI_V * b * d_zap_cm * Math.sqrt(fcMPa)) / 60;
  // Separación máxima de estribos: min(0.5·d, 60) cm.
  const sMaxEstribo = Math.min(0.5 * d_zap_cm, 60);
  // Av/s mínima por retracción: en zapatas rige la Armadura transversal de
  // flexión; no se modela un mínimo de estribos separado (avsMin = 0).
  const avsMin = 0;
  // Av/s requerida por corte (cm²/cm): 0 si Vu ≤ φVc (estribos solo montaje).
  const avsReq =
    Vu_zap > phiVc_zap + 1e-9
      ? (Vu_zap - phiVc_zap) / (PHI_V * fyKNcm2 * d_zap_cm)
      : 0;
  const estribo = (() => {
    const adopt = input.adopcion?.estribo;
    if (adopt && BAR_AREA_MM2[adopt.diam] > 0 && adopt.sep > 0) {
      const area = aBarCm2(adopt.diam);
      const legs = adopt.legs ?? 2;
      const avsProv = (legs * area * 100) / adopt.sep; // cm²/m
      const ok =
        avsProv >= Math.max(avsReq, avsMin) * 100 - 1e-6 &&
        adopt.sep <= sMaxEstribo;
      return { diam: adopt.diam, sep: adopt.sep, asProv: avsProv, legs, ok };
    }
    return selectStirrups(avsReq, sMaxEstribo, adopt?.legs ?? 2);
  })();
  st.push(
    `   Vu_zap = q_u·vuelo = ${f2(q_u)}·${f2(vuelo)} = ${f2(Vu_zap)} kN/m`,
  );
  st.push(
    `   φVc_zap = 0.75·b·d·√f'c/60 = 0.75·${b}·${f2(d_zap_cm)}·√${fcMPa}/60 = ${f2(phiVc_zap)} kN/m`,
  );
  st.push(
    `   Av/s req = ${f4(avsReq)} cm²/cm ${avsReq === 0 ? "(no rige corte — estribos solo de montaje)" : ""} · s_max = ${f2(sMaxEstribo)} cm · ramas = ${estribo.legs}`,
  );
  st.push(
    `   Estribos: Ø${estribo.diam} c/ ${estribo.sep} cm → Av/s prov = ${f2(estribo.asProv)} cm²/m ${estribo.ok ? "✓" : "✗"}`,
  );
  if (input.adopcion?.estribo && !estribo.ok)
    warnings.push(
      "Estribos de zapata adoptados insuficientes (Av/s prov < req o sep > s_max).",
    );

  // ── 9. Compresión axial ──
  st.push("");
  st.push("9. Verificación a compresión axial del tabique");
  const Ag = b * (H * 100); // cm²
  const As_total = (vertInt.asProv + vertExt.asProv) * 100; // cm²
  const Pn = 0.85 * fcKNcm2 * Ag + As_total * fyKNcm2;
  const axialRatio = Pu / (PHI_P * Pn);
  const axialOK = axialRatio <= 1;
  st.push(
    `   Ag = 100·${f2(H * 100)} = ${f2(Ag)} cm² · As ≈ ${f2(As_total)} cm²`,
  );
  st.push(
    `   Pn = 0.85·f'c·Ag + As·fy = ${f2(0.85 * fcKNcm2 * Ag)} + ${f2(As_total * fyKNcm2)} = ${f2(Pn)} kN`,
  );
  st.push(`   D/C = Pu/(φ·Pn) = ${f2(axialRatio)} ${axialOK ? "✓" : "✗"}`);
  if (!axialOK)
    warnings.push("Compresión axial del tabique no verifica: aumentá e_muro.");

  // ── Verificaciones (D/C) ──
  const flexCap = phiB_Mn(omega, fcKNcm2, b, d_cm);
  const verifications: MuroVerification[] = [
    {
      label: "Flexión tabique",
      value: `M_u = ${f2(M_u_gov)} kN·m/m`,
      ratio: M_u_gov / Math.max(1e-9, flexCap),
      ok: M_u_gov <= flexCap + 1e-6,
    },
    {
      label: "Corte tabique",
      value: `Vu = ${f2(Vu)} kN/m`,
      ratio: shearRatio,
      ok: shearOK,
    },
    {
      label: "Compresión axial",
      value: `Pu = ${f2(Pu)} kN/m`,
      ratio: axialRatio,
      ok: axialOK,
    },
    {
      label: `Tensión de suelo (${input.tipo_zapata})`,
      value: `σ_max = ${f2(sigma_max)} kPa`,
      ratio:
        sigma_max /
        (input.tipo_zapata === "centrada"
          ? sigma_adm_kPa
          : 1.25 * sigma_adm_kPa),
      ok: sigmaOK,
    },
  ];

  st.push("");
  st.push(
    `=== RESUMEN: ${errors.length === 0 ? "✓ diseño completo" : "✗ errores"} ===`,
  );

  return {
    H,
    e_muro,
    d_cm,
    Ka,
    z0,
    z_wt,
    p_q,
    p_s_wt,
    p_s_base,
    p_sub_base,
    p_w_base,
    p_net_0,
    p_net_z0,
    p_net_wt,
    p_net_base,
    W_def: def.W,
    R_sup: def.R_sup,
    R_inf: def.R_inf,
    M_max_def: def.Mmax,
    z_M_max_def: def.zMmax,
    V_max_def: def.Vmax,
    z_strut,
    M_cant: prov.M_cant,
    R_strut: prov.R_strut,
    R_base_lower: prov.R_base_lower,
    M_max_prov: prov.Mmax,
    z_M_max_prov: prov.zMmax,
    V_max_prov: prov.Vmax,
    which,
    M_gov,
    M_u_gov,
    z_M_gov,
    Pu,
    PP_muro,
    PP_losa,
    mn,
    omega,
    As_cal,
    As_min,
    As_req,
    As_ext,
    vertInt,
    vertExt,
    horizInt,
    horizExt,
    Vu,
    phiVc: phiVcMetric,
    shearRatio,
    shearOK,
    P_serv,
    M_base,
    sigma_adm_kPa,
    sigma_cent,
    e0,
    sigma_max,
    sigmaOK,
    vuelo,
    rigidOK,
    q_u,
    M_u_zap,
    d_zap_cm,
    As_trans_cal,
    As_trans_min,
    As_trans_req,
    As_long,
    As_longSup,
    trans,
    longInf,
    longSup,
    Vu_zap,
    phiVc_zap,
    avsReq,
    avsMin,
    sMax: sMaxEstribo,
    legs: estribo.legs ?? 2,
    estribo,
    axialRatio,
    axialOK,
    verifications,
    steps: st,
    warnings,
    errors,
  };
}

function emptyResult(
  input: MuroInput,
  st: string[],
  warnings: string[],
  errors: string[],
): MuroResult {
  const zero = (): MuroBarSelection => ({ diam: 0, sep: 0, asProv: 0 });
  return {
    H: input.H,
    e_muro: input.e_muro,
    d_cm: 0,
    Ka: 0,
    z0: 0,
    z_wt: 0,
    p_q: 0,
    p_s_wt: 0,
    p_s_base: 0,
    p_sub_base: 0,
    p_w_base: 0,
    p_net_0: 0,
    p_net_z0: 0,
    p_net_wt: 0,
    p_net_base: 0,
    W_def: 0,
    R_sup: 0,
    R_inf: 0,
    M_max_def: 0,
    z_M_max_def: 0,
    V_max_def: 0,
    z_strut: 0,
    M_cant: 0,
    R_strut: 0,
    R_base_lower: 0,
    M_max_prov: 0,
    z_M_max_prov: 0,
    V_max_prov: 0,
    which: "definitivo",
    M_gov: 0,
    M_u_gov: 0,
    z_M_gov: 0,
    Pu: 0,
    PP_muro: 0,
    PP_losa: 0,
    mn: 0,
    omega: 0,
    As_cal: 0,
    As_min: 0,
    As_req: 0,
    As_ext: 0,
    vertInt: zero(),
    vertExt: zero(),
    horizInt: zero(),
    horizExt: zero(),
    Vu: 0,
    phiVc: 0,
    shearRatio: 0,
    shearOK: true,
    P_serv: 0,
    M_base: 0,
    sigma_adm_kPa: 0,
    sigma_cent: 0,
    e0: 0,
    sigma_max: 0,
    sigmaOK: true,
    vuelo: 0,
    rigidOK: true,
    q_u: 0,
    M_u_zap: 0,
    d_zap_cm: 0,
    As_trans_cal: 0,
    As_trans_min: 0,
    As_trans_req: 0,
    As_long: 0,
    As_longSup: 0,
    trans: zero(),
    longInf: { ...zero() },
    longSup: { ...zero() },
    Vu_zap: 0,
    phiVc_zap: 0,
    avsReq: 0,
    avsMin: 0,
    sMax: 0,
    legs: 2,
    estribo: { ...zero() },
    axialRatio: 0,
    axialOK: true,
    verifications: [],
    steps: st,
    warnings,
    errors,
  };
}
