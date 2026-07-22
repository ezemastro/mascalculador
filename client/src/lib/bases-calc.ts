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

/** Paso 7: Altura útil — rigidez + predimensionado por flexión */
function step7_EffectiveDepth(
  B: number, L: number, cx: number, cy: number,
  Mnx: number, Mny: number, fc: number,
): { d: number; method: string } {
  // Predim por rigidez (conservador)
  const d_rig = Math.max((B - cx) / 3, (L - cy) / 3);
  // Predim por flexión (empírico): d = sqrt(6.5·Mn / (b·fc))
  const dx_flex = Math.sqrt((6.5 * Mnx) / (L * fc));
  const dy_flex = Math.sqrt((6.5 * Mny) / (B * fc));
  const d_flex = Math.max(dx_flex, dy_flex);

  const d = Math.max(d_rig, d_flex);
  const method = d === d_rig ? "rigidez" : "flexión";
  return { d, method };
}

/** Paso 8: Verificación al punzonado
 *  Vu = Pu − qu·A0  donde A0 = (cx+d)·(cy+d)
 *  φVc = 0.75 · b0 · d · √fc / 12   con b0 = 2·(cx+d) + 2·(cy+d) */
function step8_Punching(
  Pu: number, qu: number, cx: number, cy: number, d: number, fc: number,
): { Vu: number; phiVc: number; OK: boolean } {
  const b0 = 2 * (cx + d) + 2 * (cy + d);
  const A0 = (cx + d) * (cy + d);
  const Vu = Pu - qu * A0;
  const phiVc = 0.75 * b0 * d * Math.sqrt(fc) / 12;
  return { Vu, phiVc, OK: Vu <= phiVc };
}

/** Paso 9: Verificación a corte unidireccional
 *  Vux = qu · L · max(kx − d, 0)
 *  Vuy = qu · B · max(ky − d, 0)
 *  φVc = 0.75 · bw · d · √fc / 6 */
function step9_BeamShear(
  qu: number, B: number, L: number,
  cx: number, cy: number, d: number, fc: number,
): { Vux: number; Vuy: number; phiVc: number; OK: boolean } {
  const kx = (B - cx) / 2;
  const ky = (L - cy) / 2;
  const Vux = qu * L * Math.max(kx - d, 0);
  const Vuy = qu * B * Math.max(ky - d, 0);

  const bw_x = L;
  const bw_y = B;
  const phiVc_x = 0.75 * bw_x * d * Math.sqrt(fc) / 6;
  const phiVc_y = 0.75 * bw_y * d * Math.sqrt(fc) / 6;
  const phiVc = Math.min(phiVc_x, phiVc_y);
  const OK = Vux <= phiVc_x && Vuy <= phiVc_y;
  return { Vux, Vuy, phiVc, OK };
}

/** Paso 10: Armadura de flexión */
function step10_Steel(
  Mnx: number, Mny: number,
  B: number, L: number, d: number,
  fc: number, fy: number, kamin: number,
): {
  mnx: number; mny: number;
  kax: number; kay: number;
  Asx: number; Asy: number; AsMin: number;
} {
  // mn = Mn / (0.85·b·d²·fc) con fc en kN/cm² → fc*0.1
  const fc_kNcm2 = fc * 0.1;
  const mnx = Mnx / (0.85 * L * d * d * fc_kNcm2);
  const mny = Mny / (0.85 * B * d * d * fc_kNcm2);

  const kax = Math.max(getKaFromMn(mnx), kamin);
  const kay = Math.max(getKaFromMn(mny), kamin);

  // As = ka · 0.85 · d · b · fc_kNcm2 / fy_kNcm2  →  fc/fy cancelan el 0.1
  const Asx = kax * 0.85 * d * L * fc / fy;
  const Asy = kay * 0.85 * d * B * fc / fy;

  // Armadura mínima: 0.0018 · b · h  (aprox con h ≈ d+5)
  const AsMin = 0.0018 * Math.max(B, L) * (d + 5);

  return { mnx, mny, kax, kay, Asx, Asy, AsMin };
}

/** Paso 11: Altura total h = d + cover, mínimo 30 cm */
function step11_TotalHeight(
  h_override: number | undefined, d: number, cover: number,
): number {
  if (h_override !== undefined && h_override > 0) return h_override;
  return Math.max(d + cover, 30);
}

/** Paso 12: Talón troncopiramidal
 *  El borde de la zapata debe tener al menos 20 cm de espesor.
 *  La diferencia h − h_borde ≥ 25 cm asegura pendiente adecuada. */
function step12_Heel(h: number, _kx: number, _ky: number): { heel: number; OK: boolean } {
  const hBorde = 20; // cm — espesor mínimo en el borde
  const heel = h - hBorde;
  return { heel, OK: heel >= 25 };
}

/** Paso 13: Separación de barras */
function step13_Spacing(
  Asx: number, Asy: number, B: number, L: number, rebD: number,
): {
  db: number; nb_x: number; nb_y: number;
  sep_x: number; sep_y: number; OK: boolean;
} {
  const db = rebD;
  const areaBar = aBar(db); // cm²

  const nb_x = Math.max(2, Math.ceil(Asx / areaBar));
  const nb_y = Math.max(2, Math.ceil(Asy / areaBar));

  // Separación centro a centro: (L − 2·cover) / (n − 1) con cover = 5 cm
  const sep_x = (B - 10) / (nb_x - 1);
  const sep_y = (L - 10) / (nb_y - 1);

  // Límite: sep ≤ min(25·db, 30 cm) con db en mm → 25·(db/10) cm
  const sepMax = Math.min(25 * (db / 10), 30);
  const OK = sep_x <= sepMax && sep_y <= sepMax;
  return { db, nb_x, nb_y, sep_x, sep_y, OK };
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
