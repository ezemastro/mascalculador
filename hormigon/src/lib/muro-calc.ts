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
  tipo_zapata: MuroTipoZapata; // centrada | excentrica (= medianera: tabique en el borde)
  // ¿Hay losa superior que arriostra la cabeza del muro? (default true)
  //   true  → tabique biapoyado (losa + zapata) y estado provisorio apuntalado.
  //   false → tabique en voladizo empotrado en la zapata (sin puntal).
  con_losa?: boolean;
  // Cargas del vecino (0 = no hay). x = distancia horizontal a la cara del
  // suelo del tabique; D = profundidad de apoyo desde el coronamiento.
  Q_vec?: number; // kN/m — franja/línea paralela al muro (medianera vecina)
  x_Q_vec?: number; // m
  P_vec?: number; // kN — columna/carga puntual
  x_P_vec?: number; // m
  D_vec?: number; // m
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
  K0: number;
  K: number; // coeficiente usado en el estado definitivo (K0 con losa, Ka sin losa)
  W_vec: number; // kN/m — resultante lateral de las cargas del vecino
  U_sub: number; // kN/m — subpresión bajo la zapata
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
  // Sin losa: voladizo
  con_losa: boolean;
  M_volad: number; // kN·m/m — momento de servicio en la base del voladizo (0 con losa)
  // Momentos últimos por cara del tabique
  M_u_suelo: number; // kN·m/m — tracción en la cara del suelo
  M_u_libre: number; // kN·m/m — tracción en la cara libre (excavación)
  M_u_nudo: number; // kN·m/m — momento del nudo tabique-zapata (medianera con losa)
  // Gobernante
  which: "definitivo" | "provisorio" | "voladizo";
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
  As_req: number; // cm²/m — vertical cara del suelo (vertInt)
  As_ext: number; // cm²/m — vertical cara libre (vertExt)
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
  P_serv: number; // kN/m — carga vertical total de servicio sobre el suelo
  M_base: number; // kN·m/m — momento de servicio respecto del centro de la base
  sigma_adm_kPa: number;
  sigma_cent: number; // kPa — N/B (presión media)
  e0: number; // m — excentricidad de la resultante (+ hacia la puntera)
  sigma_max: number; // kPa
  sigma_min: number; // kPa
  B_contacto: number; // m — ancho apoyado (< B si e > B/6)
  sigmaOK: boolean;
  x_muro: number; // m — eje del tabique medido desde el borde del lado del suelo
  PP_zap: number; // kN/m
  W_relleno: number; // kN/m — suelo sobre el talón (zapata centrada)
  T_losa: number; // kN/m — fuerza de la cupla losa/base que centra la presión (con losa)
  FS_vuelco: number; // sin losa (0 si no aplica)
  FS_desl: number; // sin losa (0 si no aplica)
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
  K: number; // coeficiente de empuje usado (Ka activo o K0 en reposo)
  z0: number; // m desde coronamiento
  z_wt: number; // m desde coronamiento (nivel freático)
  /** Presión del suelo + agua + sobrecarga (sin clamp de z0) a la profundidad z. */
  pActive(z: number): number;
  /** Presión lateral de las cargas del vecino a la profundidad z. */
  pVec(z: number): number;
  /** Presión neta: suelo (0 por encima de z0) + cargas del vecino. */
  pNet(z: number): number;
}

/** Ka de Rankine y K0 de Jaky (1 − sen φ). */
function earthCoefs(phiDeg: number): { Ka: number; K0: number } {
  const phiRad = (phiDeg * Math.PI) / 180;
  return {
    Ka: Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2),
    K0: 1 - Math.sin(phiRad),
  };
}

/** Promedio en 1 m de muro (|y| ≤ 0.5 m) del reparto lateral de una carga
 *  puntual: σh(y) = σh(0)·cos²(1.1·θ), tanθ = y/x (NAVFAC DM-7.2). */
function pointSpreadFactor(x: number): number {
  const N = 50;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const y = -0.5 + (i + 0.5) / N;
    const th = Math.atan(Math.abs(y) / Math.max(x, 0.01));
    s += Math.pow(Math.cos(Math.min(Math.PI / 2, 1.1 * th)), 2);
  }
  return s / N;
}

/** Empuje lateral por cargas del vecino (Boussinesq modificado por
 *  Terzaghi, NAVFAC DM-7.2 — ya incluye el efecto de muro rígido).
 *  Las cargas se aplican a la profundidad D desde el coronamiento; debajo
 *  se usa la altura H' = H − D y n = (z − D)/H', m = x/H'.
 *   Franja/línea Q (kN/m) paralela al muro:
 *     m ≤ 0.4: σh = 0.20·Q/H'·n/(0.16+n²)²   (resultante ≈ 0.55·Q)
 *     m > 0.4: σh = 1.28·Q/H'·m²·n/(m²+n²)²   (resultante = 0.64·Q/(m²+1))
 *   Columna P (kN), por metro de muro (promedio en 1 m):
 *     m ≤ 0.4: σh = 0.28·P/H'²·n²/(0.16+n²)³
 *     m > 0.4: σh = 1.77·P/H'²·m²·n²/(m²+n²)³ */
function vecinoPressure(input: MuroInput): (z: number) => number {
  const Q = input.Q_vec ?? 0;
  const xQ = input.x_Q_vec ?? 0;
  const P = input.P_vec ?? 0;
  const xP = input.x_P_vec ?? 0;
  const D = Math.max(0, input.D_vec ?? 0);
  const Hp = input.H - D;
  if ((Q <= 0 && P <= 0) || Hp <= 0) return () => 0;
  const fP = P > 0 ? pointSpreadFactor(xP) : 0;
  return (z: number) => {
    if (z <= D) return 0;
    const n = (z - D) / Hp;
    let s = 0;
    if (Q > 0) {
      const m = xQ / Hp;
      s +=
        m <= 0.4
          ? (((0.2 * Q) / Hp) * n) / Math.pow(0.16 + n * n, 2)
          : (((1.28 * Q) / Hp) * (m * m * n)) / Math.pow(m * m + n * n, 2);
    }
    if (P > 0) {
      const m = xP / Hp;
      const sh =
        m <= 0.4
          ? (((0.28 * P) / (Hp * Hp)) * (n * n)) / Math.pow(0.16 + n * n, 3)
          : (((1.77 * P) / (Hp * Hp)) * (m * m * n * n)) /
            Math.pow(m * m + n * n, 3);
      s += sh * fP;
    }
    return s;
  };
}

function buildPressure(input: MuroInput, K: number): PressureModel {
  // z0 (grieta de tracción) = max(0, 2·c/(FS·γ·√K) − q/γ)
  const z0 = Math.max(
    0,
    (2 * (input.c / input.FS_c)) / (input.gamma * Math.sqrt(K)) -
      input.q_lindero / input.gamma,
  );
  const z_wt = input.h_napa > 0 ? input.H - input.h_napa : input.H + 1; // fuera si no hay napa
  const p_q = K * input.q_lindero;

  const pActive = (z: number): number => {
    if (z <= 0) return 0;
    const pSoilAbove = K * input.gamma * Math.min(z, z_wt);
    const pSoilSub =
      z > z_wt ? K * (input.gamma_sat - GAMMA_W) * (z - z_wt) : 0;
    const pWater = z > z_wt ? GAMMA_W * (z - z_wt) : 0;
    return p_q + pSoilAbove + pSoilSub + pWater;
  };
  const pVec = vecinoPressure(input);
  const pNet = (z: number): number => (z < z0 ? 0 : pActive(z)) + pVec(z);

  return { K, z0, z_wt, pActive, pVec, pNet };
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
): Statics & {
  R_strut: number;
  R_base_lower: number;
  M_cant: number;
  M_low: number;
} {
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
    M_low: Math.abs(Mmax_low),
  };
}

/** Sin losa superior: voladizo empotrado en la zapata (z = H) y libre arriba.
 *  Devuelve el empuje total W (= corte en la base) y el momento en la base
 *  M_base = ∫ p(z)·(H − z) dz (tracción en la cara del suelo). */
function staticsVoladizo(
  pNet: (z: number) => number,
  H: number,
  N = 400,
): { W: number; M_base: number } {
  const dz = H / N;
  let W = 0;
  let M_base = 0;
  for (let i = 0; i < N; i++) {
    const za = i * dz;
    const zb = za + dz;
    const w = (pNet(za) + pNet(zb)) / 2;
    W += w * dz;
    M_base += w * dz * (H - (za + zb) / 2);
  }
  return { W, M_base };
}

/** Presión del suelo bajo una zapata corrida (por metro) con carga N y
 *  momento M respecto del centro de la base.
 *  - |e| ≤ B/6: distribución trapecial σ = N/B·(1 ± 6e/B).
 *  - B/6 < |e| < B/2: la zapata se despega; distribución triangular sobre el
 *    ancho apoyado B' = 3·(B/2 − |e|) → σmax = 2N/B', σmin = 0.
 *  - |e| ≥ B/2: la resultante cae fuera de la base (vuelca). */
export function soilPressure(
  N: number,
  M: number,
  B: number,
): {
  e: number;
  smax: number;
  smin: number;
  contacto: number;
  vuelca: boolean;
} {
  const e = N > 0 ? M / N : 0;
  const ea = Math.abs(e);
  if (N <= 0) return { e, smax: 0, smin: 0, contacto: B, vuelca: false };
  if (ea <= B / 6 + 1e-12) {
    return {
      e,
      smax: (N / B) * (1 + (6 * ea) / B),
      smin: (N / B) * (1 - (6 * ea) / B),
      contacto: B,
      vuelca: false,
    };
  }
  if (ea < B / 2) {
    const contacto = 3 * (B / 2 - ea);
    return { e, smax: (2 * N) / contacto, smin: 0, contacto, vuelca: false };
  }
  return { e, smax: Infinity, smin: 0, contacto: 0, vuelca: true };
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
  const conLosa = input.con_losa !== false;
  const medianera = input.tipo_zapata === "excentrica";
  const { Ka, K0 } = earthCoefs(input.phi);
  // Con losa el muro no puede desplazarse → empuje en reposo (K0) en el estado
  // definitivo. El estado provisorio (apuntalado, antes de la losa) y el
  // voladizo sin losa admiten el giro que moviliza el empuje activo (Ka).
  const pmA = buildPressure(input, Ka);
  const pm0 = buildPressure(input, K0);
  const pm = conLosa ? pm0 : pmA;
  const K = pm.K;
  const z0 = pm.z0;
  const z_wt = pm.z_wt;
  st.push("");
  st.push(
    conLosa
      ? "1. Empujes — estado definitivo EN REPOSO (losa: el muro no se desplaza); provisorio activo"
      : "1. Empujes activos de Rankine (sin losa: el voladizo puede girar)",
  );
  st.push(
    `   Ka = tan²(45° − φ/2) = tan²(45° − ${f1(input.phi)}°/2) = ${f3(Ka)} · K0 = 1 − sen φ = ${f3(K0)} → K usado = ${f3(K)}${conLosa ? " (K0)" : " (Ka)"}`,
  );
  st.push(
    `   Grieta de tracción z0 = máx(0, 2·c/(FS·γ·√K) − q/γ) = ${f2(z0)} m`,
  );
  if (input.h_napa > 0)
    st.push(
      `   Nivel freático a ${f2(input.h_napa)} m desde la base → z_wt = H − h_napa = ${f2(z_wt)} m desde el coronamiento`,
    );
  else st.push(`   Sin napa (γw = ${f2(GAMMA_W)} kN/m³ no actúa).`);

  const p_q = K * input.q_lindero;
  const p_s_wt =
    input.h_napa > 0 ? K * input.gamma * z_wt : K * input.gamma * H;
  const p_s_base = K * input.gamma * Math.min(H, z_wt);
  const p_sub_base =
    input.h_napa > 0 ? K * (input.gamma_sat - GAMMA_W) * (H - z_wt) : 0;
  const p_w_base = input.h_napa > 0 ? GAMMA_W * (H - z_wt) : 0;
  const p_net_0 = pm.pNet(0);
  const p_net_z0 = pm.pNet(z0);
  const p_net_wt = pm.pNet(Math.min(z_wt, H));
  const p_net_base = pm.pNet(H);

  st.push(
    `   p_q = K·q = ${f2(p_q)} kN/m² (uniforme) · p_s(base) = ${f2(p_s_base)} kN/m²`,
  );
  if (input.h_napa > 0)
    st.push(
      `   sumergido base = ${f2(p_sub_base)} kN/m² · hidrostática base = ${f2(p_w_base)} kN/m²`,
    );
  // Cargas del vecino
  const Q_vec = input.Q_vec ?? 0;
  const P_vec = input.P_vec ?? 0;
  const D_vec = Math.max(0, input.D_vec ?? 0);
  let W_vec = 0;
  if (Q_vec > 0 || P_vec > 0) {
    const N = 200;
    for (let i = 0; i < N; i++) {
      const z = ((i + 0.5) / N) * H;
      W_vec += pm.pVec(z) * (H / N);
    }
    st.push(
      `   Cargas del vecino (Boussinesq modificado, NAVFAC DM-7.2), aplicadas a D = ${f2(D_vec)} m bajo el coronamiento:`,
    );
    if (Q_vec > 0)
      st.push(
        `     franja/línea Q = ${f2(Q_vec)} kN/m a x = ${f2(input.x_Q_vec ?? 0)} m del muro`,
      );
    if (P_vec > 0)
      st.push(
        `     columna P = ${f2(P_vec)} kN a x = ${f2(input.x_P_vec ?? 0)} m (promedio en 1 m de muro con reparto cos²(1.1θ))`,
      );
    const zs = [0.25, 0.5, 0.75, 1].map((f) => D_vec + f * (H - D_vec));
    st.push(
      `     σh: ${zs.map((z) => `z=${f2(z)} → ${f2(pm.pVec(z))}`).join(" · ")} kN/m² · resultante = ${f2(W_vec)} kN/m`,
    );
    if (D_vec >= H)
      warnings.push(
        "Las cargas del vecino están por debajo de la base del tabique: no se consideran.",
      );
  }
  st.push(
    `   p_net: z=0 → ${f2(p_net_0)} · z=z0 (${f2(z0)} m) → ${f2(p_net_z0)} · z=z_wt (${f2(Math.min(z_wt, H))} m) → ${f2(p_net_wt)} · z=H → ${f2(p_net_base)} kN/m²`,
  );

  // ── Configuración: losa superior y tipo de zapata ──
  const b = 100; // cm — ancho de diseño por metro
  const B = input.B_zap;
  const H_z = input.H_zap;
  st.push(
    `Configuración: ${conLosa ? "CON losa superior (cabeza arriostrada)" : "SIN losa superior (tabique en voladizo)"} · zapata ${medianera ? "excéntrica / medianera (tabique en el borde, puntera hacia la excavación)" : "centrada (tabique en el eje)"}`,
  );

  // ── 2/3. Estática del tabique ──
  let def: Statics;
  let prov: ReturnType<typeof staticsProvisorio>;
  let z_strut = 0;
  let M_volad = 0;
  st.push("");
  if (conLosa) {
    st.push(
      "2. Estado definitivo — muro biapoyado (cabeza en losa, base en zapata)",
    );
    def = staticsDefinitivo(pm.pNet, H);
    st.push(
      `   Empuje W = ${f2(def.W)} kN/m · R_cabeza = ${f2(def.R_sup)} kN/m · R_base = ${f2(def.R_inf)} kN/m`,
    );
    st.push(
      `   M_max = ${f2(Math.abs(def.Mmax))} kN·m/m en z = ${f2(def.zMmax)} m (tracción en la cara libre) · V_max = ${f2(def.Vmax)} kN/m`,
    );

    st.push("");
    st.push(
      "3. Estado provisorio — muro apuntalado a H_puntal con pie en zapata",
    );
    z_strut = H - input.H_puntal;
    z_strut = Math.max(0.05 * H, Math.min(0.95 * H, z_strut));
    st.push(
      `   Modelo: voladizo libre superior 0..z_strut empotrado en el puntal + tramo inferior z_strut..H apoyado en puntal y pie.`,
    );
    prov = staticsProvisorio(pmA.pNet, H, z_strut);
    st.push(
      `   Voladizo superior: T_puntal = ${f2(prov.R_strut)} kN/m · M_cant(en puntal) = ${f2(Math.abs(prov.M_cant))} kN·m/m (tracción en la cara del suelo)`,
    );
    st.push(
      `   Tramo inferior: R_puntal = ${f2(prov.R_strut)} kN/m · R_pie = ${f2(prov.R_base_lower)} kN/m · M_max = ${f2(prov.M_low)} kN·m/m (tracción en la cara libre)`,
    );
  } else {
    st.push(
      "2. Sin losa superior — tabique en voladizo empotrado en la zapata",
    );
    const vol = staticsVoladizo(pm.pNet, H);
    M_volad = vol.M_base;
    def = {
      W: vol.W,
      R_sup: 0,
      R_inf: vol.W,
      Mmax: vol.M_base,
      zMmax: H,
      Vmax: vol.W,
    };
    prov = {
      W: 0,
      R_sup: 0,
      R_inf: 0,
      Mmax: 0,
      zMmax: 0,
      Vmax: 0,
      R_strut: 0,
      R_base_lower: 0,
      M_cant: 0,
      M_low: 0,
    };
    st.push(`   Empuje W = ∫p·dz = ${f2(vol.W)} kN/m (= corte en la base)`);
    st.push(
      `   M_base = ∫p·(H − z)·dz = ${f2(vol.M_base)} kN·m/m (tracción en la cara del suelo)`,
    );
    st.push("");
    st.push(
      "3. Estado provisorio — no aplica (sin losa el voladizo ya es el estado definitivo)",
    );
  }

  // ── 4. Cargas verticales ──
  st.push("");
  st.push("4. Cargas verticales por metro lineal");
  const PP_muro = gammaC * e_muro * H; // kN/m
  const PP_losa = gammaC * input.e_losa; // kN/m²
  const D_losa = conLosa ? (PP_losa + input.CM_losa) * input.ancho_inf : 0;
  const L_losa_m = conLosa ? input.L_losa * input.ancho_inf : 0;
  st.push(
    `   PP_muro = γc·e_muro·H = ${f2(gammaC)}·${f2(e_muro)}·${f2(H)} = ${f2(PP_muro)} kN/m`,
  );
  if (conLosa) {
    st.push(
      `   Losa: D = (γc·e_losa + CM)·ancho_inf = (${f2(PP_losa)} + ${f2(input.CM_losa)})·${f2(input.ancho_inf)} = ${f2(D_losa)} kN/m · L = ${f2(input.L_losa)}·${f2(input.ancho_inf)} = ${f2(L_losa_m)} kN/m`,
    );
  } else {
    st.push("   Sin losa: no hay carga de losa sobre el tabique.");
  }
  const Pu = 1.2 * (PP_muro + D_losa) + 1.6 * L_losa_m;
  st.push(
    `   Pu (tabique) = 1.2·(PP_muro + D_losa) + 1.6·L_losa = ${f2(Pu)} kN/m`,
  );

  // ── 5. Zapata: presiones sobre el suelo y estabilidad ──
  st.push("");
  st.push("5. Zapata corrida — presiones sobre el suelo");
  const sigma_adm_MPa =
    input.sigma_adm_unit === "kg/cm2"
      ? input.sigma_adm_suelo * 0.098
      : input.sigma_adm_suelo;
  const sigma_adm_kPa = sigma_adm_MPa * 1000;
  st.push(
    `   σ_adm suelo = ${f2(input.sigma_adm_suelo)} ${input.sigma_adm_unit} = ${f2(sigma_adm_kPa)} kPa`,
  );
  // x se mide desde el borde de la zapata del lado del suelo retenido.
  const heel = medianera ? 0 : (B - e_muro) / 2; // talón (bajo el relleno)
  const vuelo = medianera ? B - e_muro : (B - e_muro) / 2; // puntera
  const x_muro = medianera ? e_muro / 2 : B / 2;
  const PP_zap = gammaC * B * H_z;
  // Relleno sobre el talón: peso total (γ sobre la napa, γ_sat debajo).
  const W_relleno =
    heel *
    (input.gamma * Math.min(H, z_wt) + input.gamma_sat * Math.max(0, H - z_wt));
  // Subpresión: con napa, el agua empuja la zapata hacia arriba con
  // u = γw·(h_napa + H_zap) uniforme en todo el ancho B.
  const u_sub = input.h_napa > 0 ? GAMMA_W * (input.h_napa + H_z) : 0;
  const U_sub = u_sub * B;
  const P_muro_D = PP_muro + D_losa;
  const P_muro_L = L_losa_m;
  const P_serv = P_muro_D + P_muro_L + PP_zap + W_relleno;
  st.push(
    `   Tabique a x = ${f2(x_muro)} m del borde del lado del suelo · talón = ${f2(heel)} m · puntera (vuelo) = ${f2(vuelo)} m`,
  );
  st.push(
    `   N = P_tabique (${f2(P_muro_D + P_muro_L)}) + PP_zap γc·B·H_zap (${f2(PP_zap)})${heel > 0 ? ` + relleno sobre talón (${f2(W_relleno)})` : ""} = ${f2(P_serv)} kN/m`,
  );
  // Carga efectiva sobre el suelo (descontada la subpresión).
  const N_ef = P_serv - U_sub;
  if (U_sub > 0) {
    st.push(
      `   Subpresión: u = γw·(h_napa + H_zap) = ${f2(GAMMA_W)}·(${f2(input.h_napa)} + ${f2(H_z)}) = ${f2(u_sub)} kPa → U = u·B = ${f2(U_sub)} kN/m`,
    );
    st.push(
      `   N efectiva sobre el suelo = N − U = ${f2(P_serv)} − ${f2(U_sub)} = ${f2(N_ef)} kN/m`,
    );
    if (N_ef <= 0)
      errors.push(
        "Flotación: la subpresión supera el peso del muro y la zapata. Aumentá el peso o anclá la zapata.",
      );
  }
  // Momento de las cargas verticales respecto del centro de la base
  // (positivo = la resultante se corre hacia la puntera / excavación).
  const M_V =
    (P_muro_D + P_muro_L) * (x_muro - B / 2) + W_relleno * (heel / 2 - B / 2);
  // Empuje: con losa lo toman la losa y la base; sin losa vuelca la zapata.
  const M_E = conLosa ? 0 : M_volad + def.W * H_z;
  let pres: ReturnType<typeof soilPressure>;
  let sigmaOK: boolean;
  let T_losa = 0;
  let FS_vuelco = 0;
  let FS_desl = 0;
  const sigma_cent = Math.max(0, N_ef) / B;
  const nTxt = U_sub > 0 ? "N_ef" : "N";
  if (conLosa) {
    pres = soilPressure(Math.max(0, N_ef), 0, B);
    T_losa = Math.abs(M_V) / (H + H_z);
    sigmaOK = pres.smax <= sigma_adm_kPa;
    st.push(
      `   Con losa: la losa y la base forman una cupla que centra la reacción → presión uniforme σ = ${nTxt}/B = ${f2(N_ef)}/${f2(B)} = ${f2(pres.smax)} kPa ≤ ${f2(sigma_adm_kPa)} kPa ${sigmaOK ? "✓" : "✗"}`,
    );
    if (T_losa > 0.005)
      st.push(
        `   Excentricidad de las cargas M_V = ${f2(M_V)} kN·m/m → T = |M_V|/(H + H_zap) = ${f2(Math.abs(M_V))}/${f2(H + H_z)} = ${f2(T_losa)} kN/m (fuerza horizontal adicional a tomar por la losa y por la base)`,
      );
  } else {
    const M_tot = M_V + M_E;
    pres = soilPressure(Math.max(0, N_ef), M_tot, B);
    st.push(
      `   Momentos respecto del centro de la base: cargas M_V = ${f2(M_V)} · empuje M_E = M_base + W·H_zap = ${f2(M_volad)} + ${f2(def.W)}·${f2(H_z)} = ${f2(M_E)} → M = ${f2(M_tot)} kN·m/m`,
    );
    st.push(
      `   e = M/${nTxt} = ${f2(M_tot)}/${f2(N_ef)} = ${f2(pres.e)} m · B/6 = ${f2(B / 6)} m`,
    );
    if (pres.vuelca) {
      sigmaOK = false;
      st.push(
        `   |e| ≥ B/2 = ${f2(B / 2)} m → la resultante cae fuera de la base: VUELCA ✗`,
      );
      errors.push(
        "La zapata vuelca: la resultante cae fuera de la base (e ≥ B/2). Aumentá B_zap.",
      );
    } else {
      if (Math.abs(pres.e) <= B / 6 + 1e-12) {
        st.push(
          `   |e| ≤ B/6 → trapecio: σ = ${nTxt}/B·(1 ± 6e/B) → σ_max = ${f2(pres.smax)} kPa · σ_min = ${f2(pres.smin)} kPa`,
        );
      } else {
        st.push(
          `   |e| > B/6 → la zapata se despega: triángulo sobre B' = 3·(B/2 − |e|) = 3·(${f2(B / 2)} − ${f2(Math.abs(pres.e))}) = ${f2(pres.contacto)} m`,
        );
        st.push(
          `   σ_max = 2·${nTxt}/B' = 2·${f2(N_ef)}/${f2(pres.contacto)} = ${f2(pres.smax)} kPa · σ_min = 0`,
        );
        warnings.push(
          `Excentricidad e = ${f2(Math.abs(pres.e))} m > B/6 = ${f2(B / 6)} m: la zapata apoya solo en ${f2(pres.contacto)} m de ${f2(B)} m (σ_max con distribución triangular).`,
        );
      }
      const okMed = sigma_cent <= sigma_adm_kPa;
      const okMax = pres.smax <= 1.25 * sigma_adm_kPa;
      sigmaOK = okMed && okMax;
      st.push(
        `   σ_media = ${nTxt}/B = ${f2(sigma_cent)} ≤ ${f2(sigma_adm_kPa)} kPa ${okMed ? "✓" : "✗"} · σ_max = ${f2(pres.smax)} ≤ 1.25·σ_adm = ${f2(1.25 * sigma_adm_kPa)} kPa ${okMax ? "✓" : "✗"}`,
      );
    }
    // Vuelco respecto de la arista de la puntera (x = B), solo cargas permanentes.
    const M_est =
      P_muro_D * (B - x_muro) + PP_zap * (B / 2) + W_relleno * (B - heel / 2);
    // La subpresión (resultante en B/2) suma al momento volcador.
    const M_volc = M_E + U_sub * (B / 2);
    FS_vuelco = M_volc > 0 ? M_est / M_volc : Infinity;
    const mu = Math.tan((2 / 3) * ((input.phi * Math.PI) / 180));
    const N_D = Math.max(0, P_muro_D + PP_zap + W_relleno - U_sub);
    FS_desl = def.W > 0 ? (mu * N_D) / def.W : Infinity;
    st.push("");
    st.push(
      "5b. Estabilidad (sin losa) — solo cargas permanentes, sin empuje pasivo",
    );
    st.push(
      `   Vuelco respecto de la puntera: FS = M_estab/M_volc = ${f2(M_est)}/${f2(M_volc)}${U_sub > 0 ? ` (empuje ${f2(M_E)} + subpresión U·B/2 ${f2((U_sub * B) / 2)})` : ""} = ${f2(FS_vuelco)} ≥ 1.5 ${FS_vuelco >= 1.5 ? "✓" : "✗"}`,
    );
    st.push(
      `   Deslizamiento: μ = tan(2φ/3) = ${f3(mu)} · FS = μ·N_D${U_sub > 0 ? "(−U)" : ""}/W = ${f3(mu)}·${f2(N_D)}/${f2(def.W)} = ${f2(FS_desl)} ≥ 1.5 ${FS_desl >= 1.5 ? "✓" : "✗"}`,
    );
    if (FS_vuelco < 1.5)
      warnings.push("Vuelco: FS < 1.5. Aumentá B_zap (o agregá talón / losa).");
    if (FS_desl < 1.5)
      warnings.push(
        "Deslizamiento: FS < 1.5. Aumentá B_zap, agregá un diente o contá con la losa de piso.",
      );
  }
  const sigma_max = pres.vuelca ? 0 : pres.smax;
  const e0 = pres.e;

  // Presión mayorada para armar la zapata (1.2D + 1.6L + 1.6 empuje),
  // neta del peso propio de la zapata (que actúa sobre la puntera).
  const N_u = 1.2 * (P_muro_D + PP_zap + W_relleno) + 1.6 * P_muro_L;
  const M_uV =
    (1.2 * P_muro_D + 1.6 * P_muro_L) * (x_muro - B / 2) +
    1.2 * W_relleno * (heel / 2 - B / 2);
  const M_uE = 1.6 * M_E;
  // La presión total hacia arriba sobre la zapata es suelo + agua: con presión
  // uniforme vale N_u/B; con excentricidad, la parte efectiva se reparte
  // (trapecio/triángulo) y el agua U suma uniforme.
  let q_u_bruta = N_u / B;
  let e0_u = 0;
  let vuelcaU = false;
  if (!conLosa) {
    const pu = soilPressure(Math.max(0, N_u - U_sub), M_uV + M_uE, B);
    e0_u = pu.e;
    if (pu.vuelca) {
      vuelcaU = true;
      q_u_bruta = 0;
      if (!pres.vuelca)
        errors.push(
          "Con cargas mayoradas la resultante cae fuera de la base: aumentá B_zap.",
        );
    } else q_u_bruta = pu.smax + u_sub;
  }
  const q_u = Math.max(0, q_u_bruta - 1.2 * gammaC * H_z);
  // Medianera con losa: el momento de la puntera pasa al pie del tabique.
  const M_u_nudo = conLosa && medianera ? (q_u * vuelo * vuelo) / 2 : 0;

  // ── 6. Momentos de diseño y dimensionamiento del tabique ──
  let M_u_libre: number;
  let M_u_suelo: number;
  let V_u_tab: number;
  let which: "definitivo" | "provisorio" | "voladizo";
  let z_M_gov: number;
  if (conLosa) {
    const Md = 1.6 * Math.abs(def.Mmax);
    const Mp = 1.6 * Math.abs(prov.Mmax);
    M_u_libre = 1.6 * Math.max(Math.abs(def.Mmax), prov.M_low);
    M_u_suelo = Math.max(1.6 * Math.abs(prov.M_cant), M_u_nudo);
    V_u_tab =
      1.6 * Math.max(def.Vmax, prov.Vmax) + (M_u_nudo > 0 ? M_u_nudo / H : 0);
    which = Mp > Math.max(Md, M_u_nudo) ? "provisorio" : "definitivo";
    z_M_gov =
      which === "provisorio" ? prov.zMmax : M_u_nudo > Md ? H : def.zMmax;
  } else {
    M_u_libre = 0;
    M_u_suelo = 1.6 * M_volad;
    V_u_tab = 1.6 * def.W;
    which = "voladizo";
    z_M_gov = H;
  }
  const M_u_gov = Math.max(M_u_libre, M_u_suelo);
  const M_gov = M_u_gov / 1.6;
  st.push("");
  st.push(
    `6. Momentos últimos del tabique (1.6·empuje) y dimensionamiento (b = 100 cm, d = ${f2(d_cm)} cm)`,
  );
  if (conLosa) {
    st.push(
      `   Cara libre (excavación): M_u = 1.6·máx(M_def = ${f2(Math.abs(def.Mmax))}, M_prov,tramo = ${f2(prov.M_low)}) = ${f2(M_u_libre)} kN·m/m`,
    );
    st.push(
      `   Cara del suelo: M_u = máx(1.6·M_cant = ${f2(1.6 * Math.abs(prov.M_cant))}${medianera ? `, M_nudo = q_u·v²/2 = ${f2(q_u)}·${f2(vuelo)}²/2 = ${f2(M_u_nudo)}` : ""}) = ${f2(M_u_suelo)} kN·m/m`,
    );
    if (medianera)
      st.push(
        "   (Medianera con losa: el momento de la puntera de la zapata se transmite al pie del tabique y lo toma la cupla losa/base.)",
      );
  } else {
    st.push(
      `   Cara del suelo (base del voladizo): M_u = 1.6·M_base = 1.6·${f2(M_volad)} = ${f2(M_u_suelo)} kN·m/m`,
    );
    st.push("   Cara libre: sin momento de cálculo → armadura mínima.");
  }
  st.push(
    `   Estado gobernante: ${which} · M_u = ${f2(M_u_gov)} kN·m/m (z = ${f2(z_M_gov)} m)`,
  );

  const As_min_flex =
    Math.max((0.25 * Math.sqrt(fcMPa)) / fyMPa, 1.4 / fyMPa) * b * d_cm;
  const As_min_rho = 0.0018 * b * d_cm;
  const As_min = Math.max(As_min_flex, As_min_rho);
  const designFace = (Mu: number) => {
    const mnF = (Mu * 100) / (PHI_B * 0.85 * fcKNcm2 * b * d_cm * d_cm);
    let omegaF = omegaFromMn(mnF);
    let fail = false;
    if (mnF > 0.32 || omegaF >= 1 || !Number.isFinite(omegaF)) {
      fail = true;
      omegaF = Math.min(omegaF, 1);
    }
    const AsCal =
      Mu > 0
        ? (omegaF * 0.85 * fcKNcm2 * b * d_cm) / fyKNcm2 -
          Pu / (PHI_B * fyKNcm2)
        : 0;
    const AsReq = AsCal < As_min ? Math.max(As_min, (4 / 3) * AsCal) : AsCal;
    return { mn: mnF, omega: omegaF, As_cal: AsCal, As_req: AsReq, fail };
  };
  const faceSuelo = designFace(M_u_suelo);
  const faceLibre = designFace(M_u_libre);
  if (faceSuelo.fail || faceLibre.fail)
    errors.push(
      "Sección insuficiente para el momento de diseño: aumentá e_muro (o fc).",
    );
  const gov = M_u_suelo >= M_u_libre ? faceSuelo : faceLibre;
  const mn = gov.mn;
  const omega = gov.omega;
  const As_cal = gov.As_cal;
  const As_req = faceSuelo.As_req; // vertical cara del suelo
  const As_ext = faceLibre.As_req; // vertical cara libre
  st.push(
    `   As_mín = máx(0.25√f'c/fy, 1.4/fy, 0.0018)·b·d = ${f2(As_min)} cm²/m`,
  );
  st.push(
    `   Cara del suelo: m_n = ${f4(faceSuelo.mn)} · ω = ${f4(faceSuelo.omega)} · As_cal = ${f2(faceSuelo.As_cal)} → As_req = ${f2(As_req)} cm²/m`,
  );
  st.push(
    `   Cara libre: m_n = ${f4(faceLibre.mn)} · ω = ${f4(faceLibre.omega)} · As_cal = ${f2(faceLibre.As_cal)} → As_req = ${f2(As_ext)} cm²/m`,
  );
  st.push(
    "   (As_cal = ω·0.85·f'c·b·d/fy − Pu/(φ·fy); si As_cal < As_mín ⇒ As_req = máx(As_mín, 4/3·As_cal))",
  );

  const smaxInt = Math.min(3 * e_muro * 100, 30);
  const vertInt = adoptSelection(
    selectBars(As_req, smaxInt),
    As_req,
    input.adopcion?.vertInt,
  );
  st.push(
    `   Vertical cara del suelo: Ø${vertInt.diam} c/ ${vertInt.sep} cm → As_prov = ${f2(vertInt.asProv)} cm²/m ${vertInt.ok ? "✓" : "✗ insuficiente"}`,
  );
  if (vertInt.asProv < As_req)
    warnings.push(
      "Armadura vertical de la cara del suelo insuficiente con el separado máximo: aumentá e_muro o fc.",
    );
  if (input.adopcion?.vertInt && !vertInt.ok)
    warnings.push(
      "Vertical cara del suelo adoptada insuficiente respecto a As requerido.",
    );

  const vertExt = adoptSelection(
    selectBars(As_ext, smaxInt),
    As_ext,
    input.adopcion?.vertExt,
  );
  st.push(
    `   Vertical cara libre: Ø${vertExt.diam} c/ ${vertExt.sep} cm → As_prov = ${f2(vertExt.asProv)} cm²/m ${vertExt.ok ? "✓" : "✗ insuficiente"}`,
  );
  if (vertExt.asProv < As_ext)
    warnings.push(
      "Armadura vertical de la cara libre insuficiente con el separado máximo: aumentá e_muro o fc.",
    );
  if (input.adopcion?.vertExt && !vertExt.ok)
    warnings.push(
      "Vertical cara libre adoptada insuficiente respecto a As requerido.",
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
    `   Horizontal cara del suelo (ρ_mín 0.0018 por cara): As = ${f2(As_h)} cm²/m → Ø${horizInt.diam} c/ ${horizInt.sep} cm (s ≤ 45 cm) ${horizInt.ok ? "✓" : "✗"}`,
  );
  st.push(
    `   Horizontal cara libre (ρ_mín 0.0018 por cara): As = ${f2(As_h)} cm²/m → Ø${horizExt.diam} c/ ${horizExt.sep} cm (s ≤ 45 cm) ${horizExt.ok ? "✓" : "✗"}`,
  );
  if (horizInt.sep > 45 || horizExt.sep > 45)
    warnings.push("Separación horizontal supera los 45 cm recomendados.");
  if (input.adopcion?.horizInt && !horizInt.ok)
    warnings.push(
      "Horizontal cara del suelo adoptada insuficiente respecto al mínimo de retracción (0.18%).",
    );
  if (input.adopcion?.horizExt && !horizExt.ok)
    warnings.push(
      "Horizontal cara libre adoptada insuficiente respecto al mínimo de retracción (0.18%).",
    );

  // ── 7. Corte del tabique ──
  st.push("");
  st.push("7. Verificación al corte del tabique");
  const Vu = V_u_tab;
  // φVc = 0.75·0.17·√f'c·b·d (SI) ≡ forma métrica 0.75·b·d·√f'c/60 (kN) con
  // f'c MPa y b,d en cm.
  const phiVcMetric = (PHI_V * b * d_cm * Math.sqrt(fcMPa)) / 60;
  const shearRatio = Vu / phiVcMetric;
  const shearOK = shearRatio <= 1;
  if (conLosa)
    st.push(
      `   Vu = 1.6·V_máx${M_u_nudo > 0 ? " + M_nudo/H" : ""} = 1.6·${f2(Math.max(def.Vmax, prov.Vmax))}${M_u_nudo > 0 ? ` + ${f2(M_u_nudo)}/${f2(H)}` : ""} = ${f2(Vu)} kN/m`,
    );
  else
    st.push(
      `   Vu = 1.6·W = 1.6·${f2(def.W)} = ${f2(Vu)} kN/m (base del voladizo)`,
    );
  st.push(
    `   φVc ≈ 0.75·b·d·√f'c/60 = 0.75·${b}·${f2(d_cm)}·√${fcMPa}/60 = ${f2(phiVcMetric)} kN/m`,
  );
  st.push(
    `   D/C = Vu/φVc = ${f2(shearRatio)} ${shearOK ? "✓" : "✗ NO cumple — aumentar e_muro"}`,
  );
  if (!shearOK) warnings.push("Corte del tabique no verifica: aumentá e_muro.");

  // ── 8. Zapata: armadura ──
  st.push("");
  st.push("8. Zapata corrida — armadura de la puntera");
  const rigidOK = vuelo <= 2 * H_z;
  st.push(
    `   Vuelo v = ${medianera ? "B − e_muro" : "(B − e_muro)/2"} = ${f2(vuelo)} m ≤ 2·H_zap = ${f2(2 * H_z)} m ${rigidOK ? "✓" : "✗ — aumentar H_zap"}`,
  );
  if (!rigidOK)
    warnings.push(
      "Vuelo de la zapata excede 2·H_zap (ángulo de biela): aumentá H_zap.",
    );

  const d_zap_cm = H_z * 100 - recZapCm;
  st.push(`   d_zap = ${f2(H_z * 100)} − ${f2(recZapCm)} = ${f2(d_zap_cm)} cm`);
  st.push(
    `   Cargas mayoradas: N_u = 1.2·(P_D + PP_zap${heel > 0 ? " + relleno" : ""}) + 1.6·L = ${f2(N_u)} kN/m`,
  );
  if (conLosa) {
    st.push(
      `   Con losa (presión uniforme): q_u = N_u/B = ${f2(q_u_bruta)} kPa`,
    );
  } else {
    st.push(
      `   M_u = M_uV + 1.6·M_E = ${f2(M_uV)} + ${f2(M_uE)} = ${f2(M_uV + M_uE)} kN·m/m → e_u = M_u/N_u = ${f2(e0_u)} m → ${vuelcaU ? "|e_u| ≥ B/2: VUELCA — la puntera no se puede dimensionar ✗" : `q_u,max = ${f2(q_u_bruta)} kPa ${Math.abs(e0_u) > B / 6 ? `(triángulo sobre B' = ${f2(3 * (B / 2 - Math.abs(e0_u)))} m, e_u > B/6)` : "(trapecio)"}`}`,
    );
  }
  st.push(
    `   q_u neta en la puntera = q_u − 1.2·γc·H_zap = ${f2(q_u_bruta)} − ${f2(1.2 * gammaC * H_z)} = ${f2(q_u)} kPa (se toma uniforme en el vuelo, del lado seguro)`,
  );
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
  // Por metro lineal: Ag = b·e_muro (antes usaba la altura H por error).
  const Ag = b * (e_muro * 100); // cm²/m
  const As_total = vertInt.asProv + vertExt.asProv; // cm²/m
  const Pn = 0.85 * fcKNcm2 * Ag + As_total * fyKNcm2;
  const axialRatio = Pu / (PHI_P * Pn);
  const axialOK = axialRatio <= 1;
  st.push(
    `   Ag = b·e_muro = 100·${f2(e_muro * 100)} = ${f2(Ag)} cm²/m · As = ${f2(As_total)} cm²/m`,
  );
  st.push(
    `   Pn = 0.85·f'c·Ag + As·fy = ${f2(0.85 * fcKNcm2 * Ag)} + ${f2(As_total * fyKNcm2)} = ${f2(Pn)} kN`,
  );
  st.push(`   D/C = Pu/(φ·Pn) = ${f2(axialRatio)} ${axialOK ? "✓" : "✗"}`);
  if (!axialOK)
    warnings.push("Compresión axial del tabique no verifica: aumentá e_muro.");

  // ── Verificaciones (D/C) ──
  // Capacidad a flexión con la armadura PROVISTA de cada cara.
  const capOf = (asProv: number) =>
    phiB_Mn((asProv * fyKNcm2) / (0.85 * fcKNcm2 * b * d_cm), fcKNcm2, b, d_cm);
  const capSuelo = capOf(vertInt.asProv);
  const capLibre = capOf(vertExt.asProv);
  const verifications: MuroVerification[] = [
    {
      label: "Flexión tabique (cara suelo)",
      value: `M_u = ${f2(M_u_suelo)} kN·m/m`,
      ratio: M_u_suelo / Math.max(1e-9, capSuelo),
      ok: M_u_suelo <= capSuelo + 1e-6,
    },
    {
      label: "Flexión tabique (cara libre)",
      value: `M_u = ${f2(M_u_libre)} kN·m/m`,
      ratio: M_u_libre / Math.max(1e-9, capLibre),
      ok: M_u_libre <= capLibre + 1e-6,
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
      label: `Tensión de suelo (${medianera ? "medianera" : "centrada"})`,
      value: pres.vuelca ? "vuelca (e ≥ B/2)" : `σ_max = ${f2(sigma_max)} kPa`,
      ratio: pres.vuelca
        ? 99
        : conLosa
          ? sigma_max / sigma_adm_kPa
          : Math.max(
              sigma_cent / sigma_adm_kPa,
              sigma_max / (1.25 * sigma_adm_kPa),
            ),
      ok: sigmaOK,
    },
  ];
  if (!conLosa) {
    verifications.push(
      {
        label: "Vuelco (FS ≥ 1.5)",
        value: `FS = ${f2(FS_vuelco)}`,
        ratio: 1.5 / Math.max(1e-9, FS_vuelco),
        ok: FS_vuelco >= 1.5,
      },
      {
        label: "Deslizamiento (FS ≥ 1.5)",
        value: `FS = ${f2(FS_desl)}`,
        ratio: 1.5 / Math.max(1e-9, FS_desl),
        ok: FS_desl >= 1.5,
      },
    );
  }

  st.push("");
  st.push(
    `=== RESUMEN: ${errors.length === 0 ? "✓ diseño completo" : "✗ errores"} ===`,
  );

  return {
    H,
    e_muro,
    d_cm,
    Ka,
    K0,
    K,
    W_vec,
    U_sub,
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
    con_losa: conLosa,
    M_volad,
    M_u_suelo,
    M_u_libre,
    M_u_nudo,
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
    M_base: conLosa ? M_V : M_V + M_E,
    sigma_adm_kPa,
    sigma_cent,
    e0,
    sigma_max,
    sigma_min: pres.smin,
    B_contacto: pres.contacto,
    sigmaOK,
    x_muro,
    PP_zap,
    W_relleno,
    T_losa,
    FS_vuelco: Number.isFinite(FS_vuelco) ? FS_vuelco : 99,
    FS_desl: Number.isFinite(FS_desl) ? FS_desl : 99,
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
    K0: 0,
    K: 0,
    W_vec: 0,
    U_sub: 0,
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
    con_losa: input.con_losa !== false,
    M_volad: 0,
    M_u_suelo: 0,
    M_u_libre: 0,
    M_u_nudo: 0,
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
    sigma_min: 0,
    B_contacto: 0,
    sigmaOK: true,
    x_muro: 0,
    PP_zap: 0,
    W_relleno: 0,
    T_losa: 0,
    FS_vuelco: 0,
    FS_desl: 0,
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
