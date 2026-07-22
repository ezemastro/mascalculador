// bases-calc.ts — Dimensionado de bases de hormigón armado según CIRSOC 201
//
// Implementa los procedimientos normativos para:
//   - Base centrada aislada (13 pasos)
//   - Base medianera con viga de fundación (7 pasos)
//   - Base medianera con tensor (6 pasos)
//
// Unidades del contrato público:
//   kN/cm² → qa (tensión admisible del suelo)
//   MPa    → fc, fy (materiales)
//   kN     → PD, PL, Pu
//   cm     → cx, cy, B, L, h, d, Df, Lcol, H
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

export type BaseType = "centrada" | "medianera";
export type MedianeraSubType = "viga-de-fundacion" | "tensor";

export interface BaseInput {
  // Suelo
  qa: number;                         // kN/cm² — tensión admisible del suelo
  Df: number;                         // cm — profundidad de fundación
  // Cargas
  PD: number;                         // kN — carga muerta
  PL: number;                         // kN — carga viva
  // Columna
  cx: number;                         // cm — lado X de la columna
  cy: number;                         // cm — lado Y de la columna
  // Materiales
  fc: number;                         // MPa — resistencia del hormigón
  fy: number;                         // MPa — tensión de fluencia del acero
  // Tipo
  type: BaseType;
  subType?: MedianeraSubType;        // solo si type === "medianera"
  // Overrides manuales de geometría
  B?: number;                         // cm — ancho de la base (overrride)
  L?: number;                         // cm — largo de la base (override)
  h?: number;                         // cm — altura total (override)
  // Medianera extras
  Lcol?: number;                      // cm — luz entre columnas (viga de fundación)
  H?: number;                         // cm — altura del tensor
  mu?: number;                        // — coeficiente de fricción (default 0.4)
  // Armado
  cover?: number;                     // cm — recubrimiento (default 5)
  rebD?: number;                      // mm — diámetro de barra (default 12)
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

function f1(n: number): string { return fmt(n, 1); }
function f2(n: number): string { return fmt(n, 1); }
function f4(n: number): string { return fmt(n, 4); }

/** Área de una barra de diámetro db (mm) en cm² */
function aBar(db: number): number {
  return (Math.PI * db * db / 4) / 100;
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
  const keys = Object.keys(MN_KA_TABLE).map(Number).sort((a, b) => a - b);
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
function step1_Dimensions(input: BaseInput): { Areq: number; B: number; L: number } {
  // Areq = (PD + PL) * 1.10 / qa   (factor 1.10 = peso propio + tierra)
  const Areq = ((input.PD + input.PL) * 1.10) / input.qa;
  // Base cuadrada por defecto
  const side = Math.ceil(Math.sqrt(Areq) / 5) * 5;
  const B = Math.max(side, input.cx + 20);
  const L = Math.max(side, input.cy + 20);
  return { Areq, B, L };
}

/** Paso 2: Carga última Pu = max(1.4·PD, 1.2·PD + 1.6·PL) */
function step2_Pu(PD: number, PL: number): number {
  return Math.max(1.4 * PD, 1.2 * PD + 1.6 * PL);
}

/** Paso 3: Cuantía mecánica mínima kamin = 2.8 / (0.85·fc) */
function step3_Kamin(fc: number): number {
  return 2.8 / (0.85 * fc);
}

/** Paso 4: Presión de contacto qu = Pu / (B·L)  [kN/cm²] */
function step4_Qu(Pu: number, B: number, L: number): number {
  return Pu / (B * L);
}

/** Paso 5: Voladizos y momentos flectores */
function step5_Bending(
  qu: number, B: number, L: number, cx: number, cy: number,
): { kx: number; ky: number; Mux: number; Muy: number } {
  const kx = (B - cx) / 2;
  const ky = (L - cy) / 2;
  // Mux = qu · L · kx² / 2  (momento respecto al eje X, kN·cm)
  // Muy = qu · B · ky² / 2  (momento respecto al eje Y, kN·cm)
  const Mux = qu * L * (kx * kx) / 2;
  const Muy = qu * B * (ky * ky) / 2;
  return { kx, ky, Mux, Muy };
}

/** Paso 6: Momentos nominales Mn = Mu / φ  con φ = 0.90 */
function step6_Nominal(
  Mux: number, Muy: number,
): { Mnx: number; Mny: number } {
  return { Mnx: Mux / 0.90, Mny: Muy / 0.90 };
}

export interface BaseResult {
  // Geometría
  Areq: number; Ap: number; B: number; L: number; h: number; d: number;
  kx: number; ky: number;
  // Cargas
  Pu: number; qu: number;
  // Centrada — flexión
  Mux: number; Muy: number; Mnx: number; Mny: number;
  // Punzonado
  Vu_punch: number; phiVc_punch: number; punchOK: boolean;
  // Corte unidireccional
  Vux: number; Vuy: number; phiVc_beam: number; beamShearOK: boolean;
  // Armadura
  mnx: number; mny: number;
  kax: number; kay: number; kamin: number;
  Asx: number; Asy: number; AsMin: number;
  // Barras
  db: number; nb_x: number; nb_y: number;
  sep_x: number; sep_y: number; sepCheckOK: boolean;
  // Talón
  heel: number; heelOK: boolean;
  // Medianera — viga de fundación
  e: number;                          // cm — excentricidad
  Mu: number;                         // kN·cm — momento volcador
  Ru: number;                         // kN — reacción de viga
  Mnv: number;                        // kN·cm — momento nominal viga
  As_sup: number;                     // cm² — armadura superior viga
  As_inf: number;                     // cm² — armadura inferior viga
  mn_med: number;                     // mn viga
  ka_med: number;                     // ka viga
  // Medianera — tensor
  Tu: number;                         // kN — tracción en tensor
  FrictionOK: boolean;               // verificación rozamiento
  As_tensor: number;                  // cm² — armadura tensor
  h_tensor: number;                   // cm — altura bloque tensor
  // Traza
  steps: string[];                   // registro paso a paso
  warnings: string[];                // advertencias no bloqueantes
  errors: string[];                  // errores de validación
}
