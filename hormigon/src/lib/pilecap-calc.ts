// Cabezal sobre pilotes — método de bielas y tirantes (CIRSOC 201-05, ACI 318
// Cap. 23 para el modelo de tirantes; nervaduras de cortante según CIRSOC).
//
// Tipos de cabezal:
//  - "rect2":     2 pilotes, cabezal rectangular (columna centrada).
//  - "linea3":    3 pilotes en línea, cabezal rectangular (columna sobre el
//                 pilote central).
//  - "triangulo": 3 pilotes en triángulo equilátero, cabezal triangular.
//
// La columna se supone centrada respecto del grupo de pilotes → reacciones
// iguales. Fuerzas del modelo: biela comprimida columna→pilote, tirante
// inferior entre pilotes. Unidades: kN, cm, MPa.

import { BAR_AREA_MM2 } from "./computo";

export type PileCapTipo = "rect2" | "linea3" | "triangulo";

export interface PileCapInput {
  PD: number; // kN — carga muerta de columna
  PL: number; // kN — carga viva de columna
  Qp: number; // kN — capacidad del pilote (carga de servicio)
  nPilotes: 2 | 3;
  tipo: PileCapTipo;
  cx: number; // cm — columna en la dirección de los pilotes
  cy: number; // cm — columna transversal
  Dp: number; // cm — diámetro del pilote
  s: number; // cm — separación entre ejes de pilotes
  Lx?: number; // cm — cabezal rectangular: largo (dirección de pilotes)
  Ly?: number; // cm — cabezal rectangular: ancho
  lado?: number; // cm — cabezal triangular: lado del triángulo
  h?: number; // cm — altura del cabezal
  fc: number;
  fy: number;
  cover?: number;
}

export interface PileCapCheck {
  Vu: number;
  phiVc: number;
  OK: boolean;
  b0?: number;
  F?: number;
  nota?: string;
}

export interface PileCapResult {
  input: PileCapInput;
  Pu: number; // kN — columna factorizada
  W: number; // kN — peso propio del cabezal
  PuTot: number; // kN — 1.2·W + Pu
  Pserv: number; // kN — PD + PL + W
  n: number;
  Rserv: number; // kN/pilote — reacción de servicio
  Rp: number; // kN/pilote — reacción última
  capGrupo: number; // kN — capacidad real del grupo = n·Qp
  capOK: boolean;
  L1: number; // cm — dimensión en planta dirección de pilotes (o lado)
  L2: number; // cm — dimensión transversal (o lado)
  areaPlan: number; // cm²
  d: number; // cm — altura útil
  a: number; // cm — distancia horizontal columna→pilote (proyección de biela)
  thetaDeg: number; // ° — ángulo biela-tirante desde la horizontal
  thetaOK: boolean;
  C: number; // kN — fuerza de biela
  wS: number; // cm — ancho de biela en el nudo del pilote
  bDisp: number; // cm — ancho de cabezal transversal a la biela
  sigmaC: number; // MPa
  sigmaCLim: number; // MPa
  bielaOK: boolean;
  sigmaCol: number; // MPa — nudo columna (CCC)
  sigmaColLim: number;
  nodoColOK: boolean;
  sigmaPil: number; // MPa — nudo pilote (CCT)
  sigmaPilLim: number;
  nodoPilOK: boolean;
  T: number; // kN — tracción del tirante
  AsTie: number; // cm² — por tirante
  AsMin: number; // cm²
  AsNec: number; // cm²
  barD: number; // mm
  barN: number;
  AsProv: number; // cm²
  armadura: string;
  tieOK: boolean;
  ld: number; // cm — desarrollo recto
  ldc: number; // cm — desarrollo con gancho 90°
  anclaje: number; // cm — largo disponible desde el eje del pilote
  anclajeOK: boolean; // alcanza recto
  anclajeGanchoOK: boolean; // alcanza con gancho
  punCol: PileCapCheck;
  punPil: PileCapCheck;
  corte: PileCapCheck | null; // solo cabezales rectangulares con voladizo
  vueloLong: number; // cm — cara de pilote → borde, dirección de pilotes
  vueloPerp: number; // cm — cara de pilote → borde, transversal
  vueloOK: boolean;
  sepGrupoOK: boolean; // s ≥ 2.5·Dp (recomendación de grupo)
  steps: string[];
  warnings: string[];
  allOK: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}
function f1(n: number): string {
  return fmt(n, 1);
}
function f2(n: number): string {
  return fmt(n, 2);
}

const PHI_C = 0.75; // hormigón (bielas, nudos, cortante)
const PHI_S = 0.9; // acero (tirantes)
const BETA_S = 0.75; // biela embotellada sin refuerzo de superficie
const GAMMA_H = 25e-6; // kN/cm³ — peso específico del hormigón

function punzonar(
  Vu: number,
  b0: number,
  d: number,
  fc: number,
  beta: number,
  alphaS: number,
): PileCapCheck {
  // CIRSOC 201-05 §11.11.2: φVc = 0.75·F·b0·d·√f'c/120 (kN·cm)
  const F1 = Math.min(4, 2 + 4 / beta);
  const F2 = (alphaS * d) / b0 + 2;
  const F = Math.min(F1, F2);
  const phiVc = (PHI_C * F * b0 * d * Math.sqrt(fc)) / 120;
  return { Vu, phiVc, OK: Vu <= phiVc, b0, F };
}

/** Diámetro + cantidad de barras para un As requerido (cm²). */
function elegirBarras(AsNec: number): {
  barD: number;
  barN: number;
  AsProv: number;
} {
  let best = {
    barD: 25,
    barN: Math.ceil(AsNec / (BAR_AREA_MM2[25] / 100)),
    AsProv: 0,
  };
  for (const diam of [12, 16, 20, 25]) {
    const area = BAR_AREA_MM2[diam] / 100; // cm²
    const n = Math.ceil(AsNec / area);
    if (n >= 2 && n <= 10) {
      best = { barD: diam, barN: n, AsProv: n * area };
      break;
    }
  }
  if (best.AsProv === 0)
    best.AsProv = best.barN * (BAR_AREA_MM2[best.barD] / 100);
  return best;
}

// ---------------------------------------------------------------------------
// Diseño
// ---------------------------------------------------------------------------

export function designPileCap(input: PileCapInput): PileCapResult {
  const n = input.nPilotes;
  const tipo = input.tipo;
  if (tipo === "rect2" && n !== 2)
    throw new Error("El tipo rect2 corresponde a 2 pilotes.");
  if (tipo !== "rect2" && n !== 3)
    throw new Error("Los tipos linea3 y triangulo corresponden a 3 pilotes.");

  const h = input.h ?? 0;
  const cover = input.cover ?? 7;
  const L1 = tipo === "triangulo" ? (input.lado ?? 0) : (input.Lx ?? 0);
  const L2 = tipo === "triangulo" ? (input.lado ?? 0) : (input.Ly ?? 0);
  const s = input.s;
  const Dp = input.Dp;
  const { cx, cy, fc, fy } = input;

  if (!(input.PD > 0 || input.PL > 0))
    throw new Error("Ingresá la carga de columna (PD y/o PL).");
  if (!(input.Qp > 0)) throw new Error("Ingresá la capacidad del pilote.");
  if (!(Dp > 0 && s > 0))
    throw new Error("Ingresá el diámetro y la separación de pilotes.");
  if (!(cx > 0 && cy > 0))
    throw new Error("Ingresá las dimensiones de la columna.");
  if (!(L1 > 0 && L2 > 0)) {
    throw new Error(
      tipo === "triangulo"
        ? "Ingresá el lado del cabezal triangular."
        : "Ingresá las dimensiones en planta del cabezal (Lx y Ly).",
    );
  }
  if (!(h > 0)) throw new Error("Ingresá la altura del cabezal.");
  if (s <= Dp)
    throw new Error(
      "La separación entre ejes debe superar el diámetro del pilote.",
    );

  const st: string[] = [];
  const warnings: string[] = [];

  st.push(`=== CABEZAL SOBRE PILOTES — BIELAS Y TIRANTES (CIRSOC 201-05) ===`);
  st.push(
    `Tipo: ${tipo === "rect2" ? "rectangular, 2 pilotes" : tipo === "linea3" ? "rectangular, 3 pilotes en línea" : "triangular, 3 pilotes en triángulo"}`,
  );
  st.push("");

  // ── Paso 1: cargas y combinación ────────────────────────────────────────
  const areaPlan =
    tipo === "triangulo" ? (Math.sqrt(3) / 4) * L1 * L1 : L1 * L2;
  const W = areaPlan * h * GAMMA_H;
  const Pu = Math.max(1.4 * input.PD, 1.2 * input.PD + 1.6 * input.PL);
  const PuTot = Pu + 1.2 * W;
  const Pserv = input.PD + input.PL + W;

  st.push("1. Cargas de columna y combinación");
  st.push(
    `   Pu = máx(1.4·${f1(input.PD)} ; 1.2·${f1(input.PD)}+1.6·${f1(input.PL)}) = ${f1(Pu)} kN`,
  );
  st.push(
    `   Peso propio W = Área·h·γH = ${f1(areaPlan)}·${f1(h)}·25·10⁻⁶ = ${f1(W)} kN`,
  );
  st.push(`   Pu,total = Pu + 1.2·W = ${f1(PuTot)} kN`);
  st.push(`   Servicio total = PD + PL + W = ${f1(Pserv)} kN`);

  // ── Paso 2: reacciones y capacidad real ─────────────────────────────────
  const Rserv = Pserv / n;
  const Rp = PuTot / n;
  const capGrupo = n * input.Qp;
  const capOK = Rserv <= input.Qp;

  st.push("");
  st.push("2. Reacciones y capacidad real de los pilotes");
  st.push(
    `   Reacción de servicio por pilote: R = (PD+PL+W)/${n} = ${f1(Rserv)} kN`,
  );
  st.push(`   Reacción última por pilote: Rp = Pu,total/${n} = ${f1(Rp)} kN`);
  st.push(
    `   Capacidad real del grupo = ${n}·Qpilote = ${f1(capGrupo)} kN vs demanda de servicio ${f1(Pserv)} kN → ${capOK ? "✓ cumple" : "✗ NO cumple"}`,
  );
  if (!capOK) {
    st.push(
      `   → Faltan pilotes o su capacidad es insuficiente: R = ${f1(Rserv)} kN > Qpilote = ${f1(input.Qp)} kN`,
    );
  }

  // ── Paso 3: geometría del modelo ────────────────────────────────────────
  const d = h - cover - 2.5; // recubrimiento + lazo inferior (Ø25/2 + Ø12/2 aprox)
  const a = tipo === "rect2" ? s / 2 : tipo === "linea3" ? s : s / Math.sqrt(3);
  const thetaDeg = (Math.atan(d / a) * 180) / Math.PI;
  const thetaOK = thetaDeg >= 25;

  st.push("");
  st.push("3. Geometría del modelo de bielas y tirantes");
  st.push(
    `   Planta: ${tipo === "triangulo" ? `triángulo equilátero de lado ${f1(L1)} cm` : `${f1(L1)} × ${f1(L2)} cm`} → A = ${f1(areaPlan)} cm²`,
  );
  st.push(
    `   d = h − recub − 2.5 = ${f1(h)} − ${f1(cover)} − 2.5 = ${f2(d)} cm`,
  );
  st.push(
    `   a (columna→pilote) = ${tipo === "rect2" ? `s/2 = ${f1(s)}/2` : tipo === "linea3" ? `s = ${f1(s)}` : `s/√3 = ${f1(s)}/√3`} = ${f2(a)} cm`,
  );
  st.push(
    `   θ = atan(d/a) = atan(${f2(d)}/${f2(a)}) = ${f1(thetaDeg)}° ${thetaOK ? "✓ ≥ 25°" : "✗ < 25° → aumentar h o reducir s"}`,
  );

  // ── Paso 4: bielas ──────────────────────────────────────────────────────
  const sinTheta = d / Math.sqrt(a * a + d * d);
  const C = Rp / sinTheta;
  const wS = Math.min(Dp, tipo === "triangulo" ? Math.min(cx, cy) : cy);
  const bDisp = tipo === "triangulo" ? L1 / Math.sqrt(3) : L2;
  const sigmaC = C / (wS * bDisp);
  const sigmaCLim = PHI_C * 0.85 * BETA_S * fc;
  const bielaOK = sigmaC <= sigmaCLim;

  st.push("");
  st.push("4. Compresión en las bielas");
  st.push(
    `   C = Rp/sen θ = ${f1(Rp)}/${fmt(sinTheta, 3)} = ${f1(C)} kN (por cada biela)`,
  );
  st.push(
    `   Ancho de biela en el nudo: ws = mín(Dpilote; ${tipo === "triangulo" ? "mín(cx;cy)" : "cy"}) = mín(${f1(Dp)}; ${f1(wS)}) = ${f1(wS)} cm`,
  );
  st.push(
    `   Ancho disponible de cabezal: b = ${f1(bDisp)} cm ${tipo === "triangulo" ? "(2·apotemas = lado/√3)" : ""}`,
  );
  st.push(
    `   σ = C/(ws·b) = ${f1(C)}/(${f1(wS)}·${f1(bDisp)}) = ${f2(sigmaC)} MPa`,
  );
  st.push(
    `   Límite = φ·0.85·βs·f'c = 0.75·0.85·0.75·${fc} = ${f2(sigmaCLim)} MPa (βs = 0.75, biela embotellada) → ${bielaOK ? "✓ cumple" : "✗ NO cumple"}`,
  );

  // ── Paso 5: nudos ───────────────────────────────────────────────────────
  const sigmaCol = PuTot / (cx * cy);
  const sigmaColLim = PHI_C * 0.85 * 1.0 * fc;
  const nodoColOK = sigmaCol <= sigmaColLim;
  const areaPil = (Math.PI * Dp * Dp) / 4;
  const sigmaPil = Rp / areaPil;
  const sigmaPilLim = PHI_C * 0.85 * 0.8 * fc;
  const nodoPilOK = sigmaPil <= sigmaPilLim;

  st.push("");
  st.push("5. Presiones en los nudos");
  st.push(
    `   Nudo columna (CCC): σ = Pu,total/(cx·cy) = ${f1(PuTot)}/(${f1(cx)}·${f1(cy)}) = ${f2(sigmaCol)} MPa ≤ φ·0.85·1.0·f'c = ${f2(sigmaColLim)} MPa → ${nodoColOK ? "✓" : "✗"}`,
  );
  st.push(
    `   Nudo pilote (CCT): σ = Rp/Apilote = ${f1(Rp)}/${f1(areaPil)} cm² = ${f2(sigmaPil)} MPa ≤ φ·0.85·0.80·f'c = ${f2(sigmaPilLim)} MPa (βn = 0.80) → ${nodoPilOK ? "✓" : "✗"}`,
  );

  // ── Paso 6: tirantes ────────────────────────────────────────────────────
  const T = tipo === "triangulo" ? (Rp * a) / (Math.sqrt(3) * d) : (Rp * a) / d;
  const AsTie = T / (PHI_S * fy * 0.1); // fy MPa → 0.1·fy kN/cm²
  const bTie = tipo === "triangulo" ? L1 / (2 * Math.sqrt(3)) : L2;
  const AsMin = 0.0018 * bTie * h;
  const AsNec = Math.max(AsTie, AsMin);
  const { barD, barN, AsProv } = elegirBarras(AsNec);
  const armadura = `${barN} Ø${barD}`;
  const tieOK = AsProv >= AsNec - 1e-9;

  st.push("");
  st.push("6. Tracción en los tirantes");
  st.push(
    tipo === "triangulo"
      ? `   Nudo del pilote: H = Rp·a/d = ${f1(Rp)}·${f2(a)}/${f2(d)} = ${f1((Rp * a) / d)} kN → T = H/√3 por cada lado = ${f1(T)} kN`
      : `   T = Rp·a/d = ${f1(Rp)}·${f2(a)}/${f2(d)} = ${f1(T)} kN ${tipo === "linea3" ? "(por cada mitad, desde el pilote exterior)" : ""}`,
  );
  st.push(
    `   As = T/(φ·fy) = ${f1(T)}/(0.90·${f1(fy * 0.1)}) = ${f2(AsTie)} cm²`,
  );
  st.push(
    `   As mín (retracción) = 0.0018·${f1(bTie)}·${f1(h)} = ${f2(AsMin)} cm² ${tipo === "triangulo" ? "(ancho tributario = apotema lado/(2√3))" : ""}`,
  );
  st.push(
    `   As nec = ${f2(AsNec)} cm² → ${armadura} por tirante (As prov = ${f2(AsProv)} cm²) ${tieOK ? "✓" : "✗"}`,
  );

  // ── Paso 7: anclaje de los tirantes ─────────────────────────────────────
  const dbMM = barD;
  const ldMM =
    dbMM <= 19
      ? (fy * dbMM) / (6.3 * Math.sqrt(fc))
      : (fy * dbMM) / (5 * Math.sqrt(fc));
  const ldcMM =
    dbMM >= 16
      ? (0.24 * fy * dbMM) / Math.sqrt(fc)
      : (0.19 * fy * dbMM) / Math.sqrt(fc);
  const ld = ldMM / 10;
  const ldc = ldcMM / 10;
  const anclaje =
    tipo === "rect2"
      ? L1 / 2 - s / 2
      : tipo === "linea3"
        ? L1 / 2 - s
        : (L1 - s) / 2;
  const anclajeOK = anclaje >= ld;
  const anclajeGanchoOK = anclaje >= ldc;

  st.push("");
  st.push("7. Anclaje de los tirantes sobre los pilotes");
  st.push(
    `   ld (recta, Ø${barD}) = ${f1(ld)} cm ; ldc (gancho 90°) = ${f1(ldc)} cm`,
  );
  st.push(
    `   Disponible desde el eje del pilote al borde: ${f1(anclaje)} cm → ${anclajeOK ? "✓ alcanza recto" : anclajeGanchoOK ? "△ recto no alcanza: gancho estándar 90° al final" : "✗ ni recto ni gancho: acortar s, alargar L1 o reducir Ø"}`,
  );

  // ── Paso 8: punzonado de la columna ─────────────────────────────────────
  const b0Col = 2 * (cx + d) + 2 * (cy + d);
  const betaCol = Math.max(cx, cy) / Math.min(cx, cy);
  let dentroCol = 0;
  if (tipo === "linea3") dentroCol += 1; // pilote central siempre bajo la columna
  const limRad = (Math.max(cx, cy) + d) / 2;
  const outerInside = a < limRad; // centro del pilote dentro del perímetro
  if (outerInside) {
    if (tipo === "triangulo") dentroCol += 3;
    else dentroCol += 2; // par simétrico (rect2 y linea3)
  }
  const vuCol = Math.max(0, PuTot - dentroCol * Rp);
  const punCol = punzonar(vuCol, b0Col, d, fc, betaCol, 40);

  st.push("");
  st.push("8. Punzonado de la columna sobre el cabezal");
  st.push(
    `   Perímetro crítico a d/2 de la cara: b0 = 2·(${f1(cx)}+${f2(d)}) + 2·(${f1(cy)}+${f2(d)}) = ${f1(b0Col)} cm`,
  );
  st.push(
    dentroCol > 0
      ? `   Vu = Pu,total − ${dentroCol}·Rp (pilote(s) dentro del perímetro) = ${f1(vuCol)} kN`
      : `   Vu = Pu,total = ${f1(vuCol)} kN (pilotes fuera del perímetro crítico)`,
  );
  st.push(
    `   β = ${f2(betaCol)} → F = mín(4 ; 2+4/β ; 40·d/b0+2) = ${f2(punCol.F ?? 0)}`,
  );
  st.push(
    `   φVc = 0.75·F·b0·d·√f'c/120 = ${f1(punCol.phiVc)} kN → ${punCol.OK ? "✓ cumple" : "✗ NO cumple"}`,
  );

  // ── Paso 9: punzonado de cada pilote ────────────────────────────────────
  const b0Pil = Math.PI * (Dp + d);
  const punPil = punzonar(Rp, b0Pil, d, fc, 1, 40);

  st.push("");
  st.push(
    "9. Punzonado de cada pilote (estampado del pilote sobre el cabezal)",
  );
  st.push(
    `   Perímetro a d/2 de la cara del pilote: b0 = π·(Dpilote+d) = π·(${f1(Dp)}+${f2(d)}) = ${f1(b0Pil)} cm`,
  );
  st.push(
    `   Vu = Rp = ${f1(Rp)} kN (conservador: toda la reacción fuera del perímetro)`,
  );
  st.push(
    `   φVc = 0.75·F·b0·d·√f'c/120 con F = ${f2(punPil.F ?? 0)} → ${f1(punPil.phiVc)} kN → ${punPil.OK ? "✓ cumple" : "✗ NO cumple"}`,
  );

  // ── Paso 10: corte unidireccional en el voladizo (solo rectangulares) ───
  let corte: PileCapCheck | null = null;
  if (tipo !== "triangulo") {
    const vueloCorte = a - Dp / 2 - d / 2 - cx / 2;
    if (vueloCorte > 0) {
      const phiVc = (PHI_C * L2 * d * Math.sqrt(fc)) / 60;
      corte = {
        Vu: Rp,
        phiVc,
        OK: Rp <= phiVc,
        nota: "Sección crítica a d/2 de la cara del pilote (CIRSOC 201-05 §15.5.2)",
      };
      st.push("");
      st.push("10. Corte unidireccional en el voladizo columna–pilote");
      st.push(
        `   Sección crítica a d/2 de la cara del pilote: Vu = Rp = ${f1(Rp)} kN`,
      );
      st.push(
        `   φVc = 0.75·bw·d·√f'c/60 con bw = ${f1(L2)} cm → ${f1(phiVc)} kN → ${corte.OK ? "✓ cumple" : "✗ NO cumple"}`,
      );
    } else {
      corte = {
        Vu: 0,
        phiVc: 0,
        OK: true,
        nota: "La sección crítica a d/2 de la cara del pilote cae dentro de la columna: no hay voladizo a cortar",
      };
      st.push("");
      st.push(
        "10. Corte unidireccional: la sección crítica cae dentro de la columna → no requiere",
      );
    }
  } else {
    st.push("");
    st.push(
      "10. Corte unidireccional: en cabezales triangulares el modelo de bielas y el punzonado de pilotes gobiernan la verificación",
    );
  }

  // ── Paso 11: geometría y detalles ───────────────────────────────────────
  const vueloLong =
    tipo === "rect2"
      ? L1 / 2 - s / 2 - Dp / 2
      : tipo === "linea3"
        ? L1 / 2 - s - Dp / 2
        : (L1 - s) / Math.sqrt(3) - Dp / 2;
  const vueloPerp =
    tipo === "triangulo"
      ? ((L1 - s) * Math.sqrt(3)) / 6 - Dp / 2
      : L2 / 2 - Dp / 2;
  const vueloOK = vueloLong >= 15 && vueloPerp >= 15;
  const sepGrupoOK = s >= 2.5 * Dp;

  st.push("");
  st.push("11. Geometría y detalles");
  st.push(
    `   Vuelo cara de pilote → borde: ${f1(vueloLong)} cm (dir. pilotes) y ${f1(vueloPerp)} cm (transversal) → ${vueloOK ? "✓ ≥ 15 cm" : "⚠ se recomienda ≥ 15 cm"}`,
  );
  st.push(
    `   Separación entre pilotes s = ${f1(s)} cm vs 2.5·Dpilote = ${f1(2.5 * Dp)} cm → ${sepGrupoOK ? "✓" : "⚠ verificar eficiencia de grupo"}`,
  );

  // ── Avisos y estado global ──────────────────────────────────────────────
  if (!thetaOK)
    warnings.push(
      `Ángulo de biela θ = ${f1(thetaDeg)}° < 25°: aumentá la altura h o reducí la separación s.`,
    );
  if (!vueloOK)
    warnings.push(
      "Vuelo del cabezal menor a 15 cm desde la cara del pilote: ajustá las dimensiones en planta.",
    );
  if (!sepGrupoOK)
    warnings.push(
      `Separación s = ${f1(s)} cm < 2.5·Dpilote: verificá la eficiencia de grupo en el estudio geotécnico.`,
    );
  if (!anclajeOK && anclajeGanchoOK)
    warnings.push(
      `El desarrollo recto (ld = ${f1(ld)} cm) no alcanza: colocar gancho estándar 90° en los extremos (ldc = ${f1(ldc)} cm ≤ ${f1(anclaje)} cm).`,
    );

  const allOK =
    capOK &&
    thetaOK &&
    bielaOK &&
    nodoColOK &&
    nodoPilOK &&
    tieOK &&
    (anclajeOK || anclajeGanchoOK) &&
    punCol.OK &&
    punPil.OK &&
    (corte?.OK ?? true);

  st.push("");
  st.push(
    `=== RESUMEN: ${allOK ? "✓ TODAS LAS VERIFICACIONES CUMPLEN" : "✗ HAY VERIFICACIONES QUE NO CUMPLEN"} ===`,
  );

  return {
    input,
    Pu,
    W,
    PuTot,
    Pserv,
    n,
    Rserv,
    Rp,
    capGrupo,
    capOK,
    L1,
    L2,
    areaPlan,
    d,
    a,
    thetaDeg,
    thetaOK,
    C,
    wS,
    bDisp,
    sigmaC,
    sigmaCLim,
    bielaOK,
    sigmaCol,
    sigmaColLim,
    nodoColOK,
    sigmaPil,
    sigmaPilLim,
    nodoPilOK,
    T,
    AsTie,
    AsMin,
    AsNec,
    barD,
    barN,
    AsProv,
    armadura,
    tieOK,
    ld,
    ldc,
    anclaje,
    anclajeOK,
    anclajeGanchoOK,
    punCol,
    punPil,
    corte,
    vueloLong,
    vueloPerp,
    vueloOK,
    sepGrupoOK,
    steps: st,
    warnings,
    allOK,
  };
}
