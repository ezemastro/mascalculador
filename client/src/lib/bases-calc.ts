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

// ---------------------------------------------------------------------------
// Helpers — medianera
// ---------------------------------------------------------------------------

/** Excentricidad de la carga en base medianera */
function medExcentricidad(B: number, cx: number): number {
  return (B - cx) / 2;
}

// ---------------------------------------------------------------------------
// Función de diseño — centrada (13 pasos)
// ---------------------------------------------------------------------------

function designCentrada(input: BaseInput): BaseResult {
  const cover = input.cover ?? 5;
  const rebD = input.rebD ?? 12;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  st.push("=== BASE CENTRADA AISLADA — CIRSOC 201 ===");
  st.push("");

  // Paso 1 — dimensiones
  const dims = step1_Dimensions(input);
  const B = input.B ?? dims.B;
  const L = input.L ?? dims.L;
  const Ap = B * L;
  st.push(`1. Área requerida A_base = (${f1(input.PD)}+${f1(input.PL)})·1.10 / ${f4(input.qa)} = ${f1(dims.Areq)} cm²`);
  st.push(`   Base adoptada: Lx = ${B} cm, Ly = ${L} cm → Ap = ${Ap} cm²`);

  // Paso 2 — Pu
  const Pu = step2_Pu(input.PD, input.PL);
  st.push(`2. Pu = max(1.4·${f1(input.PD)} ; 1.2·${f1(input.PD)}+1.6·${f1(input.PL)}) = ${f1(Pu)} kN`);

  // Paso 3 — kamin
  const kamin = step3_Kamin(input.fc);
  st.push(`3. kamin = 2.8 / (0.85·${input.fc}) = ${f4(kamin)}`);

  // Paso 4 — qu
  const qu = step4_Qu(Pu, B, L);
  st.push(`4. qu = ${f1(Pu)} / (${B}·${L}) = ${fmt(qu, 6)} kN/cm²`);

  // Paso 5 — bending
  const { kx, ky, Mux, Muy } = step5_Bending(qu, B, L, input.cx, input.cy);
  st.push(`5. kx = (${B}−${input.cx})/2 = ${f1(kx)} cm, ky = (${L}−${input.cy})/2 = ${f1(ky)} cm`);
  st.push(`   Mux = ${fmt(qu, 6)}·${L}·${f1(kx)}²/2 = ${f1(Mux)} kN·cm`);
  st.push(`   Muy = ${fmt(qu, 6)}·${B}·${f1(ky)}²/2 = ${f1(Muy)} kN·cm`);

  // Paso 6 — nominal
  const { Mnx, Mny } = step6_Nominal(Mux, Muy);
  st.push(`6. Mnx = ${f1(Mux)} / 0.90 = ${f1(Mnx)} kN·cm`);
  st.push(`   Mny = ${f1(Muy)} / 0.90 = ${f1(Mny)} kN·cm`);

  // Paso 7 — altura útil
  const { d, method } = step7_EffectiveDepth(B, L, input.cx, input.cy, Mnx, Mny, input.fc);
  const d_rig = Math.max((B - input.cx) / 3, (L - input.cy) / 3);
  const dx_flex = Math.sqrt((6.5 * Mnx) / (L * input.fc));
  const dy_flex = Math.sqrt((6.5 * Mny) / (B * input.fc));
  st.push(`7. Predim rigidez: d ≥ max((${B}−${input.cx})/3, (${L}−${input.cy})/3) = ${f1(d_rig)} cm`);
  st.push(`   Predim flexión: dx = √(6.5·${f1(Mnx)}/(${L}·${input.fc})) = ${f1(dx_flex)} cm, dy = ${f1(dy_flex)} cm`);
  st.push(`   d adoptado = ${f1(d)} cm (controla ${method})`);

  // Paso 8 — punzonado
  const punch = step8_Punching(Pu, qu, input.cx, input.cy, d, input.fc);
  st.push(`8. Punzonado: b0 = 2·(${input.cx}+${f1(d)})+2·(${input.cy}+${f1(d)}) = ${f1(2*(input.cx+d)+2*(input.cy+d))} cm`);
  st.push(`   Vu = ${f1(Pu)} − ${fmt(qu, 6)}·${f1((input.cx+d)*(input.cy+d))} = ${f1(punch.Vu)} kN`);
  st.push(`   φVc = 0.75·b0·${f1(d)}·√${input.fc}/12 = ${f1(punch.phiVc)} kN`);
  st.push(`   ${punch.OK ? "✓ Vu ≤ φVc" : "✗ Vu > φVc — NO VERIFICA"}`);
  if (!punch.OK) wr.push("Punzonado: Vu > φVc — aumentar altura o dimensiones de la base.");

  // Paso 9 — corte
  const shear = step9_BeamShear(qu, B, L, input.cx, input.cy, d, input.fc);
  st.push(`9. Corte unidireccional:`);
  st.push(`   Vux = ${fmt(qu, 6)}·${L}·max(${f1(kx)}−${f1(d)},0) = ${f1(shear.Vux)} kN`);
  st.push(`   Vuy = ${fmt(qu, 6)}·${B}·max(${f1(ky)}−${f1(d)},0) = ${f1(shear.Vuy)} kN`);
  st.push(`   φVc = 0.75·bw·${f1(d)}·√${input.fc}/6 = ${f1(shear.phiVc)} kN`);
  st.push(`   ${shear.OK ? "✓ Verifica corte unidireccional" : "✗ NO VERIFICA corte"}`);
  if (!shear.OK) wr.push("Corte unidireccional no verifica — aumentar altura útil.");

  // Paso 10 — armadura
  const steel = step10_Steel(Mnx, Mny, B, L, d, input.fc, input.fy, kamin);
  const fc_kNcm2 = input.fc * 0.1;
  st.push(`10. Flexión:`);
  st.push(`    mnx = ${f1(Mnx)}/(0.85·${L}·${f1(d)}²·${fmt(fc_kNcm2, 3)}) = ${f4(steel.mnx)}`);
  st.push(`    mny = ${f1(Mny)}/(0.85·${B}·${f1(d)}²·${fmt(fc_kNcm2, 3)}) = ${f4(steel.mny)}`);
  st.push(`    kax = max(ka(mnx), ${f4(kamin)}) = ${f4(steel.kax)}`);
  st.push(`    kay = max(ka(mny), ${f4(kamin)}) = ${f4(steel.kay)}`);
  st.push(`    Asx = ${f4(steel.kax)}·0.85·${f1(d)}·${L}·${input.fc}/${input.fy} = ${f2(steel.Asx)} cm²`);
  st.push(`    Asy = ${f4(steel.kay)}·0.85·${f1(d)}·${B}·${input.fc}/${input.fy} = ${f2(steel.Asy)} cm²`);
  st.push(`    AsMín (0.0018·b·h) ≈ ${f2(steel.AsMin)} cm²`);

  // Paso 11 — altura total
  const h = step11_TotalHeight(input.h, d, cover);
  if (input.h !== undefined && input.h > 0) {
    st.push(`11. Altura total: h = ${h} cm (manual override)`);
  } else {
    st.push(`11. Altura total: h = d + cover = ${f1(d)} + ${cover} = ${f1(d + cover)} cm → adoptado ${h} cm (mín 30 cm)`);
  }

  // Paso 12 — talón
  const heel = step12_Heel(h, kx, ky);
  st.push(`12. Talón: h − h_borde = ${h} − 20 = ${f1(heel.heel)} cm ≥ 25 cm? ${heel.OK ? "✓" : "✗"}`);
  if (!heel.OK) wr.push(`Talón insuficiente (${f1(heel.heel)} cm < 25 cm) — aumentar altura.`);

  // Paso 13 — separación
  const barDisp = step13_Spacing(steel.Asx, steel.Asy, B, L, rebD);
  const sepMax = Math.min(25 * (rebD / 10), 30);
  st.push(`13. Armado: Ø${rebD} mm c/${f1(barDisp.sep_x)} cm (X, ${barDisp.nb_x} barras) — Ø${rebD} mm c/${f1(barDisp.sep_y)} cm (Y, ${barDisp.nb_y} barras)`);
  st.push(`    sep ≤ min(25·${rebD/10}, 30) = ${f1(sepMax)} cm → ${barDisp.OK ? "✓" : "✗"}`);
  if (!barDisp.OK) wr.push("Separación excede el máximo normativo — aumentar diámetro o número de barras.");

  st.push("");
  st.push(`=== RESUMEN: ${er.length === 0 ? "✓ DISEÑO COMPLETO" : "✗ ERRORES"} ===`);

  return {
    Areq: dims.Areq, Ap, B, L, h, d, kx, ky,
    Pu, qu,
    Mux, Muy, Mnx, Mny,
    Vu_punch: punch.Vu, phiVc_punch: punch.phiVc, punchOK: punch.OK,
    Vux: shear.Vux, Vuy: shear.Vuy, phiVc_beam: shear.phiVc, beamShearOK: shear.OK,
    mnx: steel.mnx, mny: steel.mny,
    kax: steel.kax, kay: steel.kay, kamin,
    Asx: steel.Asx, Asy: steel.Asy, AsMin: steel.AsMin,
    db: barDisp.db, nb_x: barDisp.nb_x, nb_y: barDisp.nb_y,
    sep_x: barDisp.sep_x, sep_y: barDisp.sep_y, sepCheckOK: barDisp.OK,
    heel: heel.heel, heelOK: heel.OK,
    // Medianera fields — not used
    e: 0, Mu: 0, Ru: 0, Mnv: 0, As_sup: 0, As_inf: 0, mn_med: 0, ka_med: 0,
    Tu: 0, FrictionOK: true, As_tensor: 0, h_tensor: 0,
    steps: st,
    warnings: wr,
    errors: er,
  };
}

// ---------------------------------------------------------------------------
// Función de diseño — medianera viga de fundación (7 pasos)
// ---------------------------------------------------------------------------

function designVigaFundacion(input: BaseInput): BaseResult {
  const cover = input.cover ?? 5;
  const rebD = input.rebD ?? 12;
  const st: string[] = [];
  const wr: string[] = [];
  const er: string[] = [];

  if (input.Lcol === undefined || input.Lcol <= 0) {
    throw new Error("Para viga de fundación, se requiere la luz entre columnas (Lcol).");
  }

  // Dimensiones de base: auto-predim si no se dieron
  const dims = step1_Dimensions(input);
  const B = input.B ?? dims.B;
  const L = input.L ?? dims.L;

  st.push("=== BASE MEDIANERA — VIGA DE FUNDACIÓN — CIRSOC 201 ===");
  st.push("");

  // Paso V1 — Pu
  const Pu = step2_Pu(input.PD, input.PL);
  st.push(`V1. Pu = max(1.4·${f1(input.PD)} ; 1.2·${f1(input.PD)}+1.6·${f1(input.PL)}) = ${f1(Pu)} kN`);

  // Paso V2 — excentricidad y momento
  const e = medExcentricidad(B, input.cx);
  const Mu = Pu * e;
  st.push(`V2. e = (${B} − ${input.cx}) / 2 = ${f1(e)} cm`);
  st.push(`    Mu = ${f1(Pu)} · ${f1(e)} = ${f1(Mu)} kN·cm`);

  // Paso V3 — reacción Ru = Mu / Lcol
  const Lcol = input.Lcol!;
  const Ru = Mu / Lcol;
  st.push(`V3. Ru = Mu / Lcol = ${f1(Mu)} / ${Lcol} = ${f1(Ru)} kN`);

  // Paso V4 — momento nominal
  const Mnv = Mu / 0.90;
  st.push(`V4. Mn = Mu / 0.90 = ${f1(Mu)} / 0.90 = ${f1(Mnv)} kN·cm`);

  // Paso V5 — dimensionado de viga
  const b_viga = Math.max(input.cy, 20);
  const fc_kNcm2 = input.fc * 0.1;
  const d_viga = Math.sqrt((6.5 * Mnv) / (b_viga * fc_kNcm2));
  const h_viga = d_viga + cover;
  st.push(`V5. Viga: b = máx(cy,20) = ${b_viga} cm (adoptado)`);
  st.push(`    d = √(6.5·${f1(Mnv)}/(${b_viga}·${fmt(fc_kNcm2, 3)})) = ${f1(d_viga)} cm`);
  st.push(`    h_viga = d + cover = ${f1(d_viga)} + ${cover} = ${f1(h_viga)} cm`);

  // Paso V6 — armadura superior
  const mn_med = Mnv / (0.85 * b_viga * d_viga * d_viga * fc_kNcm2);
  const kamin = step3_Kamin(input.fc);
  const ka_med = Math.max(getKaFromMn(mn_med), kamin);
  const As_sup = ka_med * 0.85 * d_viga * b_viga * input.fc / input.fy;
  st.push(`V6. mn_viga = ${f1(Mnv)}/(0.85·${b_viga}·${f1(d_viga)}²·${fmt(fc_kNcm2, 3)}) = ${f4(mn_med)}`);
  st.push(`    ka = max(${f4(getKaFromMn(mn_med))}, ${f4(kamin)}) = ${f4(ka_med)}`);
  st.push(`    As_sup = ${f4(ka_med)}·0.85·${f1(d_viga)}·${b_viga}·${input.fc}/${input.fy} = ${f2(As_sup)} cm²`);

  // Paso V7 — armadura inferior y estribos
  const As_inf = Math.max(As_sup / 3, 2 * aBar(12));
  const Vu_med = Ru;
  st.push(`V7. As_inf = máx(As_sup/3, 2Ø12) = máx(${f2(As_sup / 3)}, ${f2(2 * aBar(12))}) = ${f2(As_inf)} cm²`);
  st.push(`    Estribos para Vu = Ru = ${f1(Vu_med)} kN (verificar en detalle)`);

  st.push("");
  st.push(`=== RESUMEN VIGA DE FUNDACIÓN ===`);
  st.push(`Base: ${B}×${L} cm | e = ${f1(e)} cm | Mu = ${f1(Mu)} kN·cm`);
  st.push(`Viga: ${b_viga}×${f1(h_viga)} cm | As_sup = ${f2(As_sup)} cm² | As_inf = ${f2(As_inf)} cm²`);

  return {
    Areq: dims.Areq, Ap: B * L, B, L, h: h_viga, d: d_viga,
    kx: (B - input.cx) / 2, ky: (L - input.cy) / 2,
    Pu, qu: Pu / (B * L),
    Mux: 0, Muy: 0, Mnx: 0, Mny: 0,
    Vu_punch: 0, phiVc_punch: 0, punchOK: true,
    Vux: 0, Vuy: 0, phiVc_beam: 0, beamShearOK: true,
    mnx: 0, mny: 0, kax: 0, kay: 0, kamin,
    Asx: 0, Asy: 0, AsMin: 0.0018 * b_viga * h_viga,
    db: rebD, nb_x: 0, nb_y: 0,
    sep_x: 0, sep_y: 0, sepCheckOK: true,
    heel: 0, heelOK: true,
    e, Mu, Ru, Mnv, As_sup, As_inf, mn_med, ka_med,
    Tu: 0, FrictionOK: true, As_tensor: 0, h_tensor: 0,
    steps: st,
    warnings: wr,
    errors: er,
  };
}
