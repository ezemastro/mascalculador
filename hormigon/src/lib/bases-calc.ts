// bases-calc.ts — Dimensionado de bases de hormigón armado según CIRSOC 201
//
// Implementa los procedimientos normativos para:
//   - Base centrada aislada (13 pasos)
//   - Base medianera con viga de fundación (7 pasos)
//   - Base medianera con tensor (6 pasos)
//
// Unidades del contrato público:
//   kN/m² → qa (tensión admisible del suelo)
//   MPa    → fc, fy (materiales)
//   kN     → PD, PL, Pu
//   cm     → cx, cy, Lx, Ly, h, d, Df, Lcol, H
//   kN·cm  → Mux, Muy, Mnx, Mny, Mu
//   cm²    → As, AsMin
//   mm     → rebD, db (diámetro de barra)
//
// Conversión clave: 1 MPa = 0.1 kN/cm²
// Las fórmulas internas convierten fc/fy a kN/cm² cuando trabajan con
// geometrías en cm y fuerzas en kN (es decir, casi siempre).
//
// Trazabilidad: cada paso registra su resultado intermedio en el array steps[].

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type BaseType =
  | "centrada"
  | "medianera"
  | "medianera-x"
  | "medianera-y"
  | "esquina";
export type MedianeraSubType =
  | "viga-de-fundacion"
  | "viga-de-equilibrio"
  | "tensor";

export interface BaseInput {
  // Suelo
  qa: number; // kN/m² — tensión admisible del suelo (σadm)
  Df: number; // cm — profundidad de fundación
  // Cargas
  PD: number; // kN — carga muerta
  PL: number; // kN — carga viva
  // Columna
  cx: number; // cm — lado X de la columna
  cy: number; // cm — lado Y de la columna
  // Materiales
  fc: number; // MPa — resistencia del hormigón
  fy: number; // MPa — tensión de fluencia del acero
  // Tipo
  type: BaseType;
  subType?: MedianeraSubType; // medianera: viga-de-fundacion|tensor; esquina: viga-de-equilibrio|tensor
  // Overrides manuales de geometría
  Lx?: number; // cm — ancho de la base (overrride)
  Ly?: number; // cm — largo de la base (override)
  h?: number; // cm — altura total (override)
  hTalon?: number; // cm — espesor del borde / talón (override)
  // Medianera extras
  Lcol?: number; // cm — luz entre columnas (viga de fundación)
  H?: number; // cm — altura del tensor
  mu?: number; // — coeficiente de fricción (default 0.4)
  // Viga de fundación — overrides manuales
  bViga?: number; // cm — ancho de la viga (auto si falta)
  hViga?: number; // cm — alto de la viga (auto si falta)
  // Esquina extras
  LcolX?: number; // cm — luz entre ejes X (viga de equilibrio)
  LcolY?: number; // cm — luz entre ejes Y (viga de equilibrio)
  Hx?: number; // cm — altura del tensor en dirección X
  Hy?: number; // cm — altura del tensor en dirección Y
  // Viga de equilibrio — overrides manuales
  bVigaX?: number; // cm — ancho viga X (auto si falta)
  hVigaX?: number; // cm — alto viga X (auto si falta)
  bVigaY?: number; // cm — ancho viga Y (auto si falta)
  hVigaY?: number; // cm — alto viga Y (auto si falta)
  // Armado
  cover?: number; // cm — recubrimiento (default 5)
  rebD?: number; // mm — diámetro de barra (default 12)
  // Peso propio
  includeSelfWeight?: boolean; // — incluir peso propio + tierra en Areq (default true)
}

export interface BaseResult {
  // Geometría
  Areq: number;
  Ap: number;
  Lx: number;
  Ly: number;
  h: number;
  d: number;
  kx: number;
  ky: number;
  // Cargas
  Pu: number;
  qu: number;
  // Centrada — flexión
  Mux: number;
  Muy: number;
  Mnx: number;
  Mny: number;
  // Punzonado
  Vu_punch: number;
  phiVc_punch: number;
  punchOK: boolean;
  // Corte unidireccional
  Vux: number;
  Vuy: number;
  phiVc_beam: number;
  beamShearOK: boolean;
  phiVc_beam_x: number;
  phiVc_beam_y: number;
  // Armadura
  mnx: number;
  mny: number;
  kax: number;
  kay: number;
  kamin: number;
  Asx: number;
  Asy: number;
  AsMin: number;
  // Barras
  db: number;
  nb_x: number;
  nb_y: number;
  sep_x: number;
  sep_y: number;
  sepCheckOK: boolean;
  // Talón
  heel: number;
  heelOK: boolean;
  // Medianera — viga de fundación
  e: number; // cm — excentricidad
  Mu: number; // kN·cm — momento volcador
  Ru: number; // kN — reacción de viga
  Mnv: number; // kN·cm — momento nominal viga
  b_viga: number; // cm — ancho viga de fundación (efectivo)
  As_sup: number; // cm² — armadura superior viga
  As_inf: number; // cm² — armadura inferior viga
  mn_med: number; // mn viga
  ka_med: number; // ka viga
  h_viga: number; // cm — altura total viga de fundación
  d_viga: number; // cm — altura útil viga de fundación
  // Medianera — tensor
  Tu: number; // kN — tracción en tensor
  FrictionOK: boolean; // verificación rozamiento
  As_tensor: number; // cm² — armadura tensor
  h_tensor: number; // cm — altura bloque tensor
  // Esquina — excentricidades y momentos volcadores
  eX: number; // cm — excentricidad en X
  eY: number; // cm — excentricidad en Y
  MuX_volc: number; // kN·cm — momento volcador X
  MuY_volc: number; // kN·cm — momento volcador Y
  // Esquina — viga de equilibrio
  Rux: number; // kN — reacción viga X
  Ruy: number; // kN — reacción viga Y
  b_vigaX: number; // cm — ancho viga X (efectivo)
  b_vigaY: number; // cm — ancho viga Y (efectivo)
  h_vigaX: number; // cm — altura viga X
  h_vigaY: number; // cm — altura viga Y
  As_supX: number; // cm² — armadura superior viga X
  As_supY: number; // cm² — armadura superior viga Y
  As_infX: number; // cm² — armadura inferior viga X
  As_infY: number; // cm² — armadura inferior viga Y
  // Esquina — tensor
  Tux: number; // kN — tracción tensor X
  Tuy: number; // kN — tracción tensor Y
  As_tensorX: number; // cm² — armadura tensor X
  As_tensorY: number; // cm² — armadura tensor Y
  h_tensorX: number; // cm — sección bloque tensor X
  h_tensorY: number; // cm — sección bloque tensor Y
  // Esquina — fuerzas de diseño del tronco de columna
  tronco_N: number; // kN — axial
  tronco_Mx: number; // kN·cm — momento respecto a X
  tronco_My: number; // kN·cm — momento respecto a Y
  tronco_Vx: number; // kN — corte X
  tronco_Vy: number; // kN — corte Y
  // Estado del tensor (falta completar datos)
  tensorPending: boolean; // true si falta H (o Hx/Hy) para dimensionar el tensor
  // Traza
  steps: string[]; // registro paso a paso
  warnings: string[]; // advertencias no bloqueantes
  errors: string[]; // errores de validación
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

function f1(n: number): string {
  return fmt(n, 1);
}
function f2(n: number): string {
  return fmt(n, 1);
}
function f4(n: number): string {
  return fmt(n, 4);
}

/** Área de una barra de diámetro db (mm) en cm² */
function aBar(db: number): number {
  return (Math.PI * db * db) / 4 / 100;
}

// ---------------------------------------------------------------------------
// Relación mn → ka (cuantía mecánica, flexión pura, bloque rectangular)
//
// Ecuación: mn = ka·(1 − 0.59·ka)  ⇒  ka = (1 − √(1−2.36·mn)) / 1.18
// Incluye tabla de referencia para mn entre 0.01 y 0.32 (step 0.01).
// ---------------------------------------------------------------------------

const MN_KA_TABLE: Record<number, number> = {};
{
  for (let mn100 = 1; mn100 <= 32; mn100++) {
    const mn = mn100 / 100;
    const disc = 1 - 2.36 * mn;
    if (disc > 0) {
      MN_KA_TABLE[mn] = (1 - Math.sqrt(disc)) / 1.18;
    }
  }
}

function getKaFromMn(mn: number): number {
  if (mn <= 0) return 0;
  // Buscar en tabla con interpolación lineal
  const keys = Object.keys(MN_KA_TABLE)
    .map(Number)
    .sort((a, b) => a - b);
  if (mn <= keys[0]) return MN_KA_TABLE[keys[0]];
  if (mn >= keys[keys.length - 1]) return MN_KA_TABLE[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (mn >= keys[i] && mn <= keys[i + 1]) {
      const t = (mn - keys[i]) / (keys[i + 1] - keys[i]);
      return MN_KA_TABLE[keys[i]] * (1 - t) + MN_KA_TABLE[keys[i + 1]] * t;
    }
  }
  return MN_KA_TABLE[keys[keys.length - 1]];
}

// ---------------------------------------------------------------------------
// Helpers — centrada (pasos 1–6)
// ---------------------------------------------------------------------------

/** Paso 1: Área requerida y dimensiones preliminares */
function step1_Dimensions(input: BaseInput): {
  Areq: number;
  Lx: number;
  Ly: number;
} {
  // Areq = (PD + PL) * factor / qa   (factor 1.10 = peso propio + tierra)
  // qa en kN/m² → Areq en m² → se pasa a cm² (×10000)
  const factor = input.includeSelfWeight === false ? 1.0 : 1.1;
  const Areq_m2 = ((input.PD + input.PL) * factor) / input.qa;
  const Areq = Areq_m2 * 10000;
  const side = Math.ceil(Math.sqrt(Areq) / 5) * 5;
  let Lx: number;
  let Ly: number;
  if (input.type === "medianera-x") {
    // medianera-x: lado X = 2·lado Y (faja larga en X, excentricidad en Y)
    Ly = Math.max(
      Math.ceil(Math.sqrt(Areq / 2) / 5) * 5,
      Math.ceil((input.cy + 20) / 5) * 5,
    );
    Lx = Math.max(2 * Ly, Math.ceil((input.cx + 20) / 5) * 5);
  } else if (input.type === "medianera-y") {
    // medianera-y: lado Y = 2·lado X (faja larga en Y, excentricidad en X)
    Lx = Math.max(
      Math.ceil(Math.sqrt(Areq / 2) / 5) * 5,
      Math.ceil((input.cx + 20) / 5) * 5,
    );
    Ly = Math.max(2 * Lx, Math.ceil((input.cy + 20) / 5) * 5);
  } else {
    // Base cuadrada por defecto (centrada / esquina)
    Lx = Math.max(side, input.cx + 20);
    Ly = Math.max(side, input.cy + 20);
  }
  return { Areq, Lx, Ly };
}

/** Paso 2: Carga última Pu = max(1.4·PD, 1.2·PD + 1.6·PL) */
function step2_Pu(PD: number, PL: number): number {
  return Math.max(1.4 * PD, 1.2 * PD + 1.6 * PL);
}

/** Paso 3: Cuantía mecánica mínima kamin = 2.8 / (0.85·fc) */
function step3_Kamin(fc: number): number {
  return 2.8 / (0.85 * fc);
}

/** Paso 4: Presión de contacto qu = Pu / (Lx·Ly)  [kN/cm²] */
function step4_Qu(Pu: number, Lx: number, Ly: number): number {
  return Pu / (Lx * Ly);
}

/** Vuelos (voladizos) de la zapata según el tipo de base.
 *  Centrada: (L−c)/2 en ambos ejes.
 *  Medianera: el eje excéntrico va sin dividir (L−c); el otro se divide por 2.
 *  Esquina: sin dividir en ninguno de los dos ejes. */
export function vuelos(
  input: BaseInput,
  Lx: number,
  Ly: number,
): { kx: number; ky: number } {
  const cx = input.cx;
  const cy = input.cy;
  if (input.type === "esquina") {
    return { kx: Lx - cx, ky: Ly - cy };
  }
  if (input.type === "medianera-x") {
    // medianera-x = excentricidad en Y → ky sin dividir
    return { kx: (Lx - cx) / 2, ky: Ly - cy };
  }
  if (input.type === "medianera-y") {
    // medianera-y = excentricidad en X → kx sin dividir
    return { kx: Lx - cx, ky: (Ly - cy) / 2 };
  }
  return { kx: (Lx - cx) / 2, ky: (Ly - cy) / 2 };
}

/** Paso 5: Voladizos y momentos flectores */
function step5_Bending(
  qu: number,
  Lx: number,
  Ly: number,
  input: BaseInput,
): { kx: number; ky: number; Mux: number; Muy: number } {
  const { kx, ky } = vuelos(input, Lx, Ly);
  // Mux = qu · Ly · kx² / 2  (momento respecto al eje X, kN·cm)
  // Muy = qu · Lx · ky² / 2  (momento respecto al eje Y, kN·cm)
  const Mux = (qu * Ly * (kx * kx)) / 2;
  const Muy = (qu * Lx * (ky * ky)) / 2;
  return { kx, ky, Mux, Muy };
}

/** Paso 6: Momentos nominales Mn = Mu / φ  con φ = 0.90 */
function step6_Nominal(Mux: number, Muy: number): { Mnx: number; Mny: number } {
  return { Mnx: Mux / 0.9, Mny: Muy / 0.9 };
}

/** Anchos de apoyo del tronco (columna + margen por cara).
 *  Centrada: +5 cm por lado (2.5 en cada cara). Excéntrica: +5 en el lado
 *  paralelo a la medianera y +3 en el sentido de la excentricidad (2.5 redondeado).
 *  Esquina: +3 en cada sentido. */
function supportWidths(input: BaseInput): { bx: number; by: number } {
  const cx = input.cx;
  const cy = input.cy;
  if (input.type === "esquina") {
    return { bx: cx + 3, by: cy + 3 };
  }
  if (input.type === "medianera-x") {
    // excentricidad en Y → Y +3, X (paralelo) +5
    return { bx: cx + 5, by: cy + 3 };
  }
  if (input.type === "medianera-y") {
    // excentricidad en X → X +3, Y (paralelo) +5
    return { bx: cx + 3, by: cy + 5 };
  }
  return { bx: cx + 5, by: cy + 5 };
}

/** Paso 7: Altura útil — rigidez + predimensionado por flexión */
function step7_EffectiveDepth(
  input: BaseInput,
  Lx: number,
  Ly: number,
  bx: number,
  by: number,
  Mnx: number,
  Mny: number,
  fc: number,
): { d: number; method: string } {
  // Predim por rigidez (conservador): d ≥ vuelo / 1.5
  const { kx, ky } = vuelos(input, Lx, Ly);
  const d_rig = Math.max(kx, ky) / 1.5;
  // Predim por flexión: d = sqrt(6.5·Mn / (b·f'c)) con f'c en kN/cm² (fc·0.1)
  const fc_kNcm2 = fc * 0.1;
  const dx_flex = Math.sqrt((6.5 * Mnx) / (by * fc_kNcm2));
  const dy_flex = Math.sqrt((6.5 * Mny) / (bx * fc_kNcm2));
  const d_flex = Math.max(dx_flex, dy_flex);

  const d = Math.max(d_rig, d_flex);
  const method = d === d_rig ? "rigidez" : "flexión";
  return { d, method };
}

/** Paso 8: Verificación al punzonado (CIRSOC 201, 11.11.2)
 *  Vu = Pu − qu·A0  donde A0 = (cx+d)·(cy+d), b0 = 2·(cx+d)+2·(cy+d)
 *  φVc = 0.75 · Y · F · b0 · d · √f'c / 120   (kN·cm)
 *  F = mín(F1, F2):  F1 = 4 (β≤2) o (2+4/β) (β>2) ; F2 = (αs·d/b0 + 2)
 *  Y = 1 centrada, 0.75 medianera, 0.5 esquina ; αs = 40/30/20 */
function step8_Punching(
  Pu: number,
  qu: number,
  cx: number,
  cy: number,
  d: number,
  fc: number,
  Y: number,
  alphaS: number,
): {
  Vu: number;
  phiVc: number;
  OK: boolean;
  b0: number;
  A0: number;
  beta: number;
  F1: number;
  F2: number;
  F: number;
} {
  const b0 = 2 * (cx + d) + 2 * (cy + d);
  const A0 = (cx + d) * (cy + d);
  const Vu = Pu - qu * A0;
  const beta = Math.max(cx, cy) / Math.min(cx, cy);
  const F1 = beta <= 2 ? 4 : 2 + 4 / beta;
  const F2 = (alphaS * d) / b0 + 2;
  const F = Math.min(F1, F2);
  const phiVc = (0.75 * Y * F * b0 * d * Math.sqrt(fc)) / 120;
  return { Vu, phiVc, OK: Vu <= phiVc, b0, A0, beta, F1, F2, F };
}

/** Paso 9: Verificación a corte unidireccional (CIRSOC 201, 11.3)
 *  Vux = qu · Ly · max(kx − d, 0)
 *  Vuy = qu · Lx · max(ky − d, 0)
 *  φVc = 0.75 · bw · d · √f'c / 60  (kN·cm), con bw efectivo = (5·apoyo + 3·ancho)/8 */
function step9_BeamShear(
  qu: number,
  Lx: number,
  Ly: number,
  input: BaseInput,
  bx: number,
  by: number,
  d: number,
  fc: number,
): {
  Vux: number;
  Vuy: number;
  phiVc_x: number;
  phiVc_y: number;
  OK: boolean;
  bwx: number;
  bwy: number;
} {
  const { kx, ky } = vuelos(input, Lx, Ly);
  const Vux = qu * Ly * Math.max(kx - d, 0);
  const Vuy = qu * Lx * Math.max(ky - d, 0);

  // Ancho efectivo al corte: promedio ponderado entre apoyo (bx/by) y ancho total (Lx/Ly)
  const bwx = (5 * bx + 3 * Lx) / 8;
  const bwy = (5 * by + 3 * Ly) / 8;

  // φVc = 0.75 · bw · d · √f'c / 60  (kN·cm)
  const phiVc_x = (0.75 * bwy * d * Math.sqrt(fc)) / 60;
  const phiVc_y = (0.75 * bwx * d * Math.sqrt(fc)) / 60;
  const OK = Vux <= phiVc_x && Vuy <= phiVc_y;
  return { Vux, Vuy, phiVc_x, phiVc_y, OK, bwx, bwy };
}

/** Paso 10: Armadura de flexión */
function step10_Steel(
  Mnx: number,
  Mny: number,
  bx: number,
  by: number,
  Lx: number,
  Ly: number,
  d: number,
  hProm: number,
  fc: number,
  fy: number,
  kamin: number,
): {
  mnx: number;
  mny: number;
  kax: number;
  kay: number;
  Asx: number;
  Asy: number;
  AsMin: number;
} {
  // mn = Mn / (0.85·b·d²·fc) con b = ancho de apoyo (by para mnx, bx para mny)
  const fc_kNcm2 = fc * 0.1;
  const mnx = Mnx / (0.85 * by * d * d * fc_kNcm2);
  const mny = Mny / (0.85 * bx * d * d * fc_kNcm2);

  // ka por flexión de vigas: mn = ka·(1 − 0.59·ka) → getKaFromMn
  const kax = Math.max(getKaFromMn(mnx), kamin);
  const kay = Math.max(getKaFromMn(mny), kamin);

  // As = ka · 0.85 · d · b · fc / fy  con b = ancho de apoyo
  const Asx = (kax * 0.85 * d * by * fc) / fy;
  const Asy = (kay * 0.85 * d * bx * fc) / fy;

  // Armadura mínima: 0.0018 · b · h_prom, con b = mayor lado (Lx/Ly) y h_prom = (h + h_talón)/2
  const AsMin = 0.0018 * Math.max(Lx, Ly) * hProm;

  return { mnx, mny, kax, kay, Asx, Asy, AsMin };
}

/** Paso 13: Separación de barras */
function step13_Spacing(
  Asx: number,
  Asy: number,
  Lx: number,
  Ly: number,
  rebD: number,
  cover: number,
): {
  db: number;
  nb_x: number;
  nb_y: number;
  sep_x: number;
  sep_y: number;
  OK: boolean;
} {
  const db = rebD;
  const areaBar = aBar(db); // cm²

  const nb_x = Math.max(2, Math.ceil(Asx / areaBar));
  const nb_y = Math.max(2, Math.ceil(Asy / areaBar));

  // Separación centro a centro: (Lx − 2·cover) / (n − 1)
  const sep_x = (Lx - 2 * cover) / (nb_x - 1);
  const sep_y = (Ly - 2 * cover) / (nb_y - 1);

  // Límite: sep ≤ min(25·db, 30 cm) con db en mm → 25·(db/10) cm
  const sepMax = Math.min(25 * (db / 10), 30);
  const OK = sep_x <= sepMax && sep_y <= sepMax;
  return { db, nb_x, nb_y, sep_x, sep_y, OK };
}

// ---------------------------------------------------------------------------
// Helpers — medianera
// ---------------------------------------------------------------------------

/** Geometría medianera según la dirección de excentricidad */
function medGeom(
  input: BaseInput,
  Lx: number,
  Ly: number,
): { e: number; bViga: number } {
  if (input.type === "medianera-x") {
    // medianera-x = lado largo en X = excentricidad en Y
    return { e: (Ly - input.cy) / 2, bViga: Math.max(input.cx, 20) };
  }
  // medianera-y = lado largo en Y = excentricidad en X
  return { e: (Lx - input.cx) / 2, bViga: Math.max(input.cy, 20) };
}

// ---------------------------------------------------------------------------
// Función de diseño — centrada (13 pasos)
// ---------------------------------------------------------------------------

function designCentrada(input: BaseInput): BaseResult {
  const cover = input.cover ?? 7;
  const rebD = input.rebD ?? 12;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  st.push("=== BASE CENTRADA AISLADA — CIRSOC 201 ===");
  st.push("");

  // Paso 1 — dimensiones
  const dims = step1_Dimensions(input);
  const Lx = input.Lx ?? dims.Lx;
  const Ly = input.Ly ?? dims.Ly;
  const Ap = Lx * Ly;
  st.push(
    `1. Área requerida A_base = (${f1(input.PD)}+${f1(input.PL)})·1.10 / ${f1(input.qa)} kN/m² = ${f1(dims.Areq / 10000)} m² = ${f1(dims.Areq)} cm²`,
  );
  st.push(`   Base adoptada: Lx = ${Lx} cm, Ly = ${Ly} cm → Ap = ${Ap} cm²`);

  // Paso 2 — Pu
  const Pu = step2_Pu(input.PD, input.PL);
  st.push(
    `2. Pu = max(1.4·${f1(input.PD)} ; 1.2·${f1(input.PD)}+1.6·${f1(input.PL)}) = ${f1(Pu)} kN`,
  );

  // Paso 3 — kamin
  const kamin = step3_Kamin(input.fc);
  st.push(`3. kamin = 2.8 / (0.85·${input.fc}) = ${f4(kamin)}`);

  // Paso 4 — qu
  const qu = step4_Qu(Pu, Lx, Ly);
  st.push(`4. qu = ${f1(Pu)} / (${Lx}·${Ly}) = ${fmt(qu, 6)} kN/cm²`);

  // Paso 5 — bending (vuelos según tipo de base)
  const { kx, ky, Mux, Muy } = step5_Bending(qu, Lx, Ly, input);
  const kxFull = input.type === "medianera-y" || input.type === "esquina";
  const kyFull = input.type === "medianera-x" || input.type === "esquina";
  st.push(
    `5. Vuelos: kx = ${kxFull ? `${Lx}−${input.cx}` : `(${Lx}−${input.cx})/2`} = ${f1(kx)} cm, ky = ${kyFull ? `${Ly}−${input.cy}` : `(${Ly}−${input.cy})/2`} = ${f1(ky)} cm`,
  );
  st.push(`   Mux = ${fmt(qu, 6)}·${Ly}·${f1(kx)}²/2 = ${f1(Mux)} kN·cm`);
  st.push(`   Muy = ${fmt(qu, 6)}·${Lx}·${f1(ky)}²/2 = ${f1(Muy)} kN·cm`);

  // Paso 6 — nominal
  const { Mnx, Mny } = step6_Nominal(Mux, Muy);
  st.push(`6. Mnx = ${f1(Mux)} / 0.90 = ${f1(Mnx)} kN·cm`);
  st.push(`   Mny = ${f1(Muy)} / 0.90 = ${f1(Mny)} kN·cm`);

  // Paso 7 — altura útil (predimensionado) y altura total adoptada
  const { bx, by } = supportWidths(input);
  const { d: dPredim, method } = step7_EffectiveDepth(
    input,
    Lx,
    Ly,
    bx,
    by,
    Mnx,
    Mny,
    input.fc,
  );
  const d_rig = Math.max(kx, ky) / 1.5;
  const dx_flex = Math.sqrt((6.5 * Mnx) / (by * input.fc * 0.1));
  const dy_flex = Math.sqrt((6.5 * Mny) / (bx * input.fc * 0.1));
  st.push(`7. Anchos de apoyo del tronco: bx = ${bx} cm, by = ${by} cm`);
  st.push(
    `   Predim rigidez: d ≥ máx(vuelo)/1.5 = máx(${f1(kx)}, ${f1(ky)})/1.5 = ${f1(d_rig)} cm`,
  );
  st.push(
    `   Predim flexión: dx = √(6.5·${f1(Mnx)}/(${by}·${fmt(input.fc * 0.1, 2)})) = ${f1(dx_flex)} cm, dy = √(6.5·${f1(Mny)}/(${bx}·${fmt(input.fc * 0.1, 2)})) = ${f1(dy_flex)} cm`,
  );
  st.push(`   d predim = ${f1(dPredim)} cm (controla ${method})`);

  // Altura útil y total finales (consistentes con la altura adoptada)
  let d: number;
  let h: number;
  if (input.h !== undefined && input.h > 0) {
    h = input.h;
    d = h - cover;
    st.push(
      `   h adoptado manual: h = ${h} cm → d = h − recubrimiento = ${h} − ${cover} = ${f1(d)} cm`,
    );
  } else {
    d = dPredim;
    h = Math.max(d + cover, 30);
    st.push(
      `   h = d + recubrimiento = ${f1(d)} + ${cover} = ${f1(d + cover)} cm → adoptado ${h} cm (mín 30 cm)`,
    );
  }

  // Talón (espesor del borde): sugerido máx(25 cm, h − kmin), adoptable por el usuario
  const kmin = Math.min(kx, ky);
  const hTalonSug = Math.max(25, h - kmin);
  const hTalon = input.hTalon !== undefined ? input.hTalon : hTalonSug;
  const hProm = (h + hTalon) / 2;

  // Paso 8 — punzonado
  const Y =
    input.type === "centrada" ? 1 : input.type === "esquina" ? 0.5 : 0.75;
  const alphaS =
    input.type === "centrada" ? 40 : input.type === "esquina" ? 20 : 30;
  const punch = step8_Punching(
    Pu,
    qu,
    input.cx,
    input.cy,
    d,
    input.fc,
    Y,
    alphaS,
  );
  st.push(
    `8. Punzonado: b0 = 2·(${input.cx}+${f1(d)})+2·(${input.cy}+${f1(d)}) = ${f1(punch.b0)} cm`,
  );
  st.push(
    `   β = ${f1(punch.beta)}, Y = ${Y}, αs = ${alphaS}, F1 = ${f1(punch.F1)}, F2 = ${f1(punch.F2)} → F = ${f1(punch.F)}`,
  );
  st.push(
    `   Vu = ${f1(Pu)} − ${fmt(qu, 6)}·${f1(punch.A0)} = ${f1(punch.Vu)} kN`,
  );
  st.push(
    `   φVc = 0.75·${Y}·${f1(punch.F)}·${f1(punch.b0)}·${f1(d)}·√${input.fc}/120 = ${f1(punch.phiVc)} kN`,
  );
  st.push(`   ${punch.OK ? "✓ Vu ≤ φVc" : "✗ Vu > φVc — NO VERIFICA"}`);
  if (!punch.OK)
    wr.push("Punzonado: Vu > φVc — aumentar altura o dimensiones de la base.");

  // Paso 9 — corte
  const shear = step9_BeamShear(qu, Lx, Ly, input, bx, by, d, input.fc);
  st.push(`9. Corte unidireccional:`);
  st.push(
    `   bwx = (5·${bx}+3·${Lx})/8 = ${f1(shear.bwx)} cm, bwy = (5·${by}+3·${Ly})/8 = ${f1(shear.bwy)} cm`,
  );
  st.push(
    `   Vux = ${fmt(qu, 6)}·${Ly}·max(${f1(kx)}−${f1(d)},0) = ${f1(shear.Vux)} kN`,
  );
  st.push(
    `   Vuy = ${fmt(qu, 6)}·${Lx}·max(${f1(ky)}−${f1(d)},0) = ${f1(shear.Vuy)} kN`,
  );
  st.push(
    `   φVc_x = 0.75·${f1(shear.bwy)}·${f1(d)}·√${input.fc}/60 = ${f1(shear.phiVc_x)} kN, φVc_y = 0.75·${f1(shear.bwx)}·${f1(d)}·√${input.fc}/60 = ${f1(shear.phiVc_y)} kN`,
  );
  st.push(
    `   ${shear.OK ? "✓ Verifica corte unidireccional" : "✗ NO VERIFICA corte"}`,
  );
  if (!shear.OK)
    wr.push("Corte unidireccional no verifica — aumentar altura útil.");

  // Paso 10 — armadura
  const steel = step10_Steel(
    Mnx,
    Mny,
    bx,
    by,
    Lx,
    Ly,
    d,
    hProm,
    input.fc,
    input.fy,
    kamin,
  );
  const fc_kNcm2 = input.fc * 0.1;
  st.push(`10. Flexión:`);
  st.push(
    `    mnx = ${f1(Mnx)}/(0.85·${by}·${f1(d)}²·${fmt(fc_kNcm2, 3)}) = ${f4(steel.mnx)}`,
  );
  st.push(
    `    mny = ${f1(Mny)}/(0.85·${bx}·${f1(d)}²·${fmt(fc_kNcm2, 3)}) = ${f4(steel.mny)}`,
  );
  st.push(`    kax = max(ka(mnx), ${f4(kamin)}) = ${f4(steel.kax)}`);
  st.push(`    kay = max(ka(mny), ${f4(kamin)}) = ${f4(steel.kay)}`);
  st.push(
    `    Asx = ${f4(steel.kax)}·0.85·${f1(d)}·${by}·${input.fc}/${input.fy} = ${f2(steel.Asx)} cm²`,
  );
  st.push(
    `    Asy = ${f4(steel.kay)}·0.85·${f1(d)}·${bx}·${input.fc}/${input.fy} = ${f2(steel.Asy)} cm²`,
  );
  st.push(
    `    AsMín = 0.0018·b·h_prom = 0.0018·${Math.max(Lx, Ly)}·${f1(hProm)} ≈ ${f2(steel.AsMin)} cm²`,
  );

  // Paso 11 — talón
  st.push(
    `11. Talón (espesor del borde): kmin = mín(${f1(kx)}, ${f1(ky)}) = ${f1(kmin)} cm`,
  );
  if (input.hTalon !== undefined) {
    st.push(
      `    h_talón adoptado manual = ${f1(hTalon)} cm (sugerido ${f1(hTalonSug)} cm)`,
    );
  } else {
    st.push(
      `    h_talón = máx(25 cm, h − kmin) = máx(25, ${f1(h)} − ${f1(kmin)}) = ${f1(hTalon)} cm`,
    );
  }

  // Paso 12 — armadura necesaria (Ø, cantidad y separación se eligen en Armadura)
  const barDisp = step13_Spacing(steel.Asx, steel.Asy, Lx, Ly, rebD, cover);
  st.push(
    `12. Armadura necesaria: Asx_nec = máx(${f2(steel.Asx)}, ${f2(steel.AsMin)}) = ${f2(Math.max(steel.Asx, steel.AsMin))} cm²`,
  );
  st.push(
    `    Asy_nec = máx(${f2(steel.Asy)}, ${f2(steel.AsMin)}) = ${f2(Math.max(steel.Asy, steel.AsMin))} cm²`,
  );
  st.push(
    `    (Ø, cantidad y separación se eligen y verifican en la sección Armadura.)`,
  );

  st.push("");
  st.push(
    `=== RESUMEN: ${er.length === 0 ? "✓ DISEÑO COMPLETO" : "✗ ERRORES"} ===`,
  );

  return {
    Areq: dims.Areq,
    Ap,
    Lx,
    Ly,
    h,
    d,
    kx,
    ky,
    Pu,
    qu,
    Mux,
    Muy,
    Mnx,
    Mny,
    Vu_punch: punch.Vu,
    phiVc_punch: punch.phiVc,
    punchOK: punch.OK,
    Vux: shear.Vux,
    Vuy: shear.Vuy,
    phiVc_beam: Math.min(shear.phiVc_x, shear.phiVc_y),
    phiVc_beam_x: shear.phiVc_x,
    phiVc_beam_y: shear.phiVc_y,
    beamShearOK: shear.OK,
    mnx: steel.mnx,
    mny: steel.mny,
    kax: steel.kax,
    kay: steel.kay,
    kamin,
    Asx: steel.Asx,
    Asy: steel.Asy,
    AsMin: steel.AsMin,
    db: barDisp.db,
    nb_x: barDisp.nb_x,
    nb_y: barDisp.nb_y,
    sep_x: barDisp.sep_x,
    sep_y: barDisp.sep_y,
    sepCheckOK: barDisp.OK,
    heel: hTalon,
    heelOK: true,
    // Medianera fields — not used
    e: 0,
    Mu: 0,
    Ru: 0,
    Mnv: 0,
    As_sup: 0,
    As_inf: 0,
    mn_med: 0,
    ka_med: 0,
    b_viga: 0,
    h_viga: 0,
    d_viga: 0,
    Tu: 0,
    FrictionOK: true,
    As_tensor: 0,
    h_tensor: 0,
    // Esquina fields — not used
    eX: 0,
    eY: 0,
    MuX_volc: 0,
    MuY_volc: 0,
    Rux: 0,
    Ruy: 0,
    b_vigaX: 0,
    b_vigaY: 0,
    h_vigaX: 0,
    h_vigaY: 0,
    As_supX: 0,
    As_supY: 0,
    As_infX: 0,
    As_infY: 0,
    Tux: 0,
    Tuy: 0,
    As_tensorX: 0,
    As_tensorY: 0,
    h_tensorX: 0,
    h_tensorY: 0,
    tronco_N: 0,
    tronco_Mx: 0,
    tronco_My: 0,
    tronco_Vx: 0,
    tronco_Vy: 0,
    tensorPending: false,
    steps: st,
    warnings: wr,
    errors: er,
  };
}

// ---------------------------------------------------------------------------
// Función de diseño — medianera viga de fundación (7 pasos)
// ---------------------------------------------------------------------------

function designVigaFundacion(input: BaseInput): BaseResult {
  if (input.Lcol === undefined || input.Lcol <= 0) {
    throw new Error(
      "Para viga de fundación, se requiere la luz entre columnas (Lcol).",
    );
  }

  // Zapata como base centrada (presión uniforme por la viga de fundación)
  const centrada = designCentrada(input);
  const { Lx, Ly, Pu } = centrada;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  st.push("=== BASE MEDIANERA — VIGA DE FUNDACIÓN — CIRSOC 201 ===");
  st.push("");
  st.push(
    "La zapata se dimensiona a flexión/corte/punzonado como base centrada (presión uniforme).",
  );
  st.push("La viga de fundación re-centra la resultante: qu = Pu/(Lx·Ly).");
  st.push("");

  // Paso V1 — excentricidad y momento volcador
  const { e, bViga: bVigaAuto } = medGeom(input, Lx, Ly);
  const b_viga = input.bViga && input.bViga > 0 ? input.bViga : bVigaAuto;
  const Mu = Pu * e;
  if (input.type === "medianera-x") {
    st.push(`V1. e = (Ly − cy)/2 = (${Ly} − ${input.cy})/2 = ${f1(e)} cm`);
  } else {
    st.push(`V1. e = (Lx − cx)/2 = (${Lx} − ${input.cx})/2 = ${f1(e)} cm`);
  }
  st.push(`    Mu = ${f1(Pu)} · ${f1(e)} = ${f1(Mu)} kN·cm`);

  // Paso V2 — reacción Ru = Mu / Lcol
  const Lcol = input.Lcol!;
  const Ru = Mu / Lcol;
  st.push(`V2. Ru = Mu / Lcol = ${f1(Mu)} / ${Lcol} = ${f1(Ru)} kN`);

  // Paso V3 — momento nominal
  const Mnv = Mu / 0.9;
  st.push(`V3. Mn = Mu / 0.90 = ${f1(Mu)} / 0.90 = ${f1(Mnv)} kN·cm`);

  // Paso V4 — dimensionado de viga
  const cover = input.cover ?? 7;
  const fc_kNcm2 = input.fc * 0.1;
  const dAuto = Math.sqrt((6.5 * Mnv) / (b_viga * fc_kNcm2));
  const d_viga =
    input.hViga && input.hViga > cover ? input.hViga - cover : dAuto;
  const h_viga = input.hViga && input.hViga > 0 ? input.hViga : d_viga + cover;
  if (input.type === "medianera-x") {
    st.push(
      `V4. Viga: b = ${b_viga} cm${input.bViga ? " (adoptado por usuario)" : ` = máx(cx,20) (automático)`}`,
    );
  } else {
    st.push(
      `V4. Viga: b = ${b_viga} cm${input.bViga ? " (adoptado por usuario)" : ` = máx(cy,20) (automático)`}`,
    );
  }
  st.push(
    `    d = √(6.5·${f1(Mnv)}/(${b_viga}·${fmt(fc_kNcm2, 3)})) = ${f1(dAuto)} cm${input.hViga ? ` → d = h − rec = ${f1(d_viga)} cm (h adoptada)` : ""}`,
  );
  st.push(
    `    h_viga = ${input.hViga ? `adoptada por usuario = ${f1(h_viga)} cm` : `d + recubrimiento = ${f1(d_viga)} + ${cover} = ${f1(h_viga)} cm`}`,
  );

  // Paso V5 — armadura superior
  const mn_med = Mnv / (0.85 * b_viga * d_viga * d_viga * fc_kNcm2);
  const kamin = step3_Kamin(input.fc);
  const ka_med = Math.max(getKaFromMn(mn_med), kamin);
  const As_sup = (ka_med * 0.85 * d_viga * b_viga * input.fc) / input.fy;
  st.push(
    `V5. mn_viga = ${f1(Mnv)}/(0.85·${b_viga}·${f1(d_viga)}²·${fmt(fc_kNcm2, 3)}) = ${f4(mn_med)}`,
  );
  st.push(
    `    ka = max(${f4(getKaFromMn(mn_med))}, ${f4(kamin)}) = ${f4(ka_med)}`,
  );
  st.push(
    `    As_sup = ${f4(ka_med)}·0.85·${f1(d_viga)}·${b_viga}·${input.fc}/${input.fy} = ${f2(As_sup)} cm²`,
  );

  // Paso V6 — armadura inferior
  const As_inf = Math.max(As_sup / 3, 2 * aBar(12));
  st.push(
    `V6. As_inf = máx(As_sup/3, 2Ø12) = máx(${f2(As_sup / 3)}, ${f2(2 * aBar(12))}) = ${f2(As_inf)} cm²`,
  );

  st.push("");
  st.push(`=== RESUMEN VIGA DE FUNDACIÓN ===`);
  st.push(`Base: ${Lx}×${Ly} cm | e = ${f1(e)} cm | Mu = ${f1(Mu)} kN·cm`);
  st.push(
    `Viga: ${b_viga}×${f1(h_viga)} cm | As_sup = ${f2(As_sup)} cm² | As_inf = ${f2(As_inf)} cm²`,
  );

  return {
    ...centrada,
    b_viga,
    h_viga,
    d_viga,
    e,
    Mu,
    Ru,
    Mnv,
    As_sup,
    As_inf,
    mn_med,
    ka_med,
    Tu: 0,
    FrictionOK: true,
    As_tensor: 0,
    h_tensor: 0,
    eX: 0,
    eY: 0,
    MuX_volc: 0,
    MuY_volc: 0,
    Rux: 0,
    Ruy: 0,
    b_vigaX: 0,
    b_vigaY: 0,
    h_vigaX: 0,
    h_vigaY: 0,
    As_supX: 0,
    As_supY: 0,
    As_infX: 0,
    As_infY: 0,
    Tux: 0,
    Tuy: 0,
    As_tensorX: 0,
    As_tensorY: 0,
    h_tensorX: 0,
    h_tensorY: 0,
    tronco_N: 0,
    tronco_Mx: 0,
    tronco_My: 0,
    tronco_Vx: 0,
    tronco_Vy: 0,
    tensorPending: false,
    steps: [...st, ...centrada.steps],
    warnings: [...wr, ...centrada.warnings],
    errors: [...er, ...centrada.errors],
  };
}

// ---------------------------------------------------------------------------
// Función de diseño — medianera tensor (6 pasos)
// ---------------------------------------------------------------------------

function designTensor(input: BaseInput): BaseResult {
  const H = input.H ?? 0;
  const tensorPending = H <= 0;

  // Zapata como base centrada (presión uniforme por el tensor)
  const centrada = designCentrada(input);
  const { Lx, Ly, Pu } = centrada;
  const mu = input.mu ?? 0.4;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  st.push("=== BASE MEDIANERA — TENSOR — CIRSOC 201 ===");
  st.push("");
  st.push(
    "La zapata se dimensiona a flexión/corte/punzonado como base centrada (presión uniforme).",
  );
  st.push("El tensor re-centra la resultante: qu = Pu/(Lx·Ly).");
  st.push("");

  const { e } = medGeom(input, Lx, Ly);
  const Mu = Pu * e;
  if (input.type === "medianera-x") {
    st.push(`T1. e = (Ly−cy)/2 = (${Ly}−${input.cy})/2 = ${f1(e)} cm`);
  } else {
    st.push(`T1. e = (Lx−cx)/2 = (${Lx}−${input.cx})/2 = ${f1(e)} cm`);
  }
  st.push(`    Mu = ${f1(Pu)} · ${f1(e)} = ${f1(Mu)} kN·cm`);

  const Tu = tensorPending ? 0 : Mu / H;
  const Rf = input.PD * mu;
  const fy_kNcm2 = input.fy * 0.1;
  const FrictionOK = Rf >= Tu;
  const As_tensor = tensorPending ? 0 : Tu / (0.9 * fy_kNcm2);
  const h_tensor = Math.max(Lx / 5, 20);
  if (tensorPending) {
    st.push(
      `T2. Falta ingresar la altura H del tensor al fondo de zapata — dimensionar en resultados.`,
    );
    er.push("Falta ingresar la altura del tensor (H) para dimensionarlo.");
  } else {
    st.push(`T2. Altura del tensor H = ${H} cm (dato)`);
    st.push(`T3. Tu = Mu / H = ${f1(Mu)} / ${H} = ${f1(Tu)} kN`);
    st.push(`T4. Rozamiento: PD·μ = ${f1(input.PD)}·${mu} = ${f1(Rf)} kN`);
    st.push(
      `    Tu = ${f1(Tu)} kN → ${FrictionOK ? "✓ Rozamiento ≥ Tu" : "✗ Rozamiento < Tu — ADVERTENCIA"}`,
    );
    if (!FrictionOK)
      wr.push(
        "La fuerza de rozamiento es menor que la tracción en el tensor. Aumentar PD o μ.",
      );
    st.push(
      `T5. As_tensor = Tu / (0.90·fy) = ${f1(Tu)} / (0.90·${fmt(fy_kNcm2, 1)}) = ${f2(As_tensor)} cm²`,
    );
  }
  st.push(
    `T6. Tensor: sección sugerida ${Math.round(h_tensor)}×${Math.round(h_tensor)} cm`,
  );

  st.push("");
  st.push(`=== RESUMEN TENSOR ===`);
  st.push(`Base: ${Lx}×${Ly} cm | e = ${f1(e)} cm | Mu = ${f1(Mu)} kN·cm`);
  st.push(`Tu = ${f1(Tu)} kN | As_tensor = ${f2(As_tensor)} cm²`);

  return {
    ...centrada,
    tensorPending,
    e,
    Mu,
    Ru: 0,
    Mnv: 0,
    As_sup: 0,
    As_inf: 0,
    mn_med: 0,
    ka_med: 0,
    b_viga: 0,
    h_viga: 0,
    d_viga: 0,
    Tu,
    FrictionOK,
    As_tensor,
    h_tensor,
    eX: 0,
    eY: 0,
    MuX_volc: 0,
    MuY_volc: 0,
    Rux: 0,
    Ruy: 0,
    b_vigaX: 0,
    b_vigaY: 0,
    h_vigaX: 0,
    h_vigaY: 0,
    As_supX: 0,
    As_supY: 0,
    As_infX: 0,
    As_infY: 0,
    Tux: 0,
    Tuy: 0,
    As_tensorX: 0,
    As_tensorY: 0,
    h_tensorX: 0,
    h_tensorY: 0,
    tronco_N: 0,
    tronco_Mx: 0,
    tronco_My: 0,
    tronco_Vx: 0,
    tronco_Vy: 0,
    steps: [...st, ...centrada.steps],
    warnings: [...wr, ...centrada.warnings],
    errors: [...er, ...centrada.errors],
  };
}

// ---------------------------------------------------------------------------
// Función de diseño — base de esquina (viga de equilibrio o tensor)
// ---------------------------------------------------------------------------
//
// Racional: el sistema de equilibrio (viga de equilibrio o tensor) re-centra la
// resultante de la carga, de modo que la zapata trabaja con presión uniforme
// qu = Pu/(Lx·Ly). Por eso la losa se dimensiona como base centrada (flexión,
// corte y punzonado) y, por separado, se diseña el sistema que absorbe los
// momentos volcadores originados por la excentricidad de la columna.
// ---------------------------------------------------------------------------

function designEsquina(input: BaseInput): BaseResult {
  const cover = input.cover ?? 7;
  const mu = input.mu ?? 0.4;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  const subType = input.subType;

  // Paso E0 — zapata como base centrada (presión uniforme)
  const centrada = designCentrada(input);
  const { Lx, Ly, Pu } = centrada;
  const cx = input.cx;
  const cy = input.cy;
  const fc = input.fc;
  const fy = input.fy;
  const kamin = step3_Kamin(fc);

  const label =
    subType === "viga-de-equilibrio" ? "VIGA DE EQUILIBRIO" : "TENSOR";
  st.push(`=== BASE DE ESQUINA — ${label} — CIRSOC 201 ===`);
  st.push("");
  st.push(
    "La zapata se dimensiona a flexión/corte/punzonado como base centrada (presión uniforme).",
  );
  st.push(
    "El sistema de equilibrio re-centra la resultante para que la presión sea uniforme qu = Pu/(Lx·Ly).",
  );
  st.push("");

  // Paso E1 — excentricidades
  const eX = (Lx - cx) / 2;
  const eY = (Ly - cy) / 2;
  st.push(
    `E1. Excentricidades: eX = (Lx − cx)/2 = (${Lx} − ${cx})/2 = ${f1(eX)} cm`,
  );
  st.push(`    eY = (Ly − cy)/2 = (${Ly} − ${cy})/2 = ${f1(eY)} cm`);

  // Paso E2 — momentos volcadores
  const MuX_volc = Pu * eX;
  const MuY_volc = Pu * eY;
  st.push(
    `E2. Momentos volcadores: MuX = Pu·eX = ${f1(Pu)}·${f1(eX)} = ${f1(MuX_volc)} kN·cm`,
  );
  st.push(`    MuY = Pu·eY = ${f1(Pu)}·${f1(eY)} = ${f1(MuY_volc)} kN·cm`);
  st.push("");

  // Valores por defecto (se rellenan según el subtipo)
  let Rux = 0;
  let Ruy = 0;
  let h_vigaX = 0;
  let h_vigaY = 0;
  let b_vigaX = 0;
  let b_vigaY = 0;
  let As_supX = 0;
  let As_supY = 0;
  let As_infX = 0;
  let As_infY = 0;
  let Tux = 0;
  let Tuy = 0;
  let As_tensorX = 0;
  let As_tensorY = 0;
  let h_tensorX = 0;
  let h_tensorY = 0;
  let FrictionOK = true;
  let tronco_N = 0;
  let tronco_Mx = 0;
  let tronco_My = 0;
  let tronco_Vx = 0;
  let tronco_Vy = 0;
  let tensorPending = false;

  if (subType === "viga-de-equilibrio") {
    if (
      input.LcolX === undefined ||
      input.LcolX <= 0 ||
      input.LcolY === undefined ||
      input.LcolY <= 0
    ) {
      throw new Error(
        "Para viga de equilibrio, se requieren las luces entre ejes LcolX y LcolY.",
      );
    }

    Rux = MuX_volc / input.LcolX;
    Ruy = MuY_volc / input.LcolY;
    st.push(
      `E3. Reacciones: Rux = MuX / LcolX = ${f1(MuX_volc)} / ${input.LcolX} = ${f1(Rux)} kN`,
    );
    st.push(
      `    Ruy = MuY / LcolY = ${f1(MuY_volc)} / ${input.LcolY} = ${f1(Ruy)} kN`,
    );
    st.push("");

    const fc_kNcm2 = fc * 0.1;

    // Viga X: corre en dirección X, ancho perpendicular = cy
    const bX =
      input.bVigaX && input.bVigaX > 0 ? input.bVigaX : Math.max(cy, 20);
    const MnvX = MuX_volc / 0.9;
    const dXauto = Math.sqrt((6.5 * MnvX) / (bX * fc_kNcm2));
    const dX =
      input.hVigaX && input.hVigaX > cover ? input.hVigaX - cover : dXauto;
    const hX = input.hVigaX && input.hVigaX > 0 ? input.hVigaX : dX + cover;
    const mnX = MnvX / (0.85 * bX * dX * dX * fc_kNcm2);
    const kaX = Math.max(getKaFromMn(mnX), kamin);
    As_supX = (kaX * 0.85 * dX * bX * fc) / fy;
    As_infX = Math.max(As_supX / 3, 2 * aBar(12));
    b_vigaX = bX;
    h_vigaX = hX;

    st.push(
      `E4. Viga X: b = ${bX} cm${input.bVigaX ? " (adoptado por usuario)" : " = máx(cy,20) (automático)"} | MnvX = MuX / 0.90 = ${f1(MnvX)} kN·cm`,
    );
    st.push(
      `    d = √(6.5·${f1(MnvX)}/(${bX}·${fmt(fc_kNcm2, 3)})) = ${f1(dXauto)} cm${input.hVigaX ? ` → d = h − rec = ${f1(dX)} cm (h adoptada)` : ""} → h = ${f1(hX)} cm`,
    );
    st.push(`    As_supX = ${f2(As_supX)} cm² | As_infX = ${f2(As_infX)} cm²`);

    // Viga Y: corre en dirección Y, ancho perpendicular = cx
    const bY =
      input.bVigaY && input.bVigaY > 0 ? input.bVigaY : Math.max(cx, 20);
    const MnvY = MuY_volc / 0.9;
    const dYauto = Math.sqrt((6.5 * MnvY) / (bY * fc_kNcm2));
    const dY =
      input.hVigaY && input.hVigaY > cover ? input.hVigaY - cover : dYauto;
    const hY = input.hVigaY && input.hVigaY > 0 ? input.hVigaY : dY + cover;
    const mnY = MnvY / (0.85 * bY * dY * dY * fc_kNcm2);
    const kaY = Math.max(getKaFromMn(mnY), kamin);
    As_supY = (kaY * 0.85 * dY * bY * fc) / fy;
    As_infY = Math.max(As_supY / 3, 2 * aBar(12));
    b_vigaY = bY;
    h_vigaY = hY;

    st.push(
      `E5. Viga Y: b = ${bY} cm${input.bVigaY ? " (adoptado por usuario)" : " = máx(cx,20) (automático)"} | MnvY = MuY / 0.90 = ${f1(MnvY)} kN·cm`,
    );
    st.push(
      `    d = √(6.5·${f1(MnvY)}/(${bY}·${fmt(fc_kNcm2, 3)})) = ${f1(dYauto)} cm${input.hVigaY ? ` → d = h − rec = ${f1(dY)} cm (h adoptada)` : ""} → h = ${f1(hY)} cm`,
    );
    st.push(`    As_supY = ${f2(As_supY)} cm² | As_infY = ${f2(As_infY)} cm²`);
    st.push("");
  } else if (subType === "tensor") {
    const Hx = input.Hx ?? 0;
    const Hy = input.Hy ?? 0;
    tensorPending = Hx <= 0 || Hy <= 0;

    Tux = tensorPending ? 0 : MuX_volc / Hx;
    Tuy = tensorPending ? 0 : MuY_volc / Hy;
    st.push(
      `E3. Tracciones: Tux = MuX / Hx = ${f1(MuX_volc)} / ${Hx} = ${f1(Tux)} kN`,
    );
    st.push(`    Tuy = MuY / Hy = ${f1(MuY_volc)} / ${Hy} = ${f1(Tuy)} kN`);
    st.push("");

    const Rf = input.PD * mu;
    FrictionOK = Rf >= Tux && Rf >= Tuy;
    const fy_kNcm2 = fy * 0.1;
    As_tensorX = tensorPending ? 0 : Tux / (0.9 * fy_kNcm2);
    As_tensorY = tensorPending ? 0 : Tuy / (0.9 * fy_kNcm2);
    if (tensorPending) {
      st.push(
        "E4. Falta ingresar las alturas Hx/Hy de los tensores al fondo de zapata — dimensionar en resultados.",
      );
      er.push(
        "Faltan las alturas de los tensores (Hx, Hy) para dimensionarlos.",
      );
    } else {
      st.push(`E4. Rozamiento: PD·μ = ${f1(input.PD)}·${mu} = ${f1(Rf)} kN`);
      st.push(
        `    Tux = ${f1(Tux)} kN, Tuy = ${f1(Tuy)} kN → ${FrictionOK ? "✓ Rozamiento ≥ Tu" : "✗ Rozamiento < Tu — ADVERTENCIA"}`,
      );
      if (!FrictionOK) {
        wr.push(
          "La fuerza de rozamiento es menor que la tracción en el tensor (en una o ambas direcciones). Aumentar PD o μ.",
        );
      }
      st.push(
        `E5. As_tensorX = ${f1(Tux)} / (0.90·${fmt(fy_kNcm2, 1)}) = ${f2(As_tensorX)} cm²`,
      );
      st.push(
        `    As_tensorY = ${f1(Tuy)} / (0.90·${fmt(fy_kNcm2, 1)}) = ${f2(As_tensorY)} cm²`,
      );
    }

    h_tensorX = Math.max(Lx / 5, 20);
    h_tensorY = Math.max(Ly / 5, 20);
    st.push(
      `E6. Bloques tensor: hX = máx(Lx/5,20) = ${Math.round(h_tensorX)} cm | hY = máx(Ly/5,20) = ${Math.round(h_tensorY)} cm`,
    );

    // Fuerzas de diseño del tronco de columna (columna corta)
    tronco_N = Pu;
    tronco_Mx = MuY_volc;
    tronco_My = MuX_volc;
    tronco_Vx = Tux;
    tronco_Vy = Tuy;
    st.push("");
    st.push(
      "E7. TRONCO DE COLUMNA (columna corta) — fuerzas de diseño para verificación posterior:",
    );
    st.push(
      `    N = ${f1(tronco_N)} kN | Mx = ${f1(tronco_Mx)} kN·cm | My = ${f1(tronco_My)} kN·cm`,
    );
    st.push(`    Vx = ${f1(tronco_Vx)} kN | Vy = ${f1(tronco_Vy)} kN`);
    st.push(
      "    NOTA: el tronco debe verificarse a flexo-compresión biaxial + axial con estas fuerzas.",
    );
    st.push("");
  } else {
    throw new Error(`Subtipo de esquina no reconocido: ${subType}`);
  }

  // Merge: pasos del sistema de equilibrio (arriba) + pasos de la zapata centrada (abajo)
  const mergedSteps = [...st, ...centrada.steps];
  const mergedWarnings = [...wr, ...centrada.warnings];
  const mergedErrors = [...er, ...centrada.errors];

  return {
    ...centrada,
    eX,
    eY,
    MuX_volc,
    MuY_volc,
    Rux,
    Ruy,
    b_vigaX,
    b_vigaY,
    h_vigaX,
    h_vigaY,
    As_supX,
    As_supY,
    As_infX,
    As_infY,
    Tux,
    Tuy,
    As_tensorX,
    As_tensorY,
    h_tensorX,
    h_tensorY,
    tronco_N,
    tronco_Mx,
    tronco_My,
    tronco_Vx,
    tronco_Vy,
    FrictionOK,
    tensorPending,
    steps: mergedSteps,
    warnings: mergedWarnings,
    errors: mergedErrors,
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Altura sugerida de la base (predimensionado por rigidez y flexión).
 * No modifica el input; devuelve la altura útil d y la altura total h.
 */
export function suggestBaseHeight(
  input: BaseInput,
  Lx: number,
  Ly: number,
): {
  d: number;
  h: number;
  method: "rigidez" | "flexión";
  dRig: number;
  dFlex: number;
} {
  const cover = input.cover ?? 7;
  const Pu = step2_Pu(input.PD, input.PL);
  const qu = step4_Qu(Pu, Lx, Ly);
  const { kx, ky, Mux, Muy } = step5_Bending(qu, Lx, Ly, input);
  const { Mnx, Mny } = step6_Nominal(Mux, Muy);

  const { bx, by } = supportWidths(input);
  // Rigidez: d ≥ voladizo / 1.5
  const dRig = Math.max(kx, ky) / 1.5;
  // Flexión: d = √(6.5·Mn / (b·f'c)) con f'c en kN/cm² y b = ancho de apoyo
  const fc_kNcm2 = input.fc * 0.1;
  const dFlex = Math.max(
    Math.sqrt((6.5 * Mnx) / (by * fc_kNcm2)),
    Math.sqrt((6.5 * Mny) / (bx * fc_kNcm2)),
  );
  const d = Math.max(dRig, dFlex);
  const h = Math.max(d + cover, 30);
  return { d, h, method: d === dRig ? "rigidez" : "flexión", dRig, dFlex };
}

/**
 * Sugerencia de dimensiones (Areq, Lx, Ly) y anchos de apoyo (bx, by)
 * para el predimensionado en el formulario. No modifica el input.
 */
export function suggestBaseDims(input: BaseInput): {
  Areq: number;
  Lx: number;
  Ly: number;
  bx: number;
  by: number;
} {
  const dims = step1_Dimensions(input);
  const Lx = input.Lx ?? dims.Lx;
  const Ly = input.Ly ?? dims.Ly;
  const { bx, by } = supportWidths(input);
  return { Areq: dims.Areq, Lx, Ly, bx, by };
}

/**
 * Diseña una base de hormigón armado según CIRSOC 201.
 *
 * @throws Error si los datos de entrada son inválidos (qa ≤ 0, cargas nulas, etc.)
 * @returns BaseResult con dimensiones, armadura, verificaciones y traza de cálculo.
 */
export function designBase(input: BaseInput): BaseResult {
  // Migración: el tipo legado "medianera" era excentricidad en X → medianera-y
  const norm: BaseInput =
    input.type === "medianera" ? { ...input, type: "medianera-y" } : input;
  if (norm.qa <= 0) {
    throw new Error(
      "La tensión admisible del suelo (σadm) debe ser mayor que cero.",
    );
  }
  if (norm.PD + norm.PL <= 0) {
    throw new Error("La carga total (PD + PL) debe ser mayor que cero.");
  }
  if (norm.cx <= 0 || norm.cy <= 0) {
    throw new Error(
      "Las dimensiones de la columna (cx, cy) deben ser mayores que cero.",
    );
  }
  if (norm.fc <= 0 || norm.fy <= 0) {
    throw new Error(
      "Las resistencias de materiales (fc, fy) deben ser mayores que cero.",
    );
  }

  if (norm.type === "centrada") {
    return designCentrada(norm);
  }

  if (norm.type === "medianera-x" || norm.type === "medianera-y") {
    if (!norm.subType) {
      throw new Error(
        "Para base medianera, seleccione viga de fundación o tensor (subType).",
      );
    }
    if (norm.subType === "viga-de-fundacion") {
      return designVigaFundacion(norm);
    }
    if (norm.subType === "tensor") {
      return designTensor(norm);
    }
    throw new Error(`Subtipo de medianera no reconocido: ${norm.subType}`);
  }

  if (norm.type === "esquina") {
    if (!norm.subType) {
      throw new Error(
        "Para base de esquina, seleccione viga de equilibrio o tensor (subType).",
      );
    }
    return designEsquina(norm);
  }

  throw new Error(`Tipo de base no reconocido: ${norm.type}`);
}

/**
 * Envoltorio seguro: nunca lanza excepciones.
 * Devuelve { result, errors } — si hay errores, result es null.
 */
export function tryDesignBase(input: BaseInput): {
  result: BaseResult | null;
  errors: string[];
} {
  try {
    const result = designBase(input);
    return { result, errors: result.errors };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { result: null, errors: [message] };
  }
}
