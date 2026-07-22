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
